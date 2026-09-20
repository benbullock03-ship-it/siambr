"""Resolves a UK postcode to its ONS Senedd constituency GSS code via postcodes.io.

Never guesses a constituency: if the postcode is invalid, or the ONS Postcode
Directory record it returns carries no Senedd constituency code, this raises
rather than falling back to a nearest-match heuristic.
"""

from __future__ import annotations

import requests

POSTCODES_IO = "https://api.postcodes.io/postcodes"


class PostcodeUnresolved(Exception):
    pass


def resolve_gss_code(postcode: str, session: requests.Session | None = None, timeout: float = 5.0) -> str:
    """Returns the ONS Senedd constituency GSS code (W09...) for a postcode."""
    s = session or requests.Session()
    resp = s.get(f"{POSTCODES_IO}/{postcode.strip()}", timeout=timeout)
    if resp.status_code == 404:
        raise PostcodeUnresolved(f"postcode {postcode!r} not found")
    resp.raise_for_status()
    result = resp.json().get("result") or {}
    codes = result.get("codes") or {}
    gss = codes.get("senedd") or codes.get("senedd_constituency")
    if not gss:
        raise PostcodeUnresolved(
            f"postcode {postcode!r} resolved but carries no Senedd constituency code"
        )
    return gss
