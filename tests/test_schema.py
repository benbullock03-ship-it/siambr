import sqlite3
import unittest

from pipeline.apply_migrations import apply_migrations, applied_versions
from pipeline.seed import POLICY_DOMAINS, seed_baseline
from tests.memory_db import memory_db

EXPECTED_TABLES = {
    "schema_migrations", "parliamentary_terms", "policy_domains",
    "members", "member_tenures", "ministerial_roles",
    "plenary_sessions", "agenda_items", "debate_contributions",
    "division_votes", "member_votes", "citizen_petitions",
}
WITHDRAWN_TABLES = {"citizen_trails", "citizen_trail_stops", "spatial_plinths"}

SHA = "0" * 64


def insert_fixture(conn):
    conn.execute(
        "INSERT INTO members VALUES ('ms-test', 'W09000008', 'Cardiff West', 'Gorllewin Caerdydd', "
        "'Test Member', NULL, NULL, NULL, 'https://senedd.wales/people/1', 'active')"
    )
    conn.execute(
        "INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy, presiding_officer_id, "
        "source_xml_url, xml_sha256) VALUES ('plenary-2024-05-14', 6, '2024-05-14', 'Plenary', "
        "'Cyfarfod Llawn', 'ms-test', 'https://record.senedd.wales/x.xml', ?)", (SHA,)
    )
    conn.execute(
        "INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy, policy_domain_id) "
        "VALUES ('item-2024-05-14-04', 'plenary-2024-05-14', 4, 'debate', 'T', 'T', 'transport')"
    )
    conn.execute(
        "INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number, spoken_language, "
        "verbatim_text_original, verbatim_text_english) VALUES ('c1', 'item-2024-05-14-04', 'ms-test', 1, 'en', 'x', 'x')"
    )
    conn.execute(
        "INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result) "
        "VALUES ('div-1', 'item-2024-05-14-04', 'motion', 1, 0, 0, 'agreed')"
    )
    conn.execute("INSERT INTO member_votes VALUES ('div-1', 'ms-test', 'for')")


class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.conn = memory_db()

    def tearDown(self):
        self.conn.close()

    def test_pragmas(self):
        self.assertEqual(self.conn.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        self.assertEqual(self.conn.execute("PRAGMA busy_timeout").fetchone()[0], 5000)
        self.assertEqual(self.conn.execute("PRAGMA synchronous").fetchone()[0], 1)

    def test_tables_exist(self):
        rows = self.conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        names = {r[0] for r in rows}
        self.assertTrue(EXPECTED_TABLES <= names, EXPECTED_TABLES - names)
        self.assertFalse(WITHDRAWN_TABLES & names, WITHDRAWN_TABLES & names)

    def test_migrations_idempotent(self):
        first = applied_versions(self.conn)
        self.assertIn("001_initial_schema", first)
        self.assertIn("005_withdraw_corridors", first)
        self.assertEqual(apply_migrations(self.conn), [])
        seed_baseline(self.conn)
        self.assertEqual(applied_versions(self.conn), first)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM policy_domains").fetchone()[0], 6)

    def test_policy_domains_seeded(self):
        rows = self.conn.execute("SELECT id, name_en FROM policy_domains ORDER BY id").fetchall()
        self.assertEqual([tuple(r) for r in rows], sorted((d[0], d[1]) for d in POLICY_DOMAINS))

    def test_terms_seeded(self):
        self.assertEqual(self.conn.execute("SELECT count(*) FROM parliamentary_terms").fetchone()[0], 7)
        self.assertEqual(self.conn.execute("SELECT seat_count FROM parliamentary_terms WHERE term = 7").fetchone()[0], 96)

    def test_foreign_keys_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy, presiding_officer_id, "
                "source_xml_url, xml_sha256) VALUES ('p', 6, '2024-01-01', 't', 't', 'ms-missing', 'u', ?)", (SHA,)
            )
        insert_fixture(self.conn)
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("UPDATE agenda_items SET policy_domain_id = 'nope'")

    def test_cascade_delete_session(self):
        insert_fixture(self.conn)
        self.conn.execute("DELETE FROM plenary_sessions WHERE id = 'plenary-2024-05-14'")
        for table in ("agenda_items", "debate_contributions", "division_votes", "member_votes"):
            self.assertEqual(self.conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0], 0, table)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM members").fetchone()[0], 1)

    def test_member_delete_restricted_by_contribution(self):
        insert_fixture(self.conn)
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("DELETE FROM members WHERE id = 'ms-test'")

    def test_petition_link_set_null_on_item_delete(self):
        insert_fixture(self.conn)
        self.conn.execute(
            "INSERT INTO citizen_petitions (id, title_en, signature_count, status, debate_agenda_item_id, source_url) "
            "VALUES ('P-06-1353', 'x', 10001, 'debated', 'item-2024-05-14-04', 'https://petitions.senedd.wales/p')"
        )
        self.conn.execute("DELETE FROM agenda_items WHERE id = 'item-2024-05-14-04'")
        self.assertIsNone(self.conn.execute("SELECT debate_agenda_item_id FROM citizen_petitions").fetchone()[0])

    def test_check_constraints(self):
        insert_fixture(self.conn)
        bad = [
            "INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result) VALUES ('d2', 'item-2024-05-14-04', 'm', -1, 0, 0, 'agreed')",
            "INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result) VALUES ('d2', 'item-2024-05-14-04', 'm', 0, 0, 0, 'passed')",
            "INSERT INTO member_votes VALUES ('div-1', 'ms-test', 'maybe')",
            "INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number, spoken_language, "
            "verbatim_text_original, verbatim_text_english) VALUES ('c2', 'item-2024-05-14-04', 'ms-test', 2, 'fr', 'x', 'x')",
            "INSERT INTO debate_contributions (id, agenda_item_id, member_id, sequence_number, spoken_language, "
            "verbatim_text_original, verbatim_text_english) VALUES ('c3', 'item-2024-05-14-04', 'ms-test', 3, 'en', '', '')",
            "INSERT INTO policy_domains VALUES ('z', 'x', 'x', 'w', 360)",
            "INSERT INTO parliamentary_terms VALUES (8, 'x', 'x', '2031-01-01', NULL, 96)",
            "UPDATE members SET current_status = 'retired'",
            "UPDATE plenary_sessions SET meeting_start_time = '1330'",
        ]
        for sql in bad:
            with self.assertRaises(sqlite3.IntegrityError, msg=sql):
                self.conn.execute(sql)


if __name__ == "__main__":
    unittest.main()
