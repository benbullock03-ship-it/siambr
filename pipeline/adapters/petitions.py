"""petitions.senedd.wales adapter.

The Senedd's petitions platform runs the same JSON:API-shaped "e-petitions"
software family as petitions.parliament.uk: a paginated ``/petitions.json``
index of ``{data: [{id, attributes: {...}}], links: {next}}`` rows. A
petition id like ``P-06-1353`` is exposed as ``attributes.action`` / the
petition's own reference, embedded in its ``link`` URL.
"""

from __future__ import annotations

import json
import re

import requests

from pipeline.adapters.http import SourceUnavailable, fetch

SITE = "https://petitions.senedd.wales"
INDEX_ENDPOINT = f"{SITE}/petitions.json"
SIGNATURE_THRESHOLD = 10_000

REF_RE = re.compile(r"(P-\d{2}-\d{4})")


def fetch_petitions_page(page: int = 1, session: requests.Session | None = None, **fetch_kwargs) -> dict:
    body = fetch(f"{INDEX_ENDPOINT}?page={page}", session=session, namespace="petitions", suffix=".json", **fetch_kwargs)
    try:
        data = json.loads(body)
    except json.JSONDecodeError as e:
        raise SourceUnavailable(f"petitions.senedd.wales returned non-JSON: {e}") from e
    if "data" not in data:
        raise SourceUnavailable("petitions.senedd.wales response missing 'data'")
    return data


def petition_ref(row: dict) -> str | None:
    """Extract the public 'P-06-1353' reference from a petition's own link URL."""
    link = row.get("links", {}).get("self") or row.get("link") or ""
    m = REF_RE.search(link)
    return m.group(1) if m else None


def parse_petitions_page(data: dict) -> list[dict]:
    out = []
    for row in data.get("data", []):
        attrs = row.get("attributes", {})
        ref = petition_ref(row) or str(row.get("id"))
        debate = attrs.get("debate") or {}
        out.append({
            "id": ref,
            "title_en": attrs.get("action") or "",
            "petitioner_name": attrs.get("creator_name"),
            "signature_count": int(attrs.get("signature_count") or 0),
            "opened_date": (attrs.get("created_at") or "")[:10] or None,
            "closing_date": (attrs.get("closed_at") or attrs.get("scheduled_closed_at") or "")[:10] or None,
            "status": attrs.get("state") or "open",
            "committee_response": attrs.get("committee_response") or attrs.get("government_response"),
            "source_url": row.get("links", {}).get("self") or f"{SITE}/petitions/{row.get('id')}",
            "debate_item_title": debate.get("debated_topic") if debate.get("debated") else None,
            "debate_session_date": (debate.get("debated_on") or "")[:10] or None,
        })
    return out


def exceeds_debate_threshold(petition: dict) -> bool:
    return petition["signature_count"] >= SIGNATURE_THRESHOLD


def load_petitions(max_pages: int = 20, session: requests.Session | None = None, **fetch_kwargs) -> list[dict]:
    s = session or requests.Session()
    petitions: list[dict] = []
    page = 1
    while page <= max_pages:
        data = fetch_petitions_page(page, s, **fetch_kwargs)
        rows = parse_petitions_page(data)
        petitions.extend(rows)
        if not rows or not data.get("links", {}).get("next"):
            break
        page += 1
    return petitions
