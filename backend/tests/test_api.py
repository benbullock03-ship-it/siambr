"""T-06: FastAPI serving layer, dossier queries, and FTS5 search."""

from __future__ import annotations

import tempfile
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import backend.db as backend_db
from backend.main import app
from pipeline.apply_migrations import apply_migrations
from pipeline.db import create_connection
from pipeline.seed import seed_baseline

MEMBER_ROWS = [
    ("ms-jane-doe", "W09000048", "Afan Ogwr Rhondda", "Afan Ogwr Rhondda", "Jane Doe", None, None,
     None, "https://senedd.wales/people/jane-doe/", "active"),
    ("ms-john-smith", "W09000049", "Bangor Conwy Môn", "Bangor Conwy Môn", "John Smith", None, None,
     None, "https://senedd.wales/people/john-smith/", "active"),
    ("ms-old-hand", "W09000050", "Ceredigion Penfro", "Ceredigion Penfro", "Old Hand", None, None,
     None, "https://senedd.wales/people/old-hand/", "former"),
]

N_FILLER_SPEECHES = 500


def _build_fixture_db(path: Path) -> None:
    conn = create_connection(path)
    apply_migrations(conn)
    seed_baseline(conn)
    with conn:
        conn.executemany(
            """INSERT INTO members (id, gss_constituency_code, constituency_name_en, constituency_name_cy,
                   canonical_name, cymraeg_name, honorific, portrait_url, official_profile_url, current_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            MEMBER_ROWS,
        )
        conn.execute(
            """INSERT INTO member_tenures (member_id, party_id, senedd_term, is_regional_member, region_name,
                   start_date, end_date)
               VALUES ('ms-jane-doe', 'labour', 7, 0, NULL, '2026-05-07', NULL)"""
        )
        conn.execute(
            """INSERT INTO member_tenures (member_id, party_id, senedd_term, is_regional_member, region_name,
                   start_date, end_date)
               VALUES ('ms-john-smith', 'conservatives', 7, 0, NULL, '2026-05-07', NULL)"""
        )
        conn.execute(
            """INSERT INTO member_tenures (member_id, party_id, senedd_term, is_regional_member, region_name,
                   start_date, end_date)
               VALUES ('ms-old-hand', 'plaid_cymru', 6, 0, NULL, '2021-05-06', '2026-05-06')"""
        )
        # A never-closed tenure from an earlier term, as the live registry contains.
        conn.execute(
            """INSERT INTO member_tenures (member_id, party_id, senedd_term, is_regional_member, region_name,
                   start_date, end_date)
               VALUES ('ms-old-hand', 'plaid_cymru', 2, 0, NULL, '2003-05-01', NULL)"""
        )
        conn.execute(
            """INSERT INTO ministerial_roles (member_id, title_en, title_cy, cabinet_level, start_date, end_date)
               VALUES ('ms-jane-doe', 'Cabinet Secretary for Health', 'Ysgrifennydd y Cabinet dros Iechyd',
                       'cabinet_secretary', '2026-05-10', NULL)"""
        )
        conn.execute(
            """INSERT INTO presiding_officers (senedd_term, member_id, office, start_date, end_date, provenance, source_url)
               VALUES (7, 'ms-john-smith', 'llywydd', '2026-05-12', NULL, 'senedd_news',
                       'https://senedd.wales/senedd-now/news/new-llywydd-and-deputy-presiding-officer-elected/')"""
        )
        conn.execute(
            """INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy,
                   source_xml_url, xml_sha256)
               VALUES ('session-1', 7, '2026-06-10', 'Plenary', 'Cyfarfod Llawn',
                       'https://record.senedd.wales/Plenary/2026-06-10.xml', ?)""",
            ("0" * 64,),
        )
        conn.execute(
            """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy,
                   policy_domain_id, senedd_tv_clip_url)
               VALUES ('item-1', 'session-1', 0, 'debate', 'NHS Dentistry Waiting Times',
                       'Amseroedd Aros Deintyddiaeth GIG', 'health', 'https://senedd.tv/clip/1')"""
        )
        conn.execute(
            """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy,
                   policy_domain_id, senedd_tv_clip_url)
               VALUES ('item-2', 'session-1', 1, 'debate', 'Rural Bus Routes',
                       'Llwybrau Bysiau Gwledig', 'transport', NULL)"""
        )
        conn.execute(
            """INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number,
                   spoken_language, verbatim_text_original, verbatim_text_english,
                   video_timestamp_start, video_timestamp_end)
               VALUES ('speech-1', 'item-1', 'ms-jane-doe', 0, 'en',
                       'NHS dentistry waiting lists in Wales remain unacceptably long.',
                       'NHS dentistry waiting lists in Wales remain unacceptably long.', 0, 45)"""
        )
        conn.execute(
            """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against,
                   votes_abstain, result)
               VALUES ('division-1', 'item-1', 'To note the report.', 1, 1, 0, 'negatived')"""
        )
        conn.executemany(
            "INSERT INTO member_votes (division_id, member_id, vote_cast) VALUES (?, ?, ?)",
            [("division-1", "ms-jane-doe", "for"), ("division-1", "ms-john-smith", "against")],
        )
        conn.execute(
            """INSERT INTO citizen_petitions (id, title_en, petitioner_name, signature_count, opened_date,
                   closing_date, status, committee_response, debate_agenda_item_id, source_url)
               VALUES ('petition-1', 'Fix NHS dentistry', 'A Citizen', 12000, '2026-01-01', NULL,
                       'debated', NULL, 'item-1', 'https://petitions.senedd.wales/petitions/1')"""
        )
        conn.executemany(
            """INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number,
                   spoken_language, verbatim_text_original, verbatim_text_english,
                   video_timestamp_start, video_timestamp_end)
               VALUES (?, 'item-2', 'ms-john-smith', ?, 'en', ?, ?, NULL, NULL)""",
            [
                (f"filler-{i}", i + 1, f"Unrelated remarks about rural transport funding, item {i}.",
                 f"Unrelated remarks about rural transport funding, item {i}.")
                for i in range(N_FILLER_SPEECHES)
            ],
        )
        # A deep-vault item so the fixture spans more than one 50 m chunk.
        conn.execute(
            """INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy,
                   source_xml_url, xml_sha256)
               VALUES ('session-0', 1, '2003-03-04', 'Plenary', 'Cyfarfod Llawn',
                       'https://record.senedd.wales/Plenary/2003-03-04.xml', ?)""",
            ("0" * 64,),
        )
        conn.execute(
            """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy,
                   policy_domain_id, senedd_tv_clip_url)
               VALUES ('item-0', 'session-0', 0, 'debate', 'Free Prescriptions',
                       'Presgripsiynau am Ddim', 'health', NULL)"""
        )
    conn.close()


class _FixtureApiCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls._tmpdir.name) / "siambr.db"
        _build_fixture_db(cls.db_path)
        backend_db.set_db_path(str(cls.db_path))
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmpdir.cleanup()


class ApiTests(_FixtureApiCase):
    def test_dossier_plate_full_payload(self) -> None:
        resp = self.client.get("/api/plenary/items/item-1")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["title_en"], "NHS Dentistry Waiting Times")
        self.assertEqual(body["session_date"], "2026-06-10")
        self.assertEqual(len(body["contributions"]), 1)
        self.assertEqual(body["contributions"][0]["member"]["canonical_name"], "Jane Doe")
        self.assertEqual(len(body["divisions"]), 1)
        self.assertEqual(body["divisions"][0]["result"], "negatived")
        self.assertEqual(len(body["petitions"]), 1)
        self.assertEqual(body["petitions"][0]["title_en"], "Fix NHS dentistry")

    def test_dossier_plate_404_on_unknown_id(self) -> None:
        resp = self.client.get("/api/plenary/items/does-not-exist")
        self.assertEqual(resp.status_code, 404)

    def test_sessions_filterable_by_term(self) -> None:
        resp = self.client.get("/api/plenary/sessions", params={"term": 7})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)
        resp = self.client.get("/api/plenary/sessions", params={"term": 3})
        self.assertEqual(resp.json(), [])

    def test_member_profile(self) -> None:
        resp = self.client.get("/api/members/ms-jane-doe")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["canonical_name"], "Jane Doe")
        self.assertEqual(body["contribution_count"], 1)
        self.assertEqual(len(body["roles"]), 1)
        self.assertEqual(body["roles"][0]["cabinet_level"], "cabinet_secretary")

    def test_member_profile_404(self) -> None:
        resp = self.client.get("/api/members/ms-nobody")
        self.assertEqual(resp.status_code, 404)

    def test_search_matches_verbatim_speech(self) -> None:
        resp = self.client.get("/api/search", params={"q": "dentistry"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(len(body["results"]), 1)
        self.assertEqual(body["results"][0]["contribution_id"], "speech-1")
        self.assertIn("<mark>", body["results"][0]["snippet"])

    def test_search_matches_member_name(self) -> None:
        resp = self.client.get("/api/search", params={"q": "\"Jane Doe\""})
        self.assertEqual(resp.json()["results"][0]["contribution_id"], "speech-1")

    def test_search_performance_under_20ms(self) -> None:
        started = time.perf_counter()
        resp = self.client.get("/api/search", params={"q": "dentistry"})
        elapsed_ms = (time.perf_counter() - started) * 1000
        self.assertEqual(resp.status_code, 200)
        self.assertLess(resp.json()["took_ms"], 20.0)
        self.assertLess(elapsed_ms, 100.0)

    def test_db_connection_is_read_only(self) -> None:
        conn = next(backend_db.get_connection())
        try:
            with self.assertRaises(Exception):
                conn.execute("INSERT INTO members (id, constituency_name_en, constituency_name_cy, "
                             "canonical_name, official_profile_url, current_status) "
                             "VALUES ('x', 'x', 'x', 'x', 'https://example.com', 'active')")
        finally:
            conn.close()


class RegisterApiTests(_FixtureApiCase):
    """T-07: payload extensions the 2D Register and Dossier Plate read."""

    def test_sessions_carry_their_agenda_items_in_order(self) -> None:
        body = self.client.get("/api/plenary/sessions").json()
        self.assertEqual([s["id"] for s in body], ["session-0", "session-1"])
        self.assertEqual([i["id"] for i in body[1]["items"]], ["item-1", "item-2"])
        self.assertEqual(body[1]["items"][0]["policy_domain_id"], "health")

    def test_domain_filter_narrows_items(self) -> None:
        body = self.client.get("/api/plenary/sessions", params={"domain": "transport"}).json()
        self.assertEqual([i["id"] for i in body[0]["items"]], ["item-2"])

    def test_sessions_filterable_by_speaker(self) -> None:
        body = self.client.get("/api/plenary/sessions", params={"speaker": "ms-jane-doe"}).json()
        self.assertEqual([i["id"] for i in body[0]["items"]], ["item-1"])
        self.assertEqual(self.client.get("/api/plenary/sessions", params={"speaker": "ms-nobody"}).json(), [])

    def test_members_index_sorted_by_name(self) -> None:
        body = self.client.get("/api/members").json()
        self.assertEqual([m["id"] for m in body], ["ms-jane-doe", "ms-john-smith", "ms-old-hand"])

    def test_policy_domains_index(self) -> None:
        body = self.client.get("/api/policy-domains").json()
        self.assertEqual(len(body), 6)
        self.assertIn({"id": "health", "name_en": "Health & Social Care", "name_cy": "Iechyd a Gofal Cymdeithasol"}, body)

    def test_contribution_carries_role_and_party_on_session_date(self) -> None:
        speech = self.client.get("/api/plenary/items/item-1").json()["contributions"][0]
        self.assertEqual(speech["role_title_en"], "Cabinet Secretary for Health")
        self.assertEqual(speech["role_title_cy"], "Ysgrifennydd y Cabinet dros Iechyd")
        self.assertEqual(speech["party_id_at_date"], "labour")

    def test_backbench_contribution_has_no_role(self) -> None:
        speech = self.client.get("/api/plenary/items/item-2").json()["contributions"][0]
        self.assertIsNone(speech["role_title_en"])
        self.assertEqual(speech["party_id_at_date"], "conservatives")

    def test_dossier_cites_official_record(self) -> None:
        body = self.client.get("/api/plenary/items/item-1").json()
        self.assertEqual(body["source_xml_url"], "https://record.senedd.wales/Plenary/2026-06-10.xml")

    def test_ballots_carry_party_on_session_date(self) -> None:
        ballots = self.client.get("/api/plenary/items/item-1").json()["divisions"][0]["ballots"]
        self.assertEqual({b["member"]["id"]: b["party_id_at_date"] for b in ballots},
                         {"ms-jane-doe": "labour", "ms-john-smith": "conservatives"})


if __name__ == "__main__":
    unittest.main()


class SiambrApiTests(_FixtureApiCase):
    """T-08: what the 3D chamber reads to seat Members and open their record."""

    def test_terms_carry_seat_counts(self) -> None:
        body = self.client.get("/api/terms").json()
        self.assertEqual([t["term"] for t in body], [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(body[5]["seat_count"], 60)
        self.assertEqual(body[6]["seat_count"], 96)
        self.assertIsNone(body[6]["end_date"])

    def test_terms_carry_their_presiding_officers_with_a_source(self) -> None:
        body = self.client.get("/api/terms").json()
        self.assertEqual(body[5]["presiding_officers"], [])
        [llywydd] = body[6]["presiding_officers"]
        self.assertEqual(llywydd["member_id"], "ms-john-smith")
        self.assertEqual(llywydd["office"], "llywydd")
        self.assertIsNone(llywydd["end_date"])
        self.assertTrue(llywydd["source_url"].startswith("https://senedd.wales/"))

    def test_current_members_means_open_tenure_in_the_open_term(self) -> None:
        everyone = self.client.get("/api/members").json()
        self.assertIn("ms-old-hand", [m["id"] for m in everyone])
        current = self.client.get("/api/members", params={"current": "true"}).json()
        self.assertEqual([m["id"] for m in current], ["ms-jane-doe", "ms-john-smith"])
        self.assertEqual(current[0]["party_id"], "labour")

    def test_member_record_is_verbatim_and_newest_first(self) -> None:
        resp = self.client.get("/api/members/ms-john-smith/record", params={"limit": 3})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["member"]["canonical_name"], "John Smith")
        self.assertEqual(body["speech_total"], N_FILLER_SPEECHES)
        self.assertEqual(len(body["speeches"]), 3)
        self.assertEqual(body["speeches"][0]["id"], f"filler-{N_FILLER_SPEECHES - 1}")
        self.assertEqual(body["speeches"][0]["agenda_item_title_en"], "Rural Bus Routes")
        self.assertEqual(body["speeches"][0]["verbatim_text_original"],
                         f"Unrelated remarks about rural transport funding, item {N_FILLER_SPEECHES - 1}.")
        self.assertEqual(body["ballot_total"], 1)
        self.assertEqual(body["ballots"][0]["vote_cast"], "against")
        self.assertEqual(body["ballots"][0]["motion_text"], "To note the report.")
        self.assertEqual(body["ballots"][0]["result"], "negatived")

    def test_member_record_404(self) -> None:
        self.assertEqual(self.client.get("/api/members/ms-nobody/record").status_code, 404)
