"""Ingest roll-call divisions from the Record's XMLExport Votes documents, and optionally petitions.

Usage: python -m pipeline.ingest_divisions_and_petitions [--meeting-id N ...] [--no-cache] [--dry-run]
                                                         [--petitions] [--db PATH]

Divisions come per plenary meeting from record.senedd.wales (same host and mirror as the
transcripts) and are keyed to their agenda item by the publisher's own item reference. A
division whose item is not in Gold is reported and skipped; a ballot naming a Member not in
the registry is reported and not written. Petitions (petitions.senedd.wales) are optional
under spec 2.0.0 and only fetched with --petitions.
"""

from __future__ import annotations

import argparse

from pipeline.adapters import petitions, plenary_votes
from pipeline.adapters.http import SourceUnavailable
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.divisions_petitions import upsert_divisions, upsert_petitions
from pipeline.export import meeting_id_of
from pipeline.plenary import known_member_ids
from pipeline.seed import seed_baseline


def gold_meetings(conn) -> list[tuple[int, str]]:
    """(meeting_id, session_date) for every plenary session in Gold with a numeric meeting id."""
    out = []
    for row in conn.execute("SELECT id, session_date FROM plenary_sessions ORDER BY session_date"):
        mid = meeting_id_of(row["id"])
        if mid is not None:
            out.append((mid, row["session_date"]))
    return out


def ingest_divisions(conn, meetings: list[tuple[int, str]], *, use_cache: bool = True, log=print) -> dict:
    known = known_member_ids(conn)
    divisions: list[plenary_votes.DivisionRecord] = []
    fetched: set[int] = set()
    unavailable: list[int] = []
    for meeting_id, session_date in meetings:
        try:
            body = plenary_votes.fetch_votes(meeting_id, session_date, use_cache=use_cache)
        except SourceUnavailable as e:
            log(f"meeting {meeting_id} ({session_date}): votes unavailable ({e})")
            unavailable.append(meeting_id)
            continue
        found = plenary_votes.parse_votes(body)
        fetched.add(meeting_id)
        divisions.extend(found)
        log(f"meeting {meeting_id} ({session_date}): {len(found)} divisions, {sum(len(d.ballots) for d in found)} ballots")
    counts, unresolved, unmatched = upsert_divisions(conn, divisions, known, replace_meetings=fetched)
    return {"counts": counts, "unresolved": unresolved, "unmatched": unmatched, "unavailable": unavailable}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--meeting-id", type=int, action="append", help="limit to these Record meeting ids")
    parser.add_argument("--dry-run", action="store_true", help="fetch and report; write nothing")
    parser.add_argument("--no-cache", action="store_true", help="ignore the Bronze mirror and refetch")
    parser.add_argument("--petitions", action="store_true", help="also fetch and link petitions (optional data)")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv)
    use_cache = not args.no_cache

    conn = create_connection(args.db)
    try:
        apply_migrations(conn)
        seed_baseline(conn)
        meetings = gold_meetings(conn)
        if args.meeting_id:
            wanted = set(args.meeting_id)
            meetings = [m for m in meetings if m[0] in wanted]
        if args.dry_run:
            for meeting_id, session_date in meetings:
                try:
                    found = plenary_votes.parse_votes(plenary_votes.fetch_votes(meeting_id, session_date, use_cache=use_cache))
                    print(f"meeting {meeting_id} ({session_date}): {len(found)} divisions")
                except SourceUnavailable as e:
                    print(f"meeting {meeting_id} ({session_date}): unavailable ({e})")
            print("dry run: nothing written")
            return 0

        report = ingest_divisions(conn, meetings, use_cache=use_cache)
        print("written: " + ", ".join(f"{k}={v}" for k, v in report["counts"].items()))
        if report["unresolved"]:
            print(f"unresolved divisions ({len(report['unresolved'])}): " + "; ".join(report["unresolved"]))
        if report["unmatched"]:
            print(f"ballots for Members not in the registry ({len(report['unmatched'])}): " + "; ".join(report["unmatched"]))
        if report["unavailable"]:
            print(f"votes unavailable for meetings: {report['unavailable']}")

        if args.petitions:
            try:
                petition_rows = petitions.load_petitions(session=None, use_cache=use_cache)
            except SourceUnavailable as e:
                print(f"petitions: unavailable ({e})")
                petition_rows = []
            pet_counts, pet_unresolved = upsert_petitions(conn, petition_rows)
            print("petitions: " + ", ".join(f"{k}={v}" for k, v in pet_counts.items()))
            if pet_unresolved:
                print(f"unresolved petition debate links ({len(pet_unresolved)}): " + "; ".join(pet_unresolved))
    finally:
        conn.close()
    print(f"db: {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
