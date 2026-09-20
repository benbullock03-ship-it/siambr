"""T-04: plenary transcript ingestion from Record of Proceedings XML.

Fixtures are whole rows cut from real XMLExport downloads: meeting 16086 (2026-07-15,
Seventh Senedd) and meeting 5000 (2018-07-17, Fifth Senedd).
"""

from __future__ import annotations

import html
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline.adapters import plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.members import canonical_id, strip_name
from pipeline.plenary import classify_domain, classify_item_type, known_member_ids, normalise, write_session
from tests.memory_db import memory_db

FIXTURES = Path(__file__).parent / "fixtures"
MODERN = (FIXTURES / "plenary_16086_bilingual.xml").read_bytes()
FIFTH = (FIXTURES / "plenary_5000_bilingual.xml").read_bytes()
SOURCE = plenary_xml.download_url(16086)


def publisher_glyphs(fragment: str) -> str:
    return "".join(html.unescape(re.sub(r"<[^>]+>", "", fragment)).split())


def glyphs(text: str) -> str:
    return "".join(text.split())


def insert_speakers(conn, body: bytes) -> None:
    """Members named in the transcript, minus role placeholders such as 'Y Llywydd / The Llywydd'."""
    for name in {r.member_name for r in plenary_xml.parse_transcript(body) if r.mg_member_id}:
        if "/" in name:
            continue
        bare, _ = strip_name(name)
        conn.execute(
            """INSERT OR IGNORE INTO members (id, constituency_name_en, constituency_name_cy, canonical_name,
                   official_profile_url, current_status) VALUES (?, 'Seat', 'Sedd', ?, 'https://senedd.wales/', 'active')""",
            (canonical_id(bare.replace(".", " ")), bare),
        )


