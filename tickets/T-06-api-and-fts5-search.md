---
id: T-06
title: "FastAPI Serving Layer, Dossier Queries & Millisecond SQLite FTS5 Full-Text Search"
kind: backend
status: superseded
depends: [T-05]
---

# T-06 — FastAPI Serving Layer, Dossier Queries & Millisecond SQLite FTS5 Full-Text Search

**What to build:**  
Implement the high-performance read-only backend API using FastAPI and SQLite FTS5 (Full-Text Search). The backend serves structured dossier payloads, debate journey metadata, member profiles, and millisecond full-text speech searches across 25 years of records.

### Acceptance Criteria
- [x] SQLite FTS5 virtual table `debate_contributions_fts` created over `debate_contributions` indexing speech text, member name, and agenda title.
- [x] Endpoints implemented in `backend/routes/`:
  - `GET /api/plenary/items/{id}`: Full verbatim Dossier Plate payload (item metadata, debate journey sequence, chronological speeches with speaker details, division vote breakdown, petition links, and Senedd TV clip offsets).
  - `GET /api/plenary/sessions`: List sessions filterable by date range, term, and policy domain.
  - `GET /api/members/{id}`: Member biography, tenures, ministerial roles, and floor contribution count.
  - `GET /api/members/by-postcode/{postcode}`: Resolves a Welsh postcode to its Constituency MS and Regional MSs.
  - `GET /api/search?q={query}&domain={domain}&term={term}`: SQLite FTS5 search returning matched speeches with highlighted snippets and relevance rank.
- [x] Performance gate: FTS5 search over 25 years of data returns in under 20ms.
- [x] Read-only database connection enforced: `backend/db.py` opens SQLite connection with `?mode=ro`.
- [x] Test suite `backend/tests/test_api.py` asserts response schemas, error handling (404 on unknown IDs), and search speed benchmarks.

**Notes:**
- Postcode resolution (`/api/members/by-postcode/`) calls postcodes.io for the ONS Senedd constituency GSS code; if the postcode has no such code on record, returns 404 rather than guessing — no boundary-polygon fallback is implemented.
- FTS5 table is self-contained (not external-content) so `snippet()` has text to slice; kept in sync via `AFTER INSERT/UPDATE/DELETE` triggers on `debate_contributions` (migration `003_debate_contributions_fts.sql`).

### Superseded under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: the site is static. FastAPI is **dev-only** and not deployed; the frontend reads exported JSON ([T-14](T-14-static-export-and-data-layer.md)). FTS5 stays in Gold for `run_checks` and local inspection; runtime search is a client-side index ([T-20](T-20-member-register-and-search.md)). The postcode endpoint is replaced by a browser-side postcodes.io call in T-20. `backend/routes/plinths.py` is removed by [T-12](T-12-withdraw-corridors-and-plinths.md).
