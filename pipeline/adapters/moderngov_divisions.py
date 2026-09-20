"""Modern.Gov electronic roll-call division adapter.

Uses the same mgWebService.asmx SOAP/XML surface as ``moderngov.py``'s members
lookup, on its ``GetVotingBallots`` operation (Modern.Gov's generic name for a
recorded division; a "ballot" is one Member's cast vote). Each ``<division>``
carries the meeting date and item title so a division can be matched back to
its ``agenda_items`` row without needing a private Modern.Gov meeting id.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime

import requests

from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.adapters.moderngov import BASE_URL
from pipeline.members import canonical_id, strip_name

DIVISIONS_OP = "GetVotingBallots"

VOTE_CAST = {
    "for": "for", "aye": "for", "yes": "for",
    "against": "against", "no": "against",
    "abstain": "abstain", "abstention": "abstain",
    "didnotvote": "did_not_vote", "absent": "did_not_vote",
}


@dataclass
class MemberBallot:
    member_id: str
    member_name: str
    vote_cast: str


@dataclass
class DivisionRecord:
    session_date: str
    item_title: str
    motion_text: str
    votes_for: int
    votes_against: int
    votes_abstain: int
    result: str
    ballots: list[MemberBallot] = field(default_factory=list)


def fetch_divisions_xml(session: requests.Session | None = None, **fetch_kwargs) -> bytes:
    body = fetch(f"{BASE_URL}/{DIVISIONS_OP}", session=session, namespace="moderngov", suffix=".xml", **fetch_kwargs)
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


def _int(el: ET.Element | None, tag: str) -> int:
    return int(_text(el, tag) or 0)


def parse_divisions_xml(body: bytes) -> list[DivisionRecord]:
    root = ET.fromstring(body)
    divisions: list[DivisionRecord] = []
    for div in root.iter("division"):
        session_date = _iso(_text(div, "meetingdate"))
        if not session_date:
            continue
        result_raw = (_text(div, "isagreed") or "").strip().lower()
        result = "agreed" if result_raw in ("true", "1", "agreed") else "negatived"
        rec = DivisionRecord(
            session_date=session_date,
            item_title=_text(div, "itemtitle") or "",
            motion_text=_text(div, "motiontitle") or "",
            votes_for=_int(div, "votesfor"),
            votes_against=_int(div, "votesagainst"),
            votes_abstain=_int(div, "votesabstain"),
            result=result,
        )
        for ballot in div.iter("ballot"):
            raw_name = _text(ballot, "membername") or ""
            if not raw_name:
                continue
            name, _honorific = strip_name(raw_name)
            vote_raw = (_text(ballot, "vote") or "").strip().lower().replace(" ", "")
            rec.ballots.append(MemberBallot(
                member_id=canonical_id(name), member_name=name,
                vote_cast=VOTE_CAST.get(vote_raw, "did_not_vote"),
            ))
        divisions.append(rec)
    return divisions


def load_divisions(**fetch_kwargs) -> list[DivisionRecord]:
    return parse_divisions_xml(fetch_divisions_xml(**fetch_kwargs))
