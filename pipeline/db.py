"""SQLite connection factory for data/siambr.db."""

from __future__ import annotations

import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = REPO_ROOT / "data" / "siambr.db"
MEMORY = ":memory:"

PRAGMAS = {
    "journal_mode": "WAL",
    "synchronous": "NORMAL",
    "foreign_keys": "ON",
    "busy_timeout": 5000,
}


def create_connection(path: str | Path = DEFAULT_DB_PATH, read_only: bool = False) -> sqlite3.Connection:
    """Open SQLite with WAL, NORMAL sync, FK enforcement and a 5s busy timeout.

    ``read_only=True`` opens via URI ``mode=ro``; journal_mode is left untouched
    there since a read-only handle cannot switch it.
    """
    is_memory = str(path) == MEMORY
    if read_only:
        if is_memory:
            raise ValueError("an in-memory database cannot be opened read-only")
        uri = f"file:{Path(path).resolve().as_posix()}?mode=ro"
        # FastAPI opens the per-request handle in one threadpool worker and may query it from another.
        conn = sqlite3.connect(uri, uri=True, isolation_level=None, check_same_thread=False)
    else:
        if not is_memory:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path), isolation_level=None)

    conn.row_factory = sqlite3.Row
    conn.execute(f"PRAGMA busy_timeout = {PRAGMAS['busy_timeout']}")
    conn.execute(f"PRAGMA foreign_keys = {PRAGMAS['foreign_keys']}")
    conn.execute(f"PRAGMA synchronous = {PRAGMAS['synchronous']}")
    if not read_only and not is_memory:
        conn.execute(f"PRAGMA journal_mode = {PRAGMAS['journal_mode']}")
    return conn
