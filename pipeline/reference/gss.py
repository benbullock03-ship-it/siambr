"""ONS GSS codes for Senedd constituencies.

Source: ONS Open Geography Portal feature services
  SENC_MAY_2026_WA_NC (16 constituencies, Seventh Senedd onward)
  SENC_DEC_2025_WA_NC (40 constituencies, First Assembly to Sixth Senedd)
https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/<name>/FeatureServer/0
Fetched 2026-09-14. ``refresh_from_ons`` re-pulls both tables live.
"""

from __future__ import annotations

import json
import unicodedata

ONS_BASE = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services"
ONS_SERVICES = {2026: "SENC_MAY_2026_WA_NC", 2025: "SENC_DEC_2025_WA_NC"}

# (gss_code, name_en, name_cy). 2026 constituencies carry one bilingual name.
SENEDD_CONSTITUENCIES_2026 = [
    ("W09000048", "Afan Ogwr Rhondda", "Afan Ogwr Rhondda"),
    ("W09000049", "Bangor Conwy Môn", "Bangor Conwy Môn"),
    ("W09000050", "Blaenau Gwent Caerffili Rhymni", "Blaenau Gwent Caerffili Rhymni"),
    ("W09000051", "Brycheiniog Tawe Nedd", "Brycheiniog Tawe Nedd"),
    ("W09000052", "Caerdydd Ffynnon Taf", "Caerdydd Ffynnon Taf"),
    ("W09000053", "Caerdydd Penarth", "Caerdydd Penarth"),
    ("W09000054", "Casnewydd Islwyn", "Casnewydd Islwyn"),
    ("W09000055", "Ceredigion Penfro", "Ceredigion Penfro"),
    ("W09000056", "Clwyd", "Clwyd"),
    ("W09000057", "Fflint Wrecsam", "Fflint Wrecsam"),
    ("W09000058", "Gwynedd Maldwyn", "Gwynedd Maldwyn"),
    ("W09000059", "Gŵyr Abertawe", "Gŵyr Abertawe"),
    ("W09000060", "Pen-y-bont Bro Morgannwg", "Pen-y-bont Bro Morgannwg"),
    ("W09000061", "Pontypridd Cynon Merthyr", "Pontypridd Cynon Merthyr"),
    ("W09000062", "Sir Fynwy Torfaen", "Sir Fynwy Torfaen"),
    ("W09000063", "Sir Gaerfyrddin", "Sir Gaerfyrddin"),
]

