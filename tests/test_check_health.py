"""The retrieval watchdog: a listed meeting that is not in the export is a failure."""

from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest import mock

from pipeline import check_health
from pipeline.adapters import plenary_xml
from pipeline.adapters.http import SourceUnavailable

TODAY = date(2026, 10, 19)
LISTED = [("2026-10-13", 16315), ("2026-10-14", 16316)]


class HealthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "data"

    def tearDown(self):
        self.tmp.cleanup()

    def export_sitting(self, meeting_id: int) -> None:
        (self.out / "sittings").mkdir(parents=True, exist_ok=True)
        (self.out / "sittings" / f"2026-10-{meeting_id % 100}.json").write_text(
            json.dumps({"meeting_id": meeting_id}), encoding="utf-8")

    def test_every_listed_meeting_that_is_held_passes(self):
        for _, meeting_id in LISTED:
            self.export_sitting(meeting_id)
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=LISTED):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertTrue(report.ok)
        self.assertEqual(report.missing, [])
        self.assertEqual(report.held, 2)

    def test_a_listed_meeting_missing_from_the_export_fails(self):
        self.export_sitting(16315)
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=LISTED):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertFalse(report.ok)
        self.assertEqual(report.missing, [("2026-10-14", 16316)])
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=LISTED), \
             mock.patch.object(check_health, "check", return_value=report), \
             redirect_stdout(io.StringIO()) as printed:
            status = check_health.main(["--out", str(self.out)])
        self.assertEqual(status, 1)
        self.assertIn("::error::meeting 16316 (2026-10-14)", printed.getvalue())

    def test_the_index_being_unreachable_is_itself_a_failure(self):
        with mock.patch.object(plenary_xml, "list_plenary_meetings", side_effect=SourceUnavailable("down")):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertFalse(report.ok)
        self.assertIn("could not verify retrieval", report.summary())

    def test_an_empty_window_is_not_a_failure(self):
        # Recess: nothing listed is a valid answer, not a stalled scheduler.
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=[]):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertTrue(report.ok)

    def test_unattributed_speech_is_reported_but_does_not_fail(self):
        self.export_sitting(16315)
        self.export_sitting(16316)
        self.out.mkdir(parents=True, exist_ok=True)
        (self.out / "health.json").write_text(
            json.dumps({"unattributed": {"contributions": 30, "sittings": 3}}), encoding="utf-8")
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=LISTED):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertTrue(report.ok)
        self.assertEqual(report.unattributed_contributions, 30)
        self.assertIn("30 unattributed speeches", report.summary())

    def test_malformed_sitting_files_do_not_crash_the_watchdog(self):
        (self.out / "sittings").mkdir(parents=True, exist_ok=True)
        (self.out / "sittings" / "2026-10-13.json").write_text("{ not json", encoding="utf-8")
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=LISTED):
            report = check_health.check(out=self.out, today=TODAY)
        self.assertEqual(report.held, 0)
        self.assertEqual(len(report.missing), 2)


if __name__ == "__main__":
    unittest.main()
