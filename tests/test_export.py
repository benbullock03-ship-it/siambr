"""T-14: Gold to Static export. Deterministic, verbatim, derived fields labelled."""

from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

from pipeline import run_checks
from pipeline.export import export_connection, is_timed, rows, round3, seconds_by_contribution
from pipeline.plenary import known_member_ids, normalise, write_session
from tests.memory_db import memory_db
from tests.test_plenary_ingestion import MODERN, SOURCE, insert_speakers


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        write_session(self.conn, normalise(MODERN, known_member_ids(self.conn), SOURCE))
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "data"
        export_connection(self.conn, self.out)

    def tearDown(self):
        self.tmp.cleanup()
        self.conn.close()

    def test_contract_files_exist(self):
        for rel in ("index.json", "sittings/index.json", "sittings/2026-07-15.json", "members/index.json", "terms/7.json"):
            self.assertTrue((self.out / rel).exists(), rel)
        member_files = list((self.out / "members").glob("ms-*.json"))
        self.assertEqual(len(member_files), self.conn.execute("SELECT count(*) FROM members").fetchone()[0])

    def test_export_is_deterministic(self):
        first = {p.relative_to(self.out): p.read_bytes() for p in self.out.rglob("*.json")}
        export_connection(self.conn, self.out)
        second = {p.relative_to(self.out): p.read_bytes() for p in self.out.rglob("*.json")}
        self.assertEqual(first, second)
        for text in (p.read_text(encoding="utf-8") for p in self.out.rglob("*.json")):
            self.assertTrue(text.endswith("}\n") or text.endswith("]\n"))
            self.assertNotIn("\r", text)

    def test_sitting_carries_clock_fields_and_verbatim_text(self):
        sitting = read(self.out / "sittings" / "2026-07-15.json")
        self.assertEqual(sitting["meeting_start_time"], "13:30:01")
        self.assertEqual(sitting["record_published_at"], "2026-07-18T06:13:23")
        self.assertEqual(sitting["source_xml_url"], SOURCE)
        self.assertEqual(sitting["clip_url"], "http://www.senedd.tv/en/16086")
        gold = {r["id"]: r for r in self.conn.execute("SELECT * FROM debate_contributions")}
        self.assertEqual(len(sitting["contributions"]), len(gold))
        for c in sitting["contributions"]:
            self.assertEqual(c["text_original"], gold[c["id"]]["verbatim_text_original"])
            self.assertEqual(c["text_english"], gold[c["id"]]["verbatim_text_english"])
            self.assertEqual(c["t_start"], gold[c["id"]]["video_timestamp_start"])
        self.assertEqual(sitting["provenance"]["t_end_derived"], "PROVENANCE_DERIVED")
        self.assertTrue(all(i["classification_provenance"] == "PROVENANCE_DERIVED" for i in sitting["items"]))
        tabled = {r["id"]: r for r in self.conn.execute("SELECT * FROM tabled_texts")}
        self.assertTrue(tabled)
        self.assertEqual(len(sitting["tabled_texts"]), len(tabled))
        for t in sitting["tabled_texts"]:
            self.assertEqual(t["text_original"], tabled[t["id"]]["text_original"])
            self.assertEqual(t["text_english"], tabled[t["id"]]["text_english"])
            self.assertEqual(t["kind"], tabled[t["id"]]["kind"])

    def test_t_end_derived_is_the_next_timed_start(self):
        sitting = read(self.out / "sittings" / "2026-07-15.json")
        timed = sorted({c["t_start"] for c in sitting["contributions"] if c["t_start"] is not None})
        for c in sitting["contributions"]:
            if c["t_start"] is None:
                self.assertIsNone(c["t_end_derived"])
                continue
            later = [t for t in timed if t > c["t_start"]]
            self.assertEqual(c["t_end_derived"], later[0] if later else None, c["id"])
            if c["t_end_derived"] is not None:
                self.assertGreaterEqual(c["t_end_derived"], c["t_start"])
        for a, b in zip(sitting["contributions"], sitting["contributions"][1:]):
            if a["t_start"] is not None and b["t_start"] is not None:
                self.assertLessEqual(a["t_start"], b["t_start"])

    def test_tv_url_carries_the_published_offset(self):
        sitting = read(self.out / "sittings" / "2026-07-15.json")
        timed = next(c for c in sitting["contributions"] if c["t_start"] is not None)
        self.assertEqual(timed["tv_url"], f"http://www.senedd.tv/en/16086?startPos={timed['t_start']}")
        for c in (c for c in sitting["contributions"] if c["t_start"] is None):
            self.assertEqual(c["tv_url"], "http://www.senedd.tv/en/16086")

    def test_division_carries_the_votes_document_it_came_from(self):
        item_id = self.conn.execute("SELECT id FROM agenda_items ORDER BY item_order LIMIT 1").fetchone()["id"]
        member_id = self.conn.execute("SELECT id FROM members LIMIT 1").fetchone()["id"]
        self.conn.execute(
            """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result)
               VALUES ('division-16086-1', ?, 'Motion NDM1', 1, 0, 0, 'agreed')""", (item_id,))
        self.conn.execute("INSERT INTO member_votes (division_id, member_id, vote_cast) VALUES ('division-16086-1', ?, 'for')", (member_id,))
        export_connection(self.conn, self.out)
        division = read(self.out / "sittings" / "2026-07-15.json")["divisions"][0]
        self.assertEqual(division["source_url"], "https://record.senedd.wales/XMLExport/Download?meetingID=16086&xmlDownloadType=Votes")
        self.assertEqual(division["votes"], {member_id: "for"})

    def test_member_ballot_points_at_the_debate_its_motion_text_names(self):
        items = self.conn.execute(
            "SELECT id, item_order, title_en FROM agenda_items ORDER BY item_order").fetchall()
        voting_time = items[-1]["id"]
        debate = items[0]
        member_id = self.conn.execute("SELECT id FROM members LIMIT 1").fetchone()["id"]
        number = int(m.group(1)) if (m := re.match(r"^\s*(\d+)\.", debate["title_en"] or "")) else debate["item_order"] + 1
        self.conn.execute(
            """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result)
               VALUES ('division-16086-1', ?, ?, 1, 0, 0, 'agreed')""",
            (voting_time, f"Item {number}. Some debate. Motion without amendment"))
        self.conn.execute(
            """INSERT INTO division_votes (id, agenda_item_id, motion_text, votes_for, votes_against, votes_abstain, result)
               VALUES ('division-16086-2', ?, 'Item 999. No such debate. Motion', 0, 1, 0, 'negatived')""", (voting_time,))
        for div, cast in (("division-16086-1", "for"), ("division-16086-2", "against")):
            self.conn.execute("INSERT INTO member_votes (division_id, member_id, vote_cast) VALUES (?, ?, ?)", (div, member_id, cast))
        export_connection(self.conn, self.out)
        ballots = {b["division_id"]: b for b in read(self.out / "members" / f"{member_id}.json")["ballots"]}
        self.assertEqual(ballots["division-16086-1"]["debate_item_id"], debate["id"])
        self.assertEqual(ballots["division-16086-1"]["debate_item_title_en"], debate["title_en"])
        self.assertIsNone(ballots["division-16086-2"]["debate_item_id"])
        self.assertIsNone(ballots["division-16086-2"]["debate_item_title_en"])
        self.assertEqual(ballots["division-16086-2"]["item_id"], voting_time)
        first = {p.relative_to(self.out): p.read_bytes() for p in self.out.rglob("*.json")}
        export_connection(self.conn, self.out)
        self.assertEqual(first, {p.relative_to(self.out): p.read_bytes() for p in self.out.rglob("*.json")})

    def test_sittings_index_is_newest_first_with_item_speakers(self):
        index = read(self.out / "sittings" / "index.json")
        self.assertEqual([s["date"] for s in index], sorted((s["date"] for s in index), reverse=True))
        first = index[0]
        self.assertEqual(first["item_count"], len(first["items"]))
        self.assertGreater(first["contribution_count"], 0)
        self.assertTrue(any(i["speaker_ids"] for i in first["items"]))

    def test_member_file_groups_contributions_by_date_newest_first(self):
        sitting = read(self.out / "sittings" / "2026-07-15.json")
        speaker = sitting["contributions"][0]["member_id"]
        member = read(self.out / "members" / f"{speaker}.json")
        self.assertEqual(member["id"], speaker)
        for key in ("tenures", "roles", "ballots"):
            self.assertIn(key, member)
        dates = [g["date"] for g in member["contributions_by_date"]]
        self.assertEqual(dates, sorted(dates, reverse=True))
        mine = [c for c in sitting["contributions"] if c["member_id"] == speaker]
        exported = [c for g in member["contributions_by_date"] for c in g["contributions"]]
        self.assertEqual({c["id"] for c in exported}, {c["id"] for c in mine})
        self.assertEqual(member["contribution_count"], len(mine))
        for c in exported:
            self.assertEqual(set(c), {"id", "item_id", "item_title_en", "t_start", "tv_url", "lang", "text_original", "text_english"})

    def test_stale_files_are_pruned_and_unchanged_files_untouched(self):
        stale = self.out / "sittings" / "1999-05-12.json"
        stale.write_text("{}", encoding="utf-8")
        index = self.out / "index.json"
        before = index.stat().st_mtime_ns
        counts = export_connection(self.conn, self.out)
        self.assertEqual(counts["pruned"], 1)
        self.assertFalse(stale.exists())
        self.assertEqual(index.stat().st_mtime_ns, before)

    def test_meeting_id_is_read_from_the_session_id(self):
        sitting = read(self.out / "sittings" / "2026-07-15.json")
        self.assertEqual(sitting["meeting_id"], 16086)
        self.assertEqual(sitting["id"], "plenary-16086")

    def test_index_generated_at_is_senedds_stamp_not_the_clock(self):
        index = read(self.out / "index.json")
        self.assertEqual(index["generated_at"], "2026-07-18T06:13:23")
        self.assertEqual(index["latest_sitting"], "2026-07-15")
        self.assertEqual(index["current_term"], 7)
        self.assertEqual(len(index["policy_domains"]), 6)

    def test_run_checks_audits_the_export_against_gold_and_bronze(self):
        with tempfile.TemporaryDirectory() as bronze:
            path = Path(bronze) / "2026" / "2026-07-15-16086.xml"
            path.parent.mkdir()
            path.write_bytes(MODERN)
            check = run_checks.check_static_verbatim(self.conn, Path(bronze), self.out, sample_size=10)
            self.assertTrue(check.ok, check.failures)
            sitting_path = self.out / "sittings" / "2026-07-15.json"
            sitting = read(sitting_path)
            sitting["contributions"][0]["text_original"] += " (edited)"
            sitting_path.write_text(json.dumps(sitting), encoding="utf-8")
            check = run_checks.check_static_verbatim(self.conn, Path(bronze), self.out, sample_size=len(sitting["contributions"]))
            self.assertFalse(check.ok)
            self.assertIn("differs from Gold", check.failures[0])


    def test_search_index_lists_every_contribution_verbatim(self):
        index = read(self.out / "search" / "index.json")
        self.assertEqual(index["engine"], "minisearch")
        docs = index["documents"]
        count = self.conn.execute("SELECT count(*) FROM debate_contributions").fetchone()[0]
        self.assertEqual(len(docs), count)
        for d in docs:
            row = self.conn.execute(
                "SELECT verbatim_text_english, verbatim_text_original, spoken_language, member_id FROM debate_contributions WHERE id = ?",
                (d["id"],),
            ).fetchone()
            self.assertEqual(d["text"], row[0])
            self.assertEqual(d["text_cy"], row[1] if row[2] == "cy" else "")
            self.assertEqual(d["member_id"], row[3])
        self.assertEqual([d["date"] for d in docs], sorted((d["date"] for d in docs), reverse=True))

    def test_member_contributions_carry_the_senedd_tv_link(self):
        member = next(p for p in (self.out / "members").glob("ms-*.json") if read(p)["contribution_count"])
        speech = read(member)["contributions_by_date"][0]["contributions"][0]
        self.assertIn("tv_url", speech)
        if speech["t_start"] is not None and speech["tv_url"]:
            self.assertTrue(speech["tv_url"].endswith(f"?startPos={speech['t_start']}"))


