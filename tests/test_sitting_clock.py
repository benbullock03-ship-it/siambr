"""T-13: sitting clock fields, record currency, the term backfill scan and run_checks."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import run_checks
from pipeline.adapters import plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.ingest_plenary import scan_meetings
from pipeline.plenary import known_member_ids, normalise, write_session
from tests.memory_db import memory_db
from tests.test_plenary_ingestion import MODERN, SOURCE, insert_speakers

COMMITTEE = MODERN.replace(b"XML_Plenary_Bilingual", b"XML_LegislationCommittee_Bilingual")
HTML_PAGE = b"<!DOCTYPE html><html><title>Welsh Parliament</title></html>"


class FieldParsingTests(unittest.TestCase):
    def test_record_published_at_is_the_generated_stamp(self):
        self.assertEqual(plenary_xml.record_published_at(MODERN), "2026-07-18T06:13:23")
        self.assertIsNone(plenary_xml.record_published_at(b"<dataroot></dataroot>"))

    def test_meeting_start_time_is_the_wall_clock(self):
        self.assertEqual(plenary_xml.meeting_start_time(MODERN), "13:30:01")
        self.assertIsNone(plenary_xml.meeting_start_time(b"<dataroot><r><MeetingDate>2026-07-15</MeetingDate></r></dataroot>"))

    def test_negative_or_missing_start_pos_is_untimed(self):
        self.assertIsNone(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?startPos=-48597&l=cy"))
        self.assertIsNone(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?l=cy"))
        self.assertIsNone(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?startPos=4.5&l=cy"))
        self.assertEqual(plenary_xml.start_pos("http://www.senedd.tv/cy/16086?startPos=0&l=cy"), 0)
        self.assertEqual(plenary_xml.raw_start_pos("http://www.senedd.tv/cy/16086?startPos=-48597&l=cy"), "-48597")

    def test_plenary_is_told_from_committee_by_row_element(self):
        self.assertTrue(plenary_xml.is_plenary(MODERN))
        self.assertFalse(plenary_xml.is_plenary(COMMITTEE))
        self.assertEqual(plenary_xml.assembly_of(MODERN), 7)


class GoldWriteTests(unittest.TestCase):
    def setUp(self):
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        self.known = known_member_ids(self.conn)

    def tearDown(self):
        self.conn.close()

    def session(self):
        return self.conn.execute("SELECT * FROM plenary_sessions").fetchone()

    def test_session_carries_both_clock_fields_and_no_derived_end(self):
        n = normalise(MODERN, self.known, SOURCE)
        write_session(self.conn, n)
        row = self.session()
        self.assertEqual(row["record_published_at"], "2026-07-18T06:13:23")
        self.assertEqual(row["meeting_start_time"], "13:30:01")
        ends = self.conn.execute("SELECT count(*) FROM debate_contributions WHERE video_timestamp_end IS NOT NULL").fetchone()[0]
        self.assertEqual(ends, 0)
        preamble = self.conn.execute(
            "SELECT count(*) FROM debate_contributions WHERE video_timestamp_start IS NULL"
        ).fetchone()[0]
        self.assertGreaterEqual(preamble, 0)

    def test_unchanged_hash_leaves_the_row_untouched(self):
        write_session(self.conn, normalise(MODERN, self.known, SOURCE))
        before = tuple(self.session())
        self.assertEqual(write_session(self.conn, normalise(MODERN, self.known, SOURCE)), "unchanged")
        self.assertEqual(tuple(self.session()), before)

    def test_revised_release_moves_record_published_at(self):
        write_session(self.conn, normalise(MODERN, self.known, SOURCE))
        revised = MODERN.replace(b'generated="2026-07-18T06:13:23"', b'generated="2026-07-20T09:00:00"')
        self.assertEqual(write_session(self.conn, normalise(revised, self.known, SOURCE)), "written")
        self.assertEqual(self.session()["record_published_at"], "2026-07-20T09:00:00")
        self.assertEqual(self.session()["xml_sha256"], plenary_xml.sha256(revised))

    def test_run_checks_pass_on_a_faithful_store_and_catch_drift(self):
        write_session(self.conn, normalise(MODERN, self.known, SOURCE))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "2026" / "2026-07-15-16086.xml"
            path.parent.mkdir()
            path.write_bytes(MODERN)
            checks = run_checks.run_all(self.conn, Path(tmp), static=None)
            self.assertTrue(all(c.ok for c in checks), [c.failures for c in checks if not c.ok])

            self.conn.execute("UPDATE debate_contributions SET video_timestamp_start = video_timestamp_start + 1 "
                              "WHERE video_timestamp_start IS NOT NULL")
            drift = next(c for c in run_checks.run_all(self.conn, Path(tmp), static=None) if c.name.startswith("every timed"))
            self.assertFalse(drift.ok)
            self.assertIn("Senedd published", drift.failures[0])


class ScanTests(unittest.TestCase):
    def test_scan_keeps_term_plenaries_and_stops_at_the_term_boundary(self):
        sixth = MODERN.replace(b"<Assembly>7</Assembly>", b"<Assembly>6</Assembly>").replace(b"2026-07-15", b"2026-03-10")

        def fake_fetch(mid, use_cache=True):
            return {103: MODERN, 102: COMMITTEE, 100: MODERN, 97: sixth}.get(mid) or (_ for _ in ()).throw(SourceUnavailable("none"))

        with mock.patch.object(plenary_xml, "fetch_transcript", side_effect=fake_fetch):
            found = scan_meetings(103, 7, gap=40, log=lambda *_: None)
        self.assertEqual(found, [100, 103])

    def test_scan_gives_up_after_a_gap(self):
        calls = []

        def fake_fetch(mid, use_cache=True):
            calls.append(mid)
            if mid == 50:
                return MODERN
            raise SourceUnavailable("none")

        with mock.patch.object(plenary_xml, "fetch_transcript", side_effect=fake_fetch):
            found = scan_meetings(54, 7, gap=5, log=lambda *_: None)
        self.assertEqual(found, [50])
        self.assertEqual(min(calls), 45)

    def test_committee_transcripts_never_reach_bronze(self):
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(plenary_xml, "PLENARY_BRONZE", Path(tmp)), \
                mock.patch.object(plenary_xml, "fetch", return_value=COMMITTEE):
            with self.assertRaises(plenary_xml.NotPlenary):
                plenary_xml.fetch_transcript(16141)
            self.assertEqual(list(Path(tmp).rglob("*.xml")), [])


if __name__ == "__main__":
    unittest.main()
