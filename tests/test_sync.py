"""T-15: pipeline.sync is idempotent and honest about what it did."""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from pipeline import senedd_tv, sync as sync_mod
from pipeline.adapters import plenary_votes, plenary_xml
from pipeline.adapters.http import SourceUnavailable
from pipeline.db import create_connection
from tests.test_plenary_ingestion import MODERN, insert_speakers
from tests.test_senedd_tv import upstream

TODAY = date(2026, 7, 20)
REVISED = MODERN.replace(b'generated="2026-07-18T06:13:23"', b'generated="2026-07-21T06:00:00"')


def snapshot(root: Path) -> dict[str, tuple[int, bytes]]:
    return {str(p.relative_to(root)): (p.stat().st_mtime_ns, p.read_bytes()) for p in root.rglob("*") if p.is_file()}


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.bronze = root / "bronze"
        self.out = root / "data"
        self.db = root / "siambr.db"
        self.upstream = {16086: MODERN}
        self.tv = mock.Mock(side_effect=SourceUnavailable("senedd.tv down"))
        self.patches = [
            mock.patch.object(plenary_xml, "PLENARY_BRONZE", self.bronze),
            mock.patch.object(plenary_xml, "list_plenary_meetings", side_effect=self.list_meetings),
            mock.patch.object(plenary_xml, "fetch", side_effect=self.fetch),
            mock.patch.object(plenary_votes, "PLENARY_BRONZE", self.bronze),
            mock.patch.object(plenary_votes, "fetch", side_effect=lambda url, **k: b'<?xml version="1.0"?><dataroot generated="x" />'),
            mock.patch.object(senedd_tv, "SENEDD_TV_BRONZE", root / "bronze_tv"),
            mock.patch.object(senedd_tv, "http_get", self.tv),
        ]
        for p in self.patches:
            p.start()
        conn = create_connection(self.db)
        sync_mod.apply_migrations(conn)
        sync_mod.seed_baseline(conn)
        insert_speakers(conn, MODERN)
        conn.close()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def list_meetings(self, start, end):
        self.assertEqual((start, end), ("2026-06-29", "2026-07-20"))
        return [("2026-07-15", mid) for mid in sorted(self.upstream)]

    def fetch(self, url, **kwargs):
        mid = int(url.split("meetingID=")[1].split("&")[0])
        if mid not in self.upstream:
            raise SourceUnavailable(f"{mid} missing")
        return self.upstream[mid]

    def run_sync(self):
        conn = create_connection(self.db)
        try:
            started = sync_mod.utcnow()
            result = sync_mod.sync(conn, today=TODAY, out=self.out)
            sync_mod.record_run(conn, started, result)
            runs = conn.execute("SELECT sessions_changed, error FROM sync_runs ORDER BY id").fetchall()
        finally:
            conn.close()
        return result, [tuple(r) for r in runs]

    def test_first_run_ingests_and_exports_then_a_quiet_run_touches_nothing(self):
        first, runs = self.run_sync()
        self.assertEqual(first.changed_dates, ["2026-07-15"])
        self.assertTrue(first.exported)
        self.assertEqual(runs, [(1, None)])
        self.assertTrue((self.bronze / "2026" / "2026-07-15-16086.xml").exists())
        self.assertTrue((self.out / "sittings" / "2026-07-15.json").exists())
        self.assertIn("1 changed", first.summary())

        before = snapshot(self.bronze) | snapshot(self.out)
        second, runs = self.run_sync()
        self.assertEqual(second.changed_dates, [])
        self.assertFalse(second.exported)
        self.assertEqual(runs, [(1, None), (0, None)])
        self.assertEqual(snapshot(self.bronze) | snapshot(self.out), before)
        self.assertIn("0 changed, no export", second.summary())

    def test_a_revised_record_is_replaced_whole_and_re_exported(self):
        self.run_sync()
        self.upstream[16086] = REVISED
        result, _ = self.run_sync()
        self.assertEqual(result.changed_dates, ["2026-07-15"])
        sitting = json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))
        self.assertEqual(sitting["record_published_at"], "2026-07-21T06:00:00")
        self.assertEqual((self.bronze / "2026" / "2026-07-15-16086.xml").read_bytes(), REVISED)

    def test_an_unavailable_meeting_is_reported_not_fatal(self):
        self.upstream[16087] = None
        del self.upstream[16087]
        with mock.patch.object(plenary_xml, "list_plenary_meetings", return_value=[("2026-07-15", 16086), ("2026-07-16", 16087)]):
            result, runs = self.run_sync()
        self.assertEqual(result.unavailable, [16087])
        self.assertEqual(result.changed_dates, ["2026-07-15"])
        self.assertEqual(runs[-1], (1, None))

    def test_the_run_row_carries_an_unhandled_error(self):
        with mock.patch.object(plenary_xml, "list_plenary_meetings", side_effect=RuntimeError("index exploded")):
            conn = create_connection(self.db)
            try:
                with self.assertRaises(RuntimeError):
                    sync_mod.sync(conn, today=TODAY, out=self.out)
                sync_mod.record_run(conn, sync_mod.utcnow(), sync_mod.SyncResult(error="RuntimeError: index exploded"))
                row = conn.execute("SELECT sessions_changed, error FROM sync_runs").fetchone()
            finally:
                conn.close()
        self.assertEqual(tuple(row), (0, "RuntimeError: index exploded"))

    def test_a_failed_stream_lookup_leaves_null_and_does_not_fail(self):
        result, runs = self.run_sync()
        self.assertEqual(runs, [(1, None)])
        self.assertEqual(result.streams_changed, [])
        sitting = json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))
        self.assertIsNone(sitting["stream_url"])

    def test_a_new_stream_alone_is_exported(self):
        self.run_sync()
        self.tv.side_effect = upstream()
        result, runs = self.run_sync()
        self.assertEqual((result.changed_dates, result.streams_changed), ([], ["2026-07-15"]))
        self.assertTrue(result.exported)
        self.assertEqual(runs[-1], (0, None))
        sitting = json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))
        self.assertTrue(sitting["stream_url"].startswith("https://nafw.cdn.vustreams.com/"))
        self.assertIn("1 streams changed", result.summary())
        quiet, _ = self.run_sync()
        self.assertFalse(quiet.exported)

    def test_export_carries_the_last_check_time(self):
        self.run_sync()
        self.upstream[16086] = REVISED
        self.run_sync()
        index = json.loads((self.out / "index.json").read_text(encoding="utf-8"))
        self.assertRegex(index["checked_at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


if __name__ == "__main__":
    unittest.main()
