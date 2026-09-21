---
id: T-35
title: "ChamberFloor Module: One Floor Rule, On-Demand Rendering"
kind: frontend
status: done
depends: [T-34]
---

# T-35 — ChamberFloor Module

**What to build:**  
One pure `ChamberFloor` module between the sitting clock and everything that draws the chamber, and a canvas that renders only when something changes. Today five `useTask` loops render every frame, paused or not, and the live desk is resolved in three places.

---

### Step 1 — ChamberFloor

- [x] Built once per sitting from timeline, term, members and desks. `at(t)` returns `{ live, presidingId, seats, liveSeat, liveDesk, tint }`.
- [x] Same object back while nothing but `t` changed; seats recomputed only when the presiding officer changes.
- [x] One live-desk rule: a seated, non-presiding speaker's own desk, else Y Llywydd's place. Replaces `liveDeskId`, `Stage`'s `liveDesk`/`liveSeat` and the duplicate `deskByMember`/`seatByDesk` maps.

### Step 2 — On-demand rendering

- [x] Threlte's default `on-demand` render mode is kept; every `useTask` except walk mode sets `autoInvalidate: false` and invalidates only when it changed something. Static `InstancedMesh`es take `update={false}`: with it on, extras rebuilds and invalidates every frame.
- [x] Frames are requested while playing, while a desk eases or a tint fades, on camera motion or input, in walk mode, and for new video frames.
- [x] Desk colour buffers upload only when a colour changed.
- [x] The halo holds steady while the clock is paused.

### Step 3 — DOM per frame

- [x] `hud.anchor` / `hud.liveSpeakerAnchor` written only when they move more than 0.5 px.
- [x] `Transcript` scrolls on beat change or content resize, not on every `t`.
- [x] ScrubBar `aria-valuetext` updates once per sitting second.

### Gates
- Vitest: `ChamberFloor.at(t)` identity and the live-desk rule; Desks colour upload only on change.
- `e2e/idle.spec.ts` (`npm run test:idle`, gating in `deploy.yml`): play, pause, settle, then 3 s with no frames drawn (dev-only counter on `window.__siambr`).
- `npm run check`, `npm test`, `npm run test:a11y`.

**Notes:**

Done 2026-09-21.

- **ChamberFloor** (`lib/stage/chamberFloor.ts`) holds the presiding spans and one seating per presiding officer. `at(t)` returns `{ floor, presidingId, seats, liveSeat, liveDesk }` and the same object while nothing shown changes. `Stage` derives `view = chamber.at(clock.t)` and passes it to the scene. Deleted: `floorLight.liveDeskId`, `Stage`'s `liveDesk`/`liveSeat`/`deskByMember`, `Desks`' `deskByMember`. One behaviour change: with no presiding officer resolved, the Stage's camera used to frame nothing for a dais speech; it now frames Y Llywydd's place, as the floor light always did.
- **Steady floor.** `steadyFloor` in `floor.ts` returns the previous `FloorState` when live beat, spoken set, division and tint are unchanged; `clock.floor` uses it, so its many readers wake on a beat change, not every frame.
- **Tasks.** Scene: a frame per tick only while the clock plays. Desks: colour buffers repaint on easing, tint or seat change; halo steady while paused. DivisionDisplays: redraw or face change. ChamberScreen: new video frame. GuidedCamera: pose change. Walker keeps drawing every frame.
- **DOM.** `SiambrState.place()` writes an anchor only past 0.5 px or on a visibility change. `Transcript` measures its scroll range with a `ResizeObserver` and writes `scrollTop` only when the rounded value changes; it never reads layout on a tick. `ScrubBar`'s `aria-valuetext` is derived from whole seconds.
- **Numbers** (`vite preview`, production build, headless Chromium on SwiftShader, `/sitting/2026-07-14`, CDP metrics over 5 s):
  - Paused: main-thread task time 5,092 ms → 85 ms.
  - Playing: 5,800 ms → 5,774 ms (SwiftShader draws every frame while the clock runs); layouts 8 → 6.
  - The idle gate fails with the scene task's `autoInvalidate` set back to true (95 → 105 frames while paused).
- **Tests.** The camera e2e test now waits for the drawer's slide-in before measuring it: with the main thread free, the check ran mid-animation.
- **Gates.** `npm run check` 0 errors; `npm test` 31 files, 308 passed; `check_prose` 0 findings; page budget largest 7,489 B; a11y + stage + screen-video + idle e2e 36 of 36 with 2 workers (HEAD failed 2 screen-video tests under the same load). Suite time 6.1 → 4.5 min.
