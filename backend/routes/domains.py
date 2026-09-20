from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from backend.db import get_connection
from backend.schemas import PolicyDomain

router = APIRouter(prefix="/api/policy-domains", tags=["policy-domains"])


@router.get("", response_model=list[PolicyDomain])
def list_policy_domains(conn: sqlite3.Connection = Depends(get_connection)) -> list[PolicyDomain]:
    return [
        PolicyDomain(id=r["id"], name_en=r["name_en"], name_cy=r["name_cy"])
        for r in conn.execute("SELECT id, name_en, name_cy FROM policy_domains ORDER BY bearing_degrees")
    ]
