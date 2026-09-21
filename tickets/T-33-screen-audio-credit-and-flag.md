---
id: T-33
title: "Screen Audio, Credit and Flag: Interpretation Audio, Attribution, Off Until Cleared"
kind: frontend
status: done
depends: [T-32]
---

# T-33 — Screen Audio, Credit and Flag

**What to build:**  
The controls and copy around T-32, and the flag that keeps it off in production until the Senedd Commission replies.

---

### Step 1 — Audio

- [x] Sound on by default, as on senedd.tv: the Play press is the user gesture that lets the browser start audio. A mute toggle in the transport bar, keyboard reachable, `aria-pressed`.
- [x] The HUD names the track as senedd.tv does: "Audio: English interpretation (Senedd TV)". The transcript column stays the verbatim Record.
- [x] Sound follows the picture: silent at 4x/16x and while buffering.

### Step 2 — Credit and missing stream

- [x] "© Senedd Commission · Senedd TV" beside the audio toggle whenever the video is available.
- [x] Sitting with `stream_url: null`: one HUD line, "No Senedd TV stream for this sitting." The "Watch on Senedd TV" link-out stays on every sitting.

### Step 3 — Flag and clearance

- [x] `PUBLIC_SCREEN_VIDEO` build flag: off in the production build, on in dev and preview.
- [ ] Email the Senedd news team: describe the use (unaltered HLS stream on in-chamber screens with its interpretation audio, credited, link-out kept) and ask whether pulling the stream directly is acceptable. Record the date sent and the reply in the notes.
- [ ] Turn the flag on in production only after a written yes.

### Gates
- `python -m scripts.check_prose` on the new copy; `npm run test:a11y` on the Stage HUD with toggle and credit visible.
- Vitest: unmuted after Play, toggle state, null-stream line.

**Notes:**
- Reuse terms: https://senedd.wales/media/images-and-video/ (embedding allowed; no adaptation beyond format and accessibility).

Done 2026-09-21, except the email: not sent yet, so the flag stays off in production.

- **Flag.** `vite.config.ts` turns `PUBLIC_SCREEN_VIDEO` into the compile-time `__SCREEN_VIDEO__`: `1`/`true` on, `0`/`false` off, unset means on under `vite dev` and off in a build. A preview build sets `PUBLIC_SCREEN_VIDEO=1`. `deploy.yml` sets `'0'` on its build step; turning it on is that one line. With it off the page passes `stream = null`, so no `<video>`, no hls.js request, no toggle, no credit and no null-stream line. Checked on `vite preview`: 2026-07-15 shows the Mute button with the flag on and none with it off.
- **Sound.** `ScreenSound` (`lib/stage/screenVideo.svelte.ts`) holds `muted` (false by default) and `failed`, shared by `ChamberScreen` and the HUD. `screenPlan` gains `audible`: 1x, playing, not seeking, at least `HAVE_FUTURE_DATA`, and no jump pending. A division tally does not mute it; the sitting is still speaking under the tally. The video is muted whenever `muted || !audible`. If the browser refuses unmuted play (`NotAllowedError`), it plays muted and the toggle shows Mute pressed, so the HUD never claims sound it is not playing.
- **Toggle and credit.** `ScreenAudio.svelte` sits in the playback row after the speed buttons, outside `#transport`, so Space on it presses Mute rather than Play. Mute is a button with `aria-pressed`. Beside it: "Audio: English interpretation (Senedd TV)" and "© Senedd Commission · Senedd TV". It shows whenever the page has a stream for the screens and it has not failed, including before Play, so sound can be muted before it starts. The copy is inline in the component so `check_prose` reads it.
- **No stream.** Where the screens would run but the sitting has `stream_url: null`: "No Senedd TV stream for this sitting." The per-item and per-speech "Watch on Senedd TV" links are unchanged.
- **Gates.** Vitest: `screen.test.ts` (audible after Play, silent at 4x/16x, paused, buffering, pending jump) and `ScreenAudio.test.ts` (sound on by default, keyboard toggle and `aria-pressed`, null-stream line, nothing where the screens do not run). `npm run check` 0 errors; `npm test` 29 files, 294 passed; `check_prose` 0 findings; `npm run test:a11y` 18 passed, with the desktop stage run asserting Mute and the credit are visible; `e2e/screen-video.spec.ts` 5 passed.

- **Audio track switch** (added 2026-09-21 on request). senedd.tv/en/{meeting} names the `interpretation` feed; senedd.tv/cy/{meeting} embeds a second player naming the `verbatim` feed: the same pictures and first segment, with the floor audio as spoken. `pipeline.senedd_tv` resolves both from Senedd's pages (no URL built by hand), mirrors the second under `-verbatim` in Bronze, and stores it in `stream_url_verbatim`/`stream_vbegin_verbatim` (migration 010). Export ships it under the same 2 s gate; `run_checks` gates and live-samples both feeds. 14 of 17 sittings have both; the other three have neither. The HUD shows "English | As spoken" beside Mute when the verbatim feed exists; switching reloads the screens at t. The label comes from the feed name, not from listening: check by ear that "As spoken" carries Welsh speeches in Welsh.

**Clearance email (draft, not sent).** To the Senedd news team:

> Subject: Reuse of the Senedd TV plenary stream in Siambr
>
> Siambr is a free, non-commercial site that replays each plenary sitting of the Seventh Senedd: a 3D model of the Siambr lights each Member's desk as they speak, beside the verbatim Record of Proceedings.
>
> We would like the model's four wall screens to show the sitting's Senedd TV stream. We would pull the public HLS stream from the Senedd TV CDN (the interpretation and verbatim feeds, 360p variant) directly. Viewers could switch between the English interpretation and the floor audio as spoken. The frames would be unaltered: no crop, tint, overlay or edit. The controls beside the video name the audio track and show "© Senedd Commission · Senedd TV", and every item and speech keeps its "Watch on Senedd TV" link. The video would not run on phones, with reduced motion or in kiosk mode.
>
> We have read the reuse terms at senedd.wales/media/images-and-video. Is pulling the stream directly in this way acceptable? The feature stays off on the public site until we have your written reply.

- Date sent: —
- Reply: —
