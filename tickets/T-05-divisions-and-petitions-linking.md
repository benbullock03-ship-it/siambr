---
id: T-05
title: "Roll-Call Division Votes & Citizen Petitions Cross-Service Linking"
kind: pipeline
status: pending
depends: [T-04]
---

# T-05 — Roll-Call Division Votes & Citizen Petitions Cross-Service Linking

**What to build:**  
Extend the data pipeline to ingest electronic roll-call division voting records from Modern.Gov (`division_votes`, `member_votes`) and citizen petition milestones from `https://petitions.senedd.wales/` (`citizen_petitions`), linking petitions and statutory voting outturns directly to their respective plenary agenda items.

### Acceptance Criteria
- [ ] Ingests division voting records from Modern.Gov XML:
  - Total tallies: `votes_for`, `votes_against`, `votes_abstain`, and motion result (`agreed` / `negatived`).
  - Member-level votes: links each MS directly to their recorded vote (`for`, `against`, `abstain`, `did_not_vote`).
- [ ] Ingests Petitions platform feeds (`https://petitions.senedd.wales/`):
  - Petition title, signature count, closing date, petitioner name, and committee response.
  - Detects petitions exceeding the 10,000 signature threshold for plenary debate.
- [ ] Links citizen petitions to corresponding plenary debate items via `agenda_items.origin_ref_id` (e.g. connecting the 20mph petition debate to Petition P-06-1353).
- [ ] CLI command `python -m pipeline.ingest_divisions_and_petitions`.
- [ ] Unit tests in `tests/test_divisions_and_petitions.py` assert:
  - Total roll-call votes equal the sum of member votes.
  - Linked petitions resolve to real debate agenda items.
  - Zero synthetic vote counts.

### Amendment under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: **divisions first, petitions optional.** Seventh Senedd divisions with member-level votes are required by [T-19](T-19-divisions-on-the-stage.md); petitions ingestion and linking may stay empty and must not block. A division must carry enough to place it on its agenda item (date and item order); the export derives the second it appears on the stage and badges that.
