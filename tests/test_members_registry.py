"""T-03: members registry. Offline parser/merge tests on fixtures, plus live-DB audits that
skip unless data/siambr.db has been populated by ``python -m pipeline.reconcile_members``."""

from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path

import requests

from pipeline.adapters import gov_wales, moderngov, senedd_site
from pipeline.adapters.http import SourceUnavailable, fetch
from pipeline.db import DEFAULT_DB_PATH, create_connection
from pipeline.members import cabinet_level_for, canonical_id, party_id_for, strip_name, term_for_date, upsert_members
from pipeline.reconcile_members import attach_first_ministers, backfill_election_seats
from pipeline.reference.term_corrections import (
    apply_byelection_replacements, apply_known_continuous_seats, apply_term_relabels,
)
from pipeline.reference.election_1999 import tenures_1999
from pipeline.reference.election_2003 import tenures_2003
from pipeline.reference.first_ministers import FIRST_MINISTERS
from pipeline.reference.gss import (
    SENEDD_CONSTITUENCIES_1999_2026, SENEDD_CONSTITUENCIES_2026, lookup_constituency,
)
from tests.memory_db import memory_db

FIXTURES = Path(__file__).parent / "fixtures"
FIRST_MINISTER_IDS = [
    "ms-alun-michael", "ms-rhodri-morgan", "ms-carwyn-jones", "ms-mark-drakeford",
    "ms-vaughan-gething", "ms-eluned-morgan", "ms-rhun-ap-iorwerth",
]


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class NormalisationTests(unittest.TestCase):
    def test_strip_name_and_canonical_id(self):
        self.assertEqual(strip_name("Rt. Hon. Elin Jones MS"), ("Elin Jones", "Rt. Hon."))
        self.assertEqual(strip_name("Rhun ap Iorwerth AS"), ("Rhun ap Iorwerth", None))
        self.assertEqual(strip_name("Alun Michael AM"), ("Alun Michael", None))
        self.assertEqual(canonical_id("Siân Gwenllian"), "ms-sian-gwenllian")
        self.assertEqual(canonical_id("Rhys ab Owen"), "ms-rhys-ab-owen")
        self.assertEqual(canonical_id("Andrew R T Davies"), canonical_id("Andrew RT Davies"))
        self.assertEqual(strip_name("Y Gw. Anrh. Elin Jones AS"), ("Elin Jones", "Rt. Hon."))

    def test_party_mapping(self):
        self.assertEqual(party_id_for("Welsh Labour and Co-operative Party"), "labour")
        self.assertEqual(party_id_for("reform uk"), "reform_uk")
        self.assertEqual(party_id_for("Welsh Green Party"), "greens")
        self.assertEqual(party_id_for("Independent Member"), "independent")
        self.assertEqual(party_id_for(None), "other")

    def test_cabinet_level(self):
        self.assertEqual(cabinet_level_for("First Minister of Wales"), "first_minister")
        self.assertEqual(cabinet_level_for("Deputy First Minister and Cabinet Minister for Social Justice"), "deputy_first_minister")
        self.assertEqual(cabinet_level_for("Cabinet Minister for Finance"), "cabinet_minister")
        self.assertEqual(cabinet_level_for("Deputy Minister for Transport"), "deputy_minister")
        self.assertEqual(cabinet_level_for("Trefnydd, Chief Whip and Cabinet Minister for Culture"), "cabinet_minister")
        self.assertIsNone(cabinet_level_for(None))

    def test_term_for_date(self):
        self.assertEqual(term_for_date("1999-05-12"), 1)
        self.assertEqual(term_for_date("2013-08-02"), 4)
        self.assertEqual(term_for_date("2026-05-08"), 7)
        self.assertIsNone(term_for_date("1998-01-01"))


class GssReferenceTests(unittest.TestCase):
    def test_sixteen_2026_constituencies(self):
        codes = [c for c, _, _ in SENEDD_CONSTITUENCIES_2026]
        self.assertEqual(len(codes), 16)
        self.assertEqual(len(set(codes)), 16)
        self.assertEqual(codes[0], "W09000048")
        self.assertEqual(codes[-1], "W09000063")

    def test_forty_pre_2026_constituencies(self):
        codes = [c for c, _, _ in SENEDD_CONSTITUENCIES_1999_2026]
        self.assertEqual(len(codes), 40)
        self.assertEqual(len(set(codes)), 40)

    def test_lookup_folds_case_diacritics_and_hyphens(self):
        self.assertEqual(lookup_constituency("bangor conwy môn")[0], "W09000049")
        self.assertEqual(lookup_constituency("Bangor Conwy Mon")[0], "W09000049")
        self.assertEqual(lookup_constituency("gŵyr abertawe")[0], "W09000059")
        self.assertEqual(lookup_constituency("pen-y-bont bro morgannwg")[0], "W09000060")
        self.assertEqual(lookup_constituency("Gorllewin Caerdydd")[1], "Cardiff West")
        self.assertIsNone(lookup_constituency("South Wales Central"))
        self.assertEqual(lookup_constituency("Camarthen East and Dinefwr")[0], "W09000015")
        self.assertEqual(lookup_constituency("Cardiff South & Penarth")[0], "W09000043")


