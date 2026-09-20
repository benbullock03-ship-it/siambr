"""Ingest Modern.Gov roll-call divisions and petitions.senedd.wales petitions.

Usage: python -m pipeline.ingest_divisions_and_petitions [--dry-run] [--no-cache] [--db PATH]

Divisions and petitions are linked to existing ``agenda_items`` rows by session
date and title; unmatched rows are reported and skipped, never fabricated.
"""

from __future__ import annotations

import argparse

from pipeline.adapters import moderngov_divisions, petitions
from pipeline.adapters.http import SourceUnavailable
from pipeline.apply_migrations import apply_migrations
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.divisions_petitions import upsert_divisions, upsert_petitions
from pipeline.seed import seed_baseline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="fetch and report; write nothing")
    parser.add_argument("--no-cache", action="store_true", help="ignore the Bronze mirror and refetch")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv)
    use_cache = not args.no_cache

    try:
        divisions = moderngov_divisions.load_divisions(use_cache=use_cache)
    except SourceUnavailable as e:
        print(f"divisions: unavailable ({e})")
        divisions = []
    try:
        petition_rows = petitions.load_petitions(session=None, use_cache=use_cache)
    except SourceUnavailable as e:
        print(f"petitions: unavailable ({e})")
        petition_rows = []

    print(f"divisions fetched: {len(divisions)}")
    print(f"petitions fetched: {len(petition_rows)}")
    exceeding = [p for p in petition_rows if petitions.exceeds_debate_threshold(p)]
    print(f"petitions exceeding {petitions.SIGNATURE_THRESHOLD:,} signatures: {len(exceeding)}")

    if args.dry_run:
        print("dry run: nothing written")
        return 0

    conn = create_connection(args.db)
    try:
        apply_migrations(conn)
        seed_baseline(conn)
        div_counts, div_unresolved = upsert_divisions(conn, divisions)
        pet_counts, pet_unresolved = upsert_petitions(conn, petition_rows)
    finally:
        conn.close()

    print("written: " + ", ".join(f"{k}={v}" for k, v in {**div_counts, **pet_counts}.items()))
    if div_unresolved:
        print(f"unresolved divisions ({len(div_unresolved)}): " + "; ".join(div_unresolved))
    if pet_unresolved:
        print(f"unresolved petition debate links ({len(pet_unresolved)}): " + "; ".join(pet_unresolved))
    print(f"db: {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
