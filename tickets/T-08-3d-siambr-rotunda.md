---
id: T-08
title: "3D Siambr Debating Chamber, Cedar Ceiling Funnel, and 60 Member Desks (Threlte)"
kind: 3d
status: done
depends: [T-07]
---

# T-08 — 3D Siambr Debating Chamber, Cedar Ceiling Funnel, and 60 Member Desks (Threlte)

**What to build:**  
Implement the 3D Siambr rotunda using Threlte 8 and Three.js in SvelteKit 5. Models the debating chamber with its inverted Western red cedar ceiling funnel, limestone floor, Llywydd dais, and 60 physical Member of the Senedd desks.

### Acceptance Criteria
- [x] Threlte 3D canvas initialized at route `/siambr` with WebGPU renderer and automatic WebGL2 fallback.
- [x] Procedural architectural model of the Siambr rotunda:
  - Circular limestone floor (`--color-ground`).
  - Inverted ceiling funnel with Western red cedar timber ribs (`--color-timber-cedar`).
  - Raised dais for Y Llywydd (Presiding Officer) and chamber clerks.
  - Semicircular tiered amphitheater arraying 60 physical Member desks.
- [x] First-person player controller:
  - Desktop: WASD / Arrow keys for walking, mouse drag / pointer lock for looking.
  - Touch / Mobile: Virtual touch joystick and tap-to-teleport floor grid.
  - Smooth collision detection preventing player from walking through walls or desks.
- [x] Member desk interaction:
  - Stepping within 2.5m of an MS desk highlights their position and displays a floating slate nametag (Member name, party badge, constituency).
  - Clicking or pressing `E` opens the Dossier Plate displaying that Member's speeches and voting history.
- [x] Graceful fallback: If WebGL context creation fails or device reports low memory, automatically redirects to the 2D Register mode (`/register`).

### Note from Ben
- look here for detailed reference guide of senned https://senedd.wales/visit/things-to-do/virtual-tour/ could not be a better source if you tried

- this is the make or break step

