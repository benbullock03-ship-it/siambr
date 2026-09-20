"""Apply pipeline/migrations/*.sql in order, once each, then seed baseline rows.

Usage: python -m pipeline.apply_migrations [--db PATH] [--no-seed]
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.seed import seed_baseline

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def _ensure_tracking_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
               version TEXT PRIMARY KEY,
               applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           )"""
    )


def applied_versions(conn: sqlite3.Connection) -> set[str]:
    _ensure_tracking_table(conn)
    return {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}


def pending_migrations(conn: sqlite3.Connection, migrations_dir: Path = MIGRATIONS_DIR) -> list[Path]:
    done = applied_versions(conn)
    return [p for p in sorted(migrations_dir.glob("*.sql")) if p.stem not in done]


def apply_migrations(conn: sqlite3.Connection, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Run each pending file inside one transaction with its tracking row. Returns applied versions."""
    applied: list[str] = []
    for path in pending_migrations(conn, migrations_dir):
        sql = path.read_text(encoding="utf-8")
        # executescript commits any open transaction first, so BEGIN/COMMIT live in the script itself.
        conn.executescript(
            "BEGIN;\n"
            f"{sql}\n"
            f"INSERT INTO schema_migrations (version) VALUES ('{path.stem}');\n"
            "COMMIT;"
        )
        applied.append(path.stem)
    return applied


def migrate(path: str | Path = DEFAULT_DB_PATH, seed: bool = True) -> list[str]:
    conn = create_connection(path)
    try:
        applied = apply_migrations(conn)
        if seed:
            seed_baseline(conn)
        return applied
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--no-seed", action="store_true")
    args = parser.parse_args(argv)
    applied = migrate(args.db, seed=not args.no_seed)
    print("applied: " + ", ".join(applied) if applied else "up to date")
    print(f"db: {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
