"""T-05: division votes and petitions ingestion/linking."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from pipeline.adapters import moderngov_divisions, petitions
from pipeline.divisions_petitions import resolve_agenda_item, upsert_divisions, upsert_petitions
from tests.memory_db import memory_db

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def seed_session_and_item(conn):
    conn.execute(
        """INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy, source_xml_url, xml_sha256)
           VALUES ('sess-1', 7, '2026-09-10', 'Plenary', 'Cyfarfod Llawn', 'https://record.senedd.wales/x', ?)""",
        ("0" * 64,),
    )
    conn.execute(
        """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy, policy_domain_id)
           VALUES ('item-1', 'sess-1', 0, 'debate', '20mph default speed limit petition debate', 'Dadl', 'transport')""",
    )
    for mid, name in [("ms-test-person", "Test Person"), ("ms-another-member", "Another Member"),
                      ("ms-former-member", "Former Member")]:
        conn.execute(
            """INSERT INTO members (id, constituency_name_en, constituency_name_cy, canonical_name,
                   official_profile_url, current_status)
               VALUES (?, 'x', 'x', ?, 'https://senedd.wales/people/x/', 'active')""",
            (mid, name),
        )


class ModernGovDivisionsAdapterTests(unittest.TestCase):
    def test_parse_ballots_and_tally(self):
        divs = moderngov_divisions.parse_divisions_xml(fixture_bytes("moderngov_votingballots.xml"))
        self.assertEqual(len(divs), 2)
        d = divs[0]
        self.assertEqual(d.session_date, "2026-09-10")
        self.assertEqual(d.result, "agreed")
        self.assertEqual((d.votes_for, d.votes_against, d.votes_abstain), (2, 1, 0))
        self.assertEqual([(b.member_id, b.vote_cast) for b in d.ballots],
                         [("ms-test-person", "for"), ("ms-another-member", "for"), ("ms-former-member", "against")])

    def test_outage_page_is_source_unavailable(self):
        import requests

        class Resp:
            status_code = 200
            content = b"<!doctype html><html><title>Service unavailable</title></html>"

            def raise_for_status(self):
                pass

        class Session(requests.Session):
            def request(self, *a, **k):
                return Resp()

        with self.assertRaises(moderngov_divisions.SourceUnavailable):
            moderngov_divisions.fetch_divisions_xml(session=Session(), use_cache=False, retries=1, sleep=lambda _: None)


class PetitionsAdapterTests(unittest.TestCase):
    def test_parse_petitions_page(self):
        data = json.loads(fixture_text("petitions_feed.json"))
        rows = petitions.parse_petitions_page(data)
        self.assertEqual(len(rows), 2)
        p = rows[0]
        self.assertEqual(p["id"], "P-06-1353")
        self.assertEqual(p["signature_count"], 12450)
        self.assertTrue(petitions.exceeds_debate_threshold(p))
        self.assertEqual(p["debate_item_title"], "20mph default speed limit petition debate")
        self.assertEqual(p["debate_session_date"], "2026-09-10")
        self.assertFalse(petitions.exceeds_debate_threshold(rows[1]))
        self.assertIsNone(rows[1]["debate_item_title"])


class LinkingAndUpsertTests(unittest.TestCase):
    def test_divisions_upsert_totals_and_skips_unresolved(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            divs = moderngov_divisions.parse_divisions_xml(fixture_bytes("moderngov_votingballots.xml"))
            counts, unresolved = upsert_divisions(conn, divs)
            self.assertEqual(counts["divisions"], 1)
            self.assertEqual(counts["member_votes"], 3)
            self.assertEqual(len(unresolved), 1)
            self.assertIn("Unmatched historic item", unresolved[0])

            row = conn.execute("SELECT votes_for, votes_against, votes_abstain, result FROM division_votes").fetchone()
            self.assertEqual(tuple(row), (2, 1, 0, "agreed"))
            total_for = conn.execute("SELECT count(*) FROM member_votes WHERE vote_cast = 'for'").fetchone()[0]
            total_against = conn.execute("SELECT count(*) FROM member_votes WHERE vote_cast = 'against'").fetchone()[0]
            self.assertEqual(total_for, row[0])
            self.assertEqual(total_against, row[1])
        finally:
            conn.close()

    def test_petitions_upsert_links_to_debate_item(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            data = json.loads(fixture_text("petitions_feed.json"))
            rows = petitions.parse_petitions_page(data)
            counts, unresolved = upsert_petitions(conn, rows)
            self.assertEqual(counts["petitions"], 2)
            self.assertEqual(counts["linked_to_debates"], 1)
            self.assertEqual(unresolved, [])

            linked = conn.execute(
                "SELECT debate_agenda_item_id FROM citizen_petitions WHERE id = 'P-06-1353'"
            ).fetchone()[0]
            self.assertEqual(linked, "item-1")
            origin = conn.execute("SELECT origin_type, origin_ref_id FROM agenda_items WHERE id = 'item-1'").fetchone()
            self.assertEqual(tuple(origin), ("petition", "P-06-1353"))

            unlinked = conn.execute(
                "SELECT debate_agenda_item_id FROM citizen_petitions WHERE id = 'P-06-0999'"
            ).fetchone()[0]
            self.assertIsNone(unlinked)
        finally:
            conn.close()

    def test_resolve_agenda_item_is_none_when_ambiguous_or_absent(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            self.assertIsNone(resolve_agenda_item(conn, "1999-01-01", None))
            self.assertEqual(resolve_agenda_item(conn, "2026-09-10", "20mph"), "item-1")
            self.assertIsNone(resolve_agenda_item(conn, "2026-09-10", "no such fragment"))
        finally:
            conn.close()

    def test_upsert_divisions_is_idempotent(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            divs = moderngov_divisions.parse_divisions_xml(fixture_bytes("moderngov_votingballots.xml"))
            first, _ = upsert_divisions(conn, divs)
            second, _ = upsert_divisions(conn, divs)
            self.assertEqual(first, second)
            self.assertEqual(conn.execute("SELECT count(*) FROM division_votes").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT count(*) FROM member_votes").fetchone()[0], 3)
        finally:
            conn.close()

    def test_zero_synthetic_vote_counts_raises_on_mismatch(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            d = moderngov_divisions.parse_divisions_xml(fixture_bytes("moderngov_votingballots.xml"))[0]
            d.votes_for = 99
            with self.assertRaises(ValueError):
                upsert_divisions(conn, [d])
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
