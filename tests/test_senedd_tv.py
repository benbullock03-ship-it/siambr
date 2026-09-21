"""T-31: the Senedd TV stream is resolved from Senedd's own pages and ships only when aligned."""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from pipeline import run_checks, senedd_tv
from pipeline.adapters.http import SourceUnavailable
from pipeline.export import export_connection
from pipeline.plenary import known_member_ids, normalise, write_session
from tests.memory_db import memory_db
from tests.test_plenary_ingestion import MODERN, SOURCE, insert_speakers

FIXTURES = Path(__file__).resolve().parent / "fixtures"
TV_PAGE = (FIXTURES / "senedd_tv_16086_page.html").read_bytes()
PLAYER = (FIXTURES / "senedd_tv_16086_player.html").read_bytes()
MASTER = (FIXTURES / "senedd_tv_16086_master.m3u8").read_bytes()
VARIANT = (FIXTURES / "senedd_tv_16086_variant.m3u8").read_bytes()
TV_PAGE_CY = (FIXTURES / "senedd_tv_16086_page_cy.html").read_bytes()
PLAYER_CY = (FIXTURES / "senedd_tv_16086_player_cy.html").read_bytes()
MASTER_VERBATIM = (FIXTURES / "senedd_tv_16086_master_verbatim.m3u8").read_bytes()
VARIANT_VERBATIM = (FIXTURES / "senedd_tv_16086_variant_verbatim.m3u8").read_bytes()
GUID = "895772f3-294c-4f28-bc78-74f224e2e3c6"
GUID_CY = "6f9eba1f-9401-40c9-9436-ae4ed2bc4d9b"
VERBATIM_URL = (f"https://nafw.cdn.vustreams.com/m/{GUID}/verbatim/verbatim.isml/"
                "verbatim.m3u8?t=2026-07-15T12:30:07")
VERBATIM_VARIANT_URL = (f"https://nafw.cdn.vustreams.com/m/{GUID}/verbatim/verbatim.isml/"
                        "verbatim-audio_0=96000-video=499968.m3u8?vbegin=1784118607")
MASTER_URL = (f"https://nafw.cdn.vustreams.com/m/{GUID}/interpretation/interpretation.isml/"
              "interpretation.m3u8?t=2026-07-15T12:30:07")
VARIANT_URL = (f"https://nafw.cdn.vustreams.com/m/{GUID}/interpretation/interpretation.isml/"
               "interpretation-audio_0=96000-video=499968.m3u8?vbegin=1784118607")
# 16086's Record MeetingDate is 2026-07-15T13:30:01 BST; its first segment starts 12:30:00.4 UTC.
RECORD_START = datetime(2026, 7, 15, 12, 30, 1, tzinfo=timezone.utc).timestamp()
FIRST_SEGMENT = datetime(2026, 7, 15, 12, 30, 0, 400000, tzinfo=timezone.utc).timestamp()
UPSTREAM = {
    "https://www.senedd.tv/en/16086": TV_PAGE,
    f"https://player.senedd.tv/Player/Index/{GUID}": PLAYER,
    MASTER_URL: MASTER,
    VARIANT_URL: VARIANT,
    "https://www.senedd.tv/cy/16086": TV_PAGE_CY,
    f"https://player.senedd.tv/Player/Index/{GUID_CY}": PLAYER_CY,
    VERBATIM_URL: MASTER_VERBATIM,
    VERBATIM_VARIANT_URL: VARIANT_VERBATIM,
}


def upstream(overrides: dict[str, bytes | Exception] | None = None):
    pages = UPSTREAM | (overrides or {})

    def get(url: str) -> bytes:
        body = pages.get(url, SourceUnavailable(f"404 from {url}"))
        if isinstance(body, Exception):
            raise body
        return body

    return get


