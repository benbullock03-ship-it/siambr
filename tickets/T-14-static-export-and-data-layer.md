---
id: T-14
title: "Static Export (Gold to JSON), adapter-static and the Frontend Data Layer"
kind: pipeline+frontend
status: done
depends: [T-13]
---

# T-14 — Static Export (Gold to JSON), adapter-static and the Frontend Data Layer

**What to build:**  
Replace the runtime FastAPI dependency with exported JSON so the site is fully static. Spec 2.0.0 section 8.2.

### Acceptance Criteria
- [x] `python -m pipeline.export [--out frontend/static/data]` writes the static data contract in spec 8.2: `index.json`, `sittings/index.json`, `sittings/{date}.json`, `members/index.json`, `members/{id}.json`, `terms/{n}.json`. Stats and search files are added by T-19 and T-20 and are not required here.
- [x] A sitting file carries: items in order; contributions in sequence with `t_start` (nullable), `t_end_derived` (the next timed contribution's `t_start` in the same sitting, or null for the last), `member_id`, `lang`, `text_original`, `text_english`, the per-contribution Senedd TV URL; divisions with member votes when present; `clip_url`; `meeting_start_time`; `record_published_at`; `source_xml_url`.
- [x] A member file carries tenures, roles, contributions grouped by sitting date newest first (`id`, `item_id`, `item_title_en`, `t_start`, `lang`, `text_original`, `text_english`), and ballots.
- [x] Deterministic: sorted keys, two-space indent, stable ordering. Running export twice on an unchanged DB yields no diff (test).
- [x] Verbatim: `pipeline.run_checks` samples contributions and diffs `text_original` in JSON against Gold and against Bronze XML.
- [x] Frontend: `svelte.config.js` uses `@sveltejs/adapter-static` with `fallback: '404.html'`, prerendering `/`, `/register`, `/members`. `src/lib/api/` is replaced by `src/lib/data/` (typed loaders over `fetch('/data/...')`, plus `PROVENANCE_DERIVED` constants). No `/api/` string remains in `frontend/src`.
- [x] `/register`, `/siambr` and the Member plate work from JSON alone with `backend/` not running.
- [x] `backend/` marked dev-only in its README docstring; its e2e fixture server for Playwright is replaced by serving `frontend/static/data` fixtures.

**Notes:**
- Keep file sizes honest: a sitting JSON with 300 contributions is roughly 400 KB uncompressed. Cloudflare Pages gzips. No sitting is split.
- Member files for former Members are exported too; they are only reachable by URL.

### Notes (done 2026-09-20)
- `pipeline/export.py`: `Exporter` writes `index.json`, `sittings/index.json`, `sittings/{date}.json`, `members/index.json`, `members/{id}.json`, `terms/{n}.json`. Sorted keys, two-space indent, LF, UTF-8 unescaped. A file whose bytes are unchanged is not rewritten (mtime stays), and JSON no longer produced is pruned rather than the directory removed (OneDrive holds locks on `rmdir`). `index.generated_at` is the newest `record_published_at` among the sittings, not the export's own clock, so the output has no wall-clock stamp at all. Run twice on the real store: byte-identical, tested and diffed.
- Real export: 17 sittings, 228 Member files, 7 term files, 20 MB on disk; the largest sitting (14 July 2026, 384 contributions, both languages) is 986 KB uncompressed. Committed under `frontend/static/data/`.
- Sitting file additions beyond the criterion: `speakers` (every Member who spoke or voted, with the party and ministerial title held on that date) so the stage needs no Member fetch to name a speaker, and a `provenance` map naming every derived field (`t_end_derived`, item type, policy domain, party and role at date). `sittings/index.json` items carry `speaker_ids` so the Register's speaker filter runs client-side.
- `run_checks` gains the static audit: a seeded random sample of 40 contributions compared JSON to Gold (text, English, `t_start`) and Gold to Bronze; `--static none` skips it. 6/6 pass.
- Frontend: `svelte.config.js` (new; the adapter was inline in `vite.config.ts`) uses `adapter-static` with `fallback: '404.html'`, prerendering `/`, `/register`, `/members`, `/siambr`. `kit.files.assets` honours `SIAMBR_STATIC_DIR` so Playwright serves a fixture export (SSR reads static assets from disk, so a Vite middleware could not intercept `/data/*`). Prerender crawl skips `/sitting/*` links until T-18 adds the route; drop that filter then.
- `src/lib/api/` and `src/lib/types/siambr.ts` deleted; `src/lib/data/` has `types.ts`, `loaders.ts`, `dossier.ts` (an agenda item cut from a sitting file) and `provenance.ts`. `hooks.server.ts` and the Vite proxy are gone; no `/api/` string in `frontend/src`.
- Search params on prerendered pages are read through a `browser` guard; the Register filters and `?item=` apply client-side.
- `/members` added (T-20 will extend it with postcode lookup and Member pages): current-term Members by party then name with a name search.
- Playwright: `e2e/global-setup.ts` runs `python -m tests.export_fixture` into `frontend/e2e/static/data` (git-ignored); `backend/tests/e2e_server.py` deleted; `backend/main.py` docstring marks the API dev-only. 11 e2e tests pass with no backend process.
- Sixty-nine source files carried CRLF from earlier Python `write_text` calls; all normalised to LF and later edits write LF explicitly.
- Gates: `python -m unittest` 109 passed; `npx vitest run` 66 passed; `npx playwright test` 11 passed; `svelte-check` 0 errors; `npm run build` writes `build/` (25 MB with data); `python -m pipeline.run_checks` 6/6 ok; export determinism verified by diff.
