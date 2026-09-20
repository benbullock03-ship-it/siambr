---
id: T-05
title: "Roll-Call Division Votes & Citizen Petitions Cross-Service Linking"
kind: pipeline
status: done
depends: [T-04]
---

# T-05 — Roll-Call Division Votes & Citizen Petitions Cross-Service Linking

**What to build:**  
Extend the data pipeline to ingest electronic roll-call division voting records from Modern.Gov (`division_votes`, `member_votes`) and citizen petition milestones from `https://petitions.senedd.wales/` (`citizen_petitions`), linking petitions and statutory voting outturns directly to their respective plenary agenda items.

### Acceptance Criteria
- [x] Ingests division voting records (from the Record of Proceedings XMLExport `Votes` document, not Modern.Gov; see Notes):
  - Total tallies: `votes_for`, `votes_against`, `votes_abstain`, and motion result (`agreed` / `negatived`).
  - Member-level votes: links each MS directly to their recorded vote (`for`, `against`, `abstain`, `did_not_vote`).
- [ ] Ingests Petitions platform feeds *(optional under the 2.0.0 amendment; adapter kept behind `--petitions`, not run)* (`https://petitions.senedd.wales/`):
  - Petition title, signature count, closing date, petitioner name, and committee response.
  - Detects petitions exceeding the 10,000 signature threshold for plenary debate.
- [ ] Links citizen petitions *(optional under the 2.0.0 amendment; code and test kept, no data)* to corresponding plenary debate items via `agenda_items.origin_ref_id` (e.g. connecting the 20mph petition debate to Petition P-06-1353).
- [x] CLI command `python -m pipeline.ingest_divisions_and_petitions`.
- [x] Unit tests in `tests/test_divisions_and_petitions.py` assert:
  - Total roll-call votes equal the sum of member votes.
  - Linked petitions resolve to real debate agenda items.
  - Zero synthetic vote counts.

### Amendment under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: **divisions first, petitions optional.** Seventh Senedd divisions with member-level votes are required by [T-19](T-19-divisions-on-the-stage.md); petitions ingestion and linking may stay empty and must not block. A division must carry enough to place it on its agenda item (date and item order); the export derives the second it appears on the stage and badges that.

### Notes (done 2026-09-20, divisions first per the amendment)
- **Source changed.** `business.senedd.wales/mgWebService.asmx` answers 403 "Service unavailable" to every operation from any client (verified on the day, with the pipeline's user agent too), and `GetVotingBallots` was a guessed operation with no evidence it exists; the Bronze mirror held a 62-byte copy of that outage page. Both the adapter (`pipeline/adapters/moderngov_divisions.py`), its synthetic fixture and the cached outage page are deleted. The Record's own XMLExport, the transcript host, offers `xmlDownloadType=Votes`: one `XML_Plenary_Vote` row per Member per vote, with the publisher's totals, result wording, the agenda item the vote was taken under and the Modern.Gov Member id and name. New adapter `pipeline/adapters/plenary_votes.py`; Bronze mirror beside the transcript as `data/bronze/plenary/{year}/{date}-{meeting}-votes.xml` (17 files, nine with divisions, eight empty `<dataroot/>` documents mirrored as such).
- Keys are the publisher's: a division is `division-{meeting}-{Contribution_ID}` and sits on `item-{meeting}-{Agenda_Item_ID}`, which is the item the Record places the vote under ("Voting Time", not the item debated). Result is read from `Vote_Result_English` wording (six wordings seen, all "agreed"/"rejected" forms); unknown wording raises rather than guesses. `motion_text` is `Vote_Name_English` verbatim (the Welsh `Vote_Name_Welsh` is parsed but the schema has one column; not shipped).
- Member ballots are matched by name through the same `member_id_for` as the transcripts. All 4,608 ballots across 48 divisions matched a registry Member; a ballot that does not match would be reported and not written, never invented. Re-ingesting a meeting deletes its divisions no longer in the current document.
- **Casting vote.** Three tied divisions on 16 September 2026 (42–42) carry a 97th row `Member_name_English = "Casting Vote"`, `Member_Id 0`, cast against, which the publisher's totals exclude. Migration `007_casting_vote.sql` adds `division_votes.casting_vote` (`for`/`against`, nullable); the row is stored there, never as a `member_votes` row, and the export carries it as `casting_vote`. The tally check (ballots for/against/abstain equal the stated totals) is enforced at ingest and again in `run_checks` (new gate: "division tallies equal their member votes and motion text equals Bronze").
- Gold: 48 divisions, 4,608 member votes (2,142 for, 1,921 against, 138 abstain, 407 did not vote), 3 casting votes, across nine sittings: 10, 17 and 24 June; 1, 7, 8, 14 and 15 July; 16 September 2026 (24 June and 16 September carry ten each). Exported into `sittings/{date}.json` `divisions[]` and Member `ballots` (Darren Millar: 48).
- `pipeline.sync` relinks divisions for changed meetings from their Votes document (cache bypassed); the sync test mocks the fetch with an empty document. CLI: `python -m pipeline.ingest_divisions_and_petitions [--meeting-id N] [--no-cache] [--dry-run] [--petitions]`; petitions only with the flag.
- Frontend: `Division.casting_vote` added to `types.ts`; T-19 renders it.
- Gates: `python -m unittest` 119 passed; `python -m pipeline.run_checks` 7/7; export deterministic (rerun after ingest, no further change); `npx vitest run` 122; `svelte-check` 0 errors; `npx playwright test` 23 passed; no `/api/`.

