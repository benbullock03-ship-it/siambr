---
id: T-29
title: "Divisions Index and Search: Find a Vote Without Knowing the Date"
kind: pipeline + frontend
status: done
depends: [T-19, T-20, T-25]
---

# T-29 — Divisions Index and Search

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` finding F13. There is no list or search of divisions across sittings. A journalist asking "how did the Senedd vote on X" must know the date, open the Register, find Voting Time and open the dossier. The Stage and the Member page show votes well once reached; this ticket makes them reachable.

---

### Step 1 — Export a divisions index

- [x] `pipeline/export.py` writes `static/data/divisions/index.json`: one row per division across all sittings, newest first: `id`, `date`, `sitting_date`, `item_id`, `debate_item_id`, `debate_item_title_en`, `target` (from `readMotion` semantics, computed in Python the same way: motion / amendment N / motion as amended), `tabled_by`, `votes_for`, `votes_against`, `votes_abstain`, `result`, `motion_text` (verbatim, for search only). Deterministic ordering.
- [x] The search index (`search/index.json`) gains a document type `division` with `title` = debate title, `text` = motion text, `date`, `item_id`, `division_id`. `SearchDocument` type updated; MiniSearch fields updated.
- [x] `tests/test_export.py` covers one division with a debate match and one without.

### Step 2 — `/divisions` route

- [x] New prerendered route `/divisions`: a table grouped by sitting day, each row the debate title, target, For / Against / Abstain counts and result chip (reusing `VoteChip` tones and `VoteLegend` at the head). Filters: term, result, text filter on debate title, applied live (no Apply button).
- [x] Each row links to `/sitting/{date}?t={division t}` ("Watch it in the chamber") and `/register?item={item_id}` ("Read the debate"), same wording as `BallotHistory`.
- [x] `PROVENANCE_DERIVED` badge on the grouping; counts are the publisher's numbers, verbatim.
- [x] `GlobalHeader` and the Stage menu (T-26) gain "Votes".
- [x] Axe passes; the table is readable at 390 px (stack to cards below 720 px).

### Step 3 — Search returns votes

- [x] `/search` results show division hits with a "Vote" kicker, the result chip and the same two links; contribution hits unchanged.
- [x] Prose passes `scripts/check_prose.py`.

### Gates
- `python -m unittest`; export determinism; `npm run check`; `npm test`; `npm run test:a11y` on `/divisions`.
- Nothing presented as a vote is altered; the index is a pointer table over the publisher's rows.

**Notes:**
- Per-Member ballots stay on the Member page; this index is per division. A per-Member column would need 96 columns and is out of scope.
- Rows carry `date` (the sitting date) but no separate `sitting_date`, which would repeat it. They also carry `term`, for the Term filter, and `item_title_en`, the item the Record files the vote under. That title is shown when no debate matches.
- `target` is the label "Motion", "Amendment N" or "Motion as amended". `pipeline.export.read_motion` mirrors `readMotion`. `votes.export.test.ts` checks every exported row against `readMotion`, `debateItemOf` and its sitting file.
- "Watch it in the chamber" links to `/sitting/{date}?division={id}`, not `?t=`. A division's time on the stage is a derived beat placement that only the TypeScript timeline computes. The Stage now reads `?division=`, seeks to that beat and pauses, so the placement is never ported to Python.
- Search division documents reuse the existing `item` and `text` fields (debate title, motion text), so the MiniSearch search fields are unchanged. The stored fields gain `type`, `division_id`, `target`, `result` and `has_debate`.
- Votes is also a kiosk opt-in link (`?kiosk_links=votes`); a kiosk still shows only Members and Register by default.
