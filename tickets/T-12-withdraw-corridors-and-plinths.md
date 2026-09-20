---
id: T-12
title: "Withdraw Corridors, Plinths, Trails and Quotation Cards"
kind: cleanup
status: done
depends: [T-09]
---

# T-12 — Withdraw Corridors, Plinths, Trails and Quotation Cards

**What to build:**  
Remove everything that is not the chamber or the Register, so the stage work in T-15 to T-18 starts from a small base. Spec 2.0.0 section 4: "The 3D surface is the Siambr debating chamber and nothing else."

### Acceptance Criteria
- [x] Frontend: delete `src/lib/3d/corridors/` (layout, textures, stream, Plinths, Ambulatory, Corridor, Corridors, tests). Remove `Corridors` from `SiambrScene.svelte`; remove plinth props, plinth raycasting and `plinthFocus`/`whereabouts` from `Walker.svelte`, `state.svelte.ts` and `SiambrHud.svelte`; remove `standBefore`, `wings`, `wingSummaries`, `ChunkStream` and `corridorColliders` from the `/siambr` route and its `+page.ts`. The chamber still renders, walks, picks desks and opens the Member plate.
- [x] Frontend: delete `src/lib/hud/JourneyTrack.svelte`, `src/lib/dossier/journey.ts` and its test; `DossierPlate.svelte` renders without the track. Delete `/register/compare` and `TwoPlates.svelte` and the Compare checkboxes in `/register`.
- [x] Frontend: remove `wings()` and `plinths()` from the API client and the `Plinth`/`WingSummary` types.
- [x] Backend (dev-only from here): delete `backend/routes/plinths.py` and its tests.
- [x] Pipeline: delete `pipeline/bake_spatial_buffers.py`, `pipeline/spatial.py` and their tests. Migration `005_withdraw_corridors.sql` drops `spatial_plinths`, `citizen_trails`, `citizen_trail_stops`. `policy_domains.wing_label` and `bearing_degrees` stay as unused columns (no destructive column drop) and are no longer read anywhere.
- [x] `static/buffers/` removed if present.
- [x] `npx vitest run`, `npx playwright test`, `python -m unittest` all green after removal; no reference to `plinth`, `corridor`, `wing`, `trail` or `journey` remains in `frontend/src`, `backend` or `pipeline` except the withdrawal migration.
- [x] `DESIGN.md` reviewed for corridor or plinth language; any found is removed.

**Notes:**
- Do not touch `src/lib/3d/chamber/`, `materials.ts`, `controls/` or the drawers beyond removing corridor imports. T-16 builds on them.

### Notes (done 2026-09-20)
- Deleted: `frontend/src/lib/3d/corridors/` (8 files), `hud/JourneyTrack.svelte`, `dossier/journey.ts` + test, `register/TwoPlates.svelte`, `/register/compare`, `backend/routes/plinths.py`, `pipeline/bake_spatial_buffers.py`, `pipeline/spatial.py`, `tests/test_spatial_buffers.py`, root `static/buffers/`, the ad hoc `frontend/_shots.mjs`.
- The chamber wall's three doorways and the arc-splitting helpers lived in `corridors/layout.ts`; they now live in `chamber/layout.ts` as `CHAMBER_DOORS`, `wallSegments`, `chamberWallSegments`, `isInOpening` (three ported tests). The `box` collider kind and `Player.setDynamicColliders` went with the plinths; the walker's outer limit is `walkRadius(0)` again and the chamber wall arcs are its colliders, so the doorways are closed to walking.
- `speechAnchor`/`divisionAnchor` moved from `journey.ts` to `$lib/dossier/anchors.ts`; the Dossier Plate is title, Senedd TV link, petitions, speech stack, divisions, citation.
- `types/siambr.ts`: `WingId` became `PolicyDomainId` (`health`, `transport`, `economy`, `education`, `communities`, `devolution`, matching `pipeline/seed.py`); `SpatialPlinth` removed.
- Migration `005_withdraw_corridors.sql` drops `spatial_plinths`, `citizen_trail_stops`, `citizen_trails`; applied to `data/siambr.db`. `policy_domains.wing_label` and `bearing_degrees` are still `NOT NULL` from 001 and a column drop is disallowed, so `pipeline/seed.py` still writes them (the only remaining mention of "wing" outside the migrations); nothing reads them.
- `/siambr?item=` still opens the Dossier Plate over the chamber (drawer, no placement). `?member=` unchanged.
- Gates: `npx vitest run` 64 passed (9 files); `npx playwright test` 10 passed; `python -m unittest` 87 passed (backend 23, pipeline 64); `svelte-check` 0 errors. `DESIGN.md` had no corridor or plinth language; its frontmatter description now names the stage.
- Git repository initialised here (the RUN-PROMPT commits one per ticket from T-12), root `.gitignore` kept: `data/*.db` and `data/bronze/*` stay ignored until T-15 decides what sync commits.
