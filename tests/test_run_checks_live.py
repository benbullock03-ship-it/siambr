"""T-24: the live verbatim gate diffs sampled speeches across the live XML, Bronze, Gold and the export."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from pipeline import run_checks
from pipeline.adapters.http import SourceUnavailable
from pipeline.export import export_connection
from pipeline.plenary import known_member_ids, normalise, write_session
from tests.memory_db import memory_db
from tests.test_plenary_ingestion import MODERN, SOURCE, insert_speakers


class LiveVerbatimGateTests(unittest.TestCase):
    def setUp(self):
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        write_session(self.conn, normalise(MODERN, known_member_ids(self.conn), SOURCE))
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.out = root / "data"
        export_connection(self.conn, self.out)
        self.bronze = root / "bronze"
        (self.bronze / "2026").mkdir(parents=True)
        (self.bronze / "2026" / "2026-07-15-16086.xml").write_bytes(MODERN)
        self.urls: list[str] = []

    def tearDown(self):
        self.tmp.cleanup()
        self.conn.close()

    def run_gate(self, body: bytes | Exception, sample: int = 20) -> run_checks.Check:
        def fetch_xml(url: str) -> bytes:
            self.urls.append(url)
            if isinstance(body, Exception):
                raise body
            return body

        return run_checks.check_live_verbatim(self.conn, self.bronze, self.out, sample_size=sample, fetch_xml=fetch_xml)

    def test_faithful_record_passes_and_fetches_each_meeting_once(self):
        check = self.run_gate(MODERN)
        self.assertTrue(check.ok, check.failures)
        self.assertEqual(check.notes, [])
        self.assertEqual(self.urls, ["https://record.senedd.wales/XMLExport/Download?meetingID=16086&xmlDownloadType=BilingualTranscript"])

    def test_a_republished_speech_fails(self):
        first = self.conn.execute("SELECT verbatim_text_original FROM debate_contributions ORDER BY id LIMIT 1").fetchone()[0]
        edited = MODERN.replace(first.split(" ")[0].encode("utf-8"), b"Edited", 1)
        self.assertNotEqual(edited, MODERN)
        check = self.run_gate(edited)
        self.assertFalse(check.ok)
        self.assertTrue(any("live XML text differs from Gold" in f or "Bronze differs from the live XML" in f for f in check.failures), check.failures)

    def test_an_edited_export_fails(self):
        path = self.out / "sittings" / "2026-07-15.json"
        sitting = json.loads(path.read_text(encoding="utf-8"))
        sitting["contributions"][0]["text_original"] += " (edited)"
        sitting["record_published_at"] = "2026-01-01T00:00:00"
        path.write_text(json.dumps(sitting), encoding="utf-8")
        check = self.run_gate(MODERN)
        self.assertTrue(any("export differs from Gold" in f for f in check.failures), check.failures)
        self.assertTrue(any("record_published_at" in f for f in check.failures), check.failures)

    def test_a_source_outage_passes_with_a_note(self):
        check = self.run_gate(SourceUnavailable("503 after retries"))
        self.assertTrue(check.ok, check.failures)
        self.assertEqual(len(check.notes), 1)
        self.assertIn("source unavailable", check.notes[0])
        self.assertIn("503 after retries", check.notes[0])

    def test_run_all_stays_offline_unless_asked(self):
        calls: list[str] = []

        def fetch_xml(url: str) -> bytes:
            calls.append(url)
            return MODERN

        names = [c.name for c in run_checks.run_all(self.conn, self.bronze, self.out, fetch_xml=fetch_xml)]
        self.assertEqual(calls, [])
        self.assertNotIn(run_checks.check_live_verbatim.__name__, names)
        names = [c.name for c in run_checks.run_all(self.conn, self.bronze, self.out, live=True, fetch_xml=fetch_xml)]
        self.assertEqual(len(calls), 1)
        self.assertTrue(any(n.startswith("sampled speeches equal the live") for n in names))


if __name__ == "__main__":
    unittest.main()