class ParsingTests(unittest.TestCase):
    def test_reads_both_row_element_names(self):
        modern, fifth = plenary_xml.parse_transcript(MODERN), plenary_xml.parse_transcript(FIFTH)
        self.assertEqual({r.meeting_id for r in modern}, {16086})
        self.assertEqual({r.assembly for r in fifth}, {5})
        self.assertEqual([r.order for r in modern], sorted(r.order for r in modern))

    def test_start_pos_is_seconds_and_negative_preamble_is_no_offset(self):
        self.assertEqual(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?startPos=4&l=cy"), 4)
        self.assertIsNone(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?startPos=-48597&l=cy"))
        self.assertIsNone(plenary_xml.start_pos(""))

    def test_clip_base_is_the_english_player_without_offset(self):
        self.assertEqual(plenary_xml.english_clip_base("http://www.senedd.tv/en/16086?startPos=7&l=en"),
                         "http://www.senedd.tv/en/16086")
        self.assertIsNone(plenary_xml.english_clip_base("http://www.senedd.tv/cy/16086?startPos=7&l=cy"))

    def test_index_page_rows_are_parsed(self):
        page = b"""<span id="showTotal">2</span><tr><td class="number">
            15/07/2026 13:30 </td> <td class="text"> Plenary </td> <td class="text">
            <a href="/XMLExport/Download?meetingID=16086&amp;xmlDownloadType=BilingualTranscript">Bilingual</a>
            </td></tr><tr><td class="number"> 14/07/2026 13:30 </td> <td class="text"> Plenary </td>
            <td class="text"> <a href="/XMLExport/Download?meetingID=16085&amp;xmlDownloadType=BilingualTranscript">"""
        with mock.patch.object(plenary_xml, "fetch", return_value=page):
            self.assertEqual(plenary_xml.list_plenary_meetings("2026-07-01", "2026-07-31"),
                             [("2026-07-14", 16085), ("2026-07-15", 16086)])


class BronzeMirrorTests(unittest.TestCase):
    def test_transcript_bytes_are_mirrored_verbatim_by_date(self):
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(plenary_xml, "PLENARY_BRONZE", Path(tmp)), \
                mock.patch.object(plenary_xml, "fetch", return_value=MODERN) as fetch:
            self.assertEqual(plenary_xml.fetch_transcript(16086), MODERN)
            path = Path(tmp) / "2026" / "2026-07-15-16086.xml"
            self.assertEqual(path.read_bytes(), MODERN)
            self.assertEqual(plenary_xml.fetch_transcript(16086), MODERN)
            self.assertEqual(fetch.call_count, 1)

    def test_error_page_for_unknown_meeting_is_unavailable(self):
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(plenary_xml, "PLENARY_BRONZE", Path(tmp)), \
                mock.patch.object(plenary_xml, "fetch", return_value=b"<html><h2>Object moved</h2></html>"):
            with self.assertRaises(SourceUnavailable):
                plenary_xml.fetch_transcript(1)


class NormalisationTests(unittest.TestCase):
    def setUp(self):
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        insert_speakers(self.conn, FIFTH)
        self.known = known_member_ids(self.conn)

    def tearDown(self):
        self.conn.close()

    def test_speech_text_matches_publisher_character_for_character(self):
        rows = {f"contribution-{r.contribution_id}": r for r in plenary_xml.parse_transcript(MODERN)}
        n = normalise(MODERN, self.known, SOURCE)
        self.assertTrue(n.contributions)
        for cid, _, _, _, lang, original, english, _ in n.contributions:
            row = rows[cid]
            self.assertNotRegex(original, r"<[^>]+>")
            self.assertEqual(glyphs(original), publisher_glyphs(row.verbatim_html), cid)
            expected_english = row.verbatim_html if lang == "en" else row.translated_html
            self.assertEqual(glyphs(english), publisher_glyphs(expected_english), cid)

    def test_welsh_speech_keeps_cymraeg_and_official_translation(self):
        n = normalise(MODERN, self.known, SOURCE)
        welsh = [c for c in n.contributions if c[4] == "cy"]
        self.assertTrue(welsh)
        for c in welsh:
            self.assertTrue(c[5] and c[6])
            self.assertNotEqual(c[5], c[6])

    def test_non_speech_rows_are_not_contributions(self):
        rows = {f"contribution-{r.contribution_id}": r for r in plenary_xml.parse_transcript(MODERN)}
        n = normalise(MODERN, self.known, SOURCE)
        self.assertEqual({rows[c[0]].contribution_type for c in n.contributions} - {"C", "O"}, set())
        self.assertNotIn("260715-0", {i[0].split("-", 2)[2] for i in n.items})

    def test_items_carry_clip_and_first_speech_offset(self):
        n = normalise(MODERN, self.known, SOURCE)
        for item in n.items:
            self.assertEqual(item[7], "http://www.senedd.tv/en/16086")
        self.assertTrue(any(c[7] is not None and c[7] > 0 for c in n.contributions))

    def test_item_with_unmatched_speaker_is_skipped_whole(self):
        n = normalise(FIFTH, self.known, plenary_xml.download_url(5000))
        self.assertTrue(any("Y Llywydd / The Llywydd" in s for s in n.skipped))
        business = [i for i in n.items if "Business Statement" in i[4]]
        self.assertEqual(business, [])

    def test_write_is_idempotent_by_checksum_and_searchable(self):
        n = normalise(MODERN, self.known, SOURCE)
        self.assertEqual(write_session(self.conn, n), "written")
        self.assertEqual(write_session(self.conn, n), "unchanged")
        stored = self.conn.execute("SELECT * FROM plenary_sessions").fetchone()
        self.assertEqual(stored["xml_sha256"], plenary_xml.sha256(MODERN))
        self.assertEqual((stored["senedd_term"], stored["session_date"]), (7, "2026-07-15"))
        count = self.conn.execute("SELECT count(*) FROM debate_contributions").fetchone()[0]
        self.assertEqual(count, len(n.contributions))
        word = re.search(r"[A-Za-z]{6,}", n.contributions[0][6]).group(0)
        hits = self.conn.execute(
            "SELECT count(*) FROM debate_contributions_fts WHERE debate_contributions_fts MATCH ?", (word,)
        ).fetchone()[0]
        self.assertGreater(hits, 0)

    def test_changed_transcript_replaces_session(self):
        write_session(self.conn, normalise(MODERN, self.known, SOURCE))
        changed = MODERN.replace(b"</dataroot>", b"</dataroot>\n")
        self.assertEqual(write_session(self.conn, normalise(changed, self.known, SOURCE)), "written")
        self.assertEqual(self.conn.execute("SELECT count(*) FROM plenary_sessions").fetchone()[0], 1)


class ClassifierTests(unittest.TestCase):
    def test_item_types(self):
        self.assertEqual(classify_item_type("1. Questions to the Cabinet Minister for Health and Care"), "oral_questions")
        self.assertEqual(classify_item_type("4. 90-second Statements"), "statement")
        self.assertEqual(classify_item_type("9. Motion to approve the financial resolution in respect of the Public Services Ombudsman (Wales) Bill"), "bill_stage")
        self.assertEqual(classify_item_type("7. Reform UK Debate: Bovine TB"), "debate")

    def test_domains(self):
        self.assertEqual(classify_domain("1. Questions to the Cabinet Minister for Health and Care"), "health")
        self.assertEqual(classify_domain("7. Reform UK Debate: Bovine TB"), "transport")
        self.assertEqual(classify_domain("6. Member Debate under Standing Order 11.21(iv): Young people and employment"), "education")
        self.assertEqual(classify_domain("2. Questions to the Cabinet Minister for Local Government, Housing"), "communities")
        self.assertEqual(classify_domain("10. Short Debate: Improving access to local economic opportunities"), "economy")
        self.assertEqual(classify_domain("9. Voting Time"), "devolution")


if __name__ == "__main__":
    unittest.main()
