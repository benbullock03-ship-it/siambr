# Siambr Implementation Tickets Index

> **Execution Model**: tickets run **in series** in the order below. Each produces working, tested code with explicit pass/fail criteria before the next begins.
>
> **Spec 2.0.0 (2026-09-20)**: the product is one sitting day on a 3D stage plus a 2D Register. Corridors, plinths, trails, quotation cards and the runtime API were withdrawn. T-09, T-10, T-11 are withdrawn; T-06 is superseded; T-04, T-05, T-07, T-08 carry amendment notes. The new run starts at T-12.

---

## Ticket Progression Pipeline

```
Foundation (done)          T-01 Scaffolding  ->  T-02 Schema  ->  T-03 Members  ->  T-07 Register  ->  T-08 Chamber

Spec 2.0.0 run
  T-12 Withdraw corridors, plinths, trails
     |
  T-13 Sitting clock fields + Seventh Senedd backfill        (T-04 amended feeds this)
     |
  T-14 Static export + adapter-static + data layer
     |
  T-15 pipeline.sync + GitHub Actions + Cloudflare Pages    <-- site goes live here, tracking sittings
     |
  T-16 Playback engine (pure TS)
     |
  T-17 Chamber stage: floor light, guided camera
     |
  T-18 Stage HUD: /sitting/[date], transcript, transport
     |                                  \
  T-20 Register: Member pages, search     T-05 Divisions (amended)  ->  T-19 Divisions on the stage
     |
  T-21 Derived stats
     |
  T-22 Kiosk / attract mode          T-23 Chamber polish pass (any time after T-17)
     |
  T-24 Verification gates
```

---

## Ticket Directory

| ID | Title | Layer | Depends | Status |
|---|---|---|---|---|
| [T-01](T-01-scaffolding-and-tokens.md) | Repo Scaffolding, SvelteKit 5 + Threlte, Senedd Estate Tokens | Foundation | — | `done` |
| [T-02](T-02-sqlite-schema-and-migrations.md) | SQLite Schema, Migrations, Policy Domain Seeding | Database | T-01 | `done` |
| [T-03](T-03-canonical-members-registry.md) | Modern.Gov Adapter: Member Identities, Tenures, Portfolios | Pipeline | T-02 | `done` |
| [T-04](T-04-plenary-xml-ingestion-engine.md) | Plenary XML Ingestion: Bronze Cache and Normalisation *(amended: Seventh Senedd first)* | Pipeline | T-03 | `pending` |
| [T-05](T-05-divisions-and-petitions-linking.md) | Roll-Call Divisions *(amended: petitions optional)* | Pipeline | T-04 | `pending` |
| [T-06](T-06-api-and-fts5-search.md) | FastAPI Serving Layer and FTS5 Search *(dev-only from T-14)* | Backend | T-05 | `superseded` |
| [T-07](T-07-2d-register-and-dossier-plate.md) | 2D Register and the Dossier Plate *(amended: Journey Track and compare withdrawn)* | Frontend | T-06 | `done` |
| [T-08](T-08-3d-siambr-rotunda.md) | 3D Siambr Chamber, Funnel and Member Desks *(amended: walk becomes opt-in)* | 3D | T-07 | `done` |
| [T-09](T-09-corridors-and-debate-plinths.md) | Corridors, Plinths and Frustum Streaming | 3D | T-08 | `withdrawn` |
| [T-10](T-10-dual-mode-hud-and-onboarding.md) | Dual-Mode Switcher, Multi-Door Entry, Compass | UX | T-09 | `withdrawn` |
| [T-11](T-11-quotation-cards-and-verification.md) | Quotation Cards and Integrity Gates | Verification | T-10 | `withdrawn` |
| [T-12](T-12-withdraw-corridors-and-plinths.md) | Withdraw Corridors, Plinths, Trails and Quotation Cards | Cleanup | T-09 | `done` |
| [T-13](T-13-sitting-clock-fields-and-term7-backfill.md) | Sitting Clock Fields, Record Currency, Seventh Senedd Backfill | Pipeline | T-12, T-04 | `done` |
| [T-14](T-14-static-export-and-data-layer.md) | Static Export (Gold to JSON), adapter-static, Frontend Data Layer | Pipeline + Frontend | T-13 | `pending` |
| [T-15](T-15-sync-and-deploy.md) | pipeline.sync, GitHub Actions Poller, Cloudflare Pages Deploy | Pipeline + Ops | T-14 | `pending` |
| [T-16](T-16-playback-engine.md) | The Sitting Clock: Pure TypeScript Playback Engine | Frontend | T-14 | `pending` |
| [T-17](T-17-chamber-stage-floor-light-and-guided-camera.md) | Chamber Stage: Floor Light, Spoken Marks, Guided Camera | 3D | T-16, T-08 | `pending` |
| [T-18](T-18-stage-hud-transcript-and-transport.md) | Stage HUD: /sitting/[date], Transcript Column, Running Order, Transport | Frontend | T-17 | `pending` |
| [T-19](T-19-divisions-on-the-stage.md) | Divisions on the Stage: Desk Tints, Wall Clocks, Division Plate | 3D + Frontend | T-05, T-17, T-18 | `pending` |
| [T-20](T-20-member-register-and-search.md) | The Register: Member Pages, Members Index, Postcode Lookup, Client Search | Frontend | T-14 | `pending` |
| [T-21](T-21-derived-stats.md) | Derived Stats: Speaking Time by Party and Member | Pipeline + Frontend | T-20, T-16 | `pending` |
| [T-22](T-22-kiosk-attract-mode.md) | Kiosk and Attract Mode | Frontend | T-18 | `pending` |
| [T-23](T-23-chamber-polish-pass.md) | Chamber Polish Pass: Lighting, Materials, Clocks, Screens, Gallery | 3D | T-17 | `pending` |
| [T-24](T-24-verification-gates.md) | Verification Gates: Verbatim, Timeline, Provenance, Prose, A11y, Perf, Determinism | Verification | T-18, T-20, T-21 | `pending` |

---

## Decisions recorded 2026-09-20

- Playback is real time from Senedd TV `startPos`, with 1x/4x/16x and stepping.
- Guided camera by default; free walk is an opt-in toggle.
- English UI now; a reviewed Welsh interface pass later, not machine translation.
- Chamber model stays; polish passes only.
- Front door is the latest sitting, paused, one Play.
- Senedd TV is link-out only.
- Full verbatim text in the stage HUD, scrolling at real pace.
- Member profile pages are the register of record.
- Stats per sitting and per term, badged derived.
- Kiosk attract mode behind `?kiosk=1`.
- Data depth on the Seventh Senedd first: all sittings, timestamps, divisions.
- Zero-cost hosting: static site on Cloudflare Pages, GitHub Actions polling every 30 minutes on sitting days.
- Sync failures: default Actions email only.
