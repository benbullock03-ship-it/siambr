"""Record of Proceedings XMLExport ``Votes`` adapter: roll-call divisions per plenary meeting.

Same canonical host as the transcripts (``record.senedd.wales/XMLExport``), download type
``Votes``. One ``XML_Plenary_Vote`` row per Member per vote; rows of one vote share a
``Contribution_ID`` and carry the publisher's totals, result wording and the agenda item the
vote was taken under (Voting Time, usually). A meeting with no divisions returns an empty
``<dataroot/>``, which is a valid answer and is mirrored like any other.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

import requests

from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.adapters.plenary_xml import BASE_URL, PLENARY_BRONZE

VOTE_CAST = {"for": "for", "against": "against", "abstain": "abstain", "didnotvote": "did_not_vote"}
_AGREED = re.compile(r"\b(agreed|accepted|carried|passed)\b", re.I)
_NEGATIVED = re.compile(r"\b(rejected|negatived|defeated|fell|not agreed)\b", re.I)


@dataclass(frozen=True)
class Ballot:
    mg_member_id: str
    member_name: str
    vote_cast: str


@dataclass
class DivisionRecord:
    meeting_id: int
    session_date: str
    vote_id: str
    agenda_item_ref: str
    item_title_en: str
    motion_text_en: str
    motion_text_cy: str
    votes_for: int
    votes_against: int
    votes_abstain: int
    result_en: str
    result: str
    ballots: list[Ballot] = field(default_factory=list)
    """The Presiding Officer's casting vote on a tie, as the Record lists it; outside the tally."""
    casting_vote: str | None = None

    @property
    def agenda_item_id(self) -> str:
        return f"item-{self.meeting_id}-{self.agenda_item_ref}"

    @property
    def id(self) -> str:
        return f"division-{self.meeting_id}-{self.vote_id}"


def votes_url(meeting_id: int) -> str:
    return f"{BASE_URL}/Download?meetingID={meeting_id}&xmlDownloadType=Votes"


def bronze_votes_path(session_date: str, meeting_id: int) -> Path:
    return PLENARY_BRONZE / session_date[:4] / f"{session_date}-{meeting_id}-votes.xml"


def fetch_votes(meeting_id: int, session_date: str, *, session: requests.Session | None = None, use_cache: bool = True) -> bytes:
    """Votes XML bytes, verbatim, mirrored beside the transcript as {date}-{meeting}-votes.xml."""
    path = bronze_votes_path(session_date, meeting_id)
    if use_cache and path.exists():
        return path.read_bytes()
    body = fetch(votes_url(meeting_id), session=session)
    if b"<dataroot" not in body[:500]:
        raise SourceUnavailable(f"meeting {meeting_id}: XMLExport returned no votes document")
    path.parent.mkdir(parents=True, exist_ok=True)
    if not (path.exists() and path.read_bytes() == body):
        path.write_bytes(body)
    return body


def result_of(result_en: str) -> str:
    """'agreed' or 'negatived' from the publisher's wording; unknown wording is an error, never a guess."""
    if _AGREED.search(result_en) and not _NEGATIVED.search(result_en):
        return "agreed"
    if _NEGATIVED.search(result_en):
        return "negatived"
    raise ValueError(f"unrecognised vote result wording: {result_en!r}")


def parse_votes(body: bytes) -> list[DivisionRecord]:
    divisions: dict[str, DivisionRecord] = {}
    for el in ET.fromstring(body):
        f = {child.tag: (child.text or "").strip() for child in el}
        vote_id = f["Contribution_ID"]
        d = divisions.get(vote_id)
        if d is None:
            d = DivisionRecord(
                meeting_id=int(f["Meeting_ID"]),
                session_date=f["MeetingDate"][:10],
                vote_id=vote_id,
                agenda_item_ref=f["Agenda_Item_ID"],
                item_title_en=f["Agenda_item_english"],
                motion_text_en=f["Vote_Name_English"],
                motion_text_cy=f["Vote_Name_Welsh"],
                votes_for=int(f["VotesTotalFor"]),
                votes_against=int(f["VotesTotalAgainst"]),
                votes_abstain=int(f["VotesTotalAbstain"]),
                result_en=f["Vote_Result_English"],
                result=result_of(f["Vote_Result_English"]),
            )
            divisions[vote_id] = d
        cast = f["Results_Result"].lower().replace(" ", "")
        if cast not in VOTE_CAST:
            raise ValueError(f"vote {vote_id}: unrecognised ballot value {f['Results_Result']!r}")
        # A tie adds a row named "Casting Vote" with Member_Id 0: the Llywydd's casting vote, not a Member's ballot.
        if f["Member_Id"] == "0" and f["Member_name_English"].strip().lower() == "casting vote":
            if d.casting_vote is not None:
                raise ValueError(f"vote {vote_id}: two casting votes")
            d.casting_vote = VOTE_CAST[cast]
            continue
        d.ballots.append(Ballot(mg_member_id=f["Member_Id"], member_name=f["Member_name_English"], vote_cast=VOTE_CAST[cast]))
    return list(divisions.values())


def tally(d: DivisionRecord) -> tuple[int, int, int]:
    return (
        sum(1 for b in d.ballots if b.vote_cast == "for"),
        sum(1 for b in d.ballots if b.vote_cast == "against"),
        sum(1 for b in d.ballots if b.vote_cast == "abstain"),
    )
