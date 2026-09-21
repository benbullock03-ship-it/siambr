---
id: T-27
title: "Phone Layout: HUD Plates Clear of the Transcript Sheet, Header Nav That Fits"
kind: frontend
status: pending
depends: [T-18, T-25]
---

# T-27 — Phone Stage and Header Layout

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` findings F4 and F5. At 390 px the Stage's bottom plates (controls hint, vote legend, seating and provenance notice) sit on top of the transcript sheet's text, and the global header's nav clips "Search" and "Stats" off the right edge with no scroll cue.

---

### Step 1 — HUD plates and the sheet share the chamber viewport

**Problem.** `SiambrHud .bottom-stack` is `position: absolute; bottom: 0.75rem` inside `.chamber`; on phones `StageSheet` is also absolute inside `.chamber` at 50 to 90 vh. Both anchor to the same bottom edge.

**Fix.** On phones the plates anchor to the top of the sheet, not the bottom of the chamber.

- [ ] `StageSheet` exposes its current height (`heightVh`) through a CSS custom property on `.chamber` (`--sheet-height`), or the page passes it to `SiambrHud`.
- [ ] `.stage.phone .bottom-stack { bottom: calc(var(--sheet-height) + 0.5rem) }`, max-height capped so the stack never exceeds the visible chamber; when the sheet is at 90 vh the stack hides (`display: none`) since no chamber is visible.
- [ ] The controls hint on phones collapses to one line ("Drag to orbit · tap a desk") with the dismiss button; the seating and provenance notice becomes a single "i" button that opens the text in a popover.
- [ ] `VoteLegend compact` on phones sits inside the sheet header (next to the tabs) during a division beat, not on the chamber.
- [ ] Playwright at 390x844: at `?t=13320` assert no element of `.bottom-stack` intersects the sheet's bounding box; screenshot to `docs/chamber-review/phone/`.

### Step 2 — Header nav fits at phone width

- [ ] Below 768 px `.primary-nav` becomes a horizontally scrollable row with a visible fade on the clipped edge, and the active link scrolls into view on load. Or, preferred: a two-row wrap (`flex-wrap: wrap`) with five items at 0.82 rem fits in 390 px; test both and keep the one that needs no scrolling.
- [ ] The "Guide" button keeps its 44 px tap height and does not truncate.
- [ ] Playwright at 390 px on `/members`: every `.nav-link` bounding box is inside the viewport.

### Gates
- `npx vitest run` green; `svelte-check` 0 errors; `npm run build` ok.
- `npm run test:a11y` green on `/sitting/{date}` at 390 px and on `/members`.
- Reduced motion unchanged; the sheet transition already disables.

**Notes:**
- Kiosk portrait (1080 px) is not a phone by the `(max-width: 720px)` query and is unaffected; check the screenshot anyway.
