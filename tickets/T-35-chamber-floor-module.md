---
id: T-35
title: "ChamberFloor Module: One Floor Rule, On-Demand Rendering"
kind: frontend
status: open
depends: [T-34]
---

# T-35 — ChamberFloor Module

**What to build:**  
One pure `ChamberFloor` module between the sitting clock and everything that draws the chamber, and a canvas that renders only when something changes. Today five `useTask` loops render every frame, paused or not, and the live desk is resolved in three places.

---

### Step 1 — ChamberFloor

- [ ] Built once per sitting from timeline, term, members and desks. `at(t)` returns `{ live, presidingId, seats, liveSeat, liveDesk, tint }`.
- [ ] Same object back while nothing but `t` changed; seats recomputed only when the presiding officer changes.
- [ ] One live-desk rule: a seated, non-presiding speaker's own desk, else Y Llywydd's place. Replaces `liveDeskId`, `Stage`'s `liveDesk`/`liveSeat` and the duplicate `deskByMember`/`seatByDesk` maps.

### Step 2 — On-demand rendering

- [ ] Canvas `renderMode: 'on-demand'`; every `useTask` sets `autoInvalidate: false` and invalidates only when it changed something.
- [ ] Frames are requested while playing, while a desk eases or a tint fades, on camera motion or input, in walk mode, and for new video frames.
- [ ] Desk colour buffers upload only when a colour changed.
- [ ] The halo holds steady while the clock is paused.

### Step 3 — DOM per frame

- [ ] `hud.anchor` / `hud.liveSpeakerAnchor` written only when they move more than 0.5 px.
- [ ] `Transcript` scrolls on beat change or content resize, not on every `t`.
- [ ] ScrubBar `aria-valuetext` updates once per sitting second.

### Gates
- Vitest: `ChamberFloor.at(t)` identity and the live-desk rule; Desks colour upload only on change.
- `e2e/perf.spec.ts`: play, pause, wait 3 s, rendered frames = 0 (dev-only counter on `window.__siambr`).
- `npm run check`, `npm test`, `npm run test:a11y`.

**Notes:**