class StatsExportTests(unittest.TestCase):
    """T-21: derived stats files, badged and reconciling to the sitting they came from."""

    def setUp(self):
        self.conn = memory_db()
        insert_speakers(self.conn, MODERN)
        write_session(self.conn, normalise(MODERN, known_member_ids(self.conn), SOURCE))
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "data"
        export_connection(self.conn, self.out)
        self.stats = read(self.out / "stats" / "sittings" / "2026-07-15.json")
        self.sitting = read(self.out / "sittings" / "2026-07-15.json")

    def tearDown(self):
        self.tmp.cleanup()
        self.conn.close()

    def test_stats_files_are_badged_derived_and_state_their_method(self):
        self.assertEqual(self.stats["provenance"], "PROVENANCE_DERIVED")
        self.assertIn("Untimed contributions carry no time.", self.stats["method"])
        term = read(self.out / "stats" / "terms" / "7.json")
        self.assertEqual(term["provenance"], "PROVENANCE_DERIVED")
        self.assertEqual(term["party_by_domain"]["domain_provenance"], "PROVENANCE_DERIVED")
        self.assertEqual(term["method"], self.stats["method"])

    def test_speaking_time_is_the_gap_to_the_next_timed_start(self):
        contributions = rows(self.conn, "SELECT * FROM debate_contributions")
        seconds = seconds_by_contribution(contributions)
        timed = sorted(c["video_timestamp_start"] for c in contributions if is_timed(c))
        self.assertEqual(round3(sum(seconds.values())), round3(timed[-1] - timed[0]))
        for c in contributions:
            self.assertEqual(is_timed(c), c["id"] in seconds)

    def test_sitting_totals_and_breakdowns_reconcile(self):
        totals = self.stats["totals"]
        self.assertEqual(totals["contributions"], len(self.sitting["contributions"]))
        self.assertEqual(totals["timed_contributions"] + totals["untimed_contributions"], totals["contributions"])
        self.assertEqual(totals["welsh_contributions"], sum(1 for c in self.sitting["contributions"] if c["lang"] == "cy"))
        self.assertEqual(totals["divisions"], len(self.sitting["divisions"]))
        for key in ("by_member", "by_party", "by_item"):
            self.assertEqual(sum(r["contributions"] for r in self.stats[key]), totals["contributions"], key)
            self.assertEqual(round3(sum(r["seconds"] for r in self.stats[key])), totals["speaking_seconds"], key)
        self.assertEqual([r["item_id"] for r in self.stats["by_item"]], [i["id"] for i in self.sitting["items"]])
        for r in self.stats["by_member"]:
            mine = [c for c in self.sitting["contributions"] if c["member_id"] == r["member_id"]]
            self.assertEqual(r["contributions"], len(mine))
            self.assertEqual(r["party_id"], self.sitting["speakers"][r["member_id"]]["party_id"])

    def test_untimed_contributions_are_reported_not_hidden(self):
        untimed = [c for c in self.sitting["contributions"] if c["t_start"] is None or c["t_start"] < 0]
        self.assertEqual(self.stats["totals"]["untimed_contributions"], len(untimed))
        self.assertEqual(sum(r["untimed_contributions"] for r in self.stats["by_member"]), len(untimed))

    def test_term_stats_aggregate_the_sittings_and_cross_party_by_domain(self):
        term = read(self.out / "stats" / "terms" / "7.json")
        self.assertEqual(term["sitting_count"], 1)
        self.assertEqual(term["totals"], self.stats["totals"])
        self.assertEqual([s["date"] for s in term["by_sitting"]], ["2026-07-15"])
        matrix = term["party_by_domain"]
        self.assertEqual(sum(c["contributions"] for c in matrix["cells"]), term["totals"]["contributions"])
        self.assertEqual(sorted({c["party_id"] for c in matrix["cells"]}, key=lambda p: p or ""), sorted(matrix["parties"], key=lambda p: p or ""))
        self.assertTrue(set(matrix["domains"]) >= {c["domain_id"] for c in matrix["cells"]})


if __name__ == "__main__":
    unittest.main()
