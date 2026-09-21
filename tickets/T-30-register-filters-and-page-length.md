---
id: T-30
title: "Register Filters and Page Length: One Filter Behaviour, Shorter First Paint"
kind: frontend
status: pending
depends: [T-20]
---

# T-30 — Register Filters and Page Length

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` finding F9. On `/register` the text box filters as you type, while Term, Policy domain and Speaker do nothing until "Apply filters" is pressed, and nothing says so. Three sittings open by default make the page 5,500 px on desktop and 8,700 px on phone before the fourth sitting.

---

### Step 1 — One filter behaviour

- [ ] All four filters apply live and write to the URL with `replaceState` (the page is prerendered once; filters already parse from the URL). Remove "Apply filters"; keep "Clear filters".
- [ ] The results bar announces changes via the existing `aria-live` region: "17 sittings, 125 debates".
- [ ] Keyboard: changing a select does not steal focus; the text box keeps its caret.
- [ ] Playwright: pick a Speaker, assert the count changes with no submit; reload the URL, assert the filter is still applied.

### Step 2 — Shorter first paint

- [ ] Only the newest sitting opens by default; the rest are closed. "Expand all sittings" stays.
- [ ] Each sitting summary row shows its debates count and speeches count as now, plus the first three debate titles in one muted line so a closed sitting is still scannable.
- [ ] Arriving with `?item=` opens that sitting and scrolls to the item (already true; assert it still holds with one open).
- [ ] Phone: the session summary row wraps to two lines at most; badges keep 12 px minimum text (raise from the current 10 px).

### Gates
- `npx vitest run`; `svelte-check` 0 errors; `npm run build`; `npm run test:a11y` on `/register`.
- Prose passes `scripts/check_prose.py`.

**Notes:**
- Formatting dates as "16 September 2026" is already the Register's style; the Stage, Members and Search use ISO (audit F14). Not in this ticket.
