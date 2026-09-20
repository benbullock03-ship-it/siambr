---
id: T-13
title: "Sitting Clock Fields, Record Currency and the Seventh Senedd Backfill"
kind: pipeline
status: done
depends: [T-12, T-04]
---

# T-13 — Sitting Clock Fields, Record Currency and the Seventh Senedd Backfill

**What to build:**  
Make the Gold store carry everything the sitting clock needs, and fill it with every Seventh Senedd plenary sitting. Spec 2.0.0 sections 4.2, 8.1, 8.3.

### Acceptance Criteria
- [x] Migration `006_sitting_clock.sql`: `plenary_sessions.record_published_at TEXT` (the transcript's `dataroot@generated`, ISO 8601) and `plenary_sessions.meeting_start_time TEXT` (`HH:MM:SS` from `<MeetingDate>`). `sync_runs` table (`id`, `started_at`, `finished_at`, `sessions_changed`, `error`).
- [x] `pipeline/plenary.py` writes both fields. `video_timestamp_start` is Senedd's `startPos` verbatim when it is a non-negative integer; a negative or missing `startPos` stores NULL (untimed). `video_timestamp_end` is never written (the export derives it).
- [x] Session rewrite on hash change also updates `record_published_at`; a hash-unchanged run leaves the row untouched.
- [x] `pipeline.ingest_plenary --scan-from <meeting_id> --term 7`: walks meeting IDs downward from the given ID, fetches each, keeps plenary transcripts whose `<Assembly>` is 7 and `<MeetingDate>` is on or after the term start date, stops after 40 consecutive non-plenary or missing IDs. Non-plenary bodies are not written to Bronze.
- [x] Backfill executed once: every Seventh Senedd plenary sitting from 12 May 2026 to the present is in Bronze and Gold. Count reported in the ticket notes with the ID range scanned.
- [x] `pipeline.run_checks` gains: every session has `meeting_start_time`; every timed contribution's `startPos` in Gold equals the one in the Bronze XML byte-for-byte; no contribution has `video_timestamp_end`.
- [x] Unit tests on a fixture XML: negative `startPos` becomes NULL; `record_published_at` parsed; `meeting_start_time` parsed.

**Notes:**
- Senedd publishes no explicit draft or final marker in the XML. `record_published_at` is the honest signal; the UI shows it and never claims "final".
- The 1999 to 2016 schema handling in T-04 stays on T-04 and is not in scope here.

### Notes (done 2026-09-20)
- Migration `006_sitting_clock.sql` adds the two columns (with a `HH:MM:SS` GLOB check) and `sync_runs`. Applied to `data/siambr.db`.
- Adapter: `record_published_at()`, `meeting_start_time()`, `assembly_of()`, `is_plenary()` (row element name `XML_Plenary…` versus `XML_LegislationCommittee…`; committee transcripts share the schema and download from the same URL) and `raw_start_pos()` (the published query value, for the byte-for-byte check). `fetch_transcript` raises `NotPlenary` and writes nothing to Bronze for a committee.
- `--scan-from N --term T [--gap 40]`: stops at the first plenary whose Assembly or date precedes the term, or after `--gap` IDs without a plenary transcript. The Senedd's summer recess is 173 IDs wide (16087 to 16259 carry no plenary), so the default gap of 40 cannot cross it; the backfill ran with `--gap 200`.
- **Backfill**: `python -m pipeline.ingest_plenary --scan-from 16261 --term 7 --gap 200 --no-cache`. Scanned 16261 down to 15832 (stopped by the gap below 16033; no Sixth Senedd plenary sits within 200 IDs). Found **17 plenary sittings**, 12 May to 16 September 2026, meeting IDs 16033, 16053, 16060, 16072 to 16078, 16082 to 16086, 16260, 16261. Gold: 17 sessions, 125 agenda items, 4,044 contributions of which 219 untimed (negative `startPos`). `record_published_at` ranges 2026-05-13 to 2026-09-19 and moves independently of the sitting date (16072 was republished on 14 September).
- `--rewrite` was added so the three sessions ingested before 006 could take the new fields without a checksum change; a normal run leaves a hash-unchanged row untouched (tested).
- `pipeline/run_checks.py` (new): referential integrity, both clock fields present, no `video_timestamp_end` in Gold, every timed `startPos` in Gold equals the Bronze query string byte-for-byte (and Bronze checksum equals Gold). All pass on the backfilled store.
- **Skipped items (unmatched speakers, skipped whole, never abridged)**: 16033 item 3 "Nomination of the First Minister" (Record spells four Members "Christina Emsley AS", "Gaz Thomas AS", "Keira Marshal AS", "Lyn Akerman AS"; the registry has Cristiana Emsley, Gareth Thomas, Kiera Marshall and no Akerman at all); 16060 item 2 and 16078 item 2 (Elfyn Llwyd, Counsel General, not a Member; `debate_contributions.member_id` cannot hold him); 16075 item 1 (the anonymous "Aelod o'r Senedd / Member of the Senedd", Modern.Gov ID 7). The transcript rows carry Modern.Gov `Member_Id` (12166 Marshall, 12148 Thomas) which is stable across spellings; matching on it needs a `members.moderngov_id` column and belongs to the T-04/T-03 reconciliation, not this ticket. Deferred and listed in the run summary.
- Divisions were not relinked (T-05 is later in the run); `ingest_divisions_and_petitions` must run after T-05 lands.
- Gates: `python -m unittest` 98 passed; `python -m pipeline.run_checks` 5/5 ok; `npx vitest run` 64 passed; `npx playwright test` 10 passed.
