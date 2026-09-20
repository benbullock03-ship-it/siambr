"""Serves the API over a throwaway fixture DB for the Playwright suite in frontend/e2e."""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import uvicorn

import backend.db as backend_db
from backend.main import app
from backend.tests.test_api import _build_fixture_db


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "siambr.db"
        _build_fixture_db(path)
        backend_db.set_db_path(str(path))
        uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
