---
id: T-32
title: "Chamber Screen Playback: Senedd TV on the Wall Screens, Following the Clock"
kind: frontend
status: done
depends: [T-31]
---

# T-32 — Chamber Screen Playback

**What to build:**  
The four wall screens (`CHAMBER_SCREENS`) show the sitting's Senedd TV stream, following the stage clock. Build against the T-31 sample stream until T-31 lands.

---

### Step 1 — One video, four screens

- [x] `ChamberScreen` owns one `<video>` and one `VideoTexture` shared by all four screens. hls.js is dynamically imported on the Stage only; Safari uses native HLS.
- [x] Fixed to the 360p variant; no adaptive switching.
- [x] Nothing loads until the first Play press. No `stream_url` means no load at all.
- [x] The screen material shows frames unaltered: no tint, crop or overlay. Any future post-processing must exclude it.

### Step 2 — Clock leads

- [x] At 1x playing: `video.currentTime` follows `t`; re-snap only when drift exceeds 0.5 s.
- [x] Buffering never holds the clock. The screen keeps its last frame, or stays dark after a jump, until it can play.
- [x] Pause pauses the video on its frame.
- [x] At 4x and 16x the video pauses and the screens go dark. Returning to 1x re-snaps to `t`.
- [x] Any jump (running order, skip, date change) sets `currentTime = t`.

### Step 3 — Division wins

- [x] While `floor.divisionTint` is set, the screens show the tally from `DivisionDisplays` as now. The video keeps following `t` underneath and shows again when the tally clears.

### Step 4 — Where it does not run

- [x] Phone layout (T-27 breakpoint), `prefers-reduced-motion: reduce` and `?kiosk=1`: no video element, no hls.js; screens behave as before T-32.
- [x] The Register never imports hls.js.

### Gates
- Vitest: clock-to-video mapping (1x follows, 0.5 s threshold, 4x/16x dark, jump re-snaps, division overrides).
- Playwright: no hls.js request on `/register`, on phone viewport, with reduced motion, or with `?kiosk=1`.
- `svelte-check` 0 errors; `npm run build`; `npm run test:perf` reported before and after.

**Notes:**

Done 2026-09-21.

- **Shape.** `lib/stage/screen.ts` holds the rules as pure functions: `screenPlan` (show video, dark or tally; play or pause; where to seek), `jumpedSince` and `variant360`. `lib/3d/chamber/ChamberScreen.svelte` owns the one `<video>` and `VideoTexture` and applies the plan every frame. `DivisionDisplays` stays the only writer of the four screen materials: tally if a division is on, else the video texture, else dark. `SittingClock.seeks` counts `seek()` calls, so every jump (running order, skip, scrub, deep link, kiosk) is seen without guessing from `t`.
- **360p only.** The master playlist is fetched, the `640x360` variant is resolved from it, and that media playlist is what plays, through native HLS or hls.js. There is no master left to switch from. Audio is muxed into the variant's TS segments, so T-33 needs no separate track.
- **Native first.** `canPlayType('application/vnd.apple.mpegurl')` is checked before hls.js is imported, so Safari never downloads it. hls.js is dynamically imported from `ChamberScreen`, which only the Stage's lazily loaded scene imports. In the production build it is one chunk that `register.html` does not reference.
- **Buffering.** A drift re-snap waits while the video is seeking or below `HAVE_FUTURE_DATA`: re-snapping mid-stall would only blank the screen. After a stall the drift rule catches it up. A jump (or return to 1x) blanks the screen until its `seeked` fires; a drift re-snap keeps the last frame.
- **Frames unaltered.** With the video on, the material has `toneMapped` and `fog` off, colour white, opacity 1, and full UVs. The plane is 1.62 x 0.9 against a 16:9 frame: scaled 1.2 % wider, not cropped. There is no post-processing pass today.
- **Texture uploads.** three's `VideoTexture` waits on `requestVideoFrameCallback`. Chrome did not fire it reliably for a `<video>` outside the DOM, and the screens stayed black while the video played. `ChamberScreen` sets `needsUpdate` whenever `currentTime` has moved.
- **Muted.** The video is muted in T-32. T-33 turns sound on.
- **Gating.** The page passes `stream = null` on the phone layout, with reduced motion and in kiosk, so no `<video>` is created and hls.js is never imported. Failures (master not 200, no 360p variant, no MSE, a fatal hls.js error) log one `console.warn`, and the screens stay dark for that page.
- **Fixture.** `tests/export_fixture.py` gives 2026-06-10 a `meeting_start_time` and an aligned `stream_url` on the CDN host. `e2e/screen-video.spec.ts` routes that host to the 16086 fixture playlists: nothing is requested before Play, the 360p variant after it, and no hls.js or CDN request is made on `/register`, on a phone viewport, with reduced motion or with `?kiosk=1`. `perf.spec.ts` routes the fixture stream to the real 2026-07-15 stream, so the trace includes the video when online.
- **Browser check on the Stage** (Chrome, WebGPU, hls.js, real 2026-07-15 data, the 75° screen; this is the check T-31 left for T-32). The video tracked `t` within 0.15 s over 12 s, with no re-snaps after the first seek. From `?t=2686`, the Minister is on camera until about t 2693. A wide shot follows, and Sara Crowley, the Member the Record names at `startPos` 2694, is at the lectern by about t 2698. That matches the T-31 ffmpeg check. At 16x the screen is dark. Back at 1x it re-snaps to t, and Pause holds the frame.
- **Perf** (SwiftShader, reports only). Before: 48 frames in 30 s, p95 684.5 ms. After, with the real stream routed in: 49 frames, p95 667.5 ms. No measurable change; SwiftShader cannot meet the frame bars either way.

