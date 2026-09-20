"""Export the Playwright fixture data: a throwaway Gold store built from backend/tests, written as static JSON.

Usage: python -m tests.export_fixture --out frontend/e2e/static/data
"""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from backend.tests.test_api import _build_fixture_db
from pipeline.db import REPO_ROOT
from pipeline.export import export

DEFAULT_OUT = REPO_ROOT / "frontend" / "e2e" / "static" / "data"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args(argv)
    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "siambr.db"
        _build_fixture_db(db)
        counts = export(db, args.out)
    print(f"fixture: {counts['sittings']} sittings, {counts['members']} members -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
