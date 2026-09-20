"""Read-only SQLite access for the serving layer. Never writes to data/siambr.db."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator

from pipeline.db import DEFAULT_DB_PATH, create_connection

_db_path = DEFAULT_DB_PATH


def set_db_path(path: str) -> None:
    """Test hook: point the API at an alternate database file."""
    global _db_path
    _db_path = path


def get_connection() -> Iterator[sqlite3.Connection]:
    conn = create_connection(_db_path, read_only=True)
    try:
        yield conn
    finally:
        conn.close()
