---
id: T-15
title: "pipeline.sync, GitHub Actions Poller and Cloudflare Pages Deploy (zero cost)"
kind: pipeline+ops
status: pending
depends: [T-14]
---

# T-15 — pipeline.sync, GitHub Actions Poller and Cloudflare Pages Deploy (zero cost)

**What to build:**  
The one command a scheduler runs, and the free scheduler that runs it, so a new sitting is on the site within one tick of Senedd publishing it. Spec 2.0.0 section 8.4. This ticket comes before the stage work on purpose: the current site goes live and starts tracking sittings immediately.

### Acceptance Criteria
- [ ] Repository initialised in git and pushed to GitHub (currently not a git repository). `.gitignore` excludes `node_modules`, `.svelte-kit`, `build`, `__pycache__`, but **includes** `data/bronze/`, `data/siambr.db` and `frontend/static/data/`.
- [ ] `python -m pipeline.sync [--window-days 21] [--db PATH]`: lists the XMLExport index for the window, fetches every listed meeting with the Bronze cache bypassed, rewrites sessions whose hash changed, runs `ingest_divisions_and_petitions` for changed dates, runs `export` if anything changed. Writes one `sync_runs` row. Exit code 0 on no change, 0 on change, non-zero on an unhandled error. Prints a one-line summary.
- [ ] Idempotent: two consecutive runs with no upstream change produce no file changes (test with a stubbed adapter).
- [ ] `.github/workflows/sync.yml`: cron `*/30 13-23 * * 2,3` and `0 6 * * *`, plus `workflow_dispatch`. Steps: checkout, Python 3.11, `pip install -r pipeline/requirements.txt`, `pipeline.sync`; if `git status --porcelain` is non-empty, commit Bronze + DB + static data with message `sync: <dates changed>`, push, then build the frontend and deploy.
- [ ] Deploy step uses `cloudflare/wrangler-action` with `pages deploy frontend/build`, secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. A second workflow `deploy.yml` deploys on push to `main` for code changes.
- [ ] Site footer reads "Record checked <finished_at> UTC" from `index.json` (written by export from the latest `sync_runs` row).
- [ ] First live deploy done; URL recorded in the ticket notes.

**Notes:**
- Concurrency: `concurrency: sync` with `cancel-in-progress: false` so two ticks never push over each other.
- Actions cron may lag 5 to 15 minutes at busy times. Not worth engineering around.
- No alerting beyond the default failure email.
