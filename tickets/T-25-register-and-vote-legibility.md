---
id: T-25
title: "Register and Vote Legibility: Member Record Overlay, Party Tabs, Division Tones, Ballot History"
kind: frontend
status: done
depends: [T-19, T-20]
---

# T-25 — Register and Vote Legibility

**What to build:**  
Four fixes from the 2026-09-21 review of `/members/{id}` and the stage during Voting Time. Work them in the order below; each is independently shippable and each closes before the next opens. No pipeline change is required for 1 to 3; step 4 may add one exported field.

---

### Step 1 — Member record opens beside the transcript, not under it

**Problem.** On the stage, clicking a Member opens the record drawer (`lib/hud/Drawer.svelte`, `position: fixed`, right-anchored, `z-index: 11`). The transcript column (`routes/sitting/[date]/+page.svelte`, `.column`, `z-index: 25`) sits above it, so the drawer is buried whenever the sidebar is open.

**Fix.** The drawer belongs to the chamber viewport, not the whole screen. It opens over the 3D view, left of the column, so the transcript keeps running while the record is read.

- [x] `Drawer` accepts an anchor: on the stage it is positioned inside `.chamber` (which is already `position: relative; isolation: isolate`), full height of the viewport, width `min(48rem, 100%)` of the chamber area, right edge flush with the column's left border.
- [x] On phones (`.stage.phone`) the drawer stays full-screen as now, above the `StageSheet`.
- [x] Stacking order is written down once in `+page.svelte` as a comment block: canvas 0, HUD 10 to 20, drawer 30, column 25 (column and drawer no longer overlap so the numbers only matter on phones).
- [x] Esc closes the drawer and never also leaves walk mode (existing rule, keep it).
- [x] Playwright: open a sitting on desktop, click a desk, assert the drawer's bounding box does not intersect the column's and both are visible.

---

### Step 2 — Party tab keeps its party colour

**Problem.** `lib/3d/chamber/Desks.svelte` mixes the party tab 45 % toward cream (`FLOOR_LIGHT.tabWarm`) once a Member has spoken, for the rest of the sitting. Every party colour washes out and, during a division, reads as a broken tint.

**Fix.** Delete the tab warming. The party tab is party colour, always.

- [x] Remove `tabWarm`, `tabWarmMix` and the `spoken` eased map from `Desks.svelte` and `floorLight.ts`; `spokenMemberIds` stays in `FloorState` (the Running Order and stats use it) but nothing in the 3D scene colours by it.
- [x] The lit screen and the worktop warm remain the only "live" cues.
- [x] `floorLight.test.ts` updated; `materials.test.ts` budget unchanged.
- [x] Screenshot pair in `docs/chamber-review/pass4/`: Speaker vantage mid-division before and after, party tabs legible against the vote tint.

---

### Step 3 — Division tones readable at a glance, with a legend

**Problem.** `DIVISION_TONES` are For blue `#1c5f9c`, Against orange `#e0912f`, Abstain grey; did-not-vote is untinted. Blue/orange carries no yes/no meaning, blue collides with the Conservative tab, and there is no legend anywhere on the stage.

**Fix.** Keep tones deliberately non-party but make them read as a pair, and say what they mean wherever a division is shown.

- [x] Choose a For/Against pair with a luminance difference of at least 30 (WCAG relative luminance) and distinct hue families that are not any `PARTY_HEX` value: proposal teal `#1f8a8a` For, amber `#d9822b` Against, grey Abstain unchanged. Record the chosen values and the reasoning in the ticket notes.
- [x] `DIVISION_TINT_MIX` raised so a tinted worktop is unmistakable from the Gallery vantage (screenshot in `pass4/`).
- [x] Legend: a `VoteLegend` component (three swatches plus "Unlit desk: did not vote") rendered in `DivisionPlate`, in the HUD during a division beat, and once at the head of the Member page ballot section. One source of truth for the swatch colours: `DIVISION_TONES` re-exported for CSS via a tiny `voteTone()` helper or CSS custom properties set on `:root` from the same constants.
- [x] Ballot chips in `DivisionPlate` member lists use the same swatches.
- [x] Reduced motion unchanged; the legend is static.

