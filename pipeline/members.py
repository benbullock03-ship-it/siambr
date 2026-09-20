"""Normalised member records, canonical IDs, party/term mapping, and the Gold-tier upsert."""

from __future__ import annotations

import re
import sqlite3
import unicodedata
from dataclasses import dataclass, field

from pipeline.seed import PARLIAMENTARY_TERMS

HONORIFICS = ("Rt. Hon.", "Rt. Hon", "Rt Hon.", "Rt Hon", "Y Gwir Anrhydeddus", "Y Gwir Anrh.", "Y Gw. Anrh.",
              "Dr.", "Dr", "Sir", "Dame", "Baroness", "Lord")
SUFFIXES = ("MS", "AS", "AM", "AC", "MBE", "OBE", "CBE", "QC", "KC")

PARTY_IDS = {
    "welsh labour": "labour",
    "welsh labour and co-operative party": "labour",
    "labour": "labour",
    "welsh labour and co-operative": "labour",
    "plaid cymru": "plaid_cymru",
    "welsh conservative party": "conservatives",
    "welsh conservatives": "conservatives",
    "conservative": "conservatives",
    "welsh liberal democrats": "libdems",
    "liberal democrat": "libdems",
    "reform uk": "reform_uk",
    "welsh green party": "greens",
    "green party": "greens",
    "ukip": "ukip",
    "uk independence party": "ukip",
    "independent": "independent",
    "independent member": "independent",
}

CABINET_LEVELS = (
    ("first minister", "first_minister"),
    ("deputy first minister", "deputy_first_minister"),
    ("counsel general", "counsel_general"),
    ("cabinet secretary", "cabinet_secretary"),
    ("cabinet minister", "cabinet_minister"),
    ("deputy minister", "deputy_minister"),
    ("minister", "minister"),
)


@dataclass
class Tenure:
    start_date: str
    end_date: str | None
    senedd_term: int
    party_id: str
    party_label: str | None = None
    party_provenance: str = "profile_current"
    is_regional_member: bool = False
    region_name: str | None = None
    seat_name: str | None = None
    seat_gss_code: str | None = None
    source_url: str | None = None


@dataclass
class Role:
    title_en: str
    title_cy: str
    start_date: str
    end_date: str | None
    cabinet_level: str | None
    provenance: str = "senedd_profile"
    source_url: str | None = None
    start_date_precision: str = "exact"


@dataclass
class MemberRecord:
    id: str
    canonical_name: str
    official_profile_url: str
    constituency_name_en: str
    constituency_name_cy: str
    current_status: str = "former"
    cymraeg_name: str | None = None
    honorific: str | None = None
    portrait_url: str | None = None
    gss_constituency_code: str | None = None
    tenures: list[Tenure] = field(default_factory=list)
    roles: list[Role] = field(default_factory=list)


def strip_name(raw: str) -> tuple[str, str | None]:
    """'Rt. Hon. Elin Jones MS' -> ('Elin Jones', 'Rt. Hon.')."""
    name = re.sub(r"\s+", " ", raw).strip()
    honorific = None
    for h in HONORIFICS:
        if name.lower().startswith(h.lower() + " "):
            honorific = "Rt. Hon." if h.lower().startswith(("rt", "y gw")) else h.rstrip(".")
            name = name[len(h):].strip()
            break
    tokens = name.split(" ")
    while len(tokens) > 1 and tokens[-1].strip(",").upper() in SUFFIXES:
        tokens.pop()
    return " ".join(tokens), honorific


def slugify(name: str) -> str:
    """'Andrew R T Davies' and 'Andrew RT Davies' both -> 'andrew-rt-davies'."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    while re.search(r"\b([A-Z])\s+(?=[A-Z]\b)", ascii_name):
        ascii_name = re.sub(r"\b([A-Z])\s+(?=[A-Z]\b)", r"\1", ascii_name)
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def canonical_id(name: str) -> str:
    return f"ms-{slugify(name)}"


def party_id_for(label: str | None) -> str:
    if not label:
        return "other"
    return PARTY_IDS.get(label.strip().lower(), "other")


def cabinet_level_for(title: str | None) -> str | None:
    if not title:
        return None
    t = title.lower()
    # "Deputy First Minister and Cabinet Minister for ..." must not match "first minister" first.
    if "deputy first minister" in t:
        return "deputy_first_minister"
    for needle, level in CABINET_LEVELS:
        if needle in t:
            return level
    return None


def term_for_date(iso_date: str) -> int | None:
    for term, _, _, start, end, _ in PARLIAMENTARY_TERMS:
        if start <= iso_date and (end is None or iso_date <= end):
            return term
    return None


def upsert_members(conn: sqlite3.Connection, records: list[MemberRecord]) -> dict[str, int]:
    """Replace each member's tenures and roles wholesale. Returns row counts."""
    counts = {"members": 0, "member_tenures": 0, "ministerial_roles": 0}
    with conn:
        for m in records:
            conn.execute(
                """INSERT INTO members (id, gss_constituency_code, constituency_name_en, constituency_name_cy,
                       canonical_name, cymraeg_name, honorific, portrait_url, official_profile_url, current_status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       gss_constituency_code = excluded.gss_constituency_code,
                       constituency_name_en = excluded.constituency_name_en,
                       constituency_name_cy = excluded.constituency_name_cy,
                       canonical_name = excluded.canonical_name,
                       cymraeg_name = COALESCE(excluded.cymraeg_name, members.cymraeg_name),
                       honorific = excluded.honorific,
                       portrait_url = COALESCE(excluded.portrait_url, members.portrait_url),
                       official_profile_url = excluded.official_profile_url,
                       current_status = excluded.current_status""",
                (m.id, m.gss_constituency_code, m.constituency_name_en, m.constituency_name_cy,
                 m.canonical_name, m.cymraeg_name, m.honorific, m.portrait_url,
                 m.official_profile_url, m.current_status),
            )
            counts["members"] += 1
            conn.execute("DELETE FROM member_tenures WHERE member_id = ?", (m.id,))
            conn.executemany(
                """INSERT INTO member_tenures (member_id, party_id, party_label, party_provenance, senedd_term,
                       is_regional_member, region_name, seat_name, seat_gss_code, start_date, end_date, source_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [(m.id, t.party_id, t.party_label, t.party_provenance, t.senedd_term,
                  int(t.is_regional_member), t.region_name, t.seat_name, t.seat_gss_code,
                  t.start_date, t.end_date, t.source_url)
                 for t in m.tenures],
            )
            counts["member_tenures"] += len(m.tenures)
            conn.execute("DELETE FROM ministerial_roles WHERE member_id = ?", (m.id,))
            conn.executemany(
                """INSERT INTO ministerial_roles (member_id, title_en, title_cy, cabinet_level, start_date, end_date,
                       provenance, source_url, start_date_precision)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [(m.id, r.title_en, r.title_cy, r.cabinet_level, r.start_date, r.end_date,
                  r.provenance, r.source_url, r.start_date_precision) for r in m.roles],
            )
            counts["ministerial_roles"] += len(m.roles)
    return counts
