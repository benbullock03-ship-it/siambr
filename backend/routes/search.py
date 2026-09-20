from __future__ import annotations

import sqlite3
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db import get_connection
from backend.queries import member_summary
from backend.schemas import SearchHit, SearchResponse

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    domain: str | None = Query(default=None),
    term: int | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    conn: sqlite3.Connection = Depends(get_connection),
) -> SearchResponse:
    where = []
    params: list = [q]
    if domain:
        where.append("a.policy_domain_id = ?")
        params.append(domain)
    if term is not None:
        where.append("ps.senedd_term = ?")
        params.append(term)

    sql = """
        SELECT
            dc.id AS contribution_id, dc.agenda_item_id, dc.member_id,
            ps.session_date AS session_date, a.title_en AS agenda_item_title_en,
            snippet(debate_contributions_fts, 0, '<mark>', '</mark>', '…', 12) AS snippet,
            bm25(debate_contributions_fts) AS rank
        FROM debate_contributions_fts
        JOIN debate_contributions dc ON dc.rowid = debate_contributions_fts.rowid
        JOIN agenda_items a ON a.id = dc.agenda_item_id
        JOIN plenary_sessions ps ON ps.id = a.session_id
        WHERE debate_contributions_fts MATCH ?
    """
    if where:
        sql += " AND " + " AND ".join(where)
    sql += " ORDER BY rank LIMIT ?"
    params.append(limit)

    started = time.perf_counter()
    try:
        rows = conn.execute(sql, params).fetchall()
    except sqlite3.OperationalError as e:
        raise HTTPException(status_code=400, detail=f"invalid search query: {e}") from e
    took_ms = (time.perf_counter() - started) * 1000

    results = []
    for row in rows:
        member_row = conn.execute("SELECT * FROM members WHERE id = ?", (row["member_id"],)).fetchone()
        results.append(SearchHit(
            contribution_id=row["contribution_id"], agenda_item_id=row["agenda_item_id"],
            agenda_item_title_en=row["agenda_item_title_en"], member=member_summary(conn, member_row),
            session_date=row["session_date"], snippet=row["snippet"], rank=row["rank"],
        ))
    return SearchResponse(query=q, took_ms=took_ms, results=results)