class ParsingTests(unittest.TestCase):
    def test_lookup_chain_reads_senedd_pages(self):
        self.assertEqual(senedd_tv.player_guid(TV_PAGE), GUID)
        self.assertEqual(senedd_tv.master_url(PLAYER), MASTER_URL)
        self.assertEqual(senedd_tv.first_variant_url(MASTER, MASTER_URL), VARIANT_URL)
        self.assertEqual(senedd_tv.first_segment_time(VARIANT), FIRST_SEGMENT)

    def test_error_pages_are_unavailable(self):
        error = b"<html><head><title>Error - NAFW Admin</title></head></html>"
        with self.assertRaises(SourceUnavailable):
            senedd_tv.player_guid(error)
        with self.assertRaises(SourceUnavailable):
            senedd_tv.master_url(error)
        with self.assertRaises(SourceUnavailable):
            senedd_tv.first_variant_url(error, MASTER_URL)

    def test_an_uploaded_file_has_no_wall_clock(self):
        body = b"#EXTM3U\n#USP-X-TIMESTAMP-MAP:MPEGTS=900000,LOCAL=1970-01-01T00:00:00Z\n#EXTINF:17, no desc\nf-1.ts\n"
        self.assertIsNone(senedd_tv.first_segment_time(body))


class AlignmentGateTests(unittest.TestCase):
    def test_gate_at_0_2_and_3_seconds(self):
        for gap, ok in [(0, True), (2, True), (-2, True), (2.001, False), (3, False), (-3, False)]:
            with self.subTest(gap=gap):
                self.assertEqual(senedd_tv.is_aligned(RECORD_START + gap, "2026-07-15", "13:30:01"), ok)

    def test_start_is_read_in_europe_london(self):
        winter = datetime(2026, 1, 13, 13, 30, 1, tzinfo=timezone.utc).timestamp()
        self.assertTrue(senedd_tv.is_aligned(winter, "2026-01-13", "13:30:01"))
        self.assertFalse(senedd_tv.is_aligned(RECORD_START + 3600, "2026-07-15", "13:30:01"))

    def test_missing_clock_never_aligns(self):
        self.assertFalse(senedd_tv.is_aligned(None, "2026-07-15", "13:30:01"))
        self.assertFalse(senedd_tv.is_aligned(RECORD_START, "2026-07-15", None))


class ResolveAndExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.bronze = root / "bronze"
        self.out = root / "data"
        self.patch = mock.patch.object(senedd_tv, "SENEDD_TV_BRONZE", self.bronze)
        self.patch.start()
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        write_session(self.conn, normalise(MODERN, known_member_ids(self.conn), SOURCE))
        self.log: list[str] = []

    def tearDown(self):
        self.patch.stop()
        self.conn.close()
        self.tmp.cleanup()

    def stored(self):
        return tuple(self.conn.execute("SELECT stream_url, stream_vbegin FROM plenary_sessions WHERE id = 'plenary-16086'").fetchone())

    def exported(self):
        export_connection(self.conn, self.out)
        return json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))["stream_url"]

    def test_resolves_mirrors_and_exports_an_aligned_stream(self):
        self.assertTrue(senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append))
        self.assertEqual(self.stored(), (MASTER_URL, FIRST_SEGMENT))
        self.assertIn("-0.6 s from the Record start, aligned", self.log[0])
        folder = self.bronze / "2026"
        self.assertEqual((folder / "2026-07-15-16086-master.m3u8").read_bytes(), MASTER)
        manifest = (folder / "2026-07-15-16086.sha256").read_text().splitlines()
        self.assertEqual([line.split("  ")[1] for line in manifest],
                         ["2026-07-15-16086-player.html", "2026-07-15-16086-master.m3u8", "2026-07-15-16086-variant.m3u8"])
        self.assertEqual(self.exported(), MASTER_URL)
        self.assertFalse(senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append))

    def test_the_welsh_player_names_the_verbatim_feed(self):
        self.assertTrue(senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append))
        row = self.conn.execute(
            "SELECT stream_url_verbatim, stream_vbegin_verbatim FROM plenary_sessions WHERE id = 'plenary-16086'").fetchone()
        self.assertEqual(tuple(row), (VERBATIM_URL, FIRST_SEGMENT))
        self.assertIn("verbatim stream -0.6 s from the Record start, aligned", self.log[1])
        self.assertTrue((self.bronze / "2026" / "2026-07-15-16086-verbatim.sha256").exists())
        export_connection(self.conn, self.out)
        sitting = json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))
        self.assertEqual((sitting["stream_url"], sitting["stream_url_verbatim"]), (MASTER_URL, VERBATIM_URL))

    def test_a_missing_verbatim_feed_leaves_the_interpretation_feed(self):
        down = upstream({f"https://player.senedd.tv/Player/Index/{GUID_CY}": SourceUnavailable("302 to /Player/Error")})
        self.assertTrue(senedd_tv.refresh_stream(self.conn, 16086, get=down, log=self.log.append))
        self.assertEqual(self.stored(), (MASTER_URL, FIRST_SEGMENT))
        self.assertIn("verbatim stream lookup unavailable", self.log[1])
        export_connection(self.conn, self.out)
        sitting = json.loads((self.out / "sittings" / "2026-07-15.json").read_text(encoding="utf-8"))
        self.assertIsNone(sitting["stream_url_verbatim"])

    def test_a_stream_three_seconds_out_is_stored_but_not_exported(self):
        late = VARIANT.replace(b"PROGRAM-DATE-TIME:2026-07-15T12:30:00.400000Z", b"PROGRAM-DATE-TIME:2026-07-15T12:30:04.000000Z")
        senedd_tv.refresh_stream(self.conn, 16086, get=upstream({VARIANT_URL: late}), log=self.log.append)
        self.assertEqual(self.stored()[0], MASTER_URL)
        self.assertIn("not aligned", self.log[0])
        self.assertIsNone(self.exported())

    def test_a_failed_lookup_leaves_null_then_keeps_what_was_stored(self):
        down = upstream({f"https://player.senedd.tv/Player/Index/{g}": SourceUnavailable("302 to /Player/Error")
                         for g in (GUID, GUID_CY)})
        self.assertFalse(senedd_tv.refresh_stream(self.conn, 16086, get=down, log=self.log.append))
        self.assertEqual(self.stored(), (None, None))
        self.assertIsNone(self.exported())
        senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append)
        senedd_tv.refresh_stream(self.conn, 16086, get=down, log=self.log.append)
        self.assertEqual(self.stored(), (MASTER_URL, FIRST_SEGMENT))

    def test_the_player_error_page_is_retried(self):
        error = b"<html><head><title>Error - NAFW Admin</title></head></html>"
        replies = [error, error, PLAYER]
        player_url = f"https://player.senedd.tv/Player/Index/{GUID}"
        get = upstream()
        stream = senedd_tv.resolve(16086, "2026-07-15", get=lambda url: replies.pop(0) if url == player_url else get(url))
        self.assertEqual(stream, senedd_tv.Stream(MASTER_URL, FIRST_SEGMENT))

    def test_a_new_record_release_keeps_the_stream(self):
        senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append)
        write_session(self.conn, normalise(MODERN, known_member_ids(self.conn), SOURCE), rewrite=True)
        self.assertEqual(self.stored(), (MASTER_URL, FIRST_SEGMENT))

    def test_run_checks_gate_and_live_sample(self):
        senedd_tv.refresh_stream(self.conn, 16086, get=upstream(), log=self.log.append)
        export_connection(self.conn, self.out)
        self.assertTrue(run_checks.check_stream_gate(self.conn, self.out).ok)

        live = run_checks.check_live_streams(self.conn, self.out, get=upstream())
        self.assertTrue(live.ok, live.failures)
        self.assertEqual(live.notes, [])

        outage = run_checks.check_live_streams(self.conn, self.out, get=upstream({MASTER_URL: SourceUnavailable("503")}))
        self.assertTrue(outage.ok)
        self.assertIn("source unavailable", outage.notes[0])

        moved = VARIANT.replace(b"12:30:00.400000Z", b"12:30:08.400000Z")
        self.assertFalse(run_checks.check_live_streams(self.conn, self.out, get=upstream({VARIANT_URL: moved})).ok)

        path = self.out / "sittings" / "2026-07-15.json"
        sitting = json.loads(path.read_text(encoding="utf-8"))
        with self.conn:
            self.conn.execute("UPDATE plenary_sessions SET stream_vbegin = stream_vbegin + 3")
        self.assertFalse(run_checks.check_stream_gate(self.conn, self.out).ok)
        self.assertEqual(sitting["stream_url"], MASTER_URL)


if __name__ == "__main__":
    unittest.main()
