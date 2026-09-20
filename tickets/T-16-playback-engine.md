---
id: T-16
title: "The Sitting Clock: Pure TypeScript Playback Engine"
kind: frontend
status: done
depends: [T-14]
---

# T-16 — The Sitting Clock: Pure TypeScript Playback Engine

**What to build:**  
The playback model for one sitting, with no Three.js or DOM dependency, in `frontend/src/lib/stage/`. Spec 2.0.0 section 4.2 and DOMAIN_MODEL.md section 3.2.

### Acceptance Criteria
- [x] `timeline.ts`: `buildTimeline(sitting)` returns an ordered list of **beats**. A timed contribution is a beat spanning `[t_start, t_end_derived)`. A run of untimed contributions between two timed ones becomes a sequence of fixed 4 s beats inserted at the preceding timed contribution's end, and the preceding beat is shortened accordingly; untimed contributions before the first timed one sit at `t = 0`. Item boundaries, the first timed `t` and the last `t_end` are exposed. Division windows (T-19) are beats of kind `division`.
- [x] `clock.ts`: a `SittingClock` class using Svelte 5 runes (`$state`) with `t`, `playing`, `speed` (1, 4, 16), `play()`, `pause()`, `seek(t)`, `stepContribution(+1|-1)`, `stepItem(+1|-1)`, `tick(dtSeconds)`. `tick` advances `t` by `dt * speed`, clamps at the end and pauses. Wall clock string derived from `meeting_start_time + t`.
- [x] `floor.ts`: `floorState(timeline, t)` returns `{ live: beat | null, spokenMemberIds: Set<string>, division: DivisionBeat | null }` in O(log n).
- [x] `vitest` fixtures: one real exported sitting (from T-14) and one synthetic sitting with untimed runs, negative-start rows and an empty item. Tests cover: beats sorted and non-overlapping; untimed beats never move `t` past the next timed start; seeking to `?t=` lands on the right live beat; stepping across item boundaries; end-of-sitting pauses.
- [x] Keyboard map documented in the module: `Space`, `ArrowLeft/Right`, `Shift+Arrow`, `[`, `]`. Bound by T-18, not here.

**Notes:**
- Nothing in this module reads the DOM or three.js. It is the thing the whole stage hangs off, so keep it small and covered.
- `t_end_derived` is derived data. Any place it is surfaced to a visitor (T-18, T-21) badges it.

### Notes (done 2026-09-20)
- Module: `frontend/src/lib/stage/` with `timeline.ts`, `floor.ts`, `clock.svelte.ts` (runes need the `.svelte.ts` suffix; the ticket said `clock.ts`), `keys.ts` (the keyboard map as data plus `keyboardAction`/`applyAction` for T-18 to bind) and test-only `fixtures.ts`. Nothing imports the DOM or three.js.
- Real data does not run in clip order: seven of the seventeen Seventh Senedd sittings have a timed contribution whose `startPos` is lower than the Record-preceding one (e.g. 19 May 2026 item 3 seq 44 at 3901 s, seq 45 at 3868 s) and five have two contributions sharing a `startPos`. Beats are therefore sorted by `t_start` (Record order as tiebreak), never by Record order; the running order (T-18) keeps Record order from the sitting file. Tied starts split the span to the next start equally so both are live for a while; `t_end_derived` in the export is the next greater start for both, so for a tied beat `tEnd` differs from `t_end_derived`. Tested on 15 September 2026 (5248 s twice).
- Inserted beats (untimed rows at 4 s, divisions at 20 s) attach to the Record-preceding timed contribution and are cut from the end of its beat. They never take more than half the gap to the next timed start, so the timed contribution always holds the floor for at least half its span; a shorter gap scales the inserts proportionally. Untimed rows before the first timed one take `min(4 s each, first start)` from t = 0. The sitting's last timed beat has no next start and is 4 s long, with trailing inserts at full length after it; `Timeline.tEnd` is that end. All of this is derived and `Timeline.provenance` names it.
- A negative `startPos` is untimed (none in the current export; the synthetic fixture covers it). An empty item is a boundary at the previous item's end with `beatCount: 0`; stepping skips it. Division beats are built now (`kind: 'division'`, `placement: PROVENANCE_DERIVED`) so T-19 only needs real division rows.
- `floorState` is O(log n): binary search for the live beat; spoken Members via a per-timeline first-speak index and a cached Set that is only rebuilt when the count changes (WeakMap keyed by the timeline object). A zero-length beat (only possible when the first timed contribution starts at 0) never holds the floor.
- `SittingClock`: `t`, `playing`, `speed` are `$state`; `floor`, `wallClock`, `atEnd` are `$derived` assigned in the constructor (class-field `$derived` referencing `this.timeline` fails svelte-check with "used before its initialization"). Starts paused at `firstTimedT`. `tick` ignores non-positive dt, clamps at `tEnd` and pauses; `play()` at the end is a no-op. Stepping moves by distinct beat/item start, so tied beats are stepped as one; stepping back from the end lands on the last beat.
- Fixtures: the real 12 May 2026 sitting (27 timed contributions, no untimed, 2 items) and 15 September 2026 (279 contributions, 12 untimed, ties and out-of-order starts) are imported straight from `frontend/static/data/sittings/`; the synthetic sitting has untimed runs, a squeezed run, a negative start, an empty item, a division and trailing untimed rows.
- Gates: `npx vitest run` 101 passed (35 new); `svelte-check` 0 errors; `python -m unittest` 114 passed; `python -m pipeline.run_checks` 6/6 ok; `npm run build` ok; no `/api/` in `frontend/src`; `npx playwright test` 11 passed on a clean run; the first run, taken while `npm run build` was running in parallel, lost the dossier test to an axe "Execution context was destroyed" navigation race (10/11), which did not recur. No e2e change in this ticket.

