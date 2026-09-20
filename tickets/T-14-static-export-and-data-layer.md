---
id: T-14
title: "Static Export (Gold to JSON), adapter-static and the Frontend Data Layer"
kind: pipeline+frontend
status: pending
depends: [T-13]
---

# T-14 — Static Export (Gold to JSON), adapter-static and the Frontend Data Layer

**What to build:**  
Replace the runtime FastAPI dependency with exported JSON so the site is fully static. Spec 2.0.0 section 8.2.

### Acceptance Criteria
- [ ] `python -m pipeline.export [--out frontend/static/data]` writes the static data contract in spec 8.2: `index.json`, `sittings/index.json`, `sittings/{date}.json`, `members/index.json`, `members/{id}.json`, `terms/{n}.json`. Stats and search files are added by T-19 and T-20 and are not required here.
- [ ] A sitting file carries: items in order; contributions in sequence with `t_start` (nullable), `t_end_derived` (the next timed contribution's `t_start` in the same sitting, or null for the last), `member_id`, `lang`, `text_original`, `text_english`, the per-contribution Senedd TV URL; divisions with member votes when present; `clip_url`; `meeting_start_time`; `record_published_at`; `source_xml_url`.
- [ ] A member file carries tenures, roles, contributions grouped by sitting date newest first (`id`, `item_id`, `item_title_en`, `t_start`, `lang`, `text_original`, `text_english`), and ballots.
- [ ] Deterministic: sorted keys, two-space indent, stable ordering. Running export twice on an unchanged DB yields no diff (test).
- [ ] Verbatim: `pipeline.run_checks` samples contributions and diffs `text_original` in JSON against Gold and against Bronze XML.
- [ ] Frontend: `svelte.config.js` uses `@sveltejs/adapter-static` with `fallback: '404.html'`, prerendering `/`, `/register`, `/members`. `src/lib/api/` is replaced by `src/lib/data/` (typed loaders over `fetch('/data/...')`, plus `PROVENANCE_DERIVED` constants). No `/api/` string remains in `frontend/src`.
- [ ] `/register`, `/siambr` and the Member plate work from JSON alone with `backend/` not running.
- [ ] `backend/` marked dev-only in its README docstring; its e2e fixture server for Playwright is replaced by serving `frontend/static/data` fixtures.

**Notes:**
- Keep file sizes honest: a sitting JSON with 300 contributions is roughly 400 KB uncompressed. Cloudflare Pages gzips. No sitting is split.
- Member files for former Members are exported too; they are only reachable by URL.
