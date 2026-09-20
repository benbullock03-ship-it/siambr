---
id: T-17
title: "Chamber Stage: Floor Light, Spoken Marks and the Guided Camera"
kind: 3d
status: pending
depends: [T-16, T-08]
---

# T-17 — Chamber Stage: Floor Light, Spoken Marks and the Guided Camera

**What to build:**  
Make the chamber respond to the clock and give it a camera that works on a kiosk. Spec 2.0.0 sections 4.3 to 4.5.

### Acceptance Criteria
- [ ] `Desks.svelte` takes `floor: FloorState` from T-16. The live Member's desk gets the floor light: worktop instance colour warms, monitor screen instance brightens, and a soft additive disc on the carpet behind the chair. Y Llywydd's desk lights when the live speaker is the Presiding Officer, the Deputy, or unseated. Members in `spokenMemberIds` get a warmed party tab. All via per-instance colour; no per-desk meshes added.
- [ ] Transitions ease over 300 ms; under `prefers-reduced-motion` they cut.
- [ ] `controls/guided.svelte.ts`: a camera rig with four vantage points (Gallery, Y Llywydd, Floor, Speaker) defined in `chamber/layout.ts` coordinates, `follow` toggle, `frameDesk(desk)`, orbit and zoom limits that keep the camera inside the envelope. Speaker view frames the live desk three-quarter over the shoulder toward the dais; on speaker change with `follow` on it eases (600 ms, cubic) to the new desk; with `follow` off it stays.
- [ ] Click or tap a desk: frames it, shows the nametag, second click opens the Member plate. Touch: single tap frames, tap the nametag button opens.
- [ ] Walk mode: the existing `Player` stays behind a `walk` toggle. Entering walk places the walker at the spawn; leaving it returns to the last guided vantage. Pointer lock only in walk mode. Walk toggle hidden under reduced motion and kiosk.
- [ ] `SiambrScene.svelte` composition: Lighting, Floor, Funnel, Envelope, Dais, Desks, one of GuidedCamera or Walker. Nothing else.
- [ ] Performance gate: Gallery view, 96 seats, floor light active, 60 fps on the dev machine's integrated GPU (Chrome, WebGPU) and no frame over 33 ms in a 30 s Playwright trace on the software renderer at 30 fps.
- [ ] `vitest` on the rig: vantage positions inside the envelope; `frameDesk` yields a camera looking at the desk; orbit limits clamp.

**Notes:**
- Desk ids to instance ids already map through `seats` order; keep that contract.
- Division tints are T-19, on the same instance-colour path. Leave a hook: `floor.division` is accepted and ignored here.
