"""Shared row -> schema mapping helpers for the serving layer."""

from __future__ import annotations

import sqlite3

from backend.schemas import MemberSummary

CURRENT_PARTY_SQL = """
    SELECT party_id FROM member_tenures
    WHERE member_id = ?
    ORDER BY (end_date IS NULL) DESC, start_date DESC
    LIMIT 1
"""


def current_party_id(conn: sqlite3.Connection, member_id: str) -> str | None:
    row = conn.execute(CURRENT_PARTY_SQL, (member_id,)).fetchone()
    return row["party_id"] if row else None


def member_summary(conn: sqlite3.Connection, member_row: sqlite3.Row) -> MemberSummary:
    return MemberSummary(
        id=member_row["id"],
        canonical_name=member_row["canonical_name"],
        cymraeg_name=member_row["cymraeg_name"],
        party_id=current_party_id(conn, member_row["id"]),
        constituency_name_en=member_row["constituency_name_en"],
        portrait_url=member_row["portrait_url"],
    )


def fetch_member_row(conn: sqlite3.Connection, member_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()


def party_id_on(conn: sqlite3.Connection, member_id: str, date: str) -> str | None:
    row = conn.execute(
        """SELECT party_id FROM member_tenures
           WHERE member_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
           ORDER BY start_date DESC LIMIT 1""",
        (member_id, date, date),
    ).fetchone()
    return row["party_id"] if row else None


def ministerial_role_on(conn: sqlite3.Connection, member_id: str, date: str) -> sqlite3.Row | None:
    return conn.execute(
        """SELECT title_en, title_cy FROM ministerial_roles
           WHERE member_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
           ORDER BY start_date DESC LIMIT 1""",
        (member_id, date, date),
    ).fetchone()
