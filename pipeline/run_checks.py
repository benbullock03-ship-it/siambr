"""Verification gates over the Gold store, the static export and the live Record.

Usage: python -m pipeline.run_checks [--db PATH] [--bronze DIR] [--sample N] [--offline]

Each check prints one line and the process exits 1 if any fails. The live check is the
only network call; when Senedd cannot be reached it reports "source unavailable" and passes.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import requests

from pipeline import senedd_tv
from pipeline.adapters import plenary_votes, plenary_xml
from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.export import DEFAULT_OUT

SAMPLE_SIZE = 40


@dataclass
class Check:
    name: str
    failures: list[str]
    notes: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failures


def _sample_ids(conn: sqlite3.Connection, sample_size: int, seed: int) -> set[str]:
    ids = [r[0] for r in conn.execute("SELECT id FROM debate_contributions ORDER BY id")]
    return set(random.Random(seed).sample(ids, min(sample_size, len(ids))))


def _sessions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, session_date, xml_sha256, meeting_start_time, record_published_at FROM plenary_sessions ORDER BY session_date"
    ).fetchall()


def check_meeting_start_time(conn: sqlite3.Connection) -> Check:
    missing = [s["id"] for s in _sessions(conn) if not s["meeting_start_time"]]
    return Check("every session has meeting_start_time", [f"{sid}: no meeting_start_time" for sid in missing])


def check_record_published_at(conn: sqlite3.Connection) -> Check:
    missing = [s["id"] for s in _sessions(conn) if not s["record_published_at"]]
    return Check("every session has record_published_at", [f"{sid}: no record_published_at" for sid in missing])


def check_no_derived_end_in_gold(conn: sqlite3.Connection) -> Check:
    n = conn.execute("SELECT count(*) FROM debate_contributions WHERE video_timestamp_end IS NOT NULL").fetchone()[0]
    return Check("no contribution carries video_timestamp_end in Gold", [f"{n} rows have video_timestamp_end"] if n else [])


def bronze_for(session: sqlite3.Row, bronze: Path) -> Path | None:
    meeting_id = session["id"].removeprefix("plenary-")
    candidates = sorted(bronze.glob(f"*/{session['session_date']}-{meeting_id}.xml"))
    return candidates[0] if candidates else None


def check_start_pos_matches_bronze(conn: sqlite3.Connection, bronze: Path) -> Check:
    """Every timed contribution's startPos in Gold equals the published query value byte-for-byte."""
    failures: list[str] = []
    for session in _sessions(conn):
        path = bronze_for(session, bronze)
        if path is None:
            failures.append(f"{session['id']}: no Bronze transcript")
            continue
        body = path.read_bytes()
        if plenary_xml.sha256(body) != session["xml_sha256"]:
            failures.append(f"{session['id']}: Bronze checksum differs from Gold")
            continue
        published = {f"contribution-{r.contribution_id}": plenary_xml.raw_start_pos(r.spoken_tv_url)
                     for r in plenary_xml.parse_transcript(body)}
        rows = conn.execute(
            """SELECT c.id, c.video_timestamp_start FROM debate_contributions c
               JOIN agenda_items a ON a.id = c.agenda_item_id WHERE a.session_id = ?""",
            (session["id"],),
        ).fetchall()
        for cid, start in rows:
            raw = published.get(cid)
            if start is None:
                if raw is not None and raw.isdigit():
                    failures.append(f"{cid}: Gold untimed but Senedd published startPos={raw}")
            elif raw != str(start):
                failures.append(f"{cid}: Gold startPos {start} but Senedd published {raw!r}")
    return Check("every timed startPos equals the Bronze XML byte-for-byte", failures)


def check_referential(conn: sqlite3.Connection) -> Check:
    failures = [f"foreign key violation in {row[0]} rowid {row[1]}" for row in conn.execute("PRAGMA foreign_key_check")]
    # A contribution names a Member on the register, or carries the publisher's own label for a
    # speaker the Record attributed to nobody (migration 011). Anything else has no speaker at all.
    orphans = conn.execute(
        """SELECT count(*) FROM debate_contributions c
           WHERE (c.member_id IS NULL OR c.member_id NOT IN (SELECT id FROM members))
             AND COALESCE(c.speaker_name, '') = ''"""
    ).fetchone()[0]
    if orphans:
        failures.append(f"{orphans} contributions name neither a known Member nor a publisher label")
    return Check("referential integrity", failures)


