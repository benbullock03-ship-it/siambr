"""Silver/Gold normalisation of Record of Proceedings transcripts into plenary_sessions,
agenda_items and debate_contributions.

Speech text is the publisher's with markup removed. An agenda item with any speaker that
cannot be matched to a Member is skipped whole, never abridged. Item type and policy domain
are derived from the item title (PROVENANCE_DERIVED); the record carries neither.
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field

from pipeline.adapters import plenary_xml
from pipeline.members import canonical_id, strip_name

PLENARY_TITLE_EN = "Plenary"
PLENARY_TITLE_CY = "Cyfarfod Llawn"
# C = spoken contribution, O = tabled oral question printed under the asking Member.
# B (question headings), I (editorial notes) and V (vote outcomes) are not speech.
SPEECH_TYPES = {"C", "O"}
PRESIDING_TITLES = {"llywydd", "presiding officer"}
FALLBACK_DOMAIN = "devolution"

ITEM_TYPE_RULES = [
    ("emergency_debate", r"\bemergency\b"),
    ("oral_questions", r"\b(questions to|topical questions|urgent questions?|questions without notice)\b"),
    ("statement", r"\bstatements?\b"),
    ("bill_stage", r"\b(bill|stage [1-4])\b"),
]

# First match wins, so narrower domains sit above broader ones.
DOMAIN_RULES = [
    ("health", r"health|nhs|social services|social care|hospital|dentist|gp\b|ambulance|cancer|cardiovascular"
               r"|mental|medic|patient|pharmac|diagnostic"),
    ("education", r"educat|school|universit|college|young people|children|childcare|welsh language|cymraeg"
                  r"|curriculum|skills|culture|sport"),
    ("transport", r"transport|rail|bus\b|buses|road|20mph|climate|environment|rural|agricultur|farm|bovine"
                  r"|tb\b|net zero|energy|deposit-return|recycling|flood|water|nature|biodiversity"),
    ("economy", r"econom|financ|budget|tax|business rates|jobs|employment|trade|tourism|procurement"),
    ("communities", r"housing|homeless|landlord|local government|social justice|communit|poverty|equalit"
                    r"|police|safety"),
    ("devolution", r"constitution|external affairs|europe|brexit|devolution|senedd reform|counsel general"
                   r"|legislative programme|justice|intergovernmental"),
]


@dataclass
class NormalisedSession:
    session: tuple
    items: list[tuple] = field(default_factory=list)
    contributions: list[tuple] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)

    @property
    def session_id(self) -> str:
        return self.session[0]

    @property
    def session_date(self) -> str:
        return self.session[2]


def bare_title(title: str) -> str:
    return re.sub(r"^\d+\.\s*", "", title).lower()


def classify_item_type(title_en: str) -> str:
    t = bare_title(title_en)
    return next((kind for kind, pattern in ITEM_TYPE_RULES if re.search(pattern, t)), "debate")


def classify_domain(title_en: str) -> str:
    t = bare_title(title_en)
    return next((d for d, pattern in DOMAIN_RULES if re.search(rf"\b(?:{pattern})", t)), FALLBACK_DOMAIN)


def member_id_for(name: str, known_members: set[str]) -> str | None:
    """'Andrew R.T. Davies AC' -> 'ms-andrew-rt-davies' when that Member exists; role placeholders stay None."""
    bare, _ = strip_name(name)
    mid = canonical_id(bare.replace(".", " "))
    return mid if mid in known_members else None


def normalise(body: bytes, known_members: set[str], source_url: str) -> NormalisedSession:
    rows = plenary_xml.parse_transcript(body)
    if not rows:
        raise ValueError(f"{source_url}: transcript has no rows")
    first = rows[0]
    if not 1 <= first.assembly <= 7:
        raise ValueError(f"{source_url}: unexpected Assembly {first.assembly}")
    session_id = f"plenary-{first.meeting_id}"

    groups: dict[str, list[plenary_xml.TranscriptRow]] = {}
    for r in rows:
        if r.agenda_item_id and r.item_title_en:
            groups.setdefault(r.agenda_item_id, []).append(r)

    out = NormalisedSession(session=())
    presiding = None
    for agenda_id, item_rows in groups.items():
        title_en = item_rows[0].item_title_en
        speeches = [r for r in item_rows
                    if r.contribution_type in SPEECH_TYPES and r.mg_member_id
                    and plenary_xml.html_to_text(r.verbatim_html)]
        unresolved = sorted({r.member_name for r in speeches if member_id_for(r.member_name, known_members) is None})
        if unresolved:
            out.skipped.append(f"{title_en!r}: unmatched speaker(s) {', '.join(unresolved)}")
            continue

        item_id = f"item-{first.meeting_id}-{agenda_id}"
        clip = next((c for r in item_rows
                     if (c := plenary_xml.english_clip_base(r.spoken_tv_url)
                         or plenary_xml.english_clip_base(r.translated_tv_url))), None)
        out.items.append((item_id, session_id, len(out.items), classify_item_type(title_en), title_en,
                          item_rows[0].item_title_cy, classify_domain(title_en), clip))

        for seq, r in enumerate(speeches):
            if r.language not in ("en", "cy"):
                raise ValueError(f"{source_url}: contribution {r.contribution_id} has language {r.language!r}")
            member_id = member_id_for(r.member_name, known_members)
            if presiding is None and r.job_title_en.lower() in PRESIDING_TITLES:
                presiding = member_id
            original = plenary_xml.html_to_text(r.verbatim_html)
            english = original if r.language == "en" else plenary_xml.html_to_text(r.translated_html)
            out.contributions.append((f"contribution-{r.contribution_id}", item_id, member_id, seq, r.language,
                                      original, english, plenary_xml.start_pos(r.spoken_tv_url)))

    out.session = (session_id, first.assembly, first.session_date, PLENARY_TITLE_EN, PLENARY_TITLE_CY,
                   presiding, source_url, plenary_xml.sha256(body),
                   plenary_xml.record_published_at(body), plenary_xml.meeting_start_time(body))
    return out


def known_member_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM members")}


def write_session(conn: sqlite3.Connection, n: NormalisedSession, *, rewrite: bool = False) -> str:
    """Returns 'unchanged' when the stored checksum matches, else replaces the whole session.

    ``rewrite`` replaces the session even when the checksum matches, for rows written before
    a field existed; the record itself is the same bytes either way.

    Replacing cascades to divisions linked by T-05, so re-run that ingest afterwards. The
    session row carries record_published_at, so it moves with the checksum and never alone.
    """
    existing = conn.execute("SELECT xml_sha256 FROM plenary_sessions WHERE id = ?", (n.session_id,)).fetchone()
    if existing and existing[0] == n.session[7] and not rewrite:
        return "unchanged"
    conn.execute("BEGIN")
    try:
        conn.execute("DELETE FROM plenary_sessions WHERE id = ?", (n.session_id,))
        conn.execute(
            """INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy,
                   presiding_officer_id, source_xml_url, xml_sha256, record_published_at, meeting_start_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            n.session,
        )
        conn.executemany(
            """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy,
                   policy_domain_id, senedd_tv_clip_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            n.items,
        )
        conn.executemany(
            """INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number, spoken_language,
                   verbatim_text_original, verbatim_text_english, video_timestamp_start)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            n.contributions,
        )
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    return "written"
