# CLAUDE.md -- Siambr (Civic 3D Landscape & Register of Senedd Cymru)

> **MISSION RULE: DEMOCRATIC TRUTH ABOVE EVERYTHING ELSE.**
> **Siambr never synthesises, attributes, edits, or invents a parliamentary statement or voting record.**
> Every word presented as a speech is a verbatim transcription from the official Record of Proceedings (*Y Cofnod*) for that exact date and speaker.
> Every roll-call vote is the publisher's stated division result, verbatim.
> If a speech or vote cannot be traced directly to an official Senedd XML release with an active canonical URL, it does not ship.

---

## 1. Stack & Runtime

- **Frontend**: SvelteKit 5 (TypeScript strict, Runes `$state`/`$derived`/`$props`), Threlte 8+ (declarative Three.js for Svelte 5) + Three.js / WebGPU. Built with `adapter-static`; **no server at runtime**. Data is JSON under `frontend/static/data/`.
- **Styling**: The Senedd Estate Design System (`DESIGN.md`) via CSS custom properties.
- **Data Pipeline**: Python 3.11+ `pipeline/` package managing Bronze (raw XML mirror), Silver (normalisation), Gold (SQLite WAL + FTS5) and Static (exported JSON).
- **Backend API**: Python FastAPI in `backend/` is **dev-only**, for inspecting `siambr.db` locally. It is not deployed and the frontend must not depend on it.
- **Hosting**: Cloudflare Pages (static). **Scheduling**: GitHub Actions cron running `pipeline.sync`. Zero running cost.

---

## 2. Architecture & Data Flow

```
                 [ SENEDD OPEN DATA WEB SERVICES ]
                                |
     +----------------+---------+---------+------------------+
     v                v                   v                  v
 Plenary XML     Modern.Gov         senedd.wales /       Senedd TV
 (XMLExport:     (Members,          gov.wales            (link-out only,
  transcripts +   divisions)        (profiles, titles)    startPos from XML)
  TV offsets)
     |                |                   |
     +----------------+---------+---------+
                                v
                   [ BRONZE ] data/bronze/**   byte-for-byte mirror, SHA-256
                                v
                   [ SILVER ] in-process normalisation
                                v
                   [ GOLD ]   data/siambr.db   SQLite WAL, FTS5, audit target
                                v
                   [ STATIC ] frontend/static/data/**.json   what ships
                                v
              /sitting/{date}  (3D Stage)      /register, /members/{id}, /search, stats  (2D Register)
```

The product is **one sitting day on a stage**: the chamber plays back in real time from Senedd TV offsets, the speaking Member's desk lights, verbatim text scrolls, divisions tint the desks. The 2D Register is the register of record per Member and per sitting. Corridors, plinths, trails and quotation cards were withdrawn on 2026-09-20; see `siambr-spec.md` 2.0.0.

---

## 3. Database Schema (Gold Tier: `data/siambr.db`)

Source of truth: `pipeline/migrations/*.sql` (applied by `python -m pipeline.apply_migrations`, tracked in `schema_migrations`). Text IDs; dates are ISO-8601 `YYYY-MM-DD` text.

1. **`parliamentary_terms`**:
   - `term` (1 to 7), `label_en`, `label_cy`, `start_date`, `end_date`, `seat_count` (60/96).
2. **`presiding_officers`**:
   - `term`, `member_id`, `office` (`llywydd`/`deputy`), `start_date`, `end_date`, `provenance`, `source_url`.
3. **`policy_domains`**:
   - `id`, `name_en`, `name_cy`. (`wing_label`, `bearing_degrees` are legacy and unused.)
4. **`members`**:
   - `id`, `gss_constituency_code` (latest seat only), `constituency_name_en`, `constituency_name_cy`, `canonical_name`, `cymraeg_name`, `honorific`, `portrait_url`, `official_profile_url`, `current_status` (`active`/`former`/`deceased`).
5. **`member_tenures`**:
   - `id`, `member_id`, `party_id` (`labour`/`plaid_cymru`/`conservatives`/`libdems`/`reform_uk`/`greens`/`ukip`/`independent`/`other`), `party_label`, `party_provenance` (`profile_current`/`moderngov_term`/`curated_reference`), `senedd_term`, `is_regional_member`, `region_name`, `seat_name`, `seat_gss_code`, `start_date`, `end_date`, `source_url`.