def check_static_verbatim(conn: sqlite3.Connection, bronze: Path, static: Path, sample_size: int = SAMPLE_SIZE,
                          seed: int = 0) -> Check:
    """A random sample of exported contributions: text_original equals Gold, and Gold equals the Bronze XML."""
    name = "exported speech text equals Gold and Bronze"
    if not (static / "sittings" / "index.json").exists():
        return Check(name, [f"no static export at {static}"])
    failures: list[str] = []
    sample = _sample_ids(conn, sample_size, seed)
    seen: set[str] = set()
    for session in _sessions(conn):
        path = static / "sittings" / f"{session['session_date']}.json"
        if not path.exists():
            failures.append(f"{session['id']}: no {path.name} in the export")
            continue
        exported = {c["id"]: c for c in json.loads(path.read_text(encoding="utf-8"))["contributions"]}
        bronze_path = bronze_for(session, bronze)
        published = {}
        if bronze_path is not None:
            published = {f"contribution-{r.contribution_id}": plenary_xml.html_to_text(r.verbatim_html)
                         for r in plenary_xml.parse_transcript(bronze_path.read_bytes())}
        for cid, original, english, start in conn.execute(
            """SELECT c.id, c.verbatim_text_original, c.verbatim_text_english, c.video_timestamp_start
               FROM debate_contributions c JOIN agenda_items a ON a.id = c.agenda_item_id WHERE a.session_id = ?""",
            (session["id"],),
        ):
            if cid not in sample:
                continue
            seen.add(cid)
            row = exported.get(cid)
            if row is None:
                failures.append(f"{cid}: missing from {path.name}")
                continue
            if row["text_original"] != original or row["text_english"] != english:
                failures.append(f"{cid}: exported text differs from Gold")
            if row["t_start"] != start:
                failures.append(f"{cid}: exported t_start {row['t_start']} differs from Gold {start}")
            if bronze_path is not None and published.get(cid) != original:
                failures.append(f"{cid}: Gold text differs from Bronze XML")
    for cid in sorted(sample - seen):
        failures.append(f"{cid}: not reached by any session")
    return Check(name, failures)


def fetch_live(url: str) -> bytes:
    """The live transcript, never cached and never written to Bronze."""
    return fetch(url, retries=2, timeout=30.0)


def _speeches(body: bytes) -> dict[str, tuple[str, str | None]]:
    return {f"contribution-{r.contribution_id}": (plenary_xml.html_to_text(r.verbatim_html), plenary_xml.raw_start_pos(r.spoken_tv_url))
            for r in plenary_xml.parse_transcript(body)}


def check_live_verbatim(conn: sqlite3.Connection, bronze: Path, static: Path, sample_size: int = SAMPLE_SIZE,
                        seed: int = 0, fetch_xml: Callable[[str], bytes] = fetch_live) -> Check:
    """Sampled contributions diffed byte-for-byte across the live XML, Bronze, Gold and the export.

    A meeting whose live XML cannot be fetched is reported in ``notes`` and does not fail.
    """
    name = "sampled speeches equal the live Senedd XML, Bronze, Gold and the export"
    if not (static / "sittings" / "index.json").exists():
        return Check(name, [f"no static export at {static}"])
    failures: list[str] = []
    notes: list[str] = []
    sample = _sample_ids(conn, sample_size, seed)
    by_session: dict[str, list[sqlite3.Row]] = {}
    for row in conn.execute(
        """SELECT c.id, c.verbatim_text_original, c.video_timestamp_start, a.session_id
           FROM debate_contributions c JOIN agenda_items a ON a.id = c.agenda_item_id ORDER BY c.id"""
    ):
        if row["id"] in sample:
            by_session.setdefault(row["session_id"], []).append(row)
    sessions = {s["id"]: s for s in _sessions(conn)}
    for session_id, rows in sorted(by_session.items()):
        session = sessions[session_id]
        url = plenary_xml.download_url(int(session_id.removeprefix("plenary-")))
        try:
            body = fetch_xml(url)
            if b"<dataroot" not in body[:500]:
                raise SourceUnavailable("no transcript in the response")
        except (SourceUnavailable, requests.RequestException, OSError) as e:
            notes.append(f"{session_id}: source unavailable ({e}); {len(rows)} sampled speeches not checked live")
            continue
        live = _speeches(body)
        bronze_path = bronze_for(session, bronze)
        mirrored: dict[str, tuple[str, str | None]] = {}
        if bronze_path is None:
            failures.append(f"{session_id}: no Bronze transcript")
        else:
            mirrored = _speeches(bronze_path.read_bytes())
        path = static / "sittings" / f"{session['session_date']}.json"
        if not path.exists():
            failures.append(f"{session_id}: no {path.name} in the export")
            continue
        sitting = json.loads(path.read_text(encoding="utf-8"))
        exported = {c["id"]: c for c in sitting["contributions"]}
        if sitting.get("record_published_at") != session["record_published_at"]:
            failures.append(f"{session_id}: exported record_published_at {sitting.get('record_published_at')!r} "
                            f"differs from Gold {session['record_published_at']!r}")
        live_published = plenary_xml.record_published_at(body)
        if live_published != session["record_published_at"]:
            notes.append(f"{session_id}: Senedd now publishes generated={live_published}, Gold holds {session['record_published_at']}")
        for row in rows:
            cid = row["id"]
            gold_text, gold_start = row["verbatim_text_original"], row["video_timestamp_start"]
            if cid not in live:
                failures.append(f"{cid}: not in the live XML")
                continue
            live_text, live_raw = live[cid]
            live_start = int(live_raw) if live_raw and live_raw.isdigit() else None
            if live_text != gold_text:
                failures.append(f"{cid}: live XML text differs from Gold")
            if live_start != gold_start:
                failures.append(f"{cid}: live startPos {live_raw!r} differs from Gold {gold_start!r}")
            if mirrored and mirrored.get(cid) != live[cid]:
                failures.append(f"{cid}: Bronze differs from the live XML")
            out = exported.get(cid)
            if out is None:
                failures.append(f"{cid}: missing from {path.name}")
            elif out["text_original"] != gold_text or out["t_start"] != gold_start:
                failures.append(f"{cid}: export differs from Gold")
    return Check(name, failures, notes)


