"""T-05: roll-call divisions from the Record's Votes documents, and optional petitions."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from pipeline.adapters import petitions, plenary_votes
from pipeline.adapters.plenary_votes import Ballot, DivisionRecord
from pipeline.divisions_petitions import resolve_agenda_item, upsert_divisions, upsert_petitions
from pipeline.members import canonical_id, strip_name
from tests.memory_db import memory_db

FIXTURES = Path(__file__).parent / "fixtures"
# The Record's Votes document for the plenary of 14 July 2026 (meeting 16085), verbatim.
VOTES = (FIXTURES / "plenary_16085_votes.xml").read_bytes()


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


def seed_meeting_16085(conn, *, members: bool = True) -> set[str]:
    """The session, its Voting Time item and (optionally) every Member named in the fixture."""
    conn.execute(
        """INSERT INTO plenary_sessions (id, senedd_term, session_date, title_en, title_cy, source_xml_url, xml_sha256)
           VALUES ('plenary-16085', 7, '2026-07-14', 'Plenary', 'Cyfarfod Llawn', 'https://record.senedd.wales/x', ?)""",
        ("0" * 64,),
    )
    conn.execute(
        """INSERT INTO agenda_items (id, session_id, item_order, item_type, title_en, title_cy, policy_domain_id)
           VALUES ('item-16085-260714-11', 'plenary-16085', 10, 'debate', '11. Voting Time', '11. Cyfnod Pleidleisio', 'devolution')""",
    )
    known: set[str] = set()
    if members:
        names = {b.member_name for d in plenary_votes.parse_votes(VOTES) for b in d.ballots}
        for raw in sorted(names):
            name, _ = strip_name(raw)
            mid = canonical_id(name.replace(".", " "))
            conn.execute(
                """INSERT INTO members (id, constituency_name_en, constituency_name_cy, canonical_name,
                       official_profile_url, current_status)
                   VALUES (?, 'x', 'x', ?, 'https://senedd.wales/people/x/', 'active')""",
                (mid, name),
            )
            known.add(mid)
    return known


class VotesAdapterTests(unittest.TestCase):
    def test_parses_one_division_per_vote_with_publisher_totals(self):
        divisions = plenary_votes.parse_votes(VOTES)
        self.assertEqual(len(divisions), 2)
        d = divisions[0]
        self.assertEqual((d.meeting_id, d.session_date), (16085, "2026-07-14"))
        self.assertEqual(d.id, "division-16085-767986")
        self.assertEqual(d.agenda_item_id, "item-16085-260714-11")
        self.assertEqual((d.votes_for, d.votes_against, d.votes_abstain), (86, 7, 0))
        self.assertEqual(d.result, "agreed")
        self.assertEqual(len(d.ballots), 96)
        self.assertEqual(plenary_votes.tally(d), (86, 7, 0))
        self.assertTrue(d.motion_text_en and d.motion_text_cy)

    def test_result_wording_is_never_guessed(self):
        self.assertEqual(plenary_votes.result_of("Motion as amended has been agreed"), "agreed")
        self.assertEqual(plenary_votes.result_of("Amendment has been rejected"), "negatived")
        with self.assertRaises(ValueError):
            plenary_votes.result_of("Vote deferred")

    def test_casting_vote_row_is_kept_apart_from_member_ballots(self):
        # Two rows copied verbatim from the Votes document of 16 September 2026 (meeting 16261).
        body = b"""<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<dataroot generated="2026-09-18T15:21:25">
