"""Export the Playwright fixture data: a throwaway Gold store built from backend/tests, written as static JSON.

Usage: python -m tests.export_fixture --out frontend/e2e/static/data
"""

from __future__ import annotations

import argparse
import sqlite3
import tempfile
from pathlib import Path

from backend.tests.test_api import _build_fixture_db
from pipeline.db import REPO_ROOT
from pipeline.export import export
from pipeline.senedd_tv import sitting_start

DEFAULT_OUT = REPO_ROOT / "frontend" / "e2e" / "static" / "data"
# Never fetched: the Playwright specs route this host, so the wall-screen gates have a stream to refuse.
FIXTURE_STREAM = "https://nafw.cdn.vustreams.com/m/fixture/interpretation/interpretation.isml/interpretation.m3u8"
FIXTURE_VERBATIM = "https://nafw.cdn.vustreams.com/m/fixture/verbatim/verbatim.isml/verbatim.m3u8"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args(argv)
    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "siambr.db"
        _build_fixture_db(db)
        with sqlite3.connect(db) as conn:
            conn.execute(
                "UPDATE plenary_sessions SET meeting_start_time = '13:30:00', stream_url = ?, stream_vbegin = ?,"
                " stream_url_verbatim = ?, stream_vbegin_verbatim = ? WHERE id = 'session-1'",
                (FIXTURE_STREAM, sitting_start("2026-06-10", "13:30:00"), FIXTURE_VERBATIM, sitting_start("2026-06-10", "13:30:00")),
            )
        conn.close()
        counts = export(db, args.out)
    print(f"fixture: {counts['sittings']} sittings, {counts['members']} members -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