def _published_streams(conn: sqlite3.Connection, static: Path) -> tuple[list[tuple[dict, str | None]], list[str]]:
    """One (stream, exported url) per sitting and feed; each stream carries the feed's Gold url and vbegin."""
    out, missing = [], []
    for s in conn.execute("SELECT * FROM plenary_sessions ORDER BY session_date"):
        path = static / "sittings" / f"{s['session_date']}.json"
        if not path.exists():
            missing.append(f"{s['id']}: no {path.name} in the export")
            continue
        sitting = json.loads(path.read_text(encoding="utf-8"))
        for feed, (_, url_col, vbegin_col) in senedd_tv.FEEDS.items():
            stream = {"id": s["id"], "feed": url_col, "session_date": s["session_date"],
                      "meeting_start_time": s["meeting_start_time"], "url": s[url_col], "vbegin": s[vbegin_col]}
            out.append((stream, sitting.get(url_col)))
    return out, missing


def check_stream_gate(conn: sqlite3.Connection, static: Path) -> Check:
    """An exported stream url is Gold's, only where it can be placed on the sitting clock, and its
    exported offset is the measured gap between the stream's first segment and the Record's start."""
    name = "exported stream urls pass the alignment gate"
    published, failures = _published_streams(conn, static)
    for s, url in published:
        offset = senedd_tv.stream_offset_s(s["vbegin"], s["session_date"], s["meeting_start_time"])
        expected = s["url"] if offset is not None else None
        if url != expected:
            failures.append(f"{s['id']}: exported {s['feed']} {url!r}, gate gives {expected!r}")
            continue
        exported = static / "sittings" / f"{s['session_date']}.json"
        if not exported.exists():
            continue
        sitting = json.loads(exported.read_text(encoding="utf-8"))
        key = "stream_offset_s" if s["feed"] == "stream_url" else "stream_offset_verbatim_s"
        if sitting.get(key) != offset:
            failures.append(f"{s['id']}: exported {key} {sitting.get(key)!r}, measured {offset!r}")
    return Check(name, failures)


def check_live_streams(conn: sqlite3.Connection, static: Path, sample_size: int = SAMPLE_SIZE, seed: int = 0,
                       get: Callable[[str], bytes] | None = None) -> Check:
    """Sampled published streams: the master still answers and its first segment still starts where Gold says.

    A stream that cannot be fetched is reported in ``notes`` and does not fail.
    """
    name = "sampled published streams still start at the sitting start"
    get = get or senedd_tv.http_get
    published, failures = _published_streams(conn, static)
    live = [s for s, url in published if url]
    notes: list[str] = []
    for s in random.Random(seed).sample(live, min(sample_size, len(live))):
        try:
            master = get(s["url"])
            vbegin = senedd_tv.first_segment_time(get(senedd_tv.first_variant_url(master, s["url"])))
        except (SourceUnavailable, requests.RequestException, OSError) as e:
            notes.append(f"{s['id']}: {s['feed']} source unavailable ({e}); stream not checked live")
            continue
        if vbegin is None or abs(vbegin - s["vbegin"]) > 0.001:
            failures.append(f"{s['id']}: live {s['feed']} first segment at {vbegin}, Gold holds {s['vbegin']}")
        elif not senedd_tv.is_aligned(vbegin, s["session_date"], s["meeting_start_time"]):
            failures.append(f"{s['id']}: live {s['feed']} no longer aligned with the sitting start")
    return Check(name, failures, notes)


