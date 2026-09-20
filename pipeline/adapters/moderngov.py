"""Modern.Gov (mgWebService.asmx) members adapter.

The Senedd's Modern.Gov instance exposes members through the ``GetCouncillorsByWard``
XML method (Modern.Gov's generic name; a "ward" is a Senedd constituency). It lists the
96 sitting Members with their terms of office but no former Members and no key posts,
and on 2026-09-14 it answered most requests with its "Service unavailable" page (HTTP
403). reconcile_members therefore uses senedd.wales as the backbone and this adapter as
a cross-check of the sitting membership whenever the service answers.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime

import requests

from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.members import MemberRecord, Role, Tenure, cabinet_level_for, canonical_id, party_id_for, strip_name, term_for_date
from pipeline.reference.gss import is_region, lookup_constituency, region_cy

BASE_URL = "https://business.senedd.wales/mgWebService.asmx"
MEMBERS_OP = "GetCouncillorsByWard"


def fetch_members_xml(session: requests.Session | None = None, **fetch_kwargs) -> bytes:
    body = fetch(f"{BASE_URL}/{MEMBERS_OP}", session=session, namespace="moderngov", suffix=".xml", **fetch_kwargs)
    if not body.lstrip().startswith(b"<"):
        raise SourceUnavailable("Modern.Gov returned a non-XML body")
    if b"<html" in body[:400].lower():
        raise SourceUnavailable("Modern.Gov returned its HTML outage page")
    return body


def _iso(mg_date: str | None) -> str | None:
    if not mg_date or not re.match(r"\d{2}/\d{2}/\d{4}", mg_date.strip()):
        return None
    return datetime.strptime(mg_date.strip()[:10], "%d/%m/%Y").strftime("%Y-%m-%d")


def _text(el: ET.Element | None, tag: str) -> str | None:
    if el is None:
        return None
    node = el.find(tag)
    return node.text.strip() if node is not None and node.text else None


def parse_members_xml(body: bytes) -> list[MemberRecord]:
    root = ET.fromstring(body)
    records: dict[str, MemberRecord] = {}
    for ward in root.iter("ward"):
        seat = _text(ward, "wardtitle") or ""
        for c in ward.iter("councillor"):
            raw_name = _text(c, "fullusername") or ""
            name, honorific = strip_name(raw_name)
            mid = canonical_id(name)
            party_label = _text(c, "politicalpartytitle")
            profile = f"https://business.senedd.wales/mgUserInfo.aspx?UID={_text(c, 'councillorid')}"
            gss = lookup_constituency(seat)
            regional = is_region(seat)
            rec = records.get(mid) or MemberRecord(
                id=mid, canonical_name=name, honorific=honorific, official_profile_url=profile,
                portrait_url=_text(c, "photobigurl") or _text(c, "photosmallurl"),
                constituency_name_en=gss[1] if gss else seat,
                constituency_name_cy=gss[2] if gss else (region_cy(seat) or seat),
                gss_constituency_code=gss[0] if gss else None,
            )
            for term_el in c.iter("termofoffice"):
                start, end = _iso(_text(term_el, "startdate")), _iso(_text(term_el, "enddate"))
                if not start:
                    continue
                term = term_for_date(start)
                if term is None:
                    continue
                rec.tenures.append(Tenure(
                    start_date=start, end_date=end, senedd_term=term, party_id=party_id_for(party_label),
                    party_label=party_label, party_provenance="profile_current",
                    is_regional_member=regional, region_name=seat if regional else None, source_url=profile,
                ))
                if end is None:
                    rec.current_status = "active"
            for post in c.iter("keypost"):
                title = _text(post, "title") or ""
                start = _iso(_text(post, "startdate"))
                if title and start:
                    rec.roles.append(Role(
                        title_en=title, title_cy=_text(post, "titlecy") or title, start_date=start,
                        end_date=_iso(_text(post, "enddate")), cabinet_level=cabinet_level_for(title),
                        provenance="moderngov", source_url=profile,
                    ))
            records[mid] = rec
    return list(records.values())


def load_members(**fetch_kwargs) -> list[MemberRecord]:
    return parse_members_xml(fetch_members_xml(**fetch_kwargs))