<XML_Plenary_Vote><Meeting_ID>16261</Meeting_ID><Assembly>7</Assembly><MeetingDate>2026-09-16T13:30:01</MeetingDate>
<Contribution_ID>769753</Contribution_ID><Contribution_Order_ID>0</Contribution_Order_ID><ID>10240621</ID>
<Vote_Name>16261_?</Vote_Name><Vote_Name_English>Item 6. Reform UK Debate - Cwm Taf Morgannwg University Health Board health visiting service. Amendment 1.</Vote_Name_English>
<Vote_Name_Welsh>Eitem 6.</Vote_Name_Welsh><VotesTotalFor>42</VotesTotalFor><VotesTotalAgainst>42</VotesTotalAgainst><VotesTotalAbstain>0</VotesTotalAbstain>
<Vote_Result_Welsh>Gwrthodwyd y gwelliant</Vote_Result_Welsh><Vote_Result_English>Amendment has been rejected</Vote_Result_English><Meeting_type>0</Meeting_type>
<Agenda_Item_ID>260916-6</Agenda_Item_ID><Agenda_item_welsh>7. Cyfnod Pleidleisio</Agenda_item_welsh><Agenda_item_english>7. Voting Time</Agenda_item_english>
<Results_Result>For</Results_Result><Member_Id>171</Member_Id><Member_name_English>Darren Millar</Member_name_English><Member_Sortcode>Millar, Darren</Member_Sortcode></XML_Plenary_Vote>
<XML_Plenary_Vote><Meeting_ID>16261</Meeting_ID><Assembly>7</Assembly><MeetingDate>2026-09-16T13:30:01</MeetingDate>
<Contribution_ID>769753</Contribution_ID><Contribution_Order_ID>0</Contribution_Order_ID><ID>10240717</ID>
<Vote_Name>16261_?</Vote_Name><Vote_Name_English>Item 6. Reform UK Debate - Cwm Taf Morgannwg University Health Board health visiting service. Amendment 1.</Vote_Name_English>
<Vote_Name_Welsh>Eitem 6.</Vote_Name_Welsh><VotesTotalFor>42</VotesTotalFor><VotesTotalAgainst>42</VotesTotalAgainst><VotesTotalAbstain>0</VotesTotalAbstain>
<Vote_Result_Welsh>Gwrthodwyd y gwelliant</Vote_Result_Welsh><Vote_Result_English>Amendment has been rejected</Vote_Result_English><Meeting_type>0</Meeting_type>
<Agenda_Item_ID>260916-6</Agenda_Item_ID><Agenda_item_welsh>7. Cyfnod Pleidleisio</Agenda_item_welsh><Agenda_item_english>7. Voting Time</Agenda_item_english>
<Results_Result>Against</Results_Result><Member_Id>0</Member_Id><Member_name_English>Casting Vote</Member_name_English><Member_Sortcode>Casting Vote</Member_Sortcode></XML_Plenary_Vote>
</dataroot>"""
        d = plenary_votes.parse_votes(body)[0]
        self.assertEqual(d.casting_vote, "against")
        self.assertEqual([b.member_name for b in d.ballots], ["Darren Millar"])
        self.assertEqual(d.result, "negatived")

    def test_empty_votes_document_is_no_divisions(self):
        self.assertEqual(plenary_votes.parse_votes(b'<?xml version="1.0"?><dataroot generated="2026-09-20T18:00:03" />'), [])

    def test_bronze_path_sits_beside_the_transcript(self):
        path = plenary_votes.bronze_votes_path("2026-07-14", 16085)
        self.assertEqual(path.name, "2026-07-14-16085-votes.xml")
        self.assertEqual(path.parent.name, "2026")


class PetitionsAdapterTests(unittest.TestCase):
    def test_parse_petitions_page(self):
        data = json.loads(fixture_text("petitions_feed.json"))
        rows = petitions.parse_petitions_page(data)
        self.assertEqual(len(rows), 2)
        big = [p for p in rows if petitions.exceeds_debate_threshold(p)]
        self.assertEqual([p["id"] for p in big], ["P-06-1353"])


class LinkingAndUpsertTests(unittest.TestCase):
    def test_divisions_upsert_writes_every_ballot_and_totals_match(self):
        conn = memory_db()
        try:
            known = seed_meeting_16085(conn)
            counts, unresolved, unmatched = upsert_divisions(conn, plenary_votes.parse_votes(VOTES), known)
            self.assertEqual(counts, {"divisions": 2, "member_votes": 192})
            self.assertEqual((unresolved, unmatched), ([], []))
            for row in conn.execute("SELECT id, votes_for, votes_against, votes_abstain FROM division_votes"):
                got = {r[0]: r[1] for r in conn.execute(
                    "SELECT vote_cast, count(*) FROM member_votes WHERE division_id = ? GROUP BY vote_cast", (row["id"],))}
                self.assertEqual((got.get("for", 0), got.get("against", 0), got.get("abstain", 0)),
                                 (row["votes_for"], row["votes_against"], row["votes_abstain"]))
        finally:
            conn.close()

    def test_division_on_an_item_not_in_gold_is_skipped_and_reported(self):
        conn = memory_db()
        try:
            seed_session_and_item(conn)
            counts, unresolved, _ = upsert_divisions(conn, plenary_votes.parse_votes(VOTES), set())
            self.assertEqual(counts["divisions"], 0)
            self.assertEqual(len(unresolved), 2)
            self.assertIn("item-16085-260714-11", unresolved[0])
        finally:
            conn.close()

    def test_ballot_for_unknown_member_is_reported_not_written(self):
        conn = memory_db()
        try:
            known = seed_meeting_16085(conn)
            missing = sorted(known)[0]
            conn.execute("DELETE FROM members WHERE id = ?", (missing,))
            known.discard(missing)
            counts, _, unmatched = upsert_divisions(conn, plenary_votes.parse_votes(VOTES), known)
            self.assertEqual(counts["member_votes"], 190)
            self.assertEqual(len(unmatched), 1)
            self.assertEqual(conn.execute("SELECT count(*) FROM member_votes WHERE member_id = ?", (missing,)).fetchone()[0], 0)
        finally:
            conn.close()

    def test_upsert_divisions_is_idempotent_and_replaces_stale_rows(self):
        conn = memory_db()
        try:
            known = seed_meeting_16085(conn)
            divisions = plenary_votes.parse_votes(VOTES)
            first = upsert_divisions(conn, divisions, known, replace_meetings={16085})
            second = upsert_divisions(conn, divisions, known, replace_meetings={16085})
            self.assertEqual(first, second)
            self.assertEqual(conn.execute("SELECT count(*) FROM division_votes").fetchone()[0], 2)
            counts, _, _ = upsert_divisions(conn, divisions[:1], known, replace_meetings={16085})
            self.assertEqual(counts["divisions"], 1)
            self.assertEqual(conn.execute("SELECT count(*) FROM division_votes").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT count(*) FROM member_votes").fetchone()[0], 96)
        finally:
            conn.close()

    def test_zero_synthetic_vote_counts_raises_on_mismatch(self):
        conn = memory_db()
        try:
            known = seed_meeting_16085(conn)
            d = plenary_votes.parse_votes(VOTES)[0]
            d.votes_for = 99
            with self.assertRaises(ValueError):
                upsert_divisions(conn, [d], known)
            synthetic = DivisionRecord(16085, "2026-07-14", "x", "260714-11", "11. Voting Time", "m", "m", 1, 0, 0,
                                       "Motion has been agreed", "agreed", [Ballot("1", "Nobody", "against")])
            with self.assertRaises(ValueError):
                upsert_divisions(conn, [synthetic], known)
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
            linked = conn.execute("SELECT debate_agenda_item_id FROM citizen_petitions WHERE id = 'P-06-1353'").fetchone()[0]
            self.assertEqual(linked, "item-1")
            origin = conn.execute("SELECT origin_type, origin_ref_id FROM agenda_items WHERE id = 'item-1'").fetchone()
            self.assertEqual(tuple(origin), ("petition", "P-06-1353"))
            unlinked = conn.execute("SELECT debate_agenda_item_id FROM citizen_petitions WHERE id = 'P-06-0999'").fetchone()[0]
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


if __name__ == "__main__":
    unittest.main()
