"""senedd.wales members adapter: search index for current Members, term archives for history.

Endpoints (all public, no key):
  POST https://senedd.wales/Umbraco/AzureSearch/Search/Search?jsonResults=true&pageSizeOverride=N
       the "Find a Member" form's own search call; returns every current Member as JSON.
  GET  https://senedd.wales/archive/<term>/elected-members-.../  one listing per past term.
  GET  https://senedd.wales/people/<slug>/                       profile: party, seat, title,
       portrait, terms of office. senedd.cymru/pobl/<slug>/ gives the Welsh-language name.
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import datetime

import requests

from pipeline.adapters import gov_wales
from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.members import (
    MemberRecord, Role, Tenure, cabinet_level_for, canonical_id, party_id_for, strip_name, term_for_date,
)
from pipeline.reference.gss import is_region, lookup_constituency, region_cy
from pipeline.seed import PARLIAMENTARY_TERMS

log = logging.getLogger(__name__)
PARLIAMENTARY_TERM_STARTS = {t[0]: t[3] for t in PARLIAMENTARY_TERMS}

SITE = "https://senedd.wales"
SITE_CY = "https://senedd.cymru"
FIND_MEMBER_PAGE = f"{SITE}/find-a-member-of-the-senedd/"
SEARCH_ENDPOINT = f"{SITE}/Umbraco/AzureSearch/Search/Search"

ARCHIVE_MEMBER_PAGES = {
    1: "/archive/first-assembly-1999-2003/elected-members-first-assembly/",
    2: "/archive/second-assembly-2003-2007/elected-members-second-assembly/",
    3: "/archive/third-assembly-2007-2011/elected-members-third-assembly/",
    4: "/archive/fourth-assembly-2011-2016/elected-members-fourth-assembly-2011-2016/",
    5: "/archive/fifth-senedd-2016-2021/elected-members-fifth-senedd-2016-2021/",
    6: "/archive/sixth-senedd-2021-2026/elected-members-sixth-senedd-2021-2026/",
}

# Umbraco form field ids as rendered on FIND_MEMBER_PAGE (2026-09-14).
SEARCH_FORM = {
    "Id": "1022", "Page": "1", "Culture": "en-GB",
    "FormFields[0].Id": "1176", "FormFields[0].Value": "",
    "FormFields[1].Id": "1177", "FormFields[1].Value": "false",
    "FormFields[2].Id": "1178", "FormFields[2].Value": "false",
    "FormFields[3].Id": "1179", "FormFields[3].Value": "false",
    "FormFields[4].Id": "1180", "FormFields[5].Id": "1181", "FormFields[6].Id": "1182",
}


def _clean(fragment: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", fragment))).strip()


def _title_case_name(lower: str) -> str:
    """Search index lowercases names; profile pages carry the real casing, so this is a fallback."""
    return " ".join(w if w in ("ap", "ab", "de", "o'") else w[:1].upper() + w[1:] for w in lower.split())


# ---- current Members (search index) -------------------------------------------------------

def fetch_current_members_json(session: requests.Session | None = None, page_size: int = 200,
                               use_cache: bool = True, **fetch_kwargs) -> dict:
    s = session or requests.Session()
    page = fetch(FIND_MEMBER_PAGE, session=s, namespace="senedd_site", suffix=".html",
                 use_cache=False, **fetch_kwargs).decode("utf-8", "replace")
    tok = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', page)
    ufprt = re.search(r'name="ufprt"[^>]*value="([^"]+)"', page)
    if not tok or not ufprt:
        raise SourceUnavailable("Find-a-Member page no longer carries the search form tokens")
    fields = dict(SEARCH_FORM, __RequestVerificationToken=tok.group(1), ufprt=ufprt.group(1))
    body = fetch(
        f"{SEARCH_ENDPOINT}?jsonResults=true&pageSizeOverride={page_size}", session=s, method="POST",
        namespace="senedd_site", suffix=".json", use_cache=use_cache,
        files={k: (None, v) for k, v in fields.items()},
        headers={"RequestVerificationToken": tok.group(1), "X-Requested-With": "XMLHttpRequest"},
        **fetch_kwargs,
    )
    data = json.loads(body)
    if data.get("totalCount", 0) > len(data.get("results", [])):
        raise SourceUnavailable(f"search page size {page_size} smaller than totalCount {data['totalCount']}")
    return data


def parse_current_members(data: dict) -> list[dict]:
    """Flatten search hits to {name, url_en, url_cy, constituency, party, group, title_en, title_cy, is_minister}."""
    out = []
    for hit in data["results"]:
        d = hit["document"]
        parties = d.get("site_politicalParty") or []
        groups = d.get("site_politicalPartyGroup") or []
        out.append({
            "site_id": d.get("id"),
            "name": d.get("site_personName_en_gb") or d.get("title_en_gb") or "",
            "name_cy": d.get("site_personName_cy_gb"),
            "url_en": (d.get("url_en_gb") or "").replace("http://", "https://"),
            "url_cy": (d.get("url_cy_gb") or "").replace("http://", "https://"),
            "constituency": d.get("site_constituency_en_gb") or "",
            "party": parties[0]["partyName"] if parties else None,
            "group": groups[0]["partyGroupName"] if groups else None,
            "title_en": d.get("site_personTitle_en_gb"),
            "title_cy": d.get("site_personTitle_cy_gb"),
            "is_minister": bool(d.get("site_isMinister")),
            "is_active": bool(d.get("site_isActiveMs")),
        })
    return out


# ---- term archives ---------------------------------------------------------------------------

ARCHIVE_ITEM = re.compile(
    r'<li>\s*<a href="(?P<href>/people/[^"]+)">(?:\s*<img(?P<img>[^>]*)>)?\s*</a>'
    r'\s*<p>\s*<a[^>]*>(?P<name>[^<]*)</a>\s*</p>\s*<p>(?P<seat>[^<]*)</p>',
    re.S,
)
IMG_SRC = re.compile(r'src="([^"]*)"')


def fetch_archive_members(term: int, session: requests.Session | None = None, **fetch_kwargs) -> list[dict]:
    url = SITE + ARCHIVE_MEMBER_PAGES[term]
    page = fetch(url, session=session, namespace="senedd_site", suffix=".html", **fetch_kwargs).decode("utf-8", "replace")
    return parse_archive_members(page, term)


def _img_src(attrs: str | None) -> str | None:
    m = IMG_SRC.search(attrs or "")
    return html.unescape(m.group(1)) if m and m.group(1) else None


def parse_archive_members(page: str, term: int) -> list[dict]:
    rows = []
    for m in ARCHIVE_ITEM.finditer(page):
        rows.append({
            "term": term,
            "name": _clean(m.group("name")),
            "url_en": SITE + html.unescape(m.group("href")),
            "seat": _clean(m.group("seat")),
            "portrait": _img_src(m.group("img")),
        })
    return rows


# ---- profile pages ---------------------------------------------------------------------------

BASIC = re.compile(r'class="person-details-basic-info person-details-basic-info--(?P<key>[a-z-]+)"[^>]*>(?P<val>.*?)</(?:h1|p|div|span)>', re.S)
TERMS_BLOCK = re.compile(r'id="termsOfOfficeContent">.*?</ol>', re.S)
DATE_RANGE = re.compile(r"(\d{2}/\d{2}/\d{4})\s*-\s*(\d{2}/\d{2}/\d{4})?")
PORTRAIT = re.compile(r'<img[^>]*class="person-details-profile-image"[^>]*(?:data-src|src)="([^"]+)"')
H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)


def _iso(uk: str) -> str:
    return datetime.strptime(uk, "%d/%m/%Y").strftime("%Y-%m-%d")


def parse_profile(page: str, url: str) -> dict:
    basic = {m.group("key"): _clean(m.group("val")) for m in BASIC.finditer(page)}
    h1 = H1.search(page)
    terms = []
    block = TERMS_BLOCK.search(page)
    if block:
        for start, end in DATE_RANGE.findall(block.group(0)):
            terms.append((_iso(start), _iso(end) if end else None))
    portrait = PORTRAIT.search(page)
    return {
        "url": url,
        "name": basic.get("name") or (_clean(h1.group(1)) if h1 else ""),
        "party": basic.get("party-name"),
        "group": basic.get("party-group-name"),
        "constituency": basic.get("constituency"),
        "title": basic.get("title"),
        "portrait": html.unescape(portrait.group(1)) if portrait else None,
        "terms_of_office": sorted(set(terms)),
    }


def fetch_profile(url: str, session: requests.Session | None = None, **fetch_kwargs) -> dict:
    page = fetch(url, session=session, namespace="senedd_site/people", suffix=".html", **fetch_kwargs)
    return parse_profile(page.decode("utf-8", "replace"), url)


def cymraeg_url(url_en: str) -> str:
    path = url_en.split("senedd.wales", 1)[-1].replace("/people/", "/pobl/")
    path = re.sub(r"-ms/?$", "-as/", path, flags=re.I)
    path = re.sub(r"-am/?$", "-ac/", path, flags=re.I)
    return SITE_CY + path


def fetch_cymraeg_name(url_cy: str, session: requests.Session | None = None, **fetch_kwargs) -> str | None:
    try:
        page = fetch(url_cy, session=session, namespace="senedd_site/pobl", suffix=".html",
                     retries=2, **fetch_kwargs).decode("utf-8", "replace")
    except SourceUnavailable:
        return None
    m = H1.search(page)
    if not m:
        return None
    name, _ = strip_name(_clean(m.group(1)))
    return name or None


# ---- assembly -------------------------------------------------------------------------------

def _dedupe_overlapping_tenures(tenures: list[Tenure]) -> list[Tenure]:
    """senedd.wales profile pages sometimes list a term-of-office range that starts before
    the next Senedd's true first sitting day (its dissolution-day convention), which
    term_for_date buckets into the wrong (prior) term -- duplicating the correctly-dated
    tenure the archive-term loop derives for the real term. Where two tenures' date ranges
    overlap, keep whichever carries a seat; a blank one is assumed to be that artifact."""
    result: list[Tenure] = []
    for t in sorted(tenures, key=lambda t: t.start_date):
        end = t.end_date or "9999-12-31"
        merged = False
        for i, r in enumerate(result):
            r_end = r.end_date or "9999-12-31"
            if t.start_date <= r_end and r.start_date <= end:
                if r.seat_name is None and t.seat_name is not None:
                    result[i] = t
                merged = True
                break
        if not merged:
            result.append(t)
    return result


def _tenure_seat(seat: str | None) -> dict:
    if not seat:
        return {}
    if is_region(seat):
        return {"is_regional_member": True, "region_name": seat.title() if seat == seat.lower() else seat, "seat_name": seat}
    gss = lookup_constituency(seat)
    return {"seat_name": gss[1] if gss else seat, "seat_gss_code": gss[0] if gss else None}


def _seat_fields(seat: str) -> dict:
    gss = lookup_constituency(seat)
    if gss:
        return {"gss_constituency_code": gss[0], "constituency_name_en": gss[1], "constituency_name_cy": gss[2]}
    return {"gss_constituency_code": None, "constituency_name_en": seat, "constituency_name_cy": region_cy(seat) or seat}


def build_records(current: list[dict], archives: list[dict], profiles: dict[str, dict],
                  cymraeg: dict[str, str | None] | None = None,
                  appointments: dict[str, tuple[str, str] | None] | None = None) -> list[MemberRecord]:
    """Merge the page types into MemberRecords keyed by canonical id.

    ``appointments`` maps profile url key -> (iso_date, gov.wales url) for current ministers.
    Without one, a role starts at the Seventh Senedd's first sitting day with precision 'term_floor'.
    """
    cymraeg = cymraeg or {}
    appointments = appointments or {}
    by_url: dict[str, dict] = {}
    for row in archives:
        key = url_key_of(row["url_en"])
        by_url.setdefault(key, {"terms": {}, "portrait": row["portrait"], "name": row["name"], "url": row["url_en"]})
        by_url[key]["terms"][row["term"]] = row["seat"]
    current_by_url = {url_key_of(c["url_en"]): c for c in current}

    per_url: list[MemberRecord] = []
    for url_key in sorted(set(by_url) | set(current_by_url)):
        prof = profiles.get(url_key) or {}
        cur = current_by_url.get(url_key)
        arch = by_url.get(url_key, {"terms": {}, "portrait": None, "name": "", "url": None})
        raw_name = prof.get("name") or arch["name"] or (cur["name"] if cur else "")
        if not raw_name:
            log.warning("no name for %s; skipped", url_key)
            continue
        if raw_name == raw_name.lower():
            raw_name = _title_case_name(raw_name)
        name, honorific = strip_name(raw_name)
        mid = canonical_id(name)
        party_label = (prof.get("party") or (cur or {}).get("party") or None)
        if party_label:
            party_label = party_label if party_label != party_label.lower() else party_label.title()
        seat_now = prof.get("constituency") or (cur or {}).get("constituency") or max(arch["terms"].items(), default=(0, ""))[1]
        if seat_now == seat_now.lower():
            seat_now = seat_now.title()
        url = prof.get("url") or (cur or {}).get("url_en") or arch["url"]

        rec = MemberRecord(
            id=mid, canonical_name=name, honorific=honorific, official_profile_url=url,
            portrait_url=prof.get("portrait") or arch["portrait"],
            cymraeg_name=cymraeg.get(url_key) or ((cur or {}).get("name_cy") and strip_name(_title_case_name(cur["name_cy"]))[0]),
            current_status="active" if cur and cur["is_active"] else "former",
            **_seat_fields(seat_now),
        )
        # The search-index fallback is a lowercased English name re-cased by rule; when it is the
        # English name in any casing it is no Welsh name at all and must not be shown as one.
        if rec.cymraeg_name and rec.cymraeg_name.casefold() == rec.canonical_name.casefold():
            rec.cymraeg_name = None

        ranges = prof.get("terms_of_office") or []
        if not ranges and cur:
            ranges = [(PARLIAMENTARY_TERM_STARTS[7], None)]
        for start, end in ranges:
            term = term_for_date(start)
            if term is None:
                continue
            seat_then = arch["terms"].get(term) or (seat_now if term == 7 else None)
            rec.tenures.append(Tenure(
                start_date=start, end_date=end, senedd_term=term, party_id=party_id_for(party_label),
                party_label=party_label, party_provenance="profile_current", source_url=url,
                **_tenure_seat(seat_then),
            ))
        for term, seat in arch["terms"].items():
            if not any(t.senedd_term == term for t in rec.tenures):
                rec.tenures.append(Tenure(
                    start_date=PARLIAMENTARY_TERM_STARTS[term], end_date=None, senedd_term=term,
                    party_id=party_id_for(party_label), party_label=party_label, party_provenance="profile_current",
                    source_url=SITE + ARCHIVE_MEMBER_PAGES[term], **_tenure_seat(seat),
                ))
        rec.tenures = _dedupe_overlapping_tenures(rec.tenures)

        title_en = (cur or {}).get("title_en") or prof.get("title")
        if cur and cur["is_minister"] and title_en:
            appt = appointments.get(url_key)
            start = appt[0] if appt else next((t.start_date for t in rec.tenures if t.senedd_term == 7), PARLIAMENTARY_TERM_STARTS[7])
            rec.roles.append(Role(
                title_en=_title_case_title(title_en), title_cy=_title_case_title(cur.get("title_cy") or title_en),
                start_date=start, end_date=None, cabinet_level=cabinet_level_for(title_en),
                provenance="gov_wales" if appt else "senedd_profile", source_url=appt[1] if appt else url,
                start_date_precision="exact" if appt else "term_floor",
            ))
        per_url.append(rec)
    return merge_by_id(per_url)


def url_key_of(url: str) -> str:
    return url.rstrip("/").lower()


def merge_by_id(records: list[MemberRecord]) -> list[MemberRecord]:
    """The same person appears under several profile URLs across term archives
    (e.g. /people/Altaf-Hussain/ and /people/Altaf-Hussain-MS/); fold them by canonical id."""
    merged: dict[str, MemberRecord] = {}
    for rec in records:
        base = merged.get(rec.id)
        if base is None:
            merged[rec.id] = rec
            continue
        richer, other = (rec, base) if rec.current_status == "active" or (len(rec.tenures) > len(base.tenures) and base.current_status != "active") else (base, rec)
        for field_name in ("cymraeg_name", "honorific", "portrait_url", "gss_constituency_code"):
            if getattr(richer, field_name) is None and getattr(other, field_name) is not None:
                setattr(richer, field_name, getattr(other, field_name))
        by_term = {t.senedd_term: t for t in richer.tenures}
        for t in other.tenures:
            mine = by_term.get(t.senedd_term)
            if mine is None:
                richer.tenures.append(t)
            elif mine.seat_name is None and t.seat_name is not None:
                mine.seat_name, mine.seat_gss_code = t.seat_name, t.seat_gss_code
                mine.is_regional_member, mine.region_name = t.is_regional_member, t.region_name
        richer.tenures.sort(key=lambda t: t.start_date)
        seen_roles = {(r.title_en, r.start_date) for r in richer.roles}
        richer.roles.extend(r for r in other.roles if (r.title_en, r.start_date) not in seen_roles)
        merged[rec.id] = richer
    return list(merged.values())


def _title_case_title(t: str) -> str:
    if t != t.lower():
        return t
    small = {"for", "and", "of", "the", "a", "dros", "ac", "a'r", "y", "ar", "am"}
    words = [w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(t.split())]
    return " ".join(words).replace(" Y ", " y ")


def load_members(session: requests.Session | None = None, terms: range | list[int] = range(1, 8),
                 with_cymraeg: bool = True, progress=None, **fetch_kwargs) -> list[MemberRecord]:
    s = session or requests.Session()
    current = parse_current_members(fetch_current_members_json(s, **fetch_kwargs)) if 7 in terms else []
    current_by_url = {url_key_of(c["url_en"]): c for c in current}
    archives: list[dict] = []
    for term in terms:
        if term in ARCHIVE_MEMBER_PAGES:
            archives.extend(fetch_archive_members(term, s, **fetch_kwargs))
    originals: dict[str, str] = {}
    for row in archives:
        originals.setdefault(url_key_of(row["url_en"]), row["url_en"])
    for c in current:
        originals[url_key_of(c["url_en"])] = c["url_en"]
    urls = sorted(originals)
    profiles: dict[str, dict] = {}
    cymraeg: dict[str, str | None] = {}
    for i, key in enumerate(urls):
        url = originals[key]
        try:
            profiles[key] = fetch_profile(url, s, **fetch_kwargs)
        except SourceUnavailable as e:
            log.warning("profile %s unavailable: %s", url, e)
        if with_cymraeg:
            cur = current_by_url.get(key)
            cymraeg[key] = fetch_cymraeg_name(cur["url_cy"] if cur and cur["url_cy"] else cymraeg_url(url), s, **fetch_kwargs)
        if progress:
            progress(i + 1, len(urls), url)
    appointments = {
        url_key_of(c["url_en"]): gov_wales.fetch_appointment(c["url_en"], s, **fetch_kwargs)
        for c in current if c["is_minister"]
    }
    return build_records(current, archives, profiles, cymraeg, appointments)