6. **`ministerial_roles`**:
   - `id`, `member_id`, `title_en`, `title_cy`, `cabinet_level` (`first_minister`/`deputy_first_minister`/`cabinet_secretary`/`cabinet_minister`/`minister`/`deputy_minister`/`counsel_general`), `start_date`, `end_date`, `provenance` (`senedd_profile`/`gov_wales`/`moderngov`/`curated_reference`), `source_url`, `start_date_precision` (`exact`/`term_floor`).
7. **`plenary_sessions`**:
   - `id`, `senedd_term`, `session_date`, `title_en`, `title_cy`, `presiding_officer_id`, `source_xml_url`, `xml_sha256`, `record_published_at` (transcript `dataroot@generated`), `meeting_start_time` (`HH:MM:SS`, anchors the sitting clock).
8. **`agenda_items`**:
   - `id`, `session_id`, `item_order`, `item_type` (`debate`/`oral_questions`/`statement`/`bill_stage`/`emergency_debate`), `title_en`, `title_cy`, `policy_domain_id`, `senedd_tv_clip_id`, `senedd_tv_clip_url`, `origin_type` (`government_business`/`committee_report`/`petition`/`member_motion`), `origin_ref_id`.
9. **`debate_contributions`** (mirrored into FTS5 `debate_contributions_fts` by triggers):
   - `id`, `agenda_item_id`, `member_id`, `sequence_number`, `spoken_language` (`en`/`cy`), `verbatim_text_original`, `verbatim_text_english`, `video_timestamp_start` (Senedd's `startPos`, seconds on the meeting clip; NULL when untimed), `video_timestamp_end` (always NULL in Gold; the export derives it).
10. **`division_votes`**:
    - `id`, `agenda_item_id`, `motion_text`, `votes_for`, `votes_against`, `votes_abstain`, `result` (`agreed`/`negatived`).
11. **`member_votes`**:
    - `division_id`, `member_id`, `vote_cast` (`for`/`against`/`abstain`/`did_not_vote`).
12. **`citizen_petitions`** (optional; empty until data exists):
    - `id`, `title_en`, `title_cy`, `petitioner_name`, `signature_count`, `opened_date`, `closing_date`, `status`, `committee_response`, `debate_agenda_item_id`, `source_url`.
13. **`sync_runs`**:
    - `id`, `started_at`, `finished_at`, `sessions_changed`, `error`.

`citizen_trails`, `citizen_trail_stops` and `spatial_plinths` are dropped by migration `005_withdraw_corridors.sql`.

---

## 4. Ingestion & Pipeline Commands

All pipeline scripts run as package modules from the repository root:

- **Fetch raw records**: `python -m pipeline.ingest_plenary --year 2026` (or `--meeting-id N`, `--scan-from N` for backfill)
- **Reconcile Members**: `python -m pipeline.reconcile_members --source mgwebservice`
- **Divisions**: `python -m pipeline.ingest_divisions_and_petitions`
- **Sync (what the scheduler runs)**: `python -m pipeline.sync` — idempotent; re-fetches the last 21 days, exports if changed
- **Export Static JSON**: `python -m pipeline.export`
- **Run Verification & Audit**: `python -m pipeline.run_checks`

---

## 5. Engineering Standards & Testing

1. **Verbatim Fidelity Audits**:
   `python -m tests.test_verbatim_provenance` fetches random sample speeches from live Senedd XMLs and diffs them against `siambr.db` character-by-character. Zero drift allowed.
2. **No Invented Entities**:
   Tests parse the export and all UI components; seating, speaking time, derived end times, party shares and domain groupings must carry the `PROVENANCE_DERIVED` badge. Speaking time is a sum of Senedd's own `startPos` values, never an estimate.
3. **Prose Linter (`scripts/check_prose.py`)**:
   Lints all UI copy against `DESIGN.md` editorial standards: sentence length caps, banned spin adjectives, and proper bilingual nomenclature (*Siambr*, *Y Llywydd*, *Plenary*).
4. **WCAG 2.2 AA & Reduced Motion**:
   The Stage HUD and every Register route pass headless axe checks; `prefers-reduced-motion: reduce` replaces camera easing with cuts, hides walk mode, and loads no three.js on the Register.
5. **Static Only**:
   `frontend/src` must not reference `/api/`. Data comes from `frontend/static/data/**.json` written by `pipeline.export`, which must be deterministic (run twice, no diff).
6. **Tickets**:
   Work follows `tickets/INDEX.md` in order. The current run starts at T-12.
