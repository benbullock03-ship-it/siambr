---
id: T-30
title: "Register Filters and Page Length: One Filter Behaviour, Shorter First Paint"
kind: frontend
status: done
depends: [T-20]
---

# T-30 — Register Filters and Page Length

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` finding F9. On `/register` the text box filters as you type, while Term, Policy domain and Speaker do nothing until "Apply filters" is pressed, and nothing says so. Three sittings open by default make the page 5,500 px on desktop and 8,700 px on phone before the fourth sitting.

---

### Step 1 — One filter behaviour

- [x] All four filters apply live and write to the URL with `replaceState` (the page is prerendered once; filters already parse from the URL). Remove "Apply filters"; keep "Clear filters".
- [x] The results bar announces changes via the existing `aria-live` region: "17 sittings, 125 debates".
- [x] Keyboard: changing a select does not steal focus; the text box keeps its caret.
- [x] Playwright: pick a Speaker, assert the count changes with no submit; reload the URL, assert the filter is still applied.

### Step 2 — Shorter first paint

- [x] Only the newest sitting opens by default; the rest are closed. "Expand all sittings" stays.
- [x] Each sitting summary row shows its debates count and speeches count as now, plus the first three debate titles in one muted line so a closed sitting is still scannable.
- [x] Arriving with `?item=` opens that sitting and scrolls to the item (already true; assert it still holds with one open).
- [x] Phone: the session summary row wraps to two lines at most; badges keep 12 px minimum text (raise from the current 10 px).

### Gates
- `npx vitest run`; `svelte-check` 0 errors; `npm run build`; `npm run test:a11y` on `/register`.
- Prose passes `scripts/check_prose.py`.

**Notes:**
- Formatting dates as "16 September 2026" is already the Register's style; the Stage, Members and Search use ISO (audit F14). Not in this ticket.
- Filters are page state; an effect writes them to the URL with `replaceState` and the URL still seeds them on arrival. "Clear filters" is a button that resets the state, so focus stays in the panel.
- The results line reads "2 sittings, 3 debates" in an `aria-live="polite"` paragraph; the text box announces as you type.
- A domain, speaker or text filter still opens every matching sitting, as before: only the unfiltered default is one open sitting. `?item=` opens its sitting beside the newest; it no longer opens all of them.
- "Scrolls to the item" was not in the code (the dossier drawer covered it). Added: on arrival the item row is scrolled to the centre once.
- The preview line is its own row under the date and counts, at desktop and phone. On phone the date and the counts share the first row (title text hidden, pills compacted). A four-digit speech count could push the pills to a third row at 390 px.
- Badges: type badge raised from 11.5 px to 12 px; the preview line uses body text colour (muted failed contrast on the panel).
- Full `playwright test` after this ticket: 65 passed, 2 skipped, 3 stage tests timed out waiting for the canvas (kiosk reduced motion, Member record from the chamber, untimed contribution). All three pass when run alone; they are SwiftShader load timeouts, not Register changes.
