"""Gold to Static: write the JSON the site ships (siambr-spec.md 8.2).

Usage: python -m pipeline.export [--db PATH] [--out frontend/static/data]

Deterministic: sorted keys, two-space indent, stable ordering, no wall-clock stamps. An
unchanged database produces byte-identical files. Everything derived (t_end_derived, policy
domain, party at date) is labelled so; speech text is copied from Gold untouched.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from pipeline.db import DEFAULT_DB_PATH, REPO_ROOT, create_connection

DEFAULT_OUT = REPO_ROOT / "frontend" / "static" / "data"
PROVENANCE_DERIVED = "PROVENANCE_DERIVED"


def dump(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    # Leave an unchanged file alone so its mtime, and any sync watching it, stays quiet.
    if path.exists() and path.read_bytes() == data:
        return
    path.write_bytes(data)


def rows(conn: sqlite3.Connection, sql: str, params=()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params)]


def party_on(tenures: list[dict], date: str) -> str | None:
    live = [t for t in tenures if t["start_date"] <= date and (t["end_date"] is None or t["end_date"] >= date)]
    return max(live, key=lambda t: t["start_date"])["party_id"] if live else None


def role_on(roles: list[dict], date: str) -> dict | None:
    live = [r for r in roles if r["start_date"] <= date and (r["end_date"] is None or r["end_date"] >= date)]
    return max(live, key=lambda r: r["start_date"]) if live else None


def meeting_id_of(session_id: str) -> int | None:
    """'plenary-16086' -> 16086; fixture or legacy IDs without a numeric suffix give None."""
    tail = session_id.rsplit("-", 1)[-1]
    return int(tail) if tail.isdigit() else None


class Exporter:
    def __init__(self, conn: sqlite3.Connection, out: Path):
        self.conn = conn
        self.out = out
        self.written: set[Path] = set()
        self.members = {m["id"]: m for m in rows(conn, "SELECT * FROM members ORDER BY id")}
        self.tenures: dict[str, list[dict]] = defaultdict(list)
        for t in rows(conn, "SELECT * FROM member_tenures ORDER BY member_id, start_date, id"):
            self.tenures[t["member_id"]].append(t)
        self.roles: dict[str, list[dict]] = defaultdict(list)
        for r in rows(conn, "SELECT * FROM ministerial_roles ORDER BY member_id, start_date, id"):
            self.roles[r["member_id"]].append(r)
        self.terms = rows(conn, "SELECT * FROM parliamentary_terms ORDER BY term")
        self.current_term = max((t for t in self.terms if t["end_date"] is None), key=lambda t: t["term"], default=self.terms[-1])
        self.domains = rows(conn, "SELECT id, name_en, name_cy FROM policy_domains ORDER BY id")
        self.sessions = rows(conn, "SELECT * FROM plenary_sessions ORDER BY session_date, id")
        dates = [s["session_date"] for s in self.sessions]
        if len(dates) != len(set(dates)):
            raise ValueError("two plenary sessions share a date; the static contract keys sittings by date")

    # --- shared shapes -------------------------------------------------------------------------

    def member_light(self, member_id: str, date: str | None = None) -> dict:
        m = self.members[member_id]
        tenures = self.tenures[member_id]
        tenure = None
        if date:
            live = [t for t in tenures if t["start_date"] <= date and (t["end_date"] is None or t["end_date"] >= date)]
            tenure = max(live, key=lambda t: t["start_date"]) if live else None
        else:
            open_ = [t for t in tenures if t["end_date"] is None]
            tenure = max(open_, key=lambda t: t["start_date"]) if open_ else (tenures[-1] if tenures else None)
        role = role_on(self.roles[member_id], date) if date else None
        return {
            "id": m["id"],
            "canonical_name": m["canonical_name"],
            "cymraeg_name": m["cymraeg_name"],
            "honorific": m["honorific"],
            "party_id": tenure["party_id"] if tenure else None,
            "constituency_name_en": m["constituency_name_en"],
            "constituency_name_cy": m["constituency_name_cy"],
            "gss_constituency_code": m["gss_constituency_code"],
            "is_regional_member": bool(tenure["is_regional_member"]) if tenure else False,
            "region_name": tenure["region_name"] if tenure else None,
            "portrait_url": m["portrait_url"],
            "official_profile_url": m["official_profile_url"],
            "current_status": m["current_status"],
            "role_title_en": role["title_en"] if role else None,
            "role_title_cy": role["title_cy"] if role else None,
        }

    def current_member_ids(self) -> list[str]:
        term = self.current_term["term"]
        ids = [mid for mid, ts in self.tenures.items() if any(t["senedd_term"] == term and t["end_date"] is None for t in ts)]
        return sorted(ids)

    # --- sittings ------------------------------------------------------------------------------

    def sitting(self, s: dict) -> dict:
        items = rows(self.conn, "SELECT * FROM agenda_items WHERE session_id = ? ORDER BY item_order, id", (s["id"],))
        contributions = rows(
            self.conn,
            """SELECT c.* FROM debate_contributions c JOIN agenda_items a ON a.id = c.agenda_item_id
               WHERE a.session_id = ? ORDER BY a.item_order, c.sequence_number, c.id""",
            (s["id"],),
        )
        clip_by_item = {i["id"]: i["senedd_tv_clip_url"] for i in items}
        timed = [c["video_timestamp_start"] for c in contributions if c["video_timestamp_start"] is not None]
        out_contribs = []
        for c in contributions:
            start = c["video_timestamp_start"]
            end = None
            if start is not None:
                later = [t for t in timed if t > start]
                end = min(later) if later else None
            clip = clip_by_item.get(c["agenda_item_id"])
            out_contribs.append({
                "id": c["id"],
                "item_id": c["agenda_item_id"],
                "seq": c["sequence_number"],
                "member_id": c["member_id"],
                "lang": c["spoken_language"],
                "text_original": c["verbatim_text_original"],
                "text_english": c["verbatim_text_english"],
                "t_start": start,
                "t_end_derived": end,
                "tv_url": f"{clip}?startPos={start}" if clip and start is not None else clip,
            })
        counts: dict[str, int] = defaultdict(int)
        for c in contributions:
            counts[c["agenda_item_id"]] += 1
        divisions = []
        for d in rows(self.conn,
                      """SELECT d.* FROM division_votes d JOIN agenda_items a ON a.id = d.agenda_item_id
                         WHERE a.session_id = ? ORDER BY a.item_order, d.id""", (s["id"],)):
            votes = rows(self.conn, "SELECT member_id, vote_cast FROM member_votes WHERE division_id = ? ORDER BY member_id", (d["id"],))
            divisions.append({
                "id": d["id"],
                "item_id": d["agenda_item_id"],
                "motion_text": d["motion_text"],
                "votes_for": d["votes_for"],
                "votes_against": d["votes_against"],
                "votes_abstain": d["votes_abstain"],
                "casting_vote": d["casting_vote"],
                "result": d["result"],
                "votes": {v["member_id"]: v["vote_cast"] for v in votes},
            })
        speaker_ids = sorted({c["member_id"] for c in contributions} | {mid for d in divisions for mid in d["votes"]})
        return {
            "date": s["session_date"],
            "id": s["id"],
            "meeting_id": meeting_id_of(s["id"]),
            "term": s["senedd_term"],
            "title_en": s["title_en"],
            "title_cy": s["title_cy"],
            "presiding_officer_id": s["presiding_officer_id"],
            "source_xml_url": s["source_xml_url"],
            "xml_sha256": s["xml_sha256"],
            "record_published_at": s["record_published_at"],
            "meeting_start_time": s["meeting_start_time"],
            "clip_url": next((i["senedd_tv_clip_url"] for i in items if i["senedd_tv_clip_url"]), None),
            "items": [{
                "id": i["id"],
                "order": i["item_order"],
                "type": i["item_type"],
                "title_en": i["title_en"],
                "title_cy": i["title_cy"],
                "policy_domain_id": i["policy_domain_id"],
                "classification_provenance": PROVENANCE_DERIVED,
                "clip_url": i["senedd_tv_clip_url"],
                "origin_type": i["origin_type"],
                "origin_ref_id": i["origin_ref_id"],
                "contribution_count": counts[i["id"]],
            } for i in items],
            "contributions": out_contribs,
            "divisions": divisions,
            "speakers": {mid: self.member_light(mid, s["session_date"]) for mid in speaker_ids},
            # What Siambr derived rather than copied: the record carries none of these.
            "provenance": {
                "t_end_derived": PROVENANCE_DERIVED,
                "items.policy_domain_id": PROVENANCE_DERIVED,
                "items.type": PROVENANCE_DERIVED,
                "speakers.party_id": PROVENANCE_DERIVED,
                "speakers.role_title_en": PROVENANCE_DERIVED,
            },
        }

    def sittings_index(self) -> list[dict]:
        index = []
        for s in self.sessions:
            items = rows(self.conn, "SELECT * FROM agenda_items WHERE session_id = ? ORDER BY item_order, id", (s["id"],))
            speakers = defaultdict(set)
            for r in self.conn.execute(
                """SELECT c.agenda_item_id, c.member_id FROM debate_contributions c
                   JOIN agenda_items a ON a.id = c.agenda_item_id WHERE a.session_id = ?""", (s["id"],)):
                speakers[r["agenda_item_id"]].add(r["member_id"])
            n = self.conn.execute(
                """SELECT count(*) FROM debate_contributions c JOIN agenda_items a ON a.id = c.agenda_item_id
                   WHERE a.session_id = ?""", (s["id"],)).fetchone()[0]
            index.append({
                "date": s["session_date"],
                "id": s["id"],
                "meeting_id": meeting_id_of(s["id"]),
                "term": s["senedd_term"],
                "title_en": s["title_en"],
                "title_cy": s["title_cy"],
                "source_xml_url": s["source_xml_url"],
                "record_published_at": s["record_published_at"],
                "meeting_start_time": s["meeting_start_time"],
                "item_count": len(items),
                "contribution_count": n,
                "items": [{
                    "id": i["id"],
                    "order": i["item_order"],
                    "type": i["item_type"],
                    "title_en": i["title_en"],
                    "title_cy": i["title_cy"],
                    "policy_domain_id": i["policy_domain_id"],
                    "classification_provenance": PROVENANCE_DERIVED,
                    "speaker_ids": sorted(speakers[i["id"]]),
                } for i in items],
            })
        return sorted(index, key=lambda x: x["date"], reverse=True)

    # --- members -------------------------------------------------------------------------------

    def member_file(self, member_id: str) -> dict:
        m = self.members[member_id]
        speeches = rows(
            self.conn,
            """SELECT c.id, c.agenda_item_id, a.title_en, s.session_date, c.spoken_language,
                      c.verbatim_text_original, c.verbatim_text_english, c.video_timestamp_start,
                      a.item_order, c.sequence_number, a.senedd_tv_clip_url
               FROM debate_contributions c
               JOIN agenda_items a ON a.id = c.agenda_item_id
               JOIN plenary_sessions s ON s.id = a.session_id
               WHERE c.member_id = ?
               ORDER BY s.session_date DESC, a.item_order, c.sequence_number, c.id""",
            (member_id,),
        )
        by_date: dict[str, list[dict]] = {}
        for sp in speeches:
            by_date.setdefault(sp["session_date"], []).append({
                "id": sp["id"],
                "item_id": sp["agenda_item_id"],
                "item_title_en": sp["title_en"],
                "t_start": sp["video_timestamp_start"],
                "tv_url": (
                    f"{sp['senedd_tv_clip_url']}?startPos={sp['video_timestamp_start']}"
                    if sp["senedd_tv_clip_url"] and sp["video_timestamp_start"] is not None
                    else sp["senedd_tv_clip_url"]
                ),
                "lang": sp["spoken_language"],
                "text_original": sp["verbatim_text_original"],
                "text_english": sp["verbatim_text_english"],
            })
        ballots = rows(
            self.conn,
            """SELECT v.division_id, v.vote_cast, d.agenda_item_id, d.motion_text, d.result, a.title_en, s.session_date
               FROM member_votes v
               JOIN division_votes d ON d.id = v.division_id
               JOIN agenda_items a ON a.id = d.agenda_item_id
               JOIN plenary_sessions s ON s.id = a.session_id
               WHERE v.member_id = ?
               ORDER BY s.session_date DESC, a.item_order, d.id""",
            (member_id,),
        )
        return {
            **self.member_light(member_id),
            "tenures": [{
                "senedd_term": t["senedd_term"],
                "party_id": t["party_id"],
                "party_label": t["party_label"],
                "party_provenance": t["party_provenance"],
                "is_regional_member": bool(t["is_regional_member"]),
                "region_name": t["region_name"],
                "seat_name": t["seat_name"],
                "seat_gss_code": t["seat_gss_code"],
                "start_date": t["start_date"],
                "end_date": t["end_date"],
                "source_url": t["source_url"],
            } for t in self.tenures[member_id]],
            "roles": [{
                "title_en": r["title_en"],
                "title_cy": r["title_cy"],
                "cabinet_level": r["cabinet_level"],
                "start_date": r["start_date"],
                "end_date": r["end_date"],
                "start_date_precision": r["start_date_precision"],
                "provenance": r["provenance"],
                "source_url": r["source_url"],
            } for r in self.roles[member_id]],
            "contribution_count": len(speeches),
            "contributions_by_date": [{"date": d, "contributions": cs} for d, cs in by_date.items()],
            "ballots": [{
                "division_id": b["division_id"],
                "item_id": b["agenda_item_id"],
                "item_title_en": b["title_en"],
                "date": b["session_date"],
                "motion_text": b["motion_text"],
                "result": b["result"],
                "vote_cast": b["vote_cast"],
            } for b in ballots],
        }

    # --- terms ---------------------------------------------------------------------------------

    def term_file(self, t: dict) -> dict:
        officers = rows(self.conn,
                        "SELECT * FROM presiding_officers WHERE senedd_term = ? ORDER BY start_date, office, id", (t["term"],))
        member_ids = sorted({mid for mid, ts in self.tenures.items() if any(x["senedd_term"] == t["term"] for x in ts)})
        return {
            "term": t["term"],
            "label_en": t["label_en"],
            "label_cy": t["label_cy"],
            "start_date": t["start_date"],
            "end_date": t["end_date"],
            "seat_count": t["seat_count"],
            "presiding_officers": [{
                "member_id": o["member_id"],
                "office": o["office"],
                "start_date": o["start_date"],
                "end_date": o["end_date"],
                "provenance": o["provenance"],
                "source_url": o["source_url"],
            } for o in officers],
            "members": [self.member_light(mid) for mid in member_ids],
        }

    # --- search --------------------------------------------------------------------------------

    def search_index(self) -> dict:
        """Documents for the client-side search (MiniSearch builds its index in the browser).

        The English text is the search field for every contribution; a Welsh original is indexed
        too, so a Welsh phrase finds the speech. Snippets come from the stored text, verbatim.
        """
        speeches = rows(
            self.conn,
            """SELECT c.id, c.agenda_item_id, a.title_en, s.session_date, c.member_id, c.spoken_language,
                      c.verbatim_text_original, c.verbatim_text_english, c.video_timestamp_start
               FROM debate_contributions c
               JOIN agenda_items a ON a.id = c.agenda_item_id
               JOIN plenary_sessions s ON s.id = a.session_id
               ORDER BY s.session_date DESC, a.item_order, c.sequence_number, c.id""",
        )
        docs = []
        for sp in speeches:
            member = self.members.get(sp["member_id"])
            docs.append({
                "id": sp["id"],
                "date": sp["session_date"],
                "item_id": sp["agenda_item_id"],
                "item": sp["title_en"],
                "member_id": sp["member_id"],
                "member": member["canonical_name"] if member else sp["member_id"],
                "lang": sp["spoken_language"],
                "t": sp["video_timestamp_start"],
                "text": sp["verbatim_text_english"],
                "text_cy": sp["verbatim_text_original"] if sp["spoken_language"] == "cy" else "",
            })
        return {
            "engine": "minisearch",
            "fields": ["text", "text_cy", "member", "item", "date"],
            "store_fields": ["date", "item_id", "item", "member_id", "member", "lang", "t", "text", "text_cy"],
            "documents": docs,
        }

    # --- run -----------------------------------------------------------------------------------

    def write(self, rel: str, payload) -> None:
        path = self.out / rel
        dump(path, payload)
        self.written.add(path.resolve())

    def prune(self) -> int:
        """Delete JSON left over from an earlier export (a withdrawn sitting, a renamed Member)."""
        stale = [p for p in self.out.rglob("*.json") if p.resolve() not in self.written]
        for p in stale:
            p.unlink()
        return len(stale)

    def run(self) -> dict[str, int]:
        sittings = self.sittings_index()
        for s in self.sessions:
            self.write(f"sittings/{s['session_date']}.json", self.sitting(s))
        self.write("sittings/index.json", sittings)
        current = self.current_member_ids()
        self.write("members/index.json", [self.member_light(mid) for mid in current])
        for mid in self.members:
            self.write(f"members/{mid}.json", self.member_file(mid))
        for t in self.terms:
            self.write(f"terms/{t['term']}.json", self.term_file(t))
        self.write("search/index.json", self.search_index())
        published = [s["record_published_at"] for s in self.sessions if s["record_published_at"]]
        last_run = self.conn.execute(
            "SELECT finished_at FROM sync_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1"
        ).fetchone()
        self.write("index.json", {
            "terms": [{
                "term": t["term"], "label_en": t["label_en"], "label_cy": t["label_cy"],
                "start_date": t["start_date"], "end_date": t["end_date"], "seat_count": t["seat_count"],
            } for t in self.terms],
            "current_term": self.current_term["term"],
            "policy_domains": self.domains,
            "latest_sitting": sittings[0]["date"] if sittings else None,
            "sitting_count": len(sittings),
            # Senedd's newest publication stamp among the exported records, not the export's own clock.
            "generated_at": max(published) if published else None,
            # When pipeline.sync last finished checking the Record (UTC), from the newest sync_runs row.
            "checked_at": last_run["finished_at"] if last_run else None,
        })
        return {"sittings": len(self.sessions), "members": len(self.members), "terms": len(self.terms), "pruned": self.prune()}


def export(db_path: str | Path = DEFAULT_DB_PATH, out: str | Path = DEFAULT_OUT) -> dict[str, int]:
    conn = create_connection(db_path, read_only=True)
    try:
        return Exporter(conn, Path(out)).run()
    finally:
        conn.close()


def export_connection(conn: sqlite3.Connection, out: str | Path) -> dict[str, int]:
    return Exporter(conn, Path(out)).run()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args(argv)
    counts = export(args.db, args.out)
    print(f"exported {counts['sittings']} sittings, {counts['members']} members, {counts['terms']} terms to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
