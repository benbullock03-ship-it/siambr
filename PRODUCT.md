# Product

## Platform

Static web (SvelteKit 5 + Threlte / WebGPU / Three.js), built from a SQLite Gold store by a Python pipeline and published as JSON. No server at runtime. Free hosting (Cloudflare Pages), free scheduling (GitHub Actions).

## Users

1. **Curious Citizens & Residents**: people who find PDF transcripts alienating but want to see what the Senedd actually did on a given day: who stood up, for how long, about what, and how the vote went.
2. **Constituents looking for their Member**: "what has my MS said, and where can I see it?" Find a Member by name or postcode; every contribution, grouped by sitting day, with a link that plays it in the chamber.
3. **Journalists, Researchers & Civil Society**: citable verbatim quotes, roll-call tallies, Senedd TV timestamps, and derived speaking-time figures that are honest about being derived.
4. **Visitors on Senedd premises**: a kiosk that runs the latest sitting unattended and survives being touched by anyone.

## Product Purpose

**Siambr** puts one sitting day of Senedd Cymru on a stage. Pick a plenary day, press Play: the chamber runs in real time, the speaking Member's desk lights up, their verbatim words scroll beside the chamber, the wall clock shows sitting time, and divisions colour the desks. Behind the stage sits a plain, publication-grade Register of every Member and every contribution.

Success means a visitor can:
1. Open the site and within ten seconds watch the most recent sitting play, with the right desk lit and the right words on screen.
2. Find their own Member and read, then watch, everything that Member said this term.
3. See at a glance which parties and which Members held the floor on a day, and for how long, with every figure traceable to the record.
4. View any sitting within a couple of hours of Senedd publishing its transcript, with no one touching the pipeline.

## Positioning & Differentiator

Parliamentary portals silo the transcript, the vote, the video and the Member profile into separate search forms. Siambr fuses them around the one thing every citizen understands: a day in the chamber, with a clock. Official sources only:
- **Plenary XML** (`record.senedd.wales/XMLExport`): transcripts and Senedd TV offsets
- **Modern.Gov Web Services** (`business.senedd.wales/mgwebservice.asmx`): Members, divisions
- **senedd.wales / gov.wales**: profiles, portraits, ministerial titles
- **Senedd TV** (`senedd.tv`): link-out at the exact moment

## Capabilities and Constraints

1. **Verbatim-First Democratic Charter**: Siambr never invents, spins or edits a speech or a vote. Speeches are the Record of Proceedings, whole.
2. **Strict Provenance Contracts**: seating, speaking time, party shares and topic groupings are derived by Siambr and are badged as such wherever they appear.
3. **Currency is honest**: every sitting shows the timestamp at which Senedd published the record on screen. Revisions replace the record whole.
4. **Dual-Surface Parity**: everything on the 3D Stage is reachable on the 2D Register, which loads no 3D code and is the reduced-motion path.
5. **Relocatability**: every sitting, item, contribution and Member links back to its canonical page on senedd.wales, record.senedd.wales or senedd.tv.
6. **English UI, Welsh content verbatim**: the interface is English with Welsh parliamentary terms; Welsh-language contributions and titles are shown in Cymraeg with the official translation beneath. A reviewed Welsh interface pass is planned, not machine-translated.
7. **Zero running cost**: static output, free hosting, free scheduling. Nothing in the design requires a server.

## Out of Scope (withdrawn 2026-09-20)

Longitudinal corridors, debate plinths, citizen trails, quotation cards, bill and committee tracking, the runtime FastAPI service. The chamber is the product.