class ModernGovAdapterTests(unittest.TestCase):
    def test_parse_councillors_by_ward(self):
        recs = moderngov.parse_members_xml(fixture("moderngov_councillorsbyward.xml").encode())
        by_id = {r.id: r for r in recs}
        self.assertEqual(set(by_id), {"ms-test-person", "ms-another-member"})
        p = by_id["ms-test-person"]
        self.assertEqual(p.honorific, "Rt. Hon.")
        self.assertEqual(p.gss_constituency_code, "W09000049")
        self.assertEqual(p.current_status, "active")
        self.assertEqual([(t.senedd_term, t.start_date, t.end_date) for t in p.tenures],
                         [(6, "2021-05-08", "2026-04-07"), (7, "2026-05-08", None)])
        self.assertEqual(p.tenures[0].party_id, "plaid_cymru")
        self.assertIsNone(by_id["ms-another-member"].portrait_url)

    def test_outage_page_is_source_unavailable(self):
        class Resp:
            status_code = 200
            content = b"<!doctype html><html><title>Service unavailable</title></html>"

            def raise_for_status(self):
                pass

        class Session(requests.Session):
            def request(self, *a, **k):
                return Resp()

        with self.assertRaises(SourceUnavailable):
            moderngov.fetch_members_xml(session=Session(), use_cache=False, retries=1, sleep=lambda _: None)


class BackoffTests(unittest.TestCase):
    def test_retries_403_with_doubling_delay(self):
        calls, delays = [], []

        class Resp:
            def __init__(self, code):
                self.status_code = code
                self.content = b"<ok/>"

            def raise_for_status(self):
                pass

        class Session(requests.Session):
            def request(self, method, url, **k):
                calls.append(url)
                return Resp(403 if len(calls) < 3 else 200)

        body = fetch("https://example.invalid/x", session=Session(), retries=4, backoff=0.5, sleep=delays.append)
        self.assertEqual(body, b"<ok/>")
        self.assertEqual(len(calls), 3)
        self.assertEqual(delays, [0.5, 1.0])

    def test_gives_up_after_retries(self):
        class Session(requests.Session):
            def request(self, *a, **k):
                raise requests.ConnectionError("down")

        with self.assertRaises(SourceUnavailable):
            fetch("https://example.invalid/y", session=Session(), retries=2, sleep=lambda _: None)


