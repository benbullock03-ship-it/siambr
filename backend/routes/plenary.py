from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db import get_connection
from backend.queries import fetch_member_row, member_summary, ministerial_role_on, party_id_on
from backend.schemas import (
    AgendaItemSummary, DivisionResult, DossierPlate, MemberVoteCast, PetitionLink, SessionSummary, SpeakerContribution,
)

router = APIRouter(prefix="/api/plenary", tags=["plenary"])


@router.get("/items/{item_id}", response_model=DossierPlate)
def get_dossier_plate(item_id: str, conn: sqlite3.Connection = Depends(get_connection)) -> DossierPlate:
    item = conn.execute(
        """SELECT a.*, s.session_date, s.id AS session_id, s.source_xml_url FROM agenda_items a
           JOIN plenary_sessions s ON s.id = a.session_id
           WHERE a.id = ?""",
        (item_id,),
    ).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail=f"agenda item {item_id!r} not found")

    contributions = []
    for row in conn.execute(
        "SELECT * FROM debate_contributions WHERE agenda_item_id = ? ORDER BY sequence_number",
        (item_id,),
    ):
        member_row = fetch_member_row(conn, row["member_id"])
        role = ministerial_role_on(conn, row["member_id"], item["session_date"])
        contributions.append(SpeakerContribution(
            id=row["id"],
            sequence_number=row["sequence_number"],
            member=member_summary(conn, member_row),
            party_id_at_date=party_id_on(conn, row["member_id"], item["session_date"]),
            role_title_en=role["title_en"] if role else None,
            role_title_cy=role["title_cy"] if role else None,
            spoken_language=row["spoken_language"],
            verbatim_text_original=row["verbatim_text_original"],
            verbatim_text_english=row["verbatim_text_english"],
            video_timestamp_start=row["video_timestamp_start"],
            video_timestamp_end=row["video_timestamp_end"],
        ))

    divisions = []
    for div_row in conn.execute(
        "SELECT * FROM division_votes WHERE agenda_item_id = ?", (item_id,)
    ):
        ballots = [
            MemberVoteCast(
                member=member_summary(conn, fetch_member_row(conn, b["member_id"])),
                party_id_at_date=party_id_on(conn, b["member_id"], item["session_date"]),
                vote_cast=b["vote_cast"],
            )
            for b in conn.execute("SELECT * FROM member_votes WHERE division_id = ?", (div_row["id"],))
        ]
        divisions.append(DivisionResult(
            id=div_row["id"], motion_text=div_row["motion_text"], votes_for=div_row["votes_for"],
            votes_against=div_row["votes_against"], votes_abstain=div_row["votes_abstain"],
            result=div_row["result"], ballots=ballots,
        ))

    petitions = [
        PetitionLink(id=p["id"], title_en=p["title_en"], signature_count=p["signature_count"],
                     status=p["status"], source_url=p["source_url"])
        for p in conn.execute(
            "SELECT * FROM citizen_petitions WHERE debate_agenda_item_id = ?", (item_id,)
        )
    ]

    return DossierPlate(
        id=item["id"], session_id=item["session_id"], session_date=item["session_date"],
        item_order=item["item_order"], item_type=item["item_type"], title_en=item["title_en"],
        title_cy=item["title_cy"], policy_domain_id=item["policy_domain_id"],
        senedd_tv_clip_url=item["senedd_tv_clip_url"], source_xml_url=item["source_xml_url"],
        contributions=contributions,
        divisions=divisions, petitions=petitions,
    )


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    term: int | None = Query(default=None),
    domain: str | None = Query(default=None),
    speaker: str | None = Query(default=None),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[SessionSummary]:
    where = []
    params: list = []
    if domain:
        where.append("a.policy_domain_id = ?")
        params.append(domain)
    if speaker:
        where.append(
            "EXISTS (SELECT 1 FROM debate_contributions c WHERE c.agenda_item_id = a.id AND c.member_id = ?)"
        )
        params.append(speaker)
    if date_from:
        where.append("s.session_date >= ?")
        params.append(date_from)
    if date_to:
        where.append("s.session_date <= ?")
        params.append(date_to)
    if term is not None:
        where.append("s.senedd_term = ?")
        params.append(term)
    sql = """SELECT s.id AS s_id, s.session_date, s.senedd_term, s.title_en AS s_title_en,
                    s.title_cy AS s_title_cy, s.source_xml_url, a.*
             FROM plenary_sessions s LEFT JOIN agenda_items a ON a.session_id = s.id"""
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY s.session_date, s.id, a.item_order"

    sessions: dict[str, SessionSummary] = {}
    for r in conn.execute(sql, params):
        session = sessions.get(r["s_id"])
        if session is None:
            session = sessions[r["s_id"]] = SessionSummary(
                id=r["s_id"], session_date=r["session_date"], senedd_term=r["senedd_term"],
                title_en=r["s_title_en"], title_cy=r["s_title_cy"], source_xml_url=r["source_xml_url"],
                items=[],
            )
        if r["id"] is not None:
            session.items.append(AgendaItemSummary(
                id=r["id"], item_order=r["item_order"], item_type=r["item_type"],
                title_en=r["title_en"], title_cy=r["title_cy"], policy_domain_id=r["policy_domain_id"],
            ))
    return list(sessions.values())
