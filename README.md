# Siambr

One sitting day of Senedd Cymru on a 3D stage, played back in real time from the official Record of Proceedings, with a plain Register of every Member and every contribution behind it. See `siambr-spec.md` for the design and `CLAUDE.md` for engineering conventions.

Every speech is verbatim from the Record. Anything Siambr derives (seating, end times, speaking time, topic grouping) is labelled `PROVENANCE_DERIVED`.

## Layout

- `pipeline/` Python 3.11+: Bronze mirror (`data/bronze`), Gold store (`data/siambr.db`), static export (`frontend/static/data`).
- `frontend/` SvelteKit 5 + Threlte, built with `adapter-static`. No server at runtime.
- `backend/` FastAPI, **dev only**: inspects `siambr.db` locally. Not deployed.

## Commands

```
python -m pipeline.apply_migrations
python -m pipeline.ingest_plenary --scan-from 16261 --term 7 --gap 200
python -m pipeline.sync              # what the scheduler runs
python -m pipeline.export
python -m pipeline.run_checks
python -m unittest
cd frontend && npm ci && npm run build && npx vitest run && npx playwright test
```

## Deployment

`.github/workflows/sync.yml` polls the Record every 30 minutes on Tuesday and Wednesday afternoons (UTC) and once a day otherwise. When a sitting changes it commits Bronze, the database and the static data, builds the site and deploys it. `.github/workflows/deploy.yml` deploys on every code push to `main`.

Both need two repository secrets for Cloudflare Pages (project name `siambr`):


