"""2003 National Assembly for Wales election: constituency winners and regional top-up Members,
with party -- same purpose and method as pipeline.reference.election_1999.

Source: BBC News, "Vote 2003: Welsh Assembly", still live 2026-09-14 at
  http://news.bbc.co.uk/1/shared/bsp/hi/vote2003/welsh_assembly/html/
  constituency pages: <id>.stm; regional pages: <id>_region.stm (ids 21-25)
This is the primary source several Wikipedia Second Assembly biographies cite directly
(e.g. Christine Gwyther's article cites .../html/129.stm). As in election_1999, source_url
values are Wayback Machine redirector links (HTTPS, stable) rather than the plain-HTTP BBC
page directly -- see election_1999's docstring for why.

One seat (Mid and West Wales, Conservative list #2) elected "Edward Davies" per BBC, who has
no corresponding senedd.wales profile or archive entry; left out rather than guessed. Wrexham's
John Marek stood as an independent ("John Marek Independent Party") after leaving Labour, so his
tenure here is recorded as independent, not Labour, matching the BBC result.
"""

from __future__ import annotations

from pipeline.members import Tenure, canonical_id, party_id_for
from pipeline.reference.gss import lookup_constituency

BBC_2003 = "http://news.bbc.co.uk/1/shared/bsp/hi/vote2003/welsh_assembly/html"
WAYBACK_2003 = "https://web.archive.org/web/2026/" + BBC_2003

_PARTY_LABELS = {
    "LAB": "Labour", "PC": "Plaid Cymru", "CON": "Conservative", "LD": "Liberal Democrat",
    "IND": "Independent",
}

# (member canonical name as ingested, BBC page id, seat name, party code)
CONSTITUENCY_WINNERS_2003 = [
    ("Brian Gibbons", 1, "Aberavon", "LAB"), ("Carl Sargeant", 10, "Alyn & Deeside", "LAB"),
    ("Peter Law", 68, "Blaenau Gwent", "LAB"), ("Kirsty Williams", 86, "Brecon & Radnorshire", "LD"),
    ("Carwyn Jones", 92, "Bridgend", "LAB"), ("Alun Ffred Jones", 111, "Caernarfon", "PC"),
    ("Jeffrey Cuthbert", 112, "Caerphilly", "LAB"), ("Jenny Randerson", 123, "Cardiff Central", "LD"),
    ("Sue Essex", 124, "Cardiff North", "LAB"), ("Lorraine Barrett", 125, "Cardiff South & Penarth", "LAB"),
    ("Rhodri Morgan", 126, "Cardiff West", "LAB"),
    ("Rhodri Glyn Thomas", 128, "Carmarthen East & Dinefwr", "PC"),
    ("Christine Gwyther", 129, "Carmarthen West & Pembrokeshire South", "LAB"),
    ("Elin Jones", 133, "Ceredigion", "PC"), ("Karen Sinclair", 149, "Clwyd South", "LAB"),
    ("Alun Pugh", 150, "Clwyd West", "LAB"), ("Denise Idris Jones", 157, "Conwy", "LAB"),
    ("Christine Chapman", 175, "Cynon Valley", "LAB"), ("Sandra Mewies", 180, "Delyn", "LAB"),
    ("Edwina Hart", 278, "Gower", "LAB"), ("Irene James", 342, "Islwyn", "LAB"),
    ("Catherine Thomas", 381, "Llanelli", "LAB"),
    ("Dafydd Elis-Thomas", 399, "Meirionnydd Nant Conwy", "PC"),
    ("Huw Lewis", 401, "Merthyr Tydfil & Rhymney", "LAB"), ("David Davies", 409, "Monmouth", "CON"),
    ("Mick Bates", 410, "Montgomeryshire", "LD"), ("Gwenda Thomas", 415, "Neath", "LAB"),
    ("John Griffiths", 424, "Newport East", "LAB"), ("Rosemary Butler", 425, "Newport West", "LAB"),
    ("Janice Gregory", 443, "Ogmore", "LAB"), ("Jane Davidson", 460, "Pontypridd", "LAB"),
    ("Tamsin Dunwoody", 465, "Preseli Pembrokeshire", "LAB"), ("Leighton Andrews", 477, "Rhondda", "LAB"),
    ("Val Lloyd", 565, "Swansea East", "LAB"), ("Andrew Davies", 566, "Swansea West", "LAB"),
    ("Lynne Neagle", 583, "Torfaen", "LAB"), ("Ann Jones", 598, "Vale of Clwyd", "LAB"),
    ("Jane Hutt", 599, "Vale of Glamorgan", "LAB"), ("John Marek", 652, "Wrexham", "IND"),
    ("Ieuan Wyn Jones", 657, "Ynys Môn", "PC"),
]

# (member canonical name, region page id, region name, party). "Edward Davies" (Mid and West
# Wales, Conservative) omitted -- no matching member record, see module docstring.
REGIONAL_MEMBERS_2003 = [
    ("Brynle Williams", 21, "North Wales", "CON"), ("Mark Isherwood", 21, "North Wales", "CON"),
    ("Janet Ryder", 21, "North Wales", "PC"), ("Eleanor Burnham", 21, "North Wales", "LD"),
    ("Nick Bourne", 22, "Mid and West Wales", "CON"), ("Lisa Francis", 22, "Mid and West Wales", "CON"),
    ("Helen Mary Jones", 22, "Mid and West Wales", "PC"),
    ("Janet Davies", 23, "South Wales West", "PC"), ("Dai Lloyd", 23, "South Wales West", "PC"),
    ("Alun Cairns", 23, "South Wales West", "CON"), ("Peter Black", 23, "South Wales West", "LD"),
    ("Leanne Wood", 24, "South Wales Central", "PC"), ("Owen John Thomas", 24, "South Wales Central", "PC"),
    ("Jonathan Morgan", 24, "South Wales Central", "CON"), ("David Melding", 24, "South Wales Central", "CON"),
    ("William Graham", 25, "South Wales East", "CON"), ("Laura Anne Jones", 25, "South Wales East", "CON"),
    ("Jocelyn Davies", 25, "South Wales East", "PC"), ("Michael German", 25, "South Wales East", "LD"),
]


def _seat_url(page_id: int) -> str:
    return f"{WAYBACK_2003}/{page_id}.stm"


def _region_url(page_id: int) -> str:
    return f"{WAYBACK_2003}/{page_id}_region.stm"


def tenures_2003() -> dict[str, Tenure]:
    """member canonical id -> Tenure for the Second Assembly, sourced to BBC Vote 2003."""
    out: dict[str, Tenure] = {}
    for name, page_id, seat, party_code in CONSTITUENCY_WINNERS_2003:
        gss = lookup_constituency(seat)
        out[canonical_id(name)] = Tenure(
            start_date="2003-05-01", end_date=None, senedd_term=2,
            party_id=party_id_for(_PARTY_LABELS[party_code]), party_label=_PARTY_LABELS[party_code],
            party_provenance="curated_reference", seat_name=gss[1] if gss else seat,
            seat_gss_code=gss[0] if gss else None, source_url=_seat_url(page_id),
        )
    for name, page_id, region, party_code in REGIONAL_MEMBERS_2003:
        out[canonical_id(name)] = Tenure(
            start_date="2003-05-01", end_date=None, senedd_term=2,
            party_id=party_id_for(_PARTY_LABELS[party_code]), party_label=_PARTY_LABELS[party_code],
            party_provenance="curated_reference", is_regional_member=True, region_name=region,
            seat_name=region, source_url=_region_url(page_id),
        )
    return out
