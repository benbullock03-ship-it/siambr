"""gov.wales minister biographies: the one official page stating an appointment date.

Each Welsh Government minister has https://www.gov.wales/<senedd-slug> whose biography
contains "On 13 May 2026 <Name> was appointed <Title>." Only that sentence is used.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

import requests

from pipeline.adapters.http import SourceUnavailable, fetch

log = logging.getLogger(__name__)
GOV_WALES = "https://www.gov.wales"
APPOINTED = re.compile(r"On (\d{1,2} [A-Z][a-z]+ \d{4})[^.]{0,120}?was appointed", re.S)


def bio_url(senedd_profile_url: str) -> str:
    slug = senedd_profile_url.rstrip("/").rsplit("/", 1)[-1].lower()
    return f"{GOV_WALES}/{slug}"


def parse_appointment_date(page: str) -> str | None:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page))
    dates = [datetime.strptime(m.group(1), "%d %B %Y").strftime("%Y-%m-%d") for m in APPOINTED.finditer(text)]
    return max(dates) if dates else None


def fetch_appointment(senedd_profile_url: str, session: requests.Session | None = None,
                      **fetch_kwargs) -> tuple[str, str] | None:
    url = bio_url(senedd_profile_url)
    try:
        page = fetch(url, session=session, namespace="gov_wales", suffix=".html", retries=2, **fetch_kwargs)
    except SourceUnavailable as e:
        log.warning("gov.wales biography %s unavailable: %s", url, e)
        return None
    date = parse_appointment_date(page.decode("utf-8", "replace"))
    return (date, url) if date else None
