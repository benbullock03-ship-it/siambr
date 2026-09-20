"""1999 National Assembly for Wales election: all 40 constituency winners and the 20 regional
top-up (list) Members, with party.

senedd.wales's own term archives and profile pages carry no data at all for many First
Assembly (1999-2003) Members -- neither party nor seat -- so the Silver-tier merge in
pipeline.adapters.senedd_site leaves those tenure rows without a seat. This table backfills
them from BBC News's 1999 Wales election results microsite, which is the primary source
Wikipedia itself cites for these results (e.g. the Val Feld and Christine Gwyther articles).

Source: BBC News, "Vote 99: Wales", http://news.bbc.co.uk/hi/english/static/vote_99/wales_99/
  constituency pages: html/constituency/<1-46>.stm (IDs 1-46 include 6 non-Welsh ids shared
  with the Scottish Parliament microsite, skipped here)
  region pages: html/region/<1-5>.stm
Fetched live 2026-09-14. source_url values point through the Wayback Machine
(web.archive.org/web/2026/<original BBC url>) rather than the live BBC page directly: BBC's
old microsite serves plain HTTP and 301-redirects HTTPS requests back to HTTP on the same
host, which many browsers refuse or flag as insecure -- the Wayback redirector always serves
over HTTPS and resolves to the nearest archived snapshot.
"""

from __future__ import annotations

from pipeline.members import Tenure, canonical_id, party_id_for
from pipeline.reference.gss import lookup_constituency

BBC_1999 = "http://news.bbc.co.uk/hi/english/static/vote_99/wales_99/html"
WAYBACK_1999 = "https://web.archive.org/web/2026/" + BBC_1999

_PARTY_LABELS = {
    "LAB": "Labour", "PC": "Plaid Cymru", "CON": "Conservative", "LD": "Liberal Democrat",
}

# (member canonical name as ingested, BBC page id, seat name). Two names differ from the BBC
# byline: "Rhodri Thomas" was BBC's short form for Rhodri Glyn Thomas; the DB's ingested forms
# for the other two are "Nick Bourne" and "Christine Humphries" (BBC: "Nicholas Bourne",
# "Christine Humphreys").
CONSTITUENCY_WINNERS_1999 = [
    ("Brian Gibbons", 1, "Aberavon", "LAB"), ("Tom Middlehurst", 2, "Alyn & Deeside", "LAB"),
    ("Peter Law", 3, "Blaenau Gwent", "LAB"), ("Kirsty Williams", 4, "Brecon & Radnorshire", "LD"),
    ("Carwyn Jones", 5, "Bridgend", "LAB"), ("Dafydd Wigley", 6, "Caernarfon", "PC"),
    ("Ron Davies", 7, "Caerphilly", "LAB"), ("Jenny Randerson", 8, "Cardiff Central", "LD"),
    ("Sue Essex", 9, "Cardiff North", "LAB"), ("Lorraine Barrett", 10, "Cardiff South & Penarth", "LAB"),
    ("Rhodri Morgan", 11, "Cardiff West", "LAB"),
    ("Rhodri Glyn Thomas", 12, "Carmarthen East & Dinefwr", "PC"),
    ("Christine Gwyther", 13, "Carmarthen West & South Pembrokeshire", "LAB"),
    ("Elin Jones", 14, "Ceredigion", "PC"), ("Karen Sinclair", 15, "Clwyd South", "LAB"),
    ("Alun Pugh", 16, "Clwyd West", "LAB"), ("Gareth Jones", 17, "Conwy", "PC"),
    ("Christine Chapman", 18, "Cynon Valley", "LAB"), ("Alison Halford", 19, "Delyn", "LAB"),
    ("Edwina Hart", 20, "Gower", "LAB"), ("Brian Hancock", 21, "Islwyn", "PC"),
    ("Helen Mary Jones", 22, "Llanelli", "PC"),
    ("Dafydd Elis-Thomas", 23, "Meirionnydd Nant Conwy", "PC"),
    ("Huw Lewis", 24, "Merthyr Tydfil & Rhymney", "LAB"), ("David Davies", 27, "Monmouth", "CON"),
    ("Mick Bates", 28, "Montgomeryshire", "LD"), ("Gwenda Thomas", 29, "Neath", "LAB"),
    ("John Griffiths", 30, "Newport East", "LAB"), ("Rosemary Butler", 31, "Newport West", "LAB"),
    ("Janice Gregory", 33, "Ogmore", "LAB"), ("Jane Davidson", 34, "Pontypridd", "LAB"),
    ("Richard Edwards", 35, "Preseli Pembrokeshire", "LAB"), ("Geraint Davies", 36, "Rhondda", "PC"),
    ("Val Feld", 40, "Swansea East", "LAB"), ("Andrew Davies", 41, "Swansea West", "LAB"),
    ("Lynne Neagle", 42, "Torfaen", "LAB"), ("Ann Jones", 43, "Vale of Clwyd", "LAB"),
    ("Jane Hutt", 44, "Vale of Glamorgan", "LAB"), ("John Marek", 45, "Wrexham", "LAB"),
    ("Ieuan Wyn Jones", 46, "Ynys Môn", "PC"),
]