class SeneddSiteAdapterTests(unittest.TestCase):
    def test_parse_current_members(self):
        rows = senedd_site.parse_current_members(json.loads(fixture("senedd_site_search.json")))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["url_en"], "https://senedd.wales/people/test-person-ms/")
        self.assertEqual(rows[0]["party"], "plaid cymru")
        self.assertTrue(rows[0]["is_minister"])
        self.assertFalse(rows[1]["is_minister"])

    def test_parse_archive(self):
        rows = senedd_site.parse_archive_members(fixture("senedd_site_archive.html"), 6)
        self.assertEqual([(r["name"], r["seat"]) for r in rows],
                         [("Test Person MS", "Ynys Môn"), ("Former Member MS", "South Wales Central")])
        self.assertTrue(rows[0]["portrait"].endswith("smallpic.jpg"))

    def test_parse_profile(self):
        p = senedd_site.parse_profile(fixture("senedd_site_profile.html"), "https://senedd.wales/people/Test-Person-MS/")
        self.assertEqual(p["name"], "Rt. Hon. Test Person MS")
        self.assertEqual(p["party"], "Plaid Cymru")
        self.assertEqual(p["constituency"], "Bangor Conwy Môn")
        self.assertTrue(p["portrait"].endswith("bigpic.jpg"))
        self.assertEqual(p["terms_of_office"],
                         [("2013-08-02", "2016-04-05"), ("2021-05-08", "2026-04-07"), ("2026-05-08", None)])

    def test_cymraeg_url(self):
        self.assertEqual(senedd_site.cymraeg_url("https://senedd.wales/people/Dawn-Bowden-MS/"),
                         "https://senedd.cymru/pobl/Dawn-Bowden-as/")
        self.assertEqual(senedd_site.cymraeg_url("https://senedd.wales/people/Old-Member-AM/"),
                         "https://senedd.cymru/pobl/Old-Member-ac/")

    def test_gov_wales_appointment_sentence(self):
        page = "<p>Biography</p><p>On 13 May 2026 Test Person was appointed Deputy First Minister.</p>"
        self.assertEqual(gov_wales.parse_appointment_date(page), "2026-05-13")
        self.assertIsNone(gov_wales.parse_appointment_date("<p>nothing here</p>"))
        self.assertEqual(gov_wales.bio_url("https://senedd.wales/people/Test-Person-MS/"), "https://www.gov.wales/test-person-ms")

    def test_build_records_merges_sources(self):
        current = senedd_site.parse_current_members(json.loads(fixture("senedd_site_search.json")))
        archive = senedd_site.parse_archive_members(fixture("senedd_site_archive.html"), 6)
        key = "https://senedd.wales/people/test-person-ms"
        profiles = {key: senedd_site.parse_profile(fixture("senedd_site_profile.html"), "https://senedd.wales/people/Test-Person-MS/")}
        recs = senedd_site.build_records(current, archive, profiles, {key: "Person Prawf"},
                                         {key: ("2026-05-13", "https://www.gov.wales/test-person-ms")})
        by_id = {r.id: r for r in recs}
        self.assertEqual(set(by_id), {"ms-test-person", "ms-another-member", "ms-former-member"})

        p = by_id["ms-test-person"]
        self.assertEqual(p.canonical_name, "Test Person")
        self.assertEqual(p.cymraeg_name, "Person Prawf")
        self.assertEqual(p.honorific, "Rt. Hon.")
        self.assertEqual(p.current_status, "active")
        self.assertEqual(p.gss_constituency_code, "W09000049")
        self.assertEqual([t.senedd_term for t in p.tenures], [4, 6, 7])
        self.assertEqual(p.tenures[1].end_date, "2026-04-07")
        self.assertEqual(len(p.roles), 1)
        self.assertEqual(p.roles[0].cabinet_level, "deputy_first_minister")
        self.assertEqual(p.roles[0].start_date, "2026-05-13")
        self.assertEqual(p.roles[0].provenance, "gov_wales")
        self.assertEqual(p.roles[0].title_en, "Deputy First Minister and Cabinet Minister for Social Justice and Equality")

        f = by_id["ms-former-member"]
        self.assertEqual(f.current_status, "former")
        self.assertEqual(f.tenures[0].senedd_term, 6)
        self.assertTrue(f.tenures[0].is_regional_member)
        self.assertEqual(f.tenures[0].region_name, "South Wales Central")
        self.assertEqual(p.tenures[1].seat_gss_code, "W09000001", "Ynys Môn seat recorded on the Sixth Senedd tenure")
        self.assertEqual(p.tenures[2].seat_gss_code, "W09000049")
        self.assertEqual(f.constituency_name_cy, "Canol De Cymru")

        a = by_id["ms-another-member"]
        self.assertEqual(a.canonical_name, "Another Member")
        self.assertEqual(a.gss_constituency_code, "W09000059")
        self.assertEqual(a.tenures[0].party_id, "reform_uk")
        self.assertEqual(a.roles, [])

    def test_upsert_is_idempotent(self):
        current = senedd_site.parse_current_members(json.loads(fixture("senedd_site_search.json")))
        recs = senedd_site.build_records(current, [], {})
        conn = memory_db()
        try:
            first = upsert_members(conn, recs)
            second = upsert_members(conn, recs)
            self.assertEqual(first, second)
            self.assertEqual(conn.execute("SELECT count(*) FROM members").fetchone()[0], 2)
            self.assertEqual(conn.execute("SELECT count(*) FROM member_tenures").fetchone()[0], 2)
            role = conn.execute("SELECT start_date_precision, provenance FROM ministerial_roles").fetchone()
            self.assertEqual(tuple(role), ("term_floor", "senedd_profile"))
        finally:
            conn.close()


