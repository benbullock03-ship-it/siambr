---
id: T-01
title: "Repo Scaffolding, SvelteKit 5 + Threlte, and Senedd Estate Design Tokens"
kind: foundation
status: done
depends: []
---

# T-01 — Repo Scaffolding, SvelteKit 5 + Threlte, and Senedd Estate Design Tokens

**What to build:**  
Initialize the Siambr project workspace with the complete directory architecture, Python virtual environment layout, and SvelteKit 5 frontend configured with TypeScript strict mode, Svelte 5 runes, Threlte 8, and the Senedd Estate design tokens.

### Acceptance Criteria
- [x] Directory layout created: `frontend/`, `backend/`, `pipeline/`, `data/`, `data/bronze/`, `static/buffers/`.
- [x] `frontend/` initialized with SvelteKit 5 (TypeScript strict, Svelte 5 runes enabled) and dependencies (`@threlte/core`, `@threlte/extras`, `three`, `@types/three`).
- [x] `frontend/src/app.css` defines the complete Senedd Estate token set: `--color-ground` (`#F7F6F2`), `--color-panel` (`#ECEAE3`), `--color-ink` (`#16191D`), `--color-timber-cedar` (`#C87D4A`), `--color-accent-plum` (`#C9187E`), and the 5 party color tokens.
- [x] Typography fonts configured via Google Fonts / Fontsource: `Lora` (serif headings), `DM Sans` (reading body), and `JetBrains Mono` (tabular numerals).
- [x] Shared TypeScript interfaces established in `frontend/src/lib/types/siambr.ts` mirroring the domain entities (`Member`, `PlenarySession`, `AgendaItem`, `DebateContribution`, `DivisionVote`).
- [x] Python backend package scaffolded with `backend/requirements.txt` (`fastapi`, `uvicorn`, `requests`, `pydantic`).
- [x] `npm run check` and `npm run dev` start without errors.
