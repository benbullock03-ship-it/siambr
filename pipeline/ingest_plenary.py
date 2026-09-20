"""Ingest plenary Record of Proceedings transcripts (record.senedd.wales/XMLExport).

Usage:
  python -m pipeline.ingest_plenary --year 2026
  python -m pipeline.ingest_plenary --years 2016-2026
  python -m pipeline.ingest_plenary --all
  python -m pipeline.ingest_plenary --meeting-id 5000 --meeting-id 16086
  python -m pipeline.ingest_plenary --scan-from 16261 --term 7 [--gap 40]
  [--dry-run] [--no-cache] [--db PATH]

The XMLExport index only lists recent meetings (on 2026-09-14: 15 plenaries from
12 May 2026), but older transcripts still download by meeting ID, hence --meeting-id
and --scan-from, which walks IDs downward until the term's start or a run of --gap
IDs with no plenary transcript.
"""

from __future__ import annotations

import argparse
from datetime import date

from pipeline.adapters import plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.seed import PARLIAMENTARY_TERMS
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.plenary import known_member_ids, normalise, write_session
from pipeline.seed import seed_baseline

FIRST_YEAR = 1999


def parse_years(spec: str) -> list[int]:
    start, _, end = spec.partition("-")
    return list(range(int(start), int(end or start) + 1))


def term_start(term: int) -> str:
    return next(t[3] for t in PARLIAMENTARY_TERMS if t[0] == term)


def scan_meetings(scan_from: int, term: int, gap: int, *, use_cache: bool = True, log=print) -> list[int]:
    """Plenary meeting IDs of `term`, walking downward from `scan_from`.

    Stops at a plenary whose Assembly or MeetingDate is before the term, or after `gap`
    consecutive IDs that yield no plenary transcript. Only plenary transcripts reach Bronze.
    """
    start_date = term_start(term)
    found: list[int] = []
    misses = 0
    mid = scan_from
    while mid > 0 and misses < gap:
        try:
            body = plenary_xml.fetch_transcript(mid, use_cache=use_cache)
        except SourceUnavailable:
            body = None
        if body is None or not plenary_xml.is_plenary(body):
            misses += 1
            mid -= 1
            continue
        misses = 0
        assembly = plenary_xml.assembly_of(body)
        session_date = plenary_xml.meeting_date(body)
        if assembly is None or assembly < term or session_date < start_date:
            log(f"meeting {mid} ({session_date}, Assembly {assembly}): before term {term}; scan stops")
            break
        if assembly == term:
            found.append(mid)
            log(f"meeting {mid} ({session_date}): plenary, term {term}")
        mid -= 1
    log(f"scan {scan_from} -> {mid}: {len(found)} plenary meetings of term {term}")
    return sorted(found)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int)
    parser.add_argument("--years", help="inclusive range, e.g. 1999-2026")
    parser.add_argument("--all", action="store_true", help=f"every year from {FIRST_YEAR}")
    parser.add_argument("--meeting-id", type=int, action="append", default=[])
    parser.add_argument("--scan-from", type=int, help="walk meeting IDs downward from here (needs --term)")
    parser.add_argument("--term", type=int, choices=range(1, 8), help="keep only plenaries of this term when scanning")
    parser.add_argument("--gap", type=int, default=40, help="stop scanning after this many IDs without a plenary transcript")
    parser.add_argument("--dry-run", action="store_true", help="fetch and normalise; write nothing to the database")
    parser.add_argument("--no-cache", action="store_true", help="ignore the Bronze mirror and refetch")
    parser.add_argument("--rewrite", action="store_true", help="replace sessions in Gold even when the checksum is unchanged")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv)

    years: list[int] = []
    if args.all:
        years = list(range(FIRST_YEAR, date.today().year + 1))
    elif args.years:
        years = parse_years(args.years)
    elif args.year:
        years = [args.year]
    if args.scan_from and not args.term:
        parser.error("--scan-from needs --term")
    if not years and not args.meeting_id and not args.scan_from:
        parser.error("give --year, --years, --all, --meeting-id or --scan-from")

    meeting_ids = set(args.meeting_id)
    if args.scan_from:
        meeting_ids.update(scan_meetings(args.scan_from, args.term, args.gap, use_cache=not args.no_cache))
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
        status = "dry run" if args.dry_run else write_session(conn, n, rewrite=args.rewrite)
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