class Election1999BackfillTests(unittest.TestCase):
    def test_fills_blank_term1_seat_only(self):
        from pipeline.members import MemberRecord, Tenure
        val_feld = MemberRecord(id="ms-val-feld", canonical_name="Val Feld", official_profile_url="u",
                                constituency_name_en="x", constituency_name_cy="x",
                                tenures=[Tenure(start_date="1999-05-06", end_date=None, senedd_term=1, party_id="other")])
        already_filled = MemberRecord(id="ms-carwyn-jones", canonical_name="Carwyn Jones", official_profile_url="u",
                                      constituency_name_en="x", constituency_name_cy="x",
                                      tenures=[Tenure(start_date="1999-05-06", end_date=None, senedd_term=1,
                                                      party_id="labour", seat_name="Bridgend", party_provenance="profile_current")])
        n = backfill_election_seats([val_feld, already_filled], 1, tenures_1999(), "1999")
        self.assertEqual(n, 1)
        self.assertEqual(val_feld.tenures[0].seat_name, "Swansea East")
        self.assertEqual(val_feld.tenures[0].party_id, "labour")
        self.assertEqual(val_feld.tenures[0].party_provenance, "curated_reference")
        self.assertTrue(val_feld.tenures[0].source_url.startswith("https://web.archive.org/web/"))
        # a tenure that already has a seat (from senedd.wales itself) is left untouched
        self.assertEqual(already_filled.tenures[0].party_provenance, "profile_current")


class TermCorrectionTests(unittest.TestCase):
    def _member(self, mid, name, tenures):
        from pipeline.members import MemberRecord
        return MemberRecord(id=mid, canonical_name=name, official_profile_url="u",
                            constituency_name_en="x", constituency_name_cy="x", tenures=tenures)

    def test_leanne_wood_relabelled_by_start_date(self):
        from pipeline.members import Tenure
        rec = self._member("ms-leanne-wood", "Leanne Wood", [
            Tenure(start_date="2003-02-05", end_date="2007-02-05", senedd_term=1, party_id="plaid_cymru"),
            Tenure(start_date="2007-04-05", end_date="2011-03-31", senedd_term=2, party_id="plaid_cymru",
                   seat_name="South Wales Central"),
        ])
        n = apply_term_relabels([rec])
        self.assertEqual(n, 2)
        self.assertEqual([t.senedd_term for t in rec.tenures], [2, 3])

    def test_byelection_replacements_fill_blank_term1_only(self):
        from pipeline.members import Tenure
        david_jones = self._member("ms-david-jones", "David Jones", [
            Tenure(start_date="1999-05-06", end_date=None, senedd_term=1, party_id="other")])
        n = apply_byelection_replacements([david_jones])
        self.assertEqual(n, 1)
        t = david_jones.tenures[0]
        self.assertEqual((t.start_date, t.end_date, t.seat_name, t.party_id), ("2002-09-10", "2003-04-30", "North Wales", "conservatives"))
        self.assertEqual(t.party_provenance, "curated_reference")

    def test_known_continuous_seat_fills_blank_only(self):
        from pipeline.members import Tenure
        artd = self._member("ms-andrew-rt-davies", "Andrew RT Davies", [
            Tenure(start_date="2011-05-06", end_date="2016-04-05", senedd_term=4, party_id="conservatives")])
        n = apply_known_continuous_seats([artd])
        self.assertEqual(n, 1)
        self.assertEqual(artd.tenures[0].seat_name, "South Wales Central")
        self.assertTrue(artd.tenures[0].is_regional_member)


class FirstMinisterReferenceTests(unittest.TestCase):
    def test_seven_contiguous_ranges(self):
        self.assertEqual([row[0] for row in FIRST_MINISTERS], FIRST_MINISTER_IDS)
        for (_, _, _, start, end, url), nxt in zip(FIRST_MINISTERS, FIRST_MINISTERS[1:]):
            self.assertLess(start, end)
            self.assertEqual(end, nxt[3], "each First Minister's end is the successor's start")
            self.assertTrue(url.startswith("https://"))
        self.assertIsNone(FIRST_MINISTERS[-1][4])

    def test_curated_role_does_not_override_exact_live_role(self):
        from pipeline.members import MemberRecord, Role
        rhun = MemberRecord(id="ms-rhun-ap-iorwerth", canonical_name="Rhun ap Iorwerth", official_profile_url="u",
                            constituency_name_en="x", constituency_name_cy="x",
                            roles=[Role("First Minister of Wales", "Prif Weinidog Cymru", "2026-05-12", None,
                                        "first_minister", provenance="gov_wales", start_date_precision="exact")])
        floor = MemberRecord(id="ms-eluned-morgan", canonical_name="Eluned Morgan", official_profile_url="u",
                             constituency_name_en="x", constituency_name_cy="x")
        self.assertEqual(attach_first_ministers([rhun, floor]), 1)
        self.assertEqual(len(rhun.roles), 1)
        self.assertEqual(rhun.roles[0].provenance, "gov_wales")
        self.assertEqual(floor.roles[0].provenance, "curated_reference")


