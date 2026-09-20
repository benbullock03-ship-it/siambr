---
id: T-18
title: "Stage HUD: /sitting/[date], Transcript Column, Running Order and Transport"
kind: frontend
status: done
depends: [T-17]
---

# T-18 — Stage HUD: /sitting/[date], Transcript Column, Running Order and Transport

**What to build:**  
The route and the flat surface around the chamber. Spec 2.0.0 sections 5.1, 9.1, 9.2.

### Acceptance Criteria
- [x] Route `/sitting/[date]` loads `sittings/{date}.json` and `terms/{n}.json`, builds the timeline, and mounts the scene. `/` redirects (prerendered) to the latest sitting from `index.json`, paused at its first timed contribution, with one obvious Play control. `/siambr` redirects to `/`.
- [x] Deep links: `?t=<seconds>` seeks and pauses on load with the camera on the speaker; `?item=<id>` seeks to that item's first timed contribution. The URL updates (replaceState, throttled to 1 s) as playback runs so a copied link is a moment.
- [x] **Top strip**: sitting date picker (a list of sitting dates from `sittings/index.json`, newest first, grouped by month; keyboard navigable), wall clock (`HH:MM:SS`, derived from `meeting_start_time + t`), transport (play/pause, previous/next contribution, previous/next item, speed 1x/4x/16x), vantage buttons (Gallery, Y Llywydd, Floor, Speaker, Follow), walk toggle, Register link.
- [x] **Scrub bar** under the strip spanning the sitting; item boundaries ticked and labelled on hover; live position marked; click or drag to seek; keyboard accessible as a slider.
- [x] **Transcript column** (right, 36% width, minimum 22rem): live contribution's portrait, name, Welsh name, party, constituency, ministerial title on that date, language tag; verbatim text in full; a Welsh original shows the official English translation beneath with a labelled rule; auto-scroll advances the text at the beat's real pace and pauses when the visitor scrolls, resuming on the next contribution; *Watch this moment on Senedd TV* link to the contribution's own URL. Untimed contributions show "No broadcast timestamp published for this contribution."
- [x] **Running order** below the transcript: items with their contributions (speaker, start time), live one marked, click seeks. Collapsible per item.
- [x] **Provenance strip** bottom-left: "Desk positions arranged by Siambr engine — not the official seating plan." and "Record as published <record_published_at>." Both always visible.
- [x] Keyboard map from T-16 bound; focus never trapped by the canvas; `Esc` leaves walk mode or closes a drawer, never both.
- [x] Phone layout: chamber above; transcript as a bottom sheet at 50% height draggable to 90%; transport in the sheet header; running order as a second tab. No horizontal scroll at 360 px.
- [x] Prose linter and axe WCAG 2.2 AA pass on the HUD at desktop and phone widths. *(axe verified at 1280 and 360 px; the prose linter does not exist until T-24 and runs then)*

**Notes:**
- The transcript column never trims, paraphrases or summarises. If it does not fit, it scrolls.
- Speaker rendering when `member_id` is null: show the record's speaker text exactly, no portrait, no party.

### Notes (done 2026-09-20)
- Route `src/routes/sitting/[date]/`: `+page.ts` loads the sitting, its term (seats come from `terms/{n}.json` `members`, so a past term seats its own Members), the site index and the sittings index; a malformed or unknown date is a 404. `svelte.config.js` reads `sittings/index.json` from the static directory at build time and prerenders every `/sitting/{date}` (17 pages in the real build); the SPA fallback covers any other date. The T-14 `handleHttpError` filter is gone.
- `/` and `/siambr` are `redirect(307)` loads, prerendered as meta-refresh HTML (`index.html` → `/sitting/2026-09-16`, `siambr.html` → `/`). `url.search` is only appended when not `building`, so a client-side arrival keeps its query while the prerender does not read it. `?item=` on the stage now means "seek to that item's first timed contribution" (spec 9.2), not "open the Dossier Plate"; the plate stays a Register drawer and its *Watch it play in the chamber* link lands on the moment.
- Deep links: `?t=` seeks, pauses and cuts the camera to the live desk; `?item=` seeks to `firstTimedT` (or the item start for an all-untimed item). While playing, `replaceState` writes `?t=<floor(t)>` at most once a second and drops `?item=`.
- HUD is `src/lib/stage/ui/`: `TopStrip` (sitting `<select>` grouped by month with `<optgroup>`, newest first, keyboard native; wall clock; `Transport`; speed chips; the camera chips and walk toggle moved here from T-17's HUD; Register link), `ScrubBar` (a native range input over a track with an item tick per non-empty item, live item tinted, division beats marked, item title on hover), `Transcript` (portrait, name, Welsh name, party, constituency, role on that date, language tag; verbatim paragraphs split on newlines only; Welsh original with the official English translation under a labelled rule; Senedd TV link; "No broadcast timestamp published for this contribution." for untimed rows; a division beat shows the motion and tally, T-19 replaces with the Division Plate), `RunningOrder` (`<details>` per item, live item opened once automatically, rows in Record order with the wall-clock start or "untimed", `aria-current` on the live row, click seeks), `ProvenanceStrip` (seating notice and "Record as published …" linking the source XML), `StageSheet` (phone: 50 vh, drag or ArrowUp/Down to 90 vh, transport in the header, Transcript and Running order as tabs). `SiambrHud.svelte` is now only the canvas overlay: controls hint, nametag, crosshair, joystick.
- Auto-scroll: the transcript body's `scrollTop` follows `(t - beat.t) / (beat.tEnd - beat.t)` over its scroll range, so the real pace is the beat's derived length; a wheel, touch or user scroll holds it until the next beat. Speaker text when `member_id` is not in `speakers`: the id is shown with "Speaker not in the Members register." (the export carries no separate speaker text; unmatched speakers were skipped whole at ingest, see the run's deferred data issue).
- Keyboard: `keys.ts` map bound on `window`, skipped while focus is in a form control or a drawer is open; in walk mode Left/Right stay with the walker. `Esc` leaves walk mode; the Drawer takes `Esc` itself when open, and the page ignores it then. The canvas has no tabindex, so focus never lands in it.
- Follow now re-frames only while playing, so the front door opens on the Gallery vantage and stays there until the first speaker change after Play; a deep link frames on arrival with a cut. The Speaker chip frames the live desk on demand.
- Layout: desktop grid, right column `minmax(22rem, 36%)` with the transcript over the running order (3:2); under 720 px the column becomes the sheet. Verified no horizontal overflow at 360 px in e2e.
- Capability fallbacks no longer navigate away: no-WebGL and low-memory render an in-place notice with an *Open the Register* link on the stage route (the redirect-to-Register e2e tests were rewritten to match).
- Gates: `npx vitest run` 122 passed; `svelte-check` 0 errors 0 warnings; `npx playwright test` 17 passed (front door redirect and one Play, `/siambr` redirect, axe at phone width with the sheet and no horizontal overflow, Member record from the stage, reduced motion, kiosk, desk click, transport and keyboard and `?t=` URL writing, untimed message, no-WebGL and low-memory fallbacks, `?item=` deep link); `python -m unittest` 114 passed; `python -m pipeline.run_checks` 6/6; `npm run build` ok (17 sitting pages); no `/api/` in `frontend/src`. Prose linter: pending T-24.