SENEDD_CONSTITUENCIES_1999_2026 = [
    ("W09000001", "Ynys Môn", "Ynys Môn"),
    ("W09000002", "Arfon", "Arfon"),
    ("W09000003", "Aberconwy", "Aberconwy"),
    ("W09000004", "Clwyd West", "Gorllewin Clwyd"),
    ("W09000005", "Vale of Clwyd", "Dyffryn Clwyd"),
    ("W09000006", "Delyn", "Delyn"),
    ("W09000007", "Alyn and Deeside", "Alun a Glannau Dyfrdwy"),
    ("W09000008", "Wrexham", "Wrecsam"),
    ("W09000009", "Clwyd South", "De Clwyd"),
    ("W09000010", "Dwyfor Meirionnydd", "Dwyfor Meirionnydd"),
    ("W09000011", "Montgomeryshire", "Sir Drefaldwyn"),
    ("W09000012", "Ceredigion", "Ceredigion"),
    ("W09000014", "Preseli Pembrokeshire", "Preseli Sir Benfro"),
    ("W09000015", "Carmarthen East and Dinefwr", "Dwyrain Caerfyrddin a Dinefwr"),
    ("W09000016", "Carmarthen West and South Pembrokeshire", "Gorllewin Caerfyrddin a De Sir Benfro"),
    ("W09000017", "Llanelli", "Llanelli"),
    ("W09000018", "Gower", "Gŵyr"),
    ("W09000019", "Swansea West", "Gorllewin Abertawe"),
    ("W09000020", "Swansea East", "Dwyrain Abertawe"),
    ("W09000021", "Neath", "Castell-nedd"),
    ("W09000022", "Aberavon", "Aberafan"),
    ("W09000023", "Bridgend", "Pen-y-bont ar Ogwr"),
    ("W09000025", "Rhondda", "Rhondda"),
    ("W09000026", "Cynon Valley", "Cwm Cynon"),
    ("W09000029", "Cardiff West", "Gorllewin Caerdydd"),
    ("W09000031", "Cardiff Central", "Canol Caerdydd"),
    ("W09000034", "Monmouth", "Sir Fynwy"),
    ("W09000035", "Caerphilly", "Caerffili"),
    ("W09000036", "Islwyn", "Islwyn"),
    ("W09000037", "Torfaen", "Torfaen"),
    ("W09000038", "Blaenau Gwent", "Blaenau Gwent"),
    ("W09000039", "Newport West", "Gorllewin Casnewydd"),
    ("W09000040", "Newport East", "Dwyrain Casnewydd"),
    ("W09000041", "Brecon and Radnorshire", "Brycheiniog a Sir Faesyfed"),
    ("W09000042", "Cardiff North", "Gogledd Caerdydd"),
    ("W09000043", "Cardiff South and Penarth", "De Caerdydd a Phenarth"),
    ("W09000044", "Merthyr Tydfil and Rhymney", "Merthyr Tudful a Rhymni"),
    ("W09000045", "Ogmore", "Ogwr"),
    ("W09000046", "Pontypridd", "Pontypridd"),
    ("W09000047", "Vale of Glamorgan", "Bro Morgannwg"),
]

# Pre-2026 regional list seats have no GSS constituency code; names as printed on senedd.wales.
ELECTORAL_REGIONS_1999_2026 = {
    "north wales": "Gogledd Cymru",
    "mid and west wales": "Canolbarth a Gorllewin Cymru",
    "south wales west": "Gorllewin De Cymru",
    "south wales central": "Canol De Cymru",
    "south wales east": "Dwyrain De Cymru",
}


# Misspellings that appear verbatim on senedd.wales archive listings.
SOURCE_ALIASES = {
    "camarthen east and dinefwr": "carmarthen east and dinefwr",
    "soth wales west": "south wales west",
}


def _fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    folded = " ".join(s.replace("-", " ").replace("&", "and").split())
    return SOURCE_ALIASES.get(folded, folded)


def _index() -> dict[str, tuple[str, str, str]]:
    idx: dict[str, tuple[str, str, str]] = {}
    for row in SENEDD_CONSTITUENCIES_2026 + SENEDD_CONSTITUENCIES_1999_2026:
        code, en, cy = row
        idx[_fold(en)] = row
        idx[_fold(cy)] = row
    return idx


_INDEX = _index()


def lookup_constituency(name: str) -> tuple[str, str, str] | None:
    """Case/diacritic/hyphen-insensitive match on English or Welsh name -> (gss, en, cy)."""
    return _INDEX.get(_fold(name))


def is_region(name: str) -> bool:
    return _fold(name) in ELECTORAL_REGIONS_1999_2026


def region_cy(name: str) -> str | None:
    return ELECTORAL_REGIONS_1999_2026.get(_fold(name))


def refresh_from_ons(fetch) -> dict[int, list[tuple[str, str, str]]]:
    """Pull both ONS tables live; ``fetch(url) -> bytes``. Used by tests and --refresh-gss."""
    out: dict[int, list[tuple[str, str, str]]] = {}
    for year, service in ONS_SERVICES.items():
        url = f"{ONS_BASE}/{service}/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json"
        data = json.loads(fetch(url))
        yy = str(year)[2:]
        out[year] = sorted(
            (a[f"SENC{yy}CD"], a[f"SENC{yy}NM"], a[f"SENC{yy}NMW"])
            for a in (f["attributes"] for f in data["features"])
        )
    return out
