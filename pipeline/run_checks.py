"""Verification gates over the Gold store (and, from T-14, the static export).

Usage: python -m pipeline.run_checks [--db PATH] [--bronze DIR]

Each check prints one line and the process exits 1 if any fails.
"""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from pipeline.adapters import plenary_xml
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.export import DEFAULT_OUT

SAMPLE_SIZE = 40


@dataclass
class Check:
    name: str
    failures: list[str]

    @property
    def ok(self) -> bool:
        return not self.failures


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
    orphans = conn.execute(
        "SELECT count(*) FROM debate_contributions c LEFT JOIN members m ON m.id = c.member_id WHERE m.id IS NULL"
    ).fetchone()[0]
    if orphans:
        failures.append(f"{orphans} contributions name no known Member")
    return Check("referential integrity", failures)


def check_static_verbatim(conn: sqlite3.Connection, bronze: Path, static: Path, sample_size: int = SAMPLE_SIZE,
                          seed: int = 0) -> Check:
    """A random sample of exported contributions: text_original equals Gold, and Gold equals the Bronze XML."""
    name = "exported speech text equals Gold and Bronze"
    if not (static / "sittings" / "index.json").exists():
        return Check(name, [f"no static export at {static}"])
    failures: list[str] = []
    ids = [r[0] for r in conn.execute("SELECT id FROM debate_contributions ORDER BY id")]
    sample = set(random.Random(seed).sample(ids, min(sample_size, len(ids))))
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


def run_all(conn: sqlite3.Connection, bronze: Path = plenary_xml.PLENARY_BRONZE, static: Path | None = DEFAULT_OUT) -> list[Check]:
    checks = [
        check_referential(conn),
        check_meeting_start_time(conn),
        check_record_published_at(conn),
        check_no_derived_end_in_gold(conn),
        check_start_pos_matches_bronze(conn, bronze),
    ]
    if static is not None:
        checks.append(check_static_verbatim(conn, bronze, static))
    return checks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--bronze", default=str(plenary_xml.PLENARY_BRONZE))
    parser.add_argument("--static", default=str(DEFAULT_OUT), help="exported JSON to audit; 'none' skips it")
    args = parser.parse_args(argv)
    conn = create_connection(args.db, read_only=True)
    try:
        checks = run_all(conn, Path(args.bronze), None if args.static == "none" else Path(args.static))
    finally:
        conn.close()
    for c in checks:
        print(f"[{'ok' if c.ok else 'FAIL'}] {c.name}")
        for f in c.failures[:20]:
            print(f"       {f}")
        if len(c.failures) > 20:
            print(f"       ... {len(c.failures) - 20} more")
    return 0 if all(c.ok for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
