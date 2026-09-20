from __future__ import annotations

import sqlite3

import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.adapters.postcodes_io import PostcodeUnresolved, resolve_gss_code
from backend.db import get_connection
from backend.queries import member_summary
from backend.schemas import (
    MemberBallot, MemberProfile, MemberRecord, MemberSpeech, MemberSummary, MemberTenure, MinisterialRole,
    PostcodeResolution,
)

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberSummary])
def list_members(
    current: bool = Query(default=False, description="Only Members holding a seat today (open tenure)."),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[MemberSummary]:
    sql = "SELECT * FROM members"
    if current:
        # Older terms carry open-ended tenures the pipeline never closed, so "current"
        # means an open tenure in the term that is itself still open.
        sql += """ WHERE EXISTS (
            SELECT 1 FROM member_tenures t
            WHERE t.member_id = members.id AND t.end_date IS NULL
              AND t.senedd_term = (SELECT MAX(term) FROM parliamentary_terms WHERE end_date IS NULL))"""
    sql += " ORDER BY canonical_name, id"
    return [member_summary(conn, r) for r in conn.execute(sql)]


def _member_profile(conn: sqlite3.Connection, member_id: str) -> MemberProfile:
    row = conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"member {member_id!r} not found")

    tenures = [
        MemberTenure(
            senedd_term=t["senedd_term"], party_id=t["party_id"],
            is_regional_member=bool(t["is_regional_member"]), region_name=t["region_name"],
            start_date=t["start_date"], end_date=t["end_date"],
        )
        for t in conn.execute(
            "SELECT * FROM member_tenures WHERE member_id = ? ORDER BY start_date", (member_id,)
        )
    ]
    roles = [
        MinisterialRole(
            title_en=r["title_en"], title_cy=r["title_cy"], cabinet_level=r["cabinet_level"],
            start_date=r["start_date"], end_date=r["end_date"],
        )
        for r in conn.execute(
            "SELECT * FROM ministerial_roles WHERE member_id = ? ORDER BY start_date", (member_id,)
        )
    ]
    contribution_count = conn.execute(
        "SELECT COUNT(*) AS n FROM debate_contributions WHERE member_id = ?", (member_id,)
    ).fetchone()["n"]

    return MemberProfile(
        id=row["id"], canonical_name=row["canonical_name"], cymraeg_name=row["cymraeg_name"],
        honorific=row["honorific"], portrait_url=row["portrait_url"],
        official_profile_url=row["official_profile_url"], current_status=row["current_status"],
        constituency_name_en=row["constituency_name_en"], constituency_name_cy=row["constituency_name_cy"],
        tenures=tenures, roles=roles, contribution_count=contribution_count,
    )


@router.get("/{member_id}", response_model=MemberProfile)
def get_member(member_id: str, conn: sqlite3.Connection = Depends(get_connection)) -> MemberProfile:
    return _member_profile(conn, member_id)


@router.get("/{member_id}/record", response_model=MemberRecord)
def get_member_record(
    member_id: str,
    limit: int = Query(default=25, ge=1, le=200),
    conn: sqlite3.Connection = Depends(get_connection),
) -> MemberRecord:
    """A Member's own verbatim speeches and roll-call ballots, newest first."""
    profile = _member_profile(conn, member_id)
    speeches = [
        MemberSpeech(
            id=r["id"], agenda_item_id=r["agenda_item_id"], agenda_item_title_en=r["title_en"],
            session_date=r["session_date"], spoken_language=r["spoken_language"],
            verbatim_text_original=r["verbatim_text_original"], verbatim_text_english=r["verbatim_text_english"],
            video_timestamp_start=r["video_timestamp_start"],
        )
        for r in conn.execute(
            """SELECT c.id, c.agenda_item_id, c.spoken_language, c.verbatim_text_original,
                      c.verbatim_text_english, c.video_timestamp_start, a.title_en, s.session_date
               FROM debate_contributions c
               JOIN agenda_items a ON a.id = c.agenda_item_id
               JOIN plenary_sessions s ON s.id = a.session_id
               WHERE c.member_id = ?
               ORDER BY s.session_date DESC, a.item_order DESC, c.sequence_number DESC
               LIMIT ?""",
            (member_id, limit),
        )
    ]
    ballots = [
        MemberBallot(
            division_id=r["division_id"], agenda_item_id=r["agenda_item_id"], agenda_item_title_en=r["title_en"],
            session_date=r["session_date"], motion_text=r["motion_text"], result=r["result"],
            vote_cast=r["vote_cast"],
        )
        for r in conn.execute(
            """SELECT v.division_id, v.vote_cast, d.agenda_item_id, d.motion_text, d.result,
                      a.title_en, s.session_date
               FROM member_votes v
               JOIN division_votes d ON d.id = v.division_id
               JOIN agenda_items a ON a.id = d.agenda_item_id
               JOIN plenary_sessions s ON s.id = a.session_id
               WHERE v.member_id = ?
               ORDER BY s.session_date DESC, a.item_order DESC
               LIMIT ?""",
            (member_id, limit),
        )
    ]
    ballot_total = conn.execute(
        "SELECT COUNT(*) AS n FROM member_votes WHERE member_id = ?", (member_id,)
    ).fetchone()["n"]
    return MemberRecord(
        member=profile, speeches=speeches, speech_total=profile.contribution_count,
        ballots=ballots, ballot_total=ballot_total,
    )


@router.get("/by-postcode/{postcode}", response_model=PostcodeResolution)
def resolve_by_postcode(postcode: str, conn: sqlite3.Connection = Depends(get_connection)) -> PostcodeResolution:
    try:
        gss = resolve_gss_code(postcode)
    except PostcodeUnresolved as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"postcode lookup service unavailable: {e}") from e

    constituency_member = None
    const_row = conn.execute(
        """SELECT m.* FROM members m
           JOIN member_tenures t ON t.member_id = m.id
           WHERE m.gss_constituency_code = ? AND t.end_date IS NULL AND t.is_regional_member = 0
           LIMIT 1""",
        (gss,),
    ).fetchone()
    if const_row is not None:
        constituency_member = member_summary(conn, const_row)

    regional_rows = conn.execute(
        """SELECT DISTINCT m.* FROM members m
           JOIN member_tenures t ON t.member_id = m.id
           WHERE t.is_regional_member = 1 AND t.end_date IS NULL
             AND t.region_name IS NOT NULL
             AND t.region_name = (
                 SELECT region_name FROM member_tenures rt
                 JOIN members rm ON rm.id = rt.member_id
                 WHERE rm.gss_constituency_code = ? AND rt.is_regional_member = 0 AND rt.end_date IS NULL
                 LIMIT 1
             )""",
        (gss,),
    ).fetchall() if const_row is not None else []

    return PostcodeResolution(
        postcode=postcode,
        constituency_member=constituency_member,
        regional_members=[member_summary(conn, r) for r in regional_rows],
    )
