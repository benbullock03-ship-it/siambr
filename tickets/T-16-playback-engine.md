---
id: T-16
title: "The Sitting Clock: Pure TypeScript Playback Engine"
kind: frontend
status: pending
depends: [T-14]
---

# T-16 — The Sitting Clock: Pure TypeScript Playback Engine

**What to build:**  
The playback model for one sitting, with no Three.js or DOM dependency, in `frontend/src/lib/stage/`. Spec 2.0.0 section 4.2 and DOMAIN_MODEL.md section 3.2.

### Acceptance Criteria
- [ ] `timeline.ts`: `buildTimeline(sitting)` returns an ordered list of **beats**. A timed contribution is a beat spanning `[t_start, t_end_derived)`. A run of untimed contributions between two timed ones becomes a sequence of fixed 4 s beats inserted at the preceding timed contribution's end, and the preceding beat is shortened accordingly; untimed contributions before the first timed one sit at `t = 0`. Item boundaries, the first timed `t` and the last `t_end` are exposed. Division windows (T-19) are beats of kind `division`.
- [ ] `clock.ts`: a `SittingClock` class using Svelte 5 runes (`$state`) with `t`, `playing`, `speed` (1, 4, 16), `play()`, `pause()`, `seek(t)`, `stepContribution(+1|-1)`, `stepItem(+1|-1)`, `tick(dtSeconds)`. `tick` advances `t` by `dt * speed`, clamps at the end and pauses. Wall clock string derived from `meeting_start_time + t`.
- [ ] `floor.ts`: `floorState(timeline, t)` returns `{ live: beat | null, spokenMemberIds: Set<string>, division: DivisionBeat | null }` in O(log n).
- [ ] `vitest` fixtures: one real exported sitting (from T-14) and one synthetic sitting with untimed runs, negative-start rows and an empty item. Tests cover: beats sorted and non-overlapping; untimed beats never move `t` past the next timed start; seeking to `?t=` lands on the right live beat; stepping across item boundaries; end-of-sitting pauses.
- [ ] Keyboard map documented in the module: `Space`, `ArrowLeft/Right`, `Shift+Arrow`, `[`, `]`. Bound by T-18, not here.

**Notes:**
- Nothing in this module reads the DOM or three.js. It is the thing the whole stage hangs off, so keep it small and covered.
- `t_end_derived` is derived data. Any place it is surfaced to a visitor (T-18, T-21) badges it.
