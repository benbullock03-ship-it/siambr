"""First Ministers of Wales (First Secretary until October 2000) with appointment date ranges.

Modern.Gov (GetMemberRoles) is the canonical source for historical portfolios but was
unavailable when this table was compiled (2026-09-14; business.senedd.wales returned 403).
Rows ship with provenance 'curated_reference'; ``reconcile_members`` replaces them with
Modern.Gov rows whenever that service answers. The 2026 row was verified against
https://www.gov.wales/rhun-ap-iorwerth-ms ("On 12 May 2026 Rhun ap Iorwerth was appointed
First Minister of Wales").
"""

from __future__ import annotations

from pipeline.members import Role

_ARCHIVE = "https://senedd.wales/archive/"

# (member_id, title_en, title_cy, start_date, end_date, source_url)
FIRST_MINISTERS = [
    ("ms-alun-michael", "First Secretary of the National Assembly for Wales",
     "Prif Ysgrifennydd Cynulliad Cenedlaethol Cymru",
     "1999-05-12", "2000-02-09", _ARCHIVE + "first-assembly-1999-2003/"),
    ("ms-rhodri-morgan", "First Minister of Wales", "Prif Weinidog Cymru",
     "2000-02-09", "2009-12-10", _ARCHIVE + "third-assembly-2007-2011/"),
    ("ms-carwyn-jones", "First Minister of Wales", "Prif Weinidog Cymru",
     "2009-12-10", "2018-12-13", _ARCHIVE + "fifth-senedd-2016-2021/"),
    ("ms-mark-drakeford", "First Minister of Wales", "Prif Weinidog Cymru",
     "2018-12-13", "2024-03-20", _ARCHIVE + "sixth-senedd-2021-2026/"),
    ("ms-vaughan-gething", "First Minister of Wales", "Prif Weinidog Cymru",
     "2024-03-20", "2024-08-06", _ARCHIVE + "sixth-senedd-2021-2026/"),
    ("ms-eluned-morgan", "First Minister of Wales", "Prif Weinidog Cymru",
     "2024-08-06", "2026-05-12", _ARCHIVE + "sixth-senedd-2021-2026/"),
    ("ms-rhun-ap-iorwerth", "First Minister of Wales", "Prif Weinidog Cymru",
     "2026-05-12", None, "https://www.gov.wales/rhun-ap-iorwerth-ms"),
]


def first_minister_roles() -> dict[str, Role]:
    return {
        mid: Role(title_en=en, title_cy=cy, start_date=start, end_date=end,
                  cabinet_level="first_minister", provenance="curated_reference", source_url=url)
        for mid, en, cy, start, end, url in FIRST_MINISTERS
    }
