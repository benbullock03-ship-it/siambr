---
id: T-24
title: "Verification Gates: Verbatim, Timeline, Provenance, Prose, Accessibility, Performance, Determinism"
kind: verification
status: pending
depends: [T-18, T-20, T-21]
---

# T-24 — Verification Gates: Verbatim, Timeline, Provenance, Prose, Accessibility, Performance, Determinism

**What to build:**  
The CI gate suite for spec 2.0.0 section 10.2. Runs on every push in `deploy.yml` and blocks deploy on failure. Replaces the gate half of the withdrawn T-11.

### Acceptance Criteria
- [ ] **Verbatim** (`python -m pipeline.run_checks --sample 40`): samples contributions, fetches the live XML for their meetings, and diffs `verbatim_text_original` byte-for-byte across Bronze, Gold and the exported sitting JSON. Any mismatch fails. Also checks `startPos` equality and that `record_published_at` in JSON matches Gold.
- [ ] **Timeline invariants** (`vitest`, from T-16): run against every exported sitting, not just fixtures: beats sorted, non-overlapping, untimed beats never pass the next timed start, division beats inside their item.
- [ ] **Provenance badging** (`vitest` + a small AST walk): every route and component that renders seating, speaking time, shares, `t_end_derived`, policy domain or division placement includes the `ProvenanceBadge` component or the `PROVENANCE_DERIVED` constant. A list of exempt files is kept in the test and must be justified in a comment.
- [ ] **Prose linter** (`python -m scripts.check_prose`): runs over `frontend/src/**/*.svelte` and the exported `method` strings from T-21. Bans spin adjectives, caps sentence length, enforces *Siambr*, *Y Llywydd*, *Plenary*, *Member of the Senedd*.
- [ ] **Accessibility** (`npm run test:a11y`): axe WCAG 2.2 AA on `/`, `/sitting/[date]` desktop and phone, `/register`, `/members`, `/members/[id]`, `/search`, both stats pages, both drawers open. Reduced-motion run asserts no three.js chunk is requested.
- [ ] **Performance** (`npm run test:perf`): Playwright trace of the Gallery view for 30 s at 1x on the CI software renderer; fails if any frame exceeds 33 ms or the p95 exceeds 20 ms.
- [ ] **Export determinism**: CI runs `pipeline.export` against the committed DB and fails if `git status --porcelain frontend/static/data` is non-empty.
- [ ] `deploy.yml` runs all gates before the Cloudflare deploy step; `sync.yml` runs verbatim and determinism only (fast path).

**Notes:**
- Quotation cards from T-11 are withdrawn and not replaced.
- The live-XML fetch in the verbatim gate is the only network call in CI besides deploy. If Senedd is down the gate reports "source unavailable" and passes, and says so in the job summary; it never fails on a fetch error.
