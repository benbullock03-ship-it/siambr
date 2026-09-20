"""Ingest Members of the Senedd into members / member_tenures / ministerial_roles.

Usage: python -m pipeline.reconcile_members [--source auto|mgwebservice|senedd-site]
                                            [--terms 1-7] [--dry-run] [--no-cymraeg] [--no-cache] [--db PATH]

senedd.wales is the backbone (it alone lists former Members, ministerial titles and
Welsh names). ``auto`` additionally fetches Modern.Gov and reports whether its sitting
membership matches; ``mgwebservice`` ingests Modern.Gov alone (sitting Members only).
Curated First Minister date ranges are added where the live source has no exact one.
"""

from __future__ import annotations

import argparse
import logging
import sys
from collections import Counter

from pipeline.adapters import moderngov, senedd_site
from pipeline.adapters.http import SourceUnavailable
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.members import MemberRecord, Tenure, upsert_members
from pipeline.seed import seed_baseline
from pipeline.reference.election_1999 import tenures_1999
from pipeline.reference.election_2003 import tenures_2003
from pipeline.reference.term_corrections import (
    apply_byelection_replacements, apply_known_continuous_seats, apply_term_relabels,
)
from pipeline.reference.first_ministers import first_minister_roles

log = logging.getLogger("pipeline.reconcile_members")


def parse_terms(spec: str) -> list[int]:
    if "-" in spec:
        lo, hi = spec.split("-", 1)
        return list(range(int(lo), int(hi) + 1))
    return [int(x) for x in spec.split(",")]


def backfill_election_seats(records: list[MemberRecord], term: int, election: dict[str, "Tenure"], label: str) -> int:
    """Fill blank seat/party fields for a given Senedd term from a curated election-results
    table (see pipeline/reference/election_*.py) wherever senedd.wales itself carries none."""
    by_id = {r.id: r for r in records}
    filled = 0
    for mid, tenure in election.items():
        rec = by_id.get(mid)
        if rec is None:
            log.warning("%s winner %s not in ingested records", label, mid)
            continue
        for i, t in enumerate(rec.tenures):
            if t.senedd_term == term and t.seat_name is None:
                rec.tenures[i] = Tenure(
                    start_date=t.start_date, end_date=t.end_date, senedd_term=term,
                    party_id=tenure.party_id, party_label=tenure.party_label,
                    party_provenance="curated_reference", is_regional_member=tenure.is_regional_member,
                    region_name=tenure.region_name, seat_name=tenure.seat_name,
                    seat_gss_code=tenure.seat_gss_code, source_url=tenure.source_url,
                )
                filled += 1
    return filled


def attach_first_ministers(records: list[MemberRecord]) -> int:
    by_id = {r.id: r for r in records}
    added = 0
    for mid, role in first_minister_roles().items():
        rec = by_id.get(mid)
        if rec is None:
            log.warning("First Minister %s not in ingested records", mid)
            continue
        live = [r for r in rec.roles if r.cabinet_level == "first_minister"]
        if any(r.start_date_precision == "exact" for r in live):
            continue
        rec.roles = [r for r in rec.roles if r.cabinet_level != "first_minister"] + [role]
        added += 1
    return added


def load(source: str, terms: list[int], with_cymraeg: bool, use_cache: bool, progress=None) -> tuple[str, list[MemberRecord]]:
    if source == "mgwebservice":
        return source, moderngov.load_members(use_cache=use_cache)
    return "senedd-site", senedd_site.load_members(terms=terms, with_cymraeg=with_cymraeg, use_cache=use_cache, progress=progress)


def cross_check_moderngov(records: list[MemberRecord], use_cache: bool) -> str:
    try:
        mg = moderngov.load_members(use_cache=use_cache, retries=3)
    except SourceUnavailable as e:
        return f"moderngov cross-check: skipped ({e})"
    ours = {r.id for r in records if r.current_status == "active"}
    theirs = {r.id for r in mg if r.current_status == "active"}
    if ours == theirs:
        return f"moderngov cross-check: sitting membership matches ({len(theirs)} Members)"
    return (f"moderngov cross-check: MISMATCH only-senedd.wales={sorted(ours - theirs)} "
            f"only-moderngov={sorted(theirs - ours)}")


def summarise(records: list[MemberRecord]) -> str:
    active = [r for r in records if r.current_status == "active"]
    parties = Counter(t.party_label for r in active for t in r.tenures if t.senedd_term == 7)
    roles = sum(len(r.roles) for r in records)
    tenures = sum(len(r.tenures) for r in records)
    lines = [
        f"members: {len(records)} (active {len(active)})",
        f"tenures: {tenures}   ministerial roles: {roles}",
        "seventh senedd by party: " + ", ".join(f"{k}={v}" for k, v in parties.most_common()),
    ]
    missing_gss = [r.canonical_name for r in active if not r.gss_constituency_code]
    if missing_gss:
        lines.append("active members without GSS code: " + ", ".join(missing_gss))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", choices=["auto", "mgwebservice", "senedd-site"], default="auto")
    parser.add_argument("--terms", default="1-7", help="e.g. 7 or 5-7 (senedd-site only)")
    parser.add_argument("--dry-run", action="store_true", help="fetch and report; write nothing")
    parser.add_argument("--no-cymraeg", action="store_true", help="skip senedd.cymru name lookups")
    parser.add_argument("--no-cache", action="store_true", help="ignore the Bronze mirror and refetch")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    def progress(i, n, url):
        if i % 20 == 0 or i == n:
            print(f"  profiles {i}/{n}", file=sys.stderr)

    source, records = load(args.source, parse_terms(args.terms), not args.no_cymraeg, not args.no_cache, progress)
    relabeled = apply_term_relabels(records)
    filled_1999 = backfill_election_seats(records, 1, tenures_1999(), "1999")
    filled_2003 = backfill_election_seats(records, 2, tenures_2003(), "2003")
    filled_byelection = apply_byelection_replacements(records)
    filled_continuous = apply_known_continuous_seats(records)
    added = attach_first_ministers(records)
    print(f"source: {source}")
    print(summarise(records))
    print(f"term mislabels corrected: {relabeled}")
    print(f"1999 election seats/parties backfilled: {filled_1999}")
    print(f"2003 election seats/parties backfilled: {filled_2003}")
    print(f"1999 by-election seats/parties backfilled: {filled_byelection}")
    print(f"known-continuous seats backfilled: {filled_continuous}")
    if args.source == "auto":
        print(cross_check_moderngov(records, not args.no_cache))
    print(f"curated first-minister roles attached: {added}")
    if args.dry_run:
        print("dry run: nothing written")
        return 0
    conn = create_connection(args.db)
    try:
        apply_migrations(conn)
        seed_baseline(conn)
        counts = upsert_members(conn, records)
    finally:
        conn.close()
    print("written: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    print(f"db: {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