def check_divisions(conn: sqlite3.Connection, bronze: Path) -> Check:
    """Every division's member votes sum to its published tally, and its motion text is the Bronze Votes text."""
    failures: list[str] = []
    for session in _sessions(conn):
        divisions = conn.execute(
            """SELECT d.* FROM division_votes d JOIN agenda_items a ON a.id = d.agenda_item_id
               WHERE a.session_id = ? ORDER BY d.id""",
            (session["id"],),
        ).fetchall()
        if not divisions:
            continue
        tail = session["id"].rsplit("-", 1)[-1]
        path = bronze / session["session_date"][:4] / f"{session['session_date']}-{tail}-votes.xml"
        published = {d.id: d for d in plenary_votes.parse_votes(path.read_bytes())} if path.exists() else {}
        if not published:
            failures.append(f"{session['id']}: divisions in Gold but no Bronze Votes document")
        for d in divisions:
            counts = {row["vote_cast"]: row["n"] for row in conn.execute(
                "SELECT vote_cast, count(*) AS n FROM member_votes WHERE division_id = ? GROUP BY vote_cast", (d["id"],)
            )}
            stated = (d["votes_for"], d["votes_against"], d["votes_abstain"])
            got = (counts.get("for", 0), counts.get("against", 0), counts.get("abstain", 0))
            if got != stated:
                failures.append(f"{d['id']}: member votes {got} do not sum to the published tally {stated}")
            src = published.get(d["id"])
            if src is not None and src.motion_text_en != d["motion_text"]:
                failures.append(f"{d['id']}: motion text differs from the Bronze Votes document")
    return Check("division tallies equal their member votes and motion text equals Bronze", failures)


def run_all(conn: sqlite3.Connection, bronze: Path = plenary_xml.PLENARY_BRONZE, static: Path | None = DEFAULT_OUT,
            sample_size: int = SAMPLE_SIZE, live: bool = False,
            fetch_xml: Callable[[str], bytes] = fetch_live) -> list[Check]:
    checks = [
        check_referential(conn),
        check_meeting_start_time(conn),
        check_record_published_at(conn),
        check_no_derived_end_in_gold(conn),
        check_start_pos_matches_bronze(conn, bronze),
        check_divisions(conn, bronze),
    ]
    if static is not None:
        checks.append(check_static_verbatim(conn, bronze, static, sample_size))
        checks.append(check_stream_gate(conn, static))
        if live:
            checks.append(check_live_verbatim(conn, bronze, static, sample_size, fetch_xml=fetch_xml))
            checks.append(check_live_streams(conn, static, sample_size))
    return checks


def report(checks: list[Check]) -> str:
    lines = []
    for c in checks:
        lines.append(f"[{'ok' if c.ok else 'FAIL'}] {c.name}")
        for f in c.failures[:20]:
            lines.append(f"       {f}")
        if len(c.failures) > 20:
            lines.append(f"       ... {len(c.failures) - 20} more")
        for n in c.notes:
            lines.append(f"       note: {n}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--bronze", default=str(plenary_xml.PLENARY_BRONZE))
    parser.add_argument("--static", default=str(DEFAULT_OUT), help="exported JSON to audit; 'none' skips it")
    parser.add_argument("--sample", type=int, default=SAMPLE_SIZE, help="contributions sampled by the verbatim checks")
    parser.add_argument("--offline", action="store_true", help="skip the live Senedd XML fetch")
    args = parser.parse_args(argv)
    conn = create_connection(args.db, read_only=True)
    try:
        checks = run_all(conn, Path(args.bronze), None if args.static == "none" else Path(args.static),
                         sample_size=args.sample, live=not args.offline)
    finally:
        conn.close()
    text = report(checks)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("### run_checks\n\n```\n" + text + "\n```\n")
    return 0 if all(c.ok for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