# (member canonical name, region page id, region name, party)
REGIONAL_MEMBERS_1999 = [
    ("Rod Richards", 1, "North Wales", "CON"), ("Peter Rogers", 1, "North Wales", "CON"),
    ("Christine Humphries", 1, "North Wales", "LD"), ("Janet Ryder", 1, "North Wales", "PC"),
    ("Nick Bourne", 2, "Mid and West Wales", "CON"), ("Glyn Davies", 2, "Mid and West Wales", "CON"),
    ("Alun Michael", 2, "Mid and West Wales", "LAB"), ("Cynog Dafis", 2, "Mid and West Wales", "PC"),
    ("Janet Davies", 3, "South Wales West", "PC"), ("Dai Lloyd", 3, "South Wales West", "PC"),
    ("Alun Cairns", 3, "South Wales West", "CON"), ("Peter Black", 3, "South Wales West", "LD"),
    ("Jonathan Morgan", 4, "South Wales Central", "CON"), ("David Melding", 4, "South Wales Central", "CON"),
    ("Pauline Jarman", 4, "South Wales Central", "PC"), ("Owen John Thomas", 4, "South Wales Central", "PC"),
    ("Jocelyn Davies", 5, "South Wales East", "PC"), ("Phil Williams", 5, "South Wales East", "PC"),
    ("William Graham", 5, "South Wales East", "CON"), ("Michael German", 5, "South Wales East", "LD"),
]


def _seat_url(page_id: int) -> str:
    return f"{WAYBACK_1999}/constituency/{page_id}.stm"


def _region_url(page_id: int) -> str:
    return f"{WAYBACK_1999}/region/{page_id}.stm"


def tenures_1999() -> dict[str, Tenure]:
    """member canonical id -> Tenure for the First Assembly, sourced to BBC Vote 99."""
    out: dict[str, Tenure] = {}
    for name, page_id, seat, party_code in CONSTITUENCY_WINNERS_1999:
        gss = lookup_constituency(seat)
        out[canonical_id(name)] = Tenure(
            start_date="1999-05-06", end_date=None, senedd_term=1,
            party_id=party_id_for(_PARTY_LABELS[party_code]), party_label=_PARTY_LABELS[party_code],
            party_provenance="curated_reference", seat_name=gss[1] if gss else seat,
            seat_gss_code=gss[0] if gss else None, source_url=_seat_url(page_id),
        )
    for name, page_id, region, party_code in REGIONAL_MEMBERS_1999:
        out[canonical_id(name)] = Tenure(
            start_date="1999-05-06", end_date=None, senedd_term=1,
            party_id=party_id_for(_PARTY_LABELS[party_code]), party_label=_PARTY_LABELS[party_code],
            party_provenance="curated_reference", is_regional_member=True, region_name=region,
            seat_name=region, source_url=_region_url(page_id),
        )
    return out
