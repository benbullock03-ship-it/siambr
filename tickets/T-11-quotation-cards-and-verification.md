---
id: T-11
title: "Verifiable Quotation Cards, Deep Permalinks, and Automated Integrity Gate Suite"
kind: verification
status: withdrawn
depends: [T-10]
---

# T-11 — Verifiable Quotation Cards, Deep Permalinks, and Automated Integrity Gate Suite

**What to build:**  
Complete the civic sharing tools ("Dossier Clip Share" for quotation cards with deep 3D permalinks) and construct the automated verification and CI gate suite ensuring zero drift, zero political spin, and complete accessibility.

### Acceptance Criteria
- [ ] **Quotation Card Generator**:
  - Selecting any speech excerpt in the Dossier Plate allows generating an unhurried, verifiable social quotation card (SVG / PNG download).
  - Includes: verbatim quote, speaker photo, party badge, date, Senedd TV broadcast timestamp, and official citation URL.
  - Generates deep permalink: `https://siambr.wales/siambr#wing=...&plinth=...&speech=...` which immediately loads the 3D scene and focuses that exact plinth.
- [ ] **Automated Verbatim Audit Gate (`python -m pipeline.run_checks`)**:
  - Fetches random sample plenary sessions from live upstream XMLs and diffs against `data/siambr.db` character-by-character. Fails non-zero on any character mismatch.
- [ ] **Editorial Prose Linter (`python -m scripts.check_prose`)**:
  - Lints all UI copy against `DESIGN.md` rules: bans spin adjectives (*"heated debate"*, *"fierce clash"*), checks sentence length limits, and enforces proper Welsh parliamentary terminology (*Siambr*, *Y Llywydd*, *Plenary*).
- [ ] **Accessibility Audit (`npm run test:a11y`)**:
  - Headless Playwright + `@axe-core/playwright` sweep verifying 100% WCAG 2.2 AA compliance across all routes and drawers.
- [ ] **Automated Scheduled Ingestion Workflow**:
  - GitHub Actions workflow `.github/workflows/plenary-sync.yml` scheduled for Tuesday and Wednesday at 20:00 UTC to incrementally pull new plenary records into the Sixth Senedd entrance.

### Withdrawn under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: quotation cards and 3D plinth permalinks are dropped. The verification gates move to [T-24](T-24-verification-gates.md); the scheduled sync moves to [T-15](T-15-sync-and-deploy.md) as a polling job, not a fixed 20:00 run.
