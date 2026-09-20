"""Baseline reference rows: the seven parliamentary terms and six policy domains."""

from __future__ import annotations

import sqlite3

# (term, label_en, label_cy, start_date, end_date, seat_count). Dates are election days.
PARLIAMENTARY_TERMS = [
    (1, "First Assembly", "Y Cynulliad Cyntaf", "1999-05-06", "2003-04-30", 60),
    (2, "Second Assembly", "Yr Ail Gynulliad", "2003-05-01", "2007-05-02", 60),
    (3, "Third Assembly", "Y Trydydd Cynulliad", "2007-05-03", "2011-05-04", 60),
    (4, "Fourth Assembly", "Y Pedwerydd Cynulliad", "2011-05-05", "2016-05-04", 60),
    (5, "Fifth Senedd", "Y Pumed Senedd", "2016-05-05", "2021-05-05", 60),
    (6, "Sixth Senedd", "Y Chweched Senedd", "2021-05-06", "2026-05-06", 60),
    (7, "Seventh Senedd", "Y Seithfed Senedd", "2026-05-07", None, 96),
]

# (id, name_en, name_cy, wing_label, bearing_degrees). The last two are legacy columns, unused since spec 2.0.0.
POLICY_DOMAINS = [
    ("health", "Health & Social Care", "Iechyd a Gofal Cymdeithasol", "north", 0),
    ("transport", "Climate Change & Transport", "Newid Hinsawdd a Thrafnidiaeth", "north-east", 60),
    ("economy", "Economy & Welsh Tax", "Yr Economi a Threth Cymru", "south-east", 120),
    ("education", "Education & Welsh Language", "Addysg a'r Gymraeg", "south", 180),
    ("communities", "Housing & Social Justice", "Tai a Chyfiawnder Cymdeithasol", "south-west", 240),
    ("devolution", "Constitution & External Affairs", "Y Cyfansoddiad a Materion Allanol", "north-west", 300),
]


def seed_baseline(conn: sqlite3.Connection) -> None:
    """Idempotent: re-running upserts the same rows."""
    with conn:
        conn.executemany(
            """INSERT INTO parliamentary_terms (term, label_en, label_cy, start_date, end_date, seat_count)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(term) DO UPDATE SET
                 label_en = excluded.label_en, label_cy = excluded.label_cy,
                 start_date = excluded.start_date, end_date = excluded.end_date,
                 seat_count = excluded.seat_count""",
            PARLIAMENTARY_TERMS,
        )
        conn.executemany(
            """INSERT INTO policy_domains (id, name_en, name_cy, wing_label, bearing_degrees)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name_en = excluded.name_en, name_cy = excluded.name_cy,
                 wing_label = excluded.wing_label, bearing_degrees = excluded.bearing_degrees""",
            POLICY_DOMAINS,
        )
