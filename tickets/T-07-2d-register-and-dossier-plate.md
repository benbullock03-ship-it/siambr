---
id: T-07
title: "2D Civic Register, The Debate Journey Track, and The Dossier Plate HUD Drawer"
kind: frontend
status: done
depends: [T-06]
---

# T-07 — 2D Civic Register, The Debate Journey Track, and The Dossier Plate HUD Drawer

**What to build:**  
Build the 2D Civic Register mode (`/register`) and the universal slide-over **Dossier Plate** in SvelteKit 5 using the Senedd Estate design system. This provides a zero-WebGL, high-density, accessible interface for reading plenary debates with unhurried typography.

### Acceptance Criteria
- [x] Route `/register` implemented displaying plenary sessions organized chronologically and filterable by policy domain, legislative term, and speaker.
- [x] The Two Plates rule implemented for legislative and policy comparisons: two competing motions or years are drawn on separate plates with an unadorned structural gutter.
- [x] **The Dossier Plate** (`$lib/hud/DossierPlate.svelte`) built as an accessible slide-over drawer:
  - **Debate Journey Track**: Interactive horizontal stepper showing debate stages (Ministerial Statement $\to$ Party Spokespeople $\to$ Backbench Interventions $\to$ Division Vote). Clicking any step smoothly scrolls the transcript to that moment.
  - **Verbatim Speech Stack**: Clean typography using Lora headings and DM Sans body, accompanied by speaker portraits, current ministerial titles, and bilingual language badges.
  - **Roll-Call Division Plate**: Visual breakdown of For / Against / Abstain votes grouped by party.
  - **Senedd TV Broadcast Seam**: Embedded video player or direct link with exact start/end timestamp parameters.
  - **Relocatable Citations**: Unadorned link back to the official Senedd URL.
- [x] Full keyboard navigation (`Esc` to close drawer, `Tab` focus trapping).
- [x] Automated accessibility audit: 100% WCAG 2.2 AA compliant with zero contrast or ARIA violations.

**Notes:**
- API extended for the Register: `/api/plenary/sessions` now nests `items` and accepts `speaker`; new `GET /api/members` and `GET /api/policy-domains`; dossier payload adds `source_xml_url`, and per-speech/ballot `party_id_at_date` plus speech `role_title_en/cy` resolved on the session date.
- Debate Journey stages are derived (record carries no stage markers) and badged "Stages grouped by Siambr engine — speeches verbatim." Rule in `frontend/src/lib/dossier/journey.ts`.
- Two Plates: tick "Compare" on two items in `/register`, opens `/register/compare?a=&b=`.
- Senedd TV offsets use W3C media fragments (`#t=start,end`); senedd.tv's native offset parameter is unverified — change only `broadcastLink`.
- Accessibility gate: `npx playwright test` (frontend) runs `@axe-core/playwright` WCAG 2.2 AA against real FastAPI over a temp fixture DB (`backend/tests/e2e_server.py`).
- Fixed T-06 latent bug: read-only SQLite handle is used across FastAPI threadpool workers under uvicorn, now opened with `check_same_thread=False`.

### Amendment under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: the **Debate Journey Track and the Two Plates compare are withdrawn** ([T-12](T-12-withdraw-corridors-and-plinths.md)). `/register` and the Dossier Plate stay and are reshaped by [T-20](T-20-member-register-and-search.md): rows gain *Watch it play* links to the Stage and show `record_published_at`. The Senedd TV seam is link-out only, at the contribution's own `startPos` URL.
