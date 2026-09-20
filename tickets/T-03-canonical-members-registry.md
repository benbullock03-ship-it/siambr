---
id: T-03
title: "Modern.Gov SOAP Adapter: 25 Years of MS Identities, Tenures & Portfolios"
kind: pipeline
status: done
depends: [T-02]
---

# T-03 — Modern.Gov SOAP Adapter: 25 Years of MS Identities, Tenures & Portfolios

**What to build:**  
Implement the Modern.Gov SOAP/XML adapter (`pipeline/adapters/moderngov.py`) connecting to `http://business.senedd.wales/mgwebservice.asmx` to ingest, reconcile, and store all historical and current Members of the Senedd (MS/AM), their party tenures, and cabinet ministerial portfolios into `members`, `member_tenures`, and `ministerial_roles`.

### Acceptance Criteria
- [x] `pipeline/adapters/moderngov.py` fetches and parses `GetMembersXml`, handling network retries with exponential backoff.
- [x] Ingests canonical biographical details: full name, Cymraeg name, honorific, constituency/region, ONS GSS constituency code, portrait URL, and official Senedd profile URL.
- [x] Handles multi-term historical tenures and party allegiance switches across all six Senedds (e.g. tracking members who shifted parties or transitioned between backbench and ministerial office).
- [x] Normalizes historical Assembly Members (1999–2020) and Members of the Senedd (2020–present) into unified canonical IDs (`ms-{slug}`).
- [x] CLI command `python -m pipeline.reconcile_members` executes ingestion with dry-run support (`--dry-run`).
- [x] Test `tests/test_members_registry.py` asserts:
  - Exactly 96 active Members exist for the Seventh Senedd (elected 7 May 2026; the ticket text originally said 60 for the Sixth Senedd, written before that election).
  - Historical First Ministers (Alun Michael, Rhodri Morgan, Carwyn Jones, Mark Drakeford, Vaughan Gething, Eluned Morgan) are present with valid ministerial date ranges.
  - Zero duplicate IDs and 100% GSS constituency mapping coverage for all 40 Welsh constituencies.
