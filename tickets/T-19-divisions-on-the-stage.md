---
id: T-19
title: "Divisions on the Stage: Desk Tints, Wall Clocks and the Division Plate"
kind: 3d+frontend
status: pending
depends: [T-05, T-17, T-18]
---

# T-19 — Divisions on the Stage: Desk Tints, Wall Clocks and the Division Plate

**What to build:**  
Roll-call divisions become visible in the chamber at the moment they happen. Spec 2.0.0 section 4.3.

### Acceptance Criteria
- [ ] Export (T-14) places each division on its agenda item with the member votes. The timeline (T-16) inserts a `division` beat after the item's last timed contribution, 20 s long at 1x, badged derived for its placement (the record gives the item, not the second).
- [ ] During a division beat every seated Member's desk tints by `vote_cast`: for, against, abstain in three chamber tones defined in `materials.ts` (not party colours; must pass a deuteranopia check). `did_not_vote` and Members with no row stay untinted. Tints fade over 6 s after the beat.
- [ ] The two red wall division clocks run during the beat (digit texture on the existing clock meshes). The four wall screens show the motion text and the tally as it stands at the end of the beat (verbatim `motion_text`, `votes_for`, `votes_against`, `votes_abstain`, `result`).
- [ ] Transcript column shows a **Division Plate** during the beat: motion text, tally, result, and the member-by-member breakdown grouped by party (reusing `DivisionPlate.svelte`), with the Modern.Gov source link.
- [ ] Running order lists divisions as rows within their item; the scrub bar ticks them.
- [ ] A sitting with no divisions shows nothing extra anywhere and says so on its stats page (T-21). No placeholder tallies ever.
- [ ] `vitest`: division beats sit inside their item; tint mapping is total over `vote_cast` values; a Member without a vote row is untinted.

**Notes:**
- Blocked on T-05 producing real `division_votes` and `member_votes` rows for Seventh Senedd sittings. Do not stub votes to build against; use a fixture sitting exported from real data once T-05 lands.
