"""Hand-verified corrections for First Assembly (1999-2003) tenure rows that senedd.wales's own
profile pages record with a start date that falls before that term's official election day,
which pipeline.members.term_for_date buckets into the wrong (earlier) Senedd term, and for two
list-seat co-options senedd.wales records with no seat/party at all.

Each entry is checked against an independent secondary source (Wikipedia) whose own citation
chain traces to a primary one (a contemporary BBC News profile, or -- where that primary source
has since gone offline -- the archived Wikipedia citation itself, noted per row). Scope is
limited to the specific rows verified here; this is not a general fix for the underlying
date-convention mismatch (see the module docstring in pipeline/adapters/senedd_site.py's
_dedupe_overlapping_tenures for the related, partially-overlapping case that function handles).

David Rhys Lloyd (First Assembly, seat/party blank on senedd.wales) has no known Wikipedia
article or other identifiable secondary source distinguishing him from unrelated namesakes
(a Swansea councillor of the same name is the only search hit) -- left unfilled rather than
guessed.
"""

from __future__ import annotations

from pipeline.members import Tenure, canonical_id, party_id_for

# (member canonical name, wrong senedd_term as ingested, correct senedd_term, start_date prefix
# to disambiguate when a member has more than one row tagged with the same wrong term).
#
# Both of Leanne Wood's first two senedd.wales "terms of office" pre-date the true election day
# of the Senedd term they actually belong to (an artifact of senedd.wales's own dissolution-day
# dating convention -- see pipeline/adapters/senedd_site.py's _dedupe_overlapping_tenures for
# the related, partially-overlapping case that function already corrects): "05/02/2003 -
# 05/02/2007" reads as term 1 (First Assembly, ends 2003-04-30) though she was never a First
# Assembly member -- per Wikipedia, elected for South Wales Central at the 1 May 2003 election,
# succeeding Pauline Jarman -- and "05/04/2007 - 31/03/2011" reads as term 2 though it is
# actually her continuous re-election for the same seat at the 3 May 2007 election (term 3).
TERM_RELABELS = [
    ("Leanne Wood", 1, 2, "2003"),
    ("Leanne Wood", 2, 3, "2007"),
]


def apply_term_relabels(records) -> int:
    by_id = {r.id: r for r in records}
    fixed = 0
    for name, wrong_term, correct_term, start_prefix in TERM_RELABELS:
        rec = by_id.get(canonical_id(name))
        if rec is None:
            continue
        for t in rec.tenures:
            if t.senedd_term == wrong_term and t.start_date.startswith(start_prefix):
                t.senedd_term = correct_term
                fixed += 1
    return fixed


# Mid-term First Assembly list co-options senedd.wales's own archive/profile carry no
# party/seat for at all. (member canonical name, start_date, end_date, seat, party code,
# predecessor -- for cross-check only, Wikipedia citation).
_PARTY_LABELS = {"LAB": "Labour", "CON": "Conservative"}
BYELECTION_REPLACEMENTS_1999 = [
    # Replaced Alun Michael as Mid and West Wales list AM on his resignation as First
    # Secretary. Wikipedia cites a contemporary BBC News profile (still live 2026-09-14):
    # https://news.bbc.co.uk/hi/english/static/uk/wales/13128.stm
    ("Delyth Evans", "2000-05-01", "2003-05-01", "Mid and West Wales", "LAB",
     "https://web.archive.org/web/2026/http://news.bbc.co.uk/hi/english/static/uk/wales/13128.stm"),
    # Replaced Rod Richards as North Wales list AM. Wikipedia's own citation (the original
    # senedd.wales member-profile page, mid=4467) is no longer live; recorded via the
    # Wikipedia article itself (David Jones (Clwyd West MP), "Member of the National
    # Assembly for North Wales" infobox entry) as the best available citation.
    ("David Jones", "2002-09-10", "2003-04-30", "North Wales", "CON",
     "https://en.wikipedia.org/wiki/David_Jones_(Clwyd_West_MP)"),
]


def byelection_tenures_1999() -> dict[str, Tenure]:
    out: dict[str, Tenure] = {}
    for name, start, end, region, party_code, source_url in BYELECTION_REPLACEMENTS_1999:
        out[canonical_id(name)] = Tenure(
            start_date=start, end_date=end, senedd_term=1,
            party_id=party_id_for(_PARTY_LABELS[party_code]), party_label=_PARTY_LABELS[party_code],
            party_provenance="curated_reference", is_regional_member=True, region_name=region,
            seat_name=region, source_url=source_url,
        )
    return out


def apply_byelection_replacements(records) -> int:
    by_id = {r.id: r for r in records}
    filled = 0
    for mid, tenure in byelection_tenures_1999().items():
        rec = by_id.get(mid)
        if rec is None:
            continue
        for i, t in enumerate(rec.tenures):
            if t.senedd_term == 1 and t.seat_name is None:
                rec.tenures[i] = tenure
                filled += 1
    return filled


# (member canonical name, senedd_term, region name) for a tenure whose seat senedd.wales's own
# archive page failed to parse (a row-formatting miss on that one page), but whose seat is
# unambiguous because the same person's adjacent terms, immediately before and after, are
# archive-confirmed for the same seat with no reported change in between. Andrew RT Davies:
# South Wales Central continuously 2007-2026 per Wikipedia ("Member of the Senedd since 2007,
# first for South Wales Central... then for Pen-y-bont Bro Morgannwg from 2026"), confirmed by
# this pipeline's own term-3, term-5 and term-6 rows for him all reading South Wales Central.
KNOWN_CONTINUOUS_SEATS = [
    ("Andrew RT Davies", 4, "South Wales Central"),
]


def apply_known_continuous_seats(records) -> int:
    by_id = {r.id: r for r in records}
    filled = 0
    for name, term, region in KNOWN_CONTINUOUS_SEATS:
        rec = by_id.get(canonical_id(name))
        if rec is None:
            continue
        for t in rec.tenures:
            if t.senedd_term == term and t.seat_name is None:
                t.is_regional_member = True
                t.region_name = region
                t.seat_name = region
                filled += 1
    return filled
