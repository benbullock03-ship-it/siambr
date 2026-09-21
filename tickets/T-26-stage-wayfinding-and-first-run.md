---
id: T-26
title: "Stage Wayfinding and First Run: Site Nav on the Stage, a Reachable Landing Page, First-Visit Orientation"
kind: frontend
status: done
depends: [T-18, T-22]
---

# T-26 — Stage Wayfinding and First Run

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` findings F1, F2, F3, F6 and F18. The front door is the latest sitting, so the Stage must carry the site's navigation and a first-visit orientation. Today the Stage links only to stats and the Register; the landing page and the Guide cannot be reached by address; and a keyboard visitor's first Tab lands in a 237-row list.

---

### Step 1 — Site navigation on the Stage

- [x] `TopStrip` gains a compact site menu (Members, Search, Register, Stats, Guide) in the top-right group, replacing the two bare links. On desktop it is a row of links; below 720 px it collapses to one "Menu" button that opens a small popover, min 44 px tap.
- [x] The "Register" link keeps context: `/register?item={current item id}` when a beat is live, plain `/register` otherwise.
- [x] In kiosk mode the menu shows Members and Register only (Search and Stats are opt-in via the existing kiosk config); each link is at least 44 px tall.
- [x] Playwright: on `/sitting/{date}` at 1440 and 390 px, links to `/members`, `/search` and the Guide exist and are within the viewport.

### Step 2 — Landing page and Guide reachable by address

- [x] `routes/+page.ts` stops redirecting on prerender. The built `index.html` is the landing page; the "front door is the latest sitting" decision is kept by having the landing page's primary button and the brand link go to the latest sitting, and by `GlobalHeader`'s "Chamber Stage" link. Record the change under "Decisions" in `tickets/INDEX.md`.
  - Alternative if the redirect must stay: prerender a second route `/welcome` as the landing page and point the brand link there. Choose one and note it.
- [x] `?guide=1` works on the Stage as well as the Register (the layout already handles it; the Stage menu from Step 1 links to it).
- [x] `OnboardingModal`'s "Don't show this guide on startup" either does something or is removed. Decision for this ticket: remove the checkbox and the `siambr_onboarded` write; the Guide is on demand only.
- [x] The modal's copy passes `scripts/check_prose.py` ("architectural beacon" and "Verbatim Truth" are spin; say what the beacon is).

### Step 3 — First-visit orientation on the Stage

- [x] The controls plate gets a first line that says what the page is and what to do: "Plenary, {date}. Press Play to start the day; the transcript follows on the right." On phones: "…the transcript is in the sheet below." The camera hint follows on the second line.
- [x] Dismissing the controls plate and the seating notice is remembered per browser in `localStorage` (`siambr.hud.dismissed`), wrapped in try/catch, never in kiosk mode.
- [x] Reduced motion unchanged.

### Step 4 — Keyboard entry order

- [x] Tab order on a fresh sitting: skip link "Skip to transport" → sitting picker → transport → speed → camera → transcript body → running order. The active running-order row is the only row in the tab sequence (`tabindex="0"`, others `-1`, arrow keys move within the list; roving tabindex).
- [x] Space or K toggles play when focus is on the body or the transport (already true for the body; assert it).
- [x] Playwright: press Tab once on `/sitting/{date}`, assert the skip link is focused; press Tab three times, assert Play is focused.

### Gates
- `npx vitest run` green; `svelte-check` 0 errors; `npm run build` ok; `npm run test:a11y` green on `/sitting/{date}` and `/`.
- `python -m scripts.check_prose` passes on all new copy.
- `frontend/src` still references no `/api/`.
- Nothing presented as a speech or a vote is altered.

**Notes:**
- Do not add a hamburger to the Register header in this ticket; T-27 handles the phone header.
- Landing page: `/` is the landing page; the prerender redirect is gone. `GlobalHeader`'s brand and "Chamber Stage" and the landing page's primary button go to the latest sitting; the Stage's brand goes to `/`. `/siambr` now redirects straight to the latest sitting (it used to hop through `/`).
- There was no kiosk link config; added `?kiosk_links=search,stats` (stored as `siambr.kiosk.links`, cleared by `?kiosk=0`). The kiosk menu omits the Guide because the layout never opens it in kiosk mode.
- Stage menu "Stats" is the session stats for the sitting on screen (`/sitting/{date}/stats`); "Guide" is `/sitting/{date}?guide=1`. The phone menu is a native `popover` placed under its button.
- Tab order: Play now leads the transport (Play, then previous item, previous contribution, next contribution, next item), so Play is the third stop. The brand link moved to the end of the strip's DOM and is drawn first with CSS `order`; it is the last strip stop.
- Space on a control outside the transport now presses that control and no longer also toggles playback. K toggles playback anywhere but form fields.
- The running order's live-row scroll no longer uses `scrollIntoView`: in Chrome it moved the Tab starting point into the list, so the first Tab from a fresh page went past the skip link.
- The controls plate now shows on phones (it was hidden below 720 px) so the phone line can be read; T-27 reshapes it.
