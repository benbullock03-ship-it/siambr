"""Record of Proceedings XMLExport adapter: plenary meeting index, Bronze mirror and row parsing.

Every meeting era seen so far (Fifth Senedd 2018, Seventh Senedd 2026) uses the same flat
row schema; only the row element name varies (``XML_Plenary_Bilingual``,
``XML_Plenary-FifthSenedd_Bilingual``), so rows are read positionally under ``<dataroot>``.
"""

from __future__ import annotations

import hashlib
import html
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlunsplit

import requests

from pipeline.adapters.http import BRONZE_DIR, SourceUnavailable, fetch

BASE_URL = "https://record.senedd.wales/XMLExport"
PLENARY_COMMITTEE_ID = 908
PLENARY_BRONZE = BRONZE_DIR / "plenary"

log = logging.getLogger(__name__)

_LIST_ROW = re.compile(
    r'<td class="number">\s*(\d{2})/(\d{2})/(\d{4})[^<]*</td>\s*<td class="text">\s*Plenary\s*</td>\s*'
    r'<td class="text">\s*<a href="/XMLExport/Download\?meetingID=(\d+)'
)
_LIST_TOTAL = re.compile(r'id="showTotal">(\d+)<')
_PARA_BREAK = re.compile(r"</p>\s*<p[^>]*>", re.I)
_BR = re.compile(r"<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")


class NotPlenary(SourceUnavailable):
    """XMLExport served a transcript, but of a committee, not Plenary."""


@dataclass(frozen=True)
class TranscriptRow:
    meeting_id: int
    assembly: int
    session_date: str
    contribution_id: str
    order: int
    language: str
    contribution_type: str
    agenda_item_id: str
    item_title_en: str
    item_title_cy: str
    mg_member_id: str
    member_name: str
    job_title_en: str
    verbatim_html: str
    translated_html: str
    spoken_tv_url: str
    translated_tv_url: str


def download_url(meeting_id: int) -> str:
    return f"{BASE_URL}/Download?meetingID={meeting_id}&xmlDownloadType=BilingualTranscript"


def list_plenary_meetings(start: str, end: str, session: requests.Session | None = None) -> list[tuple[str, int]]:
    """(session_date, meeting_id) pairs the XMLExport index lists between two ISO dates, oldest first."""
    text = fetch(f"{BASE_URL}/?committee={PLENARY_COMMITTEE_ID}&start={start}&end={end}", session=session).decode(
        "utf-8", "replace"
    )
    found = sorted({(f"{y}-{m}-{d}", int(mid)) for d, m, y, mid in _LIST_ROW.findall(text)})
    total = _LIST_TOTAL.search(text)
    if total and int(total.group(1)) > len(found):
        log.warning("XMLExport index reports %s meetings for %s..%s but %d were parsed", total.group(1), start, end, len(found))
    return found


def bronze_path(session_date: str, meeting_id: int) -> Path:
    return PLENARY_BRONZE / session_date[:4] / f"{session_date}-{meeting_id}.xml"


def meeting_date(body: bytes) -> str:
    m = re.search(rb"<MeetingDate>(\d{4}-\d{2}-\d{2})", body)
    if not m:
        raise SourceUnavailable("transcript has no <MeetingDate>")
    return m.group(1).decode()


def meeting_start_time(body: bytes) -> str | None:
    """HH:MM:SS of the first <MeetingDate>, the wall clock at Senedd TV offset 0; None when the date has no time."""
    m = re.search(rb"<MeetingDate>\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})", body)
    return m.group(1).decode() if m else None


def record_published_at(body: bytes) -> str | None:
    """The transcript's dataroot@generated, verbatim: Senedd's publication stamp for this release."""
    m = re.search(rb'<dataroot[^>]*\sgenerated="([^"]+)"', body)
    return m.group(1).decode() if m else None


def assembly_of(body: bytes) -> int | None:
    m = re.search(rb"<Assembly>(\d+)</Assembly>", body)
    return int(m.group(1)) if m else None


def is_plenary(body: bytes) -> bool:
    """Committee transcripts share the schema; only the row element name says which body met."""
    m = re.search(rb"<dataroot[^>]*>\s*<([A-Za-z_]+)", body)
    return bool(m) and m.group(1).startswith(b"XML_Plenary")


def sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def fetch_transcript(meeting_id: int, *, session: requests.Session | None = None, use_cache: bool = True) -> bytes:
    """Bilingual transcript bytes, verbatim, mirrored to data/bronze/plenary/{year}/{date}-{meeting}.xml."""
    if use_cache:
        cached = sorted(PLENARY_BRONZE.glob(f"*/*-{meeting_id}.xml"))
        if cached:
            return cached[0].read_bytes()
    body = fetch(download_url(meeting_id), session=session)
    # An unknown meetingID redirects to an HTML error page rather than returning 404.
    if b"<dataroot" not in body[:500]:
        raise SourceUnavailable(f"meeting {meeting_id}: XMLExport returned no transcript")
    if not is_plenary(body):
        raise NotPlenary(f"meeting {meeting_id}: not a Plenary transcript")
    path = bronze_path(meeting_date(body), meeting_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return body


def parse_transcript(body: bytes) -> list[TranscriptRow]:
    rows = []
    for el in ET.fromstring(body):
        f = {child.tag: child.text or "" for child in el}
        rows.append(TranscriptRow(
            meeting_id=int(f["Meeting_ID"]),
            assembly=int(f["Assembly"]),
            session_date=f["MeetingDate"][:10],
            contribution_id=f["Contribution_ID"].strip(),
            order=int(f["Contribution_Order_ID"]),
            language=f["contribution_language"].strip().lower(),
            contribution_type=f["contribution_type"].strip(),
            agenda_item_id=f["Agenda_Item_ID"].strip(),
            item_title_en=f["Agenda_item_english"].strip(),
            item_title_cy=f["Agenda_item_welsh"].strip(),
            mg_member_id=f["Member_Id"].strip(),
            member_name=f["Member_name_English"].strip(),
            job_title_en=f["Member_job_title_English"].strip(),
            verbatim_html=f["contribution_verbatim"],
            translated_html=f["contribution_translated"],
            spoken_tv_url=f["contribution_spoken_seneddTv"].strip(),
            translated_tv_url=f["contribution_translated_seneddTv"].strip(),
        ))
    return sorted(rows, key=lambda r: r.order)


def html_to_text(fragment: str) -> str:
    """Drop markup, split paragraphs with a blank line, decode entities. Characters of the words are untouched."""
    text = _BR.sub("\n", _PARA_BREAK.sub("\n\n", fragment))
    return html.unescape(_TAG.sub("", text)).strip()


def raw_start_pos(tv_url: str) -> str | None:
    """The startPos query value exactly as published, or None when the link carries none."""
    values = parse_qs(urlsplit(tv_url).query).get("startPos") if tv_url else None
    return values[0] if values else None


def start_pos(tv_url: str) -> int | None:
    """Seconds from meeting start, Senedd's own figure. A negative or malformed startPos is untimed (None)."""
    raw = raw_start_pos(tv_url)
    if raw is None or not re.fullmatch(r"\d+", raw):
        return None
    return int(raw)


def english_clip_base(tv_url: str) -> str | None:
    """'http://www.senedd.tv/en/16086?startPos=4&l=en' -> 'http://www.senedd.tv/en/16086'."""
    if not tv_url:
        return None
    parts = urlsplit(tv_url)
    if not parts.path.startswith("/en/"):
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
