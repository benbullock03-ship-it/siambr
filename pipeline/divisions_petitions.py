"""Link roll-call divisions and citizen petitions to their plenary agenda items and upsert
the Gold-tier rows. Never invents an agenda item, a Member or a vote: a division whose item
is not in Gold is skipped and reported; a ballot whose Member is not in the registry is
reported and not written; a tally that the ballots do not add up to is an error.
"""

from __future__ import annotations

import sqlite3

from pipeline.adapters.plenary_votes import DivisionRecord, tally
from pipeline.plenary import member_id_for


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


def upsert_divisions(
    conn: sqlite3.Connection, divisions: list[DivisionRecord], known_members: set[str], *, replace_meetings: set[int] = frozenset()
) -> tuple[dict[str, int], list[str], list[str]]:
    """Write divisions keyed by the publisher's vote id. Returns (counts, unresolved items, unmatched Member names).

    For every meeting in ``replace_meetings`` a division no longer in ``divisions`` is deleted,
    so the Gold rows follow the current Votes document for that meeting.
    """
    counts = {"divisions": 0, "member_votes": 0}
    unresolved: list[str] = []
    unmatched: set[str] = set()
    with conn:
        for meeting_id in replace_meetings:
            keep = [d.id for d in divisions if d.meeting_id == meeting_id]
            stale = conn.execute(
                f"""SELECT d.id FROM division_votes d JOIN agenda_items a ON a.id = d.agenda_item_id
                    WHERE a.session_id = ? AND d.id NOT IN ({','.join('?' * len(keep)) or "''"})""",
                (f"plenary-{meeting_id}", *keep),
            ).fetchall()
            for row in stale:
                conn.execute("DELETE FROM member_votes WHERE division_id = ?", (row["id"],))
                conn.execute("DELETE FROM division_votes WHERE id = ?", (row["id"],))
        for d in divisions:
            if tally(d) != (d.votes_for, d.votes_against, d.votes_abstain):
                raise ValueError(f"division {d.id}: ballots {tally(d)} do not sum to the published tally "
                                 f"{(d.votes_for, d.votes_against, d.votes_abstain)}")
            item = conn.execute("SELECT 1 FROM agenda_items WHERE id = ?", (d.agenda_item_id,)).fetchone()
            if item is None:
                unresolved.append(f"{d.session_date}: {d.agenda_item_id} ({d.item_title_en!r}) not in Gold")
                continue
            conn.execute(
                """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against,
                       votes_abstain, result, casting_vote)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       agenda_item_id = excluded.agenda_item_id, motion_text = excluded.motion_text,
                       votes_for = excluded.votes_for, votes_against = excluded.votes_against,
                       votes_abstain = excluded.votes_abstain, result = excluded.result,
                       casting_vote = excluded.casting_vote""",
                (d.id, d.agenda_item_id, d.motion_text_en, d.votes_for, d.votes_against, d.votes_abstain, d.result,
                 d.casting_vote),
            )
            counts["divisions"] += 1
            conn.execute("DELETE FROM member_votes WHERE division_id = ?", (d.id,))
            rows = []
            for b in d.ballots:
                member_id = member_id_for(b.member_name, known_members)
                if member_id is None:
                    unmatched.add(f"{b.member_name} (Modern.Gov {b.mg_member_id})")
                    continue
                rows.append((d.id, member_id, b.vote_cast))
            conn.executemany("INSERT INTO member_votes (division_id, member_id, vote_cast) VALUES (?, ?, ?)", rows)
            counts["member_votes"] += len(rows)
    return counts, unresolved, sorted(unmatched)


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
