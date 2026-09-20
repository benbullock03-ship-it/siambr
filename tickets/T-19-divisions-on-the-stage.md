---
id: T-19
title: "Divisions on the Stage: Desk Tints, Wall Clocks and the Division Plate"
kind: 3d+frontend
status: done
depends: [T-05, T-17, T-18]
---

# T-19 — Divisions on the Stage: Desk Tints, Wall Clocks and the Division Plate

**What to build:**  
Roll-call divisions become visible in the chamber at the moment they happen. Spec 2.0.0 section 4.3.

### Acceptance Criteria
- [x] Export (T-14) places each division on its agenda item with the member votes. The timeline (T-16) inserts a `division` beat after the item's last timed contribution, 20 s long at 1x, badged derived for its placement (the record gives the item, not the second).
- [x] During a division beat every seated Member's desk tints by `vote_cast`: for, against, abstain in three chamber tones defined in `materials.ts` (not party colours; must pass a deuteranopia check). `did_not_vote` and Members with no row stay untinted. Tints fade over 6 s after the beat.
- [x] The two red wall division clocks run during the beat (digit texture on the existing clock meshes). The four wall screens show the motion text and the tally as it stands at the end of the beat (verbatim `motion_text`, `votes_for`, `votes_against`, `votes_abstain`, `result`).
- [x] Transcript column shows a **Division Plate** during the beat: motion text, tally, result, and the member-by-member breakdown grouped by party (reusing `DivisionPlate.svelte`), with the Modern.Gov source link.
- [x] Running order lists divisions as rows within their item; the scrub bar ticks them.
- [x] A sitting with no divisions shows nothing extra anywhere (pinned by `floor.test.ts`), and its stats page says so in a line. No placeholder tallies ever.
- [x] `vitest`: division beats sit inside their item; tint mapping is total over `vote_cast` values; a Member without a vote row is untinted.

**Notes:**
- Built against real exported data (24 June 2026 carries ten divisions with 96 ballots each); nothing stubbed.
- The export now carries each division's `source_url`, the meeting's XMLExport `Votes` document. T-05 reads divisions from the Record, not Modern.Gov, so that is the canonical link the Division Plate offers.
- Desk tones are `DIVISION_TONES` in `materials.ts`; `divisionLight.test.ts` simulates deuteranopia (Viénot 1999) and asserts every pair stays apart in CIE Lab.
- The line a sitting with no divisions shows on its stats page landed with T-21. The chamber and the Register show nothing extra, and `floor.test.ts` pins that.
- **Open point for T-23 or a spec decision**: the 20 s beat is a request, not a guarantee. Voting Time on 24 June 2026 leaves nine seconds of clip between its last timed contribution and the next item's first startPos, so ten divisions share nine seconds rather than overrun a published startPos. The six-second tint fade is what keeps a squeezed run readable on the desks. Giving each division its full 20 s would need either a clock that holds during Voting Time or a placement rule that puts each division after the contribution that calls it.
