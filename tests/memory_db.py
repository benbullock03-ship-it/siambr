"""Pristine, fully migrated and seeded in-memory Siambr database for offline tests."""

from __future__ import annotations

import sqlite3

from pipeline.apply_migrations import apply_migrations
from pipeline.db import MEMORY, create_connection
from pipeline.seed import seed_baseline


def memory_db(seed: bool = True) -> sqlite3.Connection:
    conn = create_connection(MEMORY)
    apply_migrations(conn)
    if seed:
        seed_baseline(conn)
    return conn
