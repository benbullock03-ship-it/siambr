"""Link division votes and citizen petitions to their plenary agenda items, and upsert
the Gold-tier rows. Never invents an agenda item: a division or petition that cannot be
matched to an existing ``agenda_items`` row is skipped and reported, not synthesised.
"""

from __future__ import annotations

import sqlite3

from pipeline.adapters.moderngov_divisions import DivisionRecord


def resolve_agenda_item(conn: sqlite3.Connection, session_date: str, title_fragment: str | None) -> str | None:
    """Match a session date (+ optional title substring) to one agenda_items.id.

    Ambiguous or absent matches return ``None`` rather than guessing.
    """
    rows = conn.execute(
        """SELECT a.id, a.title_en FROM agenda_items a
           JOIN plenary_sessions s ON s.id = a.session_id
           WHERE s.session_date = ?""",
        (session_date,),
    ).fetchall()
    if not rows:
        return None
    if title_fragment:
        needle = title_fragment.strip().lower()
        matches = [r["id"] for r in rows
                   if needle in (title := (r["title_en"] or "").lower()) or title in needle]
        return matches[0] if len(matches) == 1 else None
    return rows[0]["id"] if len(rows) == 1 else None


def upsert_divisions(conn: sqlite3.Connection, divisions: list[DivisionRecord]) -> tuple[dict[str, int], list[str]]:
    counts = {"divisions": 0, "member_votes": 0}
    unresolved: list[str] = []
    with conn:
        for i, d in enumerate(divisions):
            agenda_item_id = resolve_agenda_item(conn, d.session_date, d.item_title)
            if agenda_item_id is None:
                unresolved.append(f"{d.session_date}: {d.item_title!r}")
                continue
            if sum(1 for b in d.ballots if b.vote_cast == "for") != d.votes_for or \
               sum(1 for b in d.ballots if b.vote_cast == "against") != d.votes_against or \
               sum(1 for b in d.ballots if b.vote_cast == "abstain") != d.votes_abstain:
                raise ValueError(f"member ballots do not sum to the stated tally for division on {d.session_date}")
            division_id = f"division-{agenda_item_id}-{i}"
            conn.execute(
                """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against,
                       votes_abstain, result)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       motion_text = excluded.motion_text, votes_for = excluded.votes_for,
                       votes_against = excluded.votes_against, votes_abstain = excluded.votes_abstain,
                       result = excluded.result""",
                (division_id, agenda_item_id, d.motion_text, d.votes_for, d.votes_against, d.votes_abstain, d.result),
            )
            counts["divisions"] += 1
            conn.execute("DELETE FROM member_votes WHERE division_id = ?", (division_id,))
            conn.executemany(
                "INSERT INTO member_votes (division_id, member_id, vote_cast) VALUES (?, ?, ?)",
                [(division_id, b.member_id, b.vote_cast) for b in d.ballots
                 if conn.execute("SELECT 1 FROM members WHERE id = ?", (b.member_id,)).fetchone()],
            )
            counts["member_votes"] += len(d.ballots)
    return counts, unresolved


def upsert_petitions(conn: sqlite3.Connection, petitions: list[dict]) -> tuple[dict[str, int], list[str]]:
    counts = {"petitions": 0, "linked_to_debates": 0}
    unresolved: list[str] = []
    with conn:
        for p in petitions:
            debate_item_id = None
            if p.get("debate_session_date"):
                debate_item_id = resolve_agenda_item(conn, p["debate_session_date"], p.get("debate_item_title"))
                if debate_item_id is None:
                    unresolved.append(f"{p['id']}: {p.get('debate_item_title')!r} on {p['debate_session_date']}")
            conn.execute(
                """INSERT INTO citizen_petitions (id, title_en, petitioner_name, signature_count, opened_date,
                       closing_date, status, committee_response, debate_agenda_item_id, source_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       title_en = excluded.title_en, petitioner_name = excluded.petitioner_name,
                       signature_count = excluded.signature_count, opened_date = excluded.opened_date,
                       closing_date = excluded.closing_date, status = excluded.status,
                       committee_response = excluded.committee_response,
                       debate_agenda_item_id = COALESCE(excluded.debate_agenda_item_id, citizen_petitions.debate_agenda_item_id),
                       source_url = excluded.source_url""",
                (p["id"], p["title_en"], p.get("petitioner_name"), p["signature_count"], p.get("opened_date"),
                 p.get("closing_date"), p["status"], p.get("committee_response"), debate_item_id, p["source_url"]),
            )
            counts["petitions"] += 1
            if debate_item_id:
                conn.execute(
                    "UPDATE agenda_items SET origin_type = 'petition', origin_ref_id = ? WHERE id = ?",
                    (p["id"], debate_item_id),
                )
                counts["linked_to_debates"] += 1
    return counts, unresolved