def _live_db() -> sqlite3.Connection | None:
    if not DEFAULT_DB_PATH.exists():
        return None
    conn = create_connection(DEFAULT_DB_PATH, read_only=True)
    if conn.execute("SELECT count(*) FROM members").fetchone()[0] == 0:
        conn.close()
        return None
    return conn


@unittest.skipIf(_live_db() is None, "data/siambr.db not populated; run python -m pipeline.reconcile_members")
class LiveRegistryAudit(unittest.TestCase):
    """Acceptance checks against the ingested Gold DB (Seventh Senedd, elected 7 May 2026)."""

    @classmethod
    def setUpClass(cls):
        cls.conn = _live_db()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_exactly_96_active_members_in_seventh_senedd(self):
        active = self.conn.execute("SELECT count(*) FROM members WHERE current_status = 'active'").fetchone()[0]
        self.assertEqual(active, 96)
        seated = self.conn.execute(
            "SELECT count(DISTINCT member_id) FROM member_tenures WHERE senedd_term = 7 AND end_date IS NULL"
        ).fetchone()[0]
        self.assertEqual(seated, 96)

    def test_sixteen_constituencies_with_six_members_each(self):
        rows = self.conn.execute(
            "SELECT gss_constituency_code, count(*) FROM members WHERE current_status = 'active' GROUP BY 1 ORDER BY 1"
        ).fetchall()
        self.assertEqual([r[0] for r in rows], [c for c, _, _ in SENEDD_CONSTITUENCIES_2026])
        self.assertEqual({r[1] for r in rows}, {6})

    def test_all_forty_pre_2026_constituencies_covered(self):
        seen = {r[0] for r in self.conn.execute("SELECT DISTINCT seat_gss_code FROM member_tenures WHERE senedd_term < 7")}
        missing = {c for c, _, _ in SENEDD_CONSTITUENCIES_1999_2026} - seen
        self.assertEqual(missing, set())

    def test_no_duplicate_identities(self):
        dup_ids = self.conn.execute("SELECT id FROM members GROUP BY id HAVING count(*) > 1").fetchall()
        dup_names = self.conn.execute("SELECT canonical_name FROM members GROUP BY canonical_name HAVING count(*) > 1").fetchall()
        self.assertEqual(dup_ids, [])
        self.assertEqual(dup_names, [])
        self.assertEqual(self.conn.execute("SELECT count(*) FROM members WHERE id NOT LIKE 'ms-%'").fetchone()[0], 0)

    def test_first_ministers_present_with_valid_ranges(self):
        for mid in FIRST_MINISTER_IDS:
            row = self.conn.execute(
                "SELECT r.start_date, r.end_date, r.source_url FROM ministerial_roles r "
                "WHERE r.member_id = ? AND r.cabinet_level = 'first_minister'", (mid,)
            ).fetchone()
            self.assertIsNotNone(row, mid)
            self.assertRegex(row[0], r"^\d{4}-\d{2}-\d{2}$")
            if row[1] is not None:
                self.assertLess(row[0], row[1])
            self.assertTrue(row[2])
        sitting = self.conn.execute(
            "SELECT member_id FROM ministerial_roles WHERE cabinet_level = 'first_minister' AND end_date IS NULL"
        ).fetchall()
        self.assertEqual([r[0] for r in sitting], ["ms-rhun-ap-iorwerth"])

    def test_every_member_has_profile_url_and_a_tenure(self):
        orphans = self.conn.execute(
            "SELECT id FROM members m WHERE NOT EXISTS (SELECT 1 FROM member_tenures t WHERE t.member_id = m.id)"
        ).fetchall()
        self.assertEqual(orphans, [])
        bad_urls = self.conn.execute("SELECT count(*) FROM members WHERE official_profile_url NOT LIKE 'https://senedd.wales/people/%'").fetchone()[0]
        self.assertEqual(bad_urls, 0)

    def test_tenures_span_all_seven_terms(self):
        terms = {r[0] for r in self.conn.execute("SELECT DISTINCT senedd_term FROM member_tenures")}
        self.assertEqual(terms, set(range(1, 8)))


if __name__ == "__main__":
    unittest.main()
