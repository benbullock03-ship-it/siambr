---
id: T-09
title: "Six Longitudinal Temporal Corridors, Slate Plinths & 50m Frustum Streaming (60fps)"
kind: 3d
status: withdrawn
depends: [T-08]
---

# T-09 — Six Longitudinal Temporal Corridors, Slate Plinths & 50m Frustum Streaming (60fps)

**What to build:**  
Extend the 3D space by generating the six radial policy wings projecting out from the Siambr rotunda. Place physical slate-and-cedar debate plinths along the temporal corridors according to the depth formula, and implement 50m frustum chunking to lock framerates at 60fps across 25 years of data.

### Acceptance Criteria
- [x] Six architectural corridors generated along cardinal angles:
  1. Health & Social Care ($0^\circ$ North)
  2. Climate Change & Transport ($60^\circ$ North-East)
  3. Economy & Welsh Tax ($120^\circ$ South-East)
  4. Education & Welsh Language ($180^\circ$ South)
  5. Housing & Social Justice ($240^\circ$ South-West)
  6. Devolution & Constitution ($300^\circ$ North-West)
- [x] Longitudinal temporal placement: debate plinths positioned along the corridor length using $Z_{\text{depth}} = 15 + \Delta\text{Years} \times 4\text{m}$.
- [x] Debate Plinth Monolith:
  - Slate body with cedar top.
  - Carved Lora debate title and JetBrains Mono date/division result.
  - Interactive highlight on approach ($< 3\text{m}$); pressing `E` opens the Dossier Plate for that debate.
- [x] High-Performance Spatial Optimization:
  - Instanced mesh rendering for all plinth bodies.
  - 50m visibility frustum chunking: only plinths in the current and adjacent 50m chunks are actively drawn.
  - Text textures and media tags stream dynamically from IndexedDB / API as the player moves.
- [x] Performance benchmark: 60fps sustained on mid-tier hardware across all corridors.

**Notes:**
- **Where the corridors leave the chamber.** The Siambr wall (12.6 m) is closed except for three doorways (45°, 135°, and the wide western entrance at 270°); they open onto an ambulatory ring under the public gallery (12.6–16.5 m, slate floor at the chamber ramp's wall height, the gallery floor as its soffit). The six corridor portals are cut in the ambulatory's outer wall on the wing bearings, each with a slate lintel carved with the wing's name in both languages. `corridors/layout.ts` carries the plan; `wallSegments()` cuts both walls and yields the arc colliders, so the walker leaves the chamber through a doorway, never through the wall. Each hall is wider than its portal, so its shell runs 2 m back behind the curved ambulatory wall to close the gap at the outer lanes.
- **Depth is the record's date, nothing else.** `pipeline/spatial.py` implements `Z = 15 + [(2026 − year) + (365 − dayOfYear)/365.25] × 4 m` with the epoch pinned to 2026.0 as the spec fixes it; `python -m pipeline.bake_spatial_buffers` writes every agenda item into `spatial_plinths` (chunk = ⌊depth/50⌋, importance = 1 + speeches + 5 × divisions) and a manifest to `static/buffers/corridors/manifest.json`. `depthForDate()` in the frontend is the same formula, unit-tested against the same dates.
- **Lanes, because weeks are 8 cm apart.** At 4 m per year consecutive sittings in one wing would overlap, so plinths are never moved in time; they pack into six lanes either side of the walkway (nearest first), and each lane outward stands 0.28 m taller so the rows read as tiers. A wing so dense that every lane is taken shares the freest lane (`place_plinths`, tested). Corridor half-width follows from the lane count, mirrored in `CORRIDOR` on the client.
- **Plinths**: one raw three `InstancedMesh` for the slate bodies and one for the cedar caps, capacity 4096, matrices rewritten only when the visible set changes; the body mesh is the raycast target (`instanceId` → `visible[i]`). Faces are canvas textures (Lora title, JetBrains Mono date and division, a small item-type/origin badge in incised lettering) bound only within 8 m through a 96-entry LRU (`FaceCache`); year bands on the pilasters share one texture per year across all wings. Approach within 3 m gives the cedar glow ring and box; `E`, click or tap opens `?item=<id>`, which renders the T-07 Dossier Plate on the `/siambr` route and, on first load, stands the visitor in front of that plinth (`Player.placeAt`).
- **Streaming**: `ChunkStream` serves 50 m chunks memory → IndexedDB (`siambr-corridors`, 6 h max age, schema-versioned) → `GET /api/plinths/{wing}?chunk=n`. From the rotunda every wing's chunk 0 is drawn (the mouths are visible through the portals); inside a corridor only that wing's current and adjacent chunks are (`visibleChunks`, tested). The walker's colliders for plinths follow the visible set (`Player.setDynamicColliders`).
- **API**: `GET /api/plinths/wings` (per-wing counts and chunk histogram) and `GET /api/plinths/{wing}[?chunk=]` (position, title, date, speech count, first division; `classification_provenance: PROVENANCE_DERIVED` because the wing follows the derived policy domain). The e2e fixture bakes plinths and adds a 2003 item so the fixture spans chunks 0 and 2.
- **Performance**: on this machine (WebGPU, NVIDIA, 1440×900) the chamber held its T-08 frame rate with all six corridors mounted; per corridor the static shell is ~60 draw calls plus two instanced meshes. Under headless SwiftShader the whole scene still renders for the axe checks. A 60 fps run on a real mid-tier GPU has not been measured here.
- **Gates**: `npx vitest run` (82 tests, incl. corridor layout, chunk streaming, wall segmentation, box colliders), `python -m unittest discover tests` (bake, depth formula, lane packing) and `python -m unittest backend.tests.test_api` (31, incl. the plinth routes), `npx playwright test` (11: a debate deep link opens the dossier, stands the visitor in the Health wing and passes axe; HUD counts the wing plinths).

### Withdrawn under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: corridors, plinths, wings, temporal depth and chunk streaming are removed from the product. The code is deleted by [T-12](T-12-withdraw-corridors-and-plinths.md). This ticket is kept for the record of what was built.
