---
id: T-13
title: "Sitting Clock Fields, Record Currency and the Seventh Senedd Backfill"
kind: pipeline
status: pending
depends: [T-12, T-04]
---

# T-13 — Sitting Clock Fields, Record Currency and the Seventh Senedd Backfill

**What to build:**  
Make the Gold store carry everything the sitting clock needs, and fill it with every Seventh Senedd plenary sitting. Spec 2.0.0 sections 4.2, 8.1, 8.3.

### Acceptance Criteria
- [ ] Migration `006_sitting_clock.sql`: `plenary_sessions.record_published_at TEXT` (the transcript's `dataroot@generated`, ISO 8601) and `plenary_sessions.meeting_start_time TEXT` (`HH:MM:SS` from `<MeetingDate>`). `sync_runs` table (`id`, `started_at`, `finished_at`, `sessions_changed`, `error`).
- [ ] `pipeline/plenary.py` writes both fields. `video_timestamp_start` is Senedd's `startPos` verbatim when it is a non-negative integer; a negative or missing `startPos` stores NULL (untimed). `video_timestamp_end` is never written (the export derives it).
- [ ] Session rewrite on hash change also updates `record_published_at`; a hash-unchanged run leaves the row untouched.
- [ ] `pipeline.ingest_plenary --scan-from <meeting_id> --term 7`: walks meeting IDs downward from the given ID, fetches each, keeps plenary transcripts whose `<Assembly>` is 7 and `<MeetingDate>` is on or after the term start date, stops after 40 consecutive non-plenary or missing IDs. Non-plenary bodies are not written to Bronze.
- [ ] Backfill executed once: every Seventh Senedd plenary sitting from 12 May 2026 to the present is in Bronze and Gold. Count reported in the ticket notes with the ID range scanned.
- [ ] `pipeline.run_checks` gains: every session has `meeting_start_time`; every timed contribution's `startPos` in Gold equals the one in the Bronze XML byte-for-byte; no contribution has `video_timestamp_end`.
- [ ] Unit tests on a fixture XML: negative `startPos` becomes NULL; `record_published_at` parsed; `meeting_start_time` parsed.

**Notes:**
- Senedd publishes no explicit draft or final marker in the XML. `record_published_at` is the honest signal; the UI shows it and never claims "final".
- The 1999 to 2016 schema handling in T-04 stays on T-04 and is not in scope here.
