---
id: T-02
title: "SQLite Database Schema, Idempotent Migrations, and Policy Domain Seeding"
kind: database
status: done
depends: [T-01]
---

# T-02 — SQLite Database Schema, Idempotent Migrations, and Policy Domain Seeding

**What to build:**  
Create the relational database infrastructure for `data/siambr.db` using SQLite with WAL (Write-Ahead Logging) mode. Write an idempotent migration engine and seed baseline parliamentary terms and the six cardinal policy domains.

### Acceptance Criteria
- [x] `pipeline/db.py` provides `create_connection(path, read_only=False)` configuring SQLite pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`.
- [x] Baseline migration `pipeline/migrations/001_initial_schema.sql` written containing complete table definitions from `siambr-spec.md`:
  - `members`, `member_tenures`, `ministerial_roles`
  - `plenary_sessions`, `agenda_items`, `debate_contributions`
  - `division_votes`, `member_votes`, `citizen_petitions`, `citizen_trails`
  - `spatial_plinths`
- [x] `python -m pipeline.apply_migrations` applies migrations idempotently, tracking execution in a `schema_migrations` table.
- [x] Seed script seeds the six primary Senedd Policy Domains:
  1. `health` (Health & Social Care, $0^\circ$)
  2. `transport` (Climate Change & Transport, $60^\circ$)
  3. `economy` (Economy & Welsh Tax, $120^\circ$)
  4. `education` (Education & Welsh Language, $180^\circ$)
  5. `communities` (Housing & Social Justice, $240^\circ$)
  6. `devolution` (Constitution & External Affairs, $300^\circ$)
- [x] In-memory test harness `tests/memory_db.py` creates a pristine seeded database in memory for offline unit testing.
- [x] Unit tests in `tests/test_schema.py` assert table existence, foreign key cascades, and check constraint integrity.
