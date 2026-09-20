---
id: T-04
title: "Plenary Hansard Ingestion Engine: Bronze Cache & Silver Normalization (1999–2026)"
kind: pipeline
status: pending
depends: [T-03]
---

# T-04 — Plenary Hansard Ingestion Engine: Bronze Cache & Silver Normalization (1999–2026)

**What to build:**  
Build the core parliamentary transcript ingestion engine consuming plenary debate XML feeds from `http://record.senedd.wales/XMLExport`. Implements the Bronze tier (immutable local raw XML cache with SHA-256 byte signatures) and Silver tier (normalization across varying schemas from 1999 to 2026) into `plenary_sessions`, `agenda_items`, and `debate_contributions`.

### Acceptance Criteria
- [ ] `pipeline/adapters/plenary_xml.py` fetches plenary meeting XMLs, writing verbatim responses to `data/bronze/{year}/{session_date}.xml` with SHA-256 checksums recorded.
- [ ] Silver normalizer parses:
  - `<Meeting>` metadata: session date, term, title, presiding officer.
  - `<ItemTitle>`, `<ItemType>`: debates, oral questions, statements, legislative stages.
  - `<Speaker>`, `<Paragraph>`: individual spoken contributions with sequence numbers.
- [ ] Normalizes 25 years of schema changes:
  - 1999–2007 legacy unstructured speaker prefixes (`"Name [Role]:"`).
  - 2007–2016 transitional XML schema.
  - 2016–2026 modern Crown XML format with bilingual tags.
- [ ] Spoken language detection (`spoken_language = 'cy'` or `'en'`). Where a speech was uttered in Welsh, preserves both native Cymraeg and the official English translation.
- [ ] Preserves complete verbatim accuracy: punctuation, procedural interjections, and presiding officer interventions are never abridged.
- [ ] CLI command `python -m pipeline.ingest_plenary --year YYYY` (with `--all` for full 1999–2026 ingestion).
- [ ] Test `tests/test_plenary_ingestion.py` validates byte-level verbatim fidelity by diffing parsed speech text against raw XML test fixtures.

### Amendment under spec 2.0.0 (2026-09-20)
> **Spec 2.0.0 (2026-09-20)**: scope is **depth on the Seventh Senedd first**. The 1999–2016 schema handling stays on this ticket but is deferred until the Seventh Senedd is complete. The sitting-clock fields, the `--scan-from` backfill and `record_published_at` are split out to [T-13](T-13-sitting-clock-fields-and-term7-backfill.md). Bronze path is `data/bronze/plenary/{year}/{date}-{meeting}.xml` as implemented, not `{session_date}.xml`.
