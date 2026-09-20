---
id: T-18
title: "Stage HUD: /sitting/[date], Transcript Column, Running Order and Transport"
kind: frontend
status: pending
depends: [T-17]
---

# T-18 — Stage HUD: /sitting/[date], Transcript Column, Running Order and Transport

**What to build:**  
The route and the flat surface around the chamber. Spec 2.0.0 sections 5.1, 9.1, 9.2.

### Acceptance Criteria
- [ ] Route `/sitting/[date]` loads `sittings/{date}.json` and `terms/{n}.json`, builds the timeline, and mounts the scene. `/` redirects (prerendered) to the latest sitting from `index.json`, paused at its first timed contribution, with one obvious Play control. `/siambr` redirects to `/`.
- [ ] Deep links: `?t=<seconds>` seeks and pauses on load with the camera on the speaker; `?item=<id>` seeks to that item's first timed contribution. The URL updates (replaceState, throttled to 1 s) as playback runs so a copied link is a moment.
- [ ] **Top strip**: sitting date picker (a list of sitting dates from `sittings/index.json`, newest first, grouped by month; keyboard navigable), wall clock (`HH:MM:SS`, derived from `meeting_start_time + t`), transport (play/pause, previous/next contribution, previous/next item, speed 1x/4x/16x), vantage buttons (Gallery, Y Llywydd, Floor, Speaker, Follow), walk toggle, Register link.
- [ ] **Scrub bar** under the strip spanning the sitting; item boundaries ticked and labelled on hover; live position marked; click or drag to seek; keyboard accessible as a slider.
- [ ] **Transcript column** (right, 36% width, minimum 22rem): live contribution's portrait, name, Welsh name, party, constituency, ministerial title on that date, language tag; verbatim text in full; a Welsh original shows the official English translation beneath with a labelled rule; auto-scroll advances the text at the beat's real pace and pauses when the visitor scrolls, resuming on the next contribution; *Watch this moment on Senedd TV* link to the contribution's own URL. Untimed contributions show "No broadcast timestamp published for this contribution."
- [ ] **Running order** below the transcript: items with their contributions (speaker, start time), live one marked, click seeks. Collapsible per item.
- [ ] **Provenance strip** bottom-left: "Desk positions arranged by Siambr engine — not the official seating plan." and "Record as published <record_published_at>." Both always visible.
- [ ] Keyboard map from T-16 bound; focus never trapped by the canvas; `Esc` leaves walk mode or closes a drawer, never both.
- [ ] Phone layout: chamber above; transcript as a bottom sheet at 50% height draggable to 90%; transport in the sheet header; running order as a second tab. No horizontal scroll at 360 px.
- [ ] Prose linter and axe WCAG 2.2 AA pass on the HUD at desktop and phone widths.

**Notes:**
- The transcript column never trims, paraphrases or summarises. If it does not fit, it scrolls.
- Speaker rendering when `member_id` is null: show the record's speaker text exactly, no portrait, no party.
