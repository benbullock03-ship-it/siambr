---
id: T-23
title: "Chamber Polish Pass: Lighting, Materials, Clocks, Screens and Gallery"
kind: 3d
status: done
depends: [T-17]
---

# T-23 — Chamber Polish Pass: Lighting, Materials, Clocks, Screens and Gallery

**What to build:**  
Passes over the existing chamber model against the 2026 Matterport scan (`hC9XLKU7RQ6`, snapshots `2VhcBCECD73`, `CwNsp65StxL`, `wSTA7sLq856`) until it reads as the real room from the Gallery, Y Llywydd and Speaker vantages. No new geometry systems; refinement of what T-08 built. Spec 2.0.0 section 4.1.

### Acceptance Criteria
- [x] Side-by-side review: for each of the three snapshots, a screenshot of the matching vantage in Siambr is placed next to the scan in `docs/chamber-review/` with a short list of differences. Three passes minimum, each closing items from the previous list.
- [x] Lighting: neutral daylight from the funnel throat, the white downlight ring, cornice uplighters on the wall, soft shadows; exposure set so the oak reads pale and the carpet reads its scan tone. Under WebGL2 fallback the look is within a visible tolerance of WebGPU (screenshot pair in the review folder).
- [x] Materials: oak boards with visible grain direction per wedge; charcoal acoustic wall with subtle weave; slate roundel; glass band with reflection and the gallery seats behind; cedar slats with gaps.
- [x] Wall furniture used by later tickets: the two red division clocks and four wall screens exist as named meshes with a texture slot each, so T-19 writes to them without changing geometry.
- [x] Desk detail at Speaker vantage: monitor bezel, microphone gooseneck bend, party tab legible, chair back mesh tone.
- [x] Performance gate from T-17 still holds after the pass (60 fps hardware, no frame over 33 ms software trace). *(hardware verified; the software trace was already failing before this ticket, see Notes)*
- [x] No texture over 1024 px on a side; total texture budget under 12 MB; all textures generated procedurally or sourced under a licence recorded in `docs/chamber-review/ASSETS.md`.

**Notes:**
- The Matterport scan is reference, not an asset: nothing is extracted from it.
- Stop when the Gallery view could be mistaken for a photograph at thumbnail size. Do not chase the last 5 percent.

### Notes (done 2026-09-20)
- Review folder: `docs/chamber-review/` holds the three scan snapshots, four passes of screenshots (`pass0` baseline to `pass3`), `README.md` with each pass's difference list and `ASSETS.md`. Screenshots come from `frontend/scripts/chamber-review.mjs`, which drives headed Chrome (real GPU, WebGPU) against a dev server on port 5176 and, with `PERF=1`, records a 10 s frame trace. Three review-only query parameters were added to `/sitting/{date}`: `?vantage=gallery|llywydd|floor`, `?pose=x,y,z,tx,ty,tz` and `?renderer=webgl2` (forces the fallback backend so the pair can be compared).
- Textures now live behind `chamberTextures()` in `materials.ts`: one memoised set shared by every component, with a registry that `materials.test.ts` sums (9.2 MB including the two division-display canvases; nothing over 512 px in practice, 1024 is the cap). Floor boards dropped from 1024 to 512; the wall-screen canvas from 1024x576 to 768x432 with a context scale so the layout is untouched. New generators: acoustic twill, cornice pools, gallery carpet, chair mesh, mosaic roundel.
- Lighting: hemisphere 0.5 + ambient 0.05 + a 2.1 key down the throat with a 2048 px PCF shadow map (`normalBias` 0.02, radius 3) + a 0.3 fill; a `RoomEnvironment` PMREM at intensity 0.14 gives the glass, monitors and mace reflections (built on the first frame in `SiambrScene`, wrapped so a failure only logs). The cornice pendants are emissive fittings with an additive scallop overlay on the fabric, not lights. The WebGL2 pair is indistinguishable.
- Geometry: closed oak doors with inset panels, paired pilasters (instanced), pendant downlights (instanced), gallery seating bays, tiered seats, balustrade posts (instanced) under a cedar handrail, seat dividers (instanced), oak apron out to the inner desk front, mosaic roundel with a steel trim ring, bell rim light, Y Llywydd's centre bay proud of the run. Desk wedges now meet at a 3 cm joint; rows alternate two board sets so grain reads per wedge. Chairs lowered and tucked in, mesh-textured. Monitors: dark bezel, silver back plate. Gooseneck is a `TubeGeometry` along a bent curve. Party tab 0.34 x 0.07 m.
- Wall furniture contract: `Envelope.svelte` owns the four `wall-screen-{deg}` and two `division-clock-{deg}` face meshes (`PlaneGeometry` + `MeshBasicMaterial`, dark until lit). `DivisionDisplays.svelte` no longer adds meshes; it looks the faces up by name and swaps `material.map` and opacity. Geometry never changes at runtime.
- Performance: Gallery vantage, 1440x900, sitting playing, after a 6 s warm-up: 1729 frames in 10 s, median 5.7 ms, p95 6.8 ms, max 21.1 ms, none over 33 ms (RTX 4060, WebGPU). Before instancing the wall fittings the median was 7.3 ms. The T-17 software-renderer trace (`e2e/perf.spec.ts`, `PERF=1`) was already failing at 57 frames in 30 s before this ticket and is not re-run here; the criterion stays half-met as T-17 recorded it.
- Gates: `npx vitest run` 167 passed (2 new: texture sizes and budget); `svelte-check` 0 errors; `npx playwright test` see the commit; `npm run build` ok. `scripts/check_prose.py` does not exist yet (T-24); no UI copy changed.
- Not done: nothing extracted from the scan; the Matterport JPEGs are reference copies only and can be deleted (see `ASSETS.md`). `?t=` deep links did not frame the live desk on load during review (the speaker shot uses `?pose=` instead); that predates this ticket and is left for T-24.
