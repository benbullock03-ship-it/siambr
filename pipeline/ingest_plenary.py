"""Ingest plenary Record of Proceedings transcripts (record.senedd.wales/XMLExport).

Usage:
  python -m pipeline.ingest_plenary --year 2026
  python -m pipeline.ingest_plenary --years 2016-2026
  python -m pipeline.ingest_plenary --all
  python -m pipeline.ingest_plenary --meeting-id 5000 --meeting-id 16086
  [--dry-run] [--no-cache] [--db PATH]

The XMLExport index only lists recent meetings (on 2026-09-14: 15 plenaries from
12 May 2026), but older transcripts still download by meeting ID, hence --meeting-id.
"""

from __future__ import annotations

import argparse
from datetime import date

from pipeline.adapters import plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.plenary import known_member_ids, normalise, write_session
from pipeline.seed import seed_baseline

FIRST_YEAR = 1999


def parse_years(spec: str) -> list[int]:
    start, _, end = spec.partition("-")
    return list(range(int(start), int(end or start) + 1))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int)
    parser.add_argument("--years", help="inclusive range, e.g. 1999-2026")
    parser.add_argument("--all", action="store_true", help=f"every year from {FIRST_YEAR}")
    parser.add_argument("--meeting-id", type=int, action="append", default=[])
    parser.add_argument("--dry-run", action="store_true", help="fetch and normalise; write nothing to the database")
    parser.add_argument("--no-cache", action="store_true", help="ignore the Bronze mirror and refetch")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv)

    years: list[int] = []
    if args.all:
        years = list(range(FIRST_YEAR, date.today().year + 1))
    elif args.years:
        years = parse_years(args.years)
    elif args.year:
        years = [args.year]
    if not years and not args.meeting_id:
        parser.error("give --year, --years, --all or --meeting-id")

    meeting_ids = set(args.meeting_id)
    for year in years:
        try:
            listed = plenary_xml.list_plenary_meetings(f"{year}-01-01", f"{year}-12-31")
        except SourceUnavailable as e:
            print(f"{year}: index unavailable ({e})")
            continue
        print(f"{year}: {len(listed)} plenary meetings listed")
        meeting_ids.update(mid for _, mid in listed)

    conn = create_connection(args.db, read_only=args.dry_run)
    if not args.dry_run:
        apply_migrations(conn)
        seed_baseline(conn)
    known = known_member_ids(conn)

    failures = written = 0
    for mid in sorted(meeting_ids):
        try:
            body = plenary_xml.fetch_transcript(mid, use_cache=not args.no_cache)
        except SourceUnavailable as e:
            print(f"meeting {mid}: unavailable ({e})")
            failures += 1
            continue
        n = normalise(body, known, plenary_xml.download_url(mid))
        status = "dry run" if args.dry_run else write_session(conn, n)
        written += status == "written"
        print(f"meeting {mid} ({n.session_date}): {status}; {len(n.items)} items, {len(n.contributions)} speeches")
        for reason in n.skipped:
            print(f"  skipped item {reason}")
    conn.close()

    if written:
        print("sessions replaced: re-run python -m pipeline.ingest_divisions_and_petitions to relink divisions and petitions")
    return 1 if meeting_ids and failures == len(meeting_ids) else 0


if __name__ == "__main__":
    raise SystemExit(main())
