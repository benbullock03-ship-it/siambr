---
id: T-10
title: "Dual-Mode Switcher, Multi-Door Citizen Entryway & Spatial Wayfinding Compass"
kind: ux
status: withdrawn
depends: [T-09]
---

# T-10 — Dual-Mode Switcher, Multi-Door Citizen Entryway & Spatial Wayfinding Compass

**What to build:**  
Implement the top-level HUD navigation suite: the persistent Dual-Mode Switcher (`3D Spatial Walkthrough` $\longleftrightarrow$ `2D Civic Register`), the Multi-Door Citizen Entryway, the 3D Wayfinding Compass with teleportation, and Curated Citizen Trails.

### Acceptance Criteria
- [ ] Persistent HUD mode switch button: toggles between 3D Spatial Walkthrough and 2D Civic Register while preserving the current debate/Member selection.
- [ ] Multi-Door Onboarding Entryway modal:
  1. **Enter by Your Area**: Welsh postcode input (or interactive map) looks up the citizen's Constituency and Regional MSs, teleporting the camera directly to their representative's physical desk.
  2. **Enter by Live Issue**: Keyword search for everyday concerns (e.g. *NHS waiting lists*, *20mph speed limits*, *school funding*) highlights relevant corridors and guides the player to related debates and petitions.
  3. **Enter Today's Chamber**: Takes the user straight to the circular Siambr displaying this week's plenary business.
- [ ] Spatial Wayfinding Compass (`$lib/hud/Compass.svelte`):
  - Fixed HUD compass indicating player orientation relative to the six policy wings.
  - Active search highlights matching plinths along the corridor with glowing trail beacons and a one-click "Teleport to Plinth" action.
- [ ] Curated Citizen Trails:
  - Guided step-by-step journeys (e.g. *The Path to 20mph*, *25 Years of Welsh NHS Devolution*) that guide the camera along sequential plinths.
- [ ] Mobile responsive: HUD scales gracefully on mobile devices without obscuring the viewport.

### Withdrawn under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: replaced by [T-18](T-18-stage-hud-transcript-and-transport.md) (stage HUD, front door is the latest sitting), [T-20](T-20-member-register-and-search.md) (find your Member by name or postcode), and [T-22](T-22-kiosk-attract-mode.md). The multi-door entryway, compass and Citizen Trails are not replaced.