**Notes:**
- **Desk count follows the term, not the ticket.** The chamber was rebuilt in spring 2026 for 96 Members (rear panels and steps removed; Senedd reform FAQ). `parliamentary_terms.seat_count` drives `buildDesks()`: 60 seats fill four tiers, 96 fill five. Today's chamber shows the Seventh Senedd with 96 desks and 96 seated Members.
- **Reference geometry** came from the Matterport tour (model `hC9XLKU7RQ6`, floors 1–3 dollhouse scans): concentric tiers around a slate roundel, three radial aisles, gallery ring above a glass band, cedar bell over the centre with a throat rising to the cowl. Chamber plan is procedural in `frontend/src/lib/3d/chamber/layout.ts` (bearings clockwise from north = −Z, matching the six wing bearings; dais at 0°, amphitheatre opening south).
- **Seating is derived, never official.** No open-data seating plan exists, so `assignSeats()` places contiguous party wedges (largest party at Y Llywydd's left, alphabetical within party) and stamps `PROVENANCE_DERIVED`. The HUD carries the notice "Desk positions arranged by Siambr engine — not the official seating plan."
- **Plan from the 2026 dollhouse** (Matterport `hC9XLKU7RQ6`, floor 1): a plain oak-boarded well 3.6 m in radius (no roundel) with a carpet ring before the first row, Y Llywydd's desk at its edge and the clerks inside it; four rows of separate 1 m-deep oak desk wedges (0.12 m gaps, merged per row for drawing) at 4.9/6.9/8.9/10.9 m wrapping 20°–340°, the inner row stopping at 50°–310° to leave Y Llywydd clear; oak radial aisles at 45°, 135° and the wide western entrance aisle at 270° (the spawn); carpet between rows; wall at 12.6 m; no screen wall behind Y Llywydd. 60 seats fill three rows, 96 fill four. `SPAWN_BEARING_DEG` and `rowArc()` in `layout.ts` carry this.
- **Y Llywydd presides from the dais, not a Member desk.** Migration `004_presiding_officers.sql` adds `presiding_officers` (term, member, office, dates, provenance, source_url) with the Seventh Senedd's Llywydd and Deputy Presiding Officer cited to the senedd.wales announcement of 12 May 2026; `GET /api/terms` returns them per term. `llywyddOf()` picks the open Llywydd, `assignSeats()` skips them, and `llywyddDesk()` gives their place at the dais so the nametag (headed "Y Llywydd · Presiding Officer") and record work there too; a hidden box over the whole desk is the pick target. The HUD names Y Llywydd.
- **Picking**: Threlte's `InstancedMesh` disables raycast on the three mesh and raycasts each `<Instance>` instead, so the walker intersects the worktop insets recursively (`intersectObject(mesh, true)`), and the nametag follows the desk under the pointer or crosshair within 6 m before falling back to the nearest desk within 2.5 m.
- **Visual pass from the 2026 chamber scan.** The Matterport model on the virtual-tour page (`hC9XLKU7RQ6`, "Senedd Debating Chamber 2026", rescanned 5 Aug 2026) now includes the refit Siambr itself; snapshots `2VhcBCECD73` (well and tiers), `CwNsp65StxL` (Y Llywydd's desk with the mace slot) and `wSTA7sLq856` (gallery) set the look. From them: pale oak floorboards on a kerbed well with the blue-on-slate mosaic roundel; carpeted tiers; oak desk wedges (`deskRunGeometry()`, a lathe of the desk section with end caps) carrying a charcoal worktop inset, pop-up monitor, gooseneck mic and the party tab; high-back charcoal task chairs; a chamber wall of charcoal acoustic fabric between oak pilasters with cornice uplighters, four wall screens, two oak doors and the two red division clocks; a dark cedar-slat gallery fascia under full-height glass with tiered public seats behind; a white ceiling ring of downlights under the cedar bell; neutral daylight. Y Llywydd's desk is a taller oak run on a low platform with the mace in its slot; the clerks' run sits in front with three monitors. Render tones live in `TIMBER`/`CHAMBER_TONES` (`materials.ts`), sampled from the scan rather than the UI tokens. Raycasting keeps one invisible instanced box per desk (`instanceId` → `desks[i]`).
- **WebGPU verified on hardware**: Chrome on this machine brings up three's WebGPU backend (NVIDIA adapter), HUD reads "WebGPU", 241 fps at 1440×900, no console errors. Threlte's default `PCFSoftShadowMap` is not available under WebGPU, so the Canvas passes `PCFShadowMap`.
- **Renderer**: `@threlte/core/webgpu` Canvas with three's `WebGPURenderer`; it drops to its WebGL2 backend on its own and the HUD reports the backend that actually initialised. A failed `init()` routes to `/register?from=siambr&reason=no-webgl`. `prefers-reduced-motion`, no WebGL2/WebGPU, or `navigator.deviceMemory < 2` redirect before any 3D module loads (`capability.ts`); the Register never loads three.
- **Controls** (`controls/player.svelte.ts`, pure and unit-tested): WASD/arrows, Shift to hurry, click for pointer lock or drag to look, `E` or tap/click on a desk to open the Member. Touch shows a joystick and tap-to-teleport onto the limestone grid; teleport targets are rejected unless a walker fits there. Collision resolves discs against merged tier arcs, the dais, the clerks' table, the screen behind the dais and the wall.
- **API extended**: `GET /api/terms`; `GET /api/members?current=true` (open tenure in the open term, because the registry still carries never-closed tenures from terms 1–5); `GET /api/members/{id}/record` (verbatim speeches and roll-call ballots, newest first, with agenda-item links back to the Register).
- **Member Dossier Plate** (`$lib/hud/MemberPlate.svelte`) shares the drawer shell (`$lib/hud/Drawer.svelte`, extracted from the T-07 plate) so focus trapping and Escape behave identically. Deep link: `/siambr?member=<id>`. Ballots are empty until T-05 lands `member_votes`.
- **Gates**: `npx vitest run` (67 tests incl. layout, desk geometry, collision, seating, controller, capability), `python -m unittest backend.tests.test_api` (23), `npx playwright test` (10, axe WCAG 2.2 AA on the chamber HUD and Member plate, plus the three fallback redirects). Headless Chromium renders the chamber under SwiftShader WebGL2.
- Local dev: port 8000 was taken by another project on this machine; run FastAPI on another port and start Vite with `API_ORIGIN=http://127.0.0.1:<port>`.

### Amendment under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: the chamber is now the whole 3D product. First-person walking becomes an **opt-in walk mode**; the default is the guided camera ([T-17](T-17-chamber-stage-floor-light-and-guided-camera.md)). The `/siambr` route is replaced by `/sitting/[date]` ([T-18](T-18-stage-hud-transcript-and-transport.md)). The `/api/*` endpoints listed above are dev-only after [T-14](T-14-static-export-and-data-layer.md). Everything in the Notes about geometry, seating provenance, picking and the renderer still holds and is the base for T-17 and [T-23](T-23-chamber-polish-pass.md).
