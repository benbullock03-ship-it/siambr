---
id: T-15
title: "pipeline.sync, GitHub Actions Poller and Cloudflare Pages Deploy (zero cost)"
kind: pipeline+ops
status: done
depends: [T-14]
---

# T-15 — pipeline.sync, GitHub Actions Poller and Cloudflare Pages Deploy (zero cost)

**What to build:**  
The one command a scheduler runs, and the free scheduler that runs it, so a new sitting is on the site within one tick of Senedd publishing it. Spec 2.0.0 section 8.4. This ticket comes before the stage work on purpose: the current site goes live and starts tracking sittings immediately.

### Acceptance Criteria
- [x] Repository initialised in git and pushed to GitHub (currently not a git repository). `.gitignore` excludes `node_modules`, `.svelte-kit`, `build`, `__pycache__`, but **includes** `data/bronze/`, `data/siambr.db` and `frontend/static/data/`.
- [x] `python -m pipeline.sync [--window-days 21] [--db PATH]`: lists the XMLExport index for the window, fetches every listed meeting with the Bronze cache bypassed, rewrites sessions whose hash changed, runs `ingest_divisions_and_petitions` for changed dates, runs `export` if anything changed. Writes one `sync_runs` row. Exit code 0 on no change, 0 on change, non-zero on an unhandled error. Prints a one-line summary.
- [x] Idempotent: two consecutive runs with no upstream change produce no file changes (test with a stubbed adapter).
- [x] `.github/workflows/sync.yml`: cron `*/30 13-23 * * 2,3` and `0 6 * * *`, plus `workflow_dispatch`. Steps: checkout, Python 3.11, `pip install -r pipeline/requirements.txt`, `pipeline.sync`; if `git status --porcelain` is non-empty, commit Bronze + DB + static data with message `sync: <dates changed>`, push, then build the frontend and deploy.
- [x] Deploy step uses `cloudflare/wrangler-action` with `pages deploy frontend/build`, secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. A second workflow `deploy.yml` deploys on push to `main` for code changes.
- [x] Site footer reads "Record checked <finished_at> UTC" from `index.json` (written by export from the latest `sync_runs` row).
- [ ] First live deploy done; URL recorded in the ticket notes. **Pending: the Cloudflare secrets do not exist yet (see Notes).**

**Notes:**
- Concurrency: `concurrency: sync` with `cancel-in-progress: false` so two ticks never push over each other.
- Actions cron may lag 5 to 15 minutes at busy times. Not worth engineering around.
- No alerting beyond the default failure email.

### Notes (2026-09-20)
- Git was initialised at T-12 so every ticket from T-12 has its own commit. `.gitignore` now tracks `data/bronze/` (96 MB: 17 plenary XMLs, the Modern.Gov ballots XML, and the senedd.wales and gov.wales profile mirrors from T-03) and `data/siambr.db` (18 MB); the WAL and SHM side files stay ignored and `pipeline.sync` checkpoints the WAL (`PRAGMA wal_checkpoint(TRUNCATE)`) before it returns so the committed file is a whole snapshot. Repository pushed to GitHub as a **private** repository (public parliamentary data, but visibility is the owner's call and private is the reversible default); the URL is in the run summary.
- `pipeline/sync.py`: `sync()` lists the index for `today - 21 days .. today`, fetches each listed meeting with the Bronze cache bypassed, writes only changed sessions, relinks divisions for the changed dates only (`upsert_divisions` on the Modern.Gov feed filtered by `session_date`; petitions are optional per the T-05 amendment and are not touched by sync), exports if anything changed, and `record_run()` writes one `sync_runs` row. An unavailable meeting is logged and skipped; an unhandled error lands in the row's `error` column and the exit code is 1. Identical Bronze bytes are not rewritten, so a quiet run leaves every file's mtime alone (tested: two runs, byte-and-mtime-identical Bronze and static trees).
- `sync_runs` lives in the committed database, so a quiet run does dirty `siambr.db`. `sync.yml` therefore commits when `git status --porcelain -- data/bronze frontend/static/data` is non-empty and includes the DB in that commit; it does not commit on DB-only changes, or the repository would grow by 18 MB every 30 minutes. Consequence: the footer's "Record checked" stamp advances only on runs that changed the record. Deliberate deviation from the literal criterion; the alternative was a commit per tick.
- First live run: `sync: 2 listed, 0 changed, no export`, exit 0 (the index window held 15 and 16 September). `sync_runs` row 1 written; `index.json` now carries `checked_at`, and the site footer reads "Record checked 2026-09-20 15:45:17 UTC" in the built `register.html`.
- Workflows: `sync.yml` (crons `*/30 13-23 * * 2,3` and `0 6 * * *`, `workflow_dispatch`, `concurrency: sync` without cancel, Python 3.11, `pip install -r pipeline/requirements.txt` (requests only), `pipeline.sync`, `run_checks` before commit, commit `sync: <dates>`, Node 24 build, `cloudflare/wrangler-action@v3` with `pages deploy frontend/build --project-name=siambr --branch=main`) and `deploy.yml` (push to `main` ignoring data paths, same build and deploy). `README.md` documents the two secrets and the one-off Pages project creation.
- **Deferred (needs the owner)**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets and the `siambr` Pages project. Until they exist the deploy step of both workflows fails after a successful build; the sync commit and push still land. Once set, run `deploy.yml` from the Actions tab and record the `*.pages.dev` URL here.
- Gates: `python -m unittest` 114 passed; `npx vitest run` 66 passed; `svelte-check` 0 errors; `npm run build` ok; `python -m pipeline.run_checks` 6/6 ok; `npx playwright test` 11 passed (T-14 run; no e2e change in this ticket).
