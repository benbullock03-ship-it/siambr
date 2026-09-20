from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from backend.db import get_connection
from backend.schemas import ParliamentaryTerm, PresidingOfficer

router = APIRouter(prefix="/api/terms", tags=["terms"])


@router.get("", response_model=list[ParliamentaryTerm])
def list_terms(conn: sqlite3.Connection = Depends(get_connection)) -> list[ParliamentaryTerm]:
    officers: dict[int, list[PresidingOfficer]] = {}
    for r in conn.execute(
        "SELECT * FROM presiding_officers ORDER BY senedd_term, start_date DESC, office"
    ):
        officers.setdefault(r["senedd_term"], []).append(
            PresidingOfficer(
                member_id=r["member_id"], office=r["office"], start_date=r["start_date"],
                end_date=r["end_date"], provenance=r["provenance"], source_url=r["source_url"],
            )
        )
    return [
        ParliamentaryTerm(
            term=r["term"], label_en=r["label_en"], label_cy=r["label_cy"],
            start_date=r["start_date"], end_date=r["end_date"], seat_count=r["seat_count"],
            presiding_officers=officers.get(r["term"], []),
        )
        for r in conn.execute("SELECT * FROM parliamentary_terms ORDER BY term")
    ]