---

### Step 4 — Ballot history on the Member page, grouped and readable

**Problem.** `routes/members/[id]/+page.svelte` renders every ballot (48 for a typical Member) as one flat table: date, "7. Voting Time" as the link text, the raw motion string, the vote, the result. The same table is repeated in `MemberPlate.svelte`.

**Fix.** Group by sitting day, then by debate, and show each vote as one short row with a coloured chip. Reuse `readMotion()` from `lib/stage/votes.ts`; nothing is rewritten, only parsed and pointed at.

- [x] Summary strip at the head of the section: For / Against / Abstain / Did not vote counts for this Member, `PROVENANCE_DERIVED` badge (counts are a sum of the publisher's rows, never an estimate).
- [x] Per sitting day: a `details` element, newest first, the first `OPEN_DAYS` open, matching the Contributions section above it. Summary line: date, number of divisions that day.
- [x] Per debate within a day: the topic from `readMotion().topic` as the heading (or the debate item title when the export supplies it, see below), then one row per division: target (`targetLabel`), "tabled in the name of …" when present, the Member's ballot as a chip, the result. Rows keep Record order.
- [x] Links: "Watch it in the chamber" per debate to `/sitting/{date}?item={debate_item_id}` and "Read the debate" to `/register?item=…`. Until `debate_item_id` is exported, link to the Voting Time item as now.
- [x] Export (optional, do it if cheap): `pipeline/export.py` adds `debate_item_id` to each `MemberBallot` using the same item-number match as `debateItemOf()`; null when no match. `tests/test_export.py` covers one matched and one unmatched case; the export stays deterministic.
- [x] `MemberPlate.svelte` ballot table replaced by the same component, so the stage drawer and the Register agree.
- [x] Prose passes `scripts/check_prose.py` when it exists; no new copy uses banned adjectives.
- [x] Axe passes on `/members/{id}` with the new structure; every chip has a text label, not colour alone.

---

### Gates (all steps)
- `npx vitest run` green; `svelte-check` 0 errors; `npm run build` ok.
- `frontend/src` still references no `/api/`.
- Nothing presented as a speech or a vote is altered; grouping and parsing only produce pointers.

**Notes:**
- Done 2026-09-21. Tones chosen: For `#1a7d7d` (teal, L* 47.5), Against `#f5b445` (amber, L* 77.6), Abstain `#a9adb2` unchanged. The proposed pair (`#1f8a8a` / `#d9822b`) was only 10 L* apart, so it failed the "at least 30" rule and was not taken. The chosen pair is 30.1 L* apart, 0.36 apart in WCAG relative luminance, and both sit at more than twice the worktop's luminance (`#3e444b`, L* 28.6) so a tinted desk reads from the Gallery. `DIVISION_TINT_MIX` is now 1. The tones live in `lib/stage/voteTones.ts` (no three.js) and `materials.ts` re-exports them; `divisionLight.test.ts` asserts the gap, the worktop margin, deuteranope separation and no party-hex collision. Amber remains the same hue family as the Liberal Democrat tab, as the ticket accepted; the legend's text labels carry the meaning.
- Export adds `debate_item_id` and `debate_item_title_en` to each ballot (two fields, the title so the heading is the debate's own). All 48 ballots of the current export matched a debate.
- Screenshots: `docs/chamber-review/pass4/{before,after}-*.png` at `?t=13320` on 2026-09-16 (first division beat). `scripts/chamber-review.mjs` takes `T=` and a sub-folder label.
- Follow-up: a colour-blind-safe shape cue on chips and desks if the legend proves insufficient.
- Order matters: 1 is a stacking bug, 2 deletes one mix, 3 chooses tones the legend and chips in 4 depend on.
- Do not chase a colour-blind-safe shape cue in this ticket; note it as a follow-up if the legend proves insufficient.
