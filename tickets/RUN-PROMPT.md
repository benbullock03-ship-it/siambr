Work through the Siambr spec 2.0.0 ticket run in `tickets/`, in this exact order, one ticket at a time:

T-12, T-13, T-14, T-15, T-16, T-17, T-18, T-20, T-05, T-19, T-21, T-23, T-22, T-24

Before starting, read `CLAUDE.md`, `siambr-spec.md` (2.0.0), `DOMAIN_MODEL.md`, `DESIGN.md` and `tickets/INDEX.md`. Read the ticket file in full before starting it, plus any ticket it depends on.

For each ticket:
1. Set its frontmatter `status: in_progress`.
2. Build everything in its Acceptance Criteria. Do not narrow scope. If a criterion is impossible as written, do the rest, then explain in the ticket Notes exactly what was left and why.
3. Run every gate the ticket names and the project gates that exist at that point: `npx vitest run`, `npx playwright test`, `python -m unittest`, `python -m pipeline.run_checks`, `python -m scripts.check_prose` where they exist. All must pass before the ticket is done. Report the real output; never mark a criterion done that was not verified.
4. Tick each `- [ ]` to `- [x]` only when verified. Add a Notes section recording non-obvious decisions, numbers (counts, ID ranges, fps, sizes), and anything the next ticket needs to know.
5. Set `status: done`, update the row in `tickets/INDEX.md`.
6. Commit with a conventional message (`feat(T-16): sitting clock playback engine`), one commit per ticket, plus the attribution line. For T-15, initialise git first if the folder is not a repository.
7. Move to the next ticket without asking.

Rules that override everything:
- DEMOCRATIC TRUTH: never invent, edit, trim, paraphrase or stub a speech, a vote, a timestamp or a Member. Fixtures come from real exported data. If real data is missing (for example divisions before T-05), build against the schema and leave the feature visibly empty; never fake rows.
- Anything derived (seating, speaking time, `t_end_derived`, division placement, policy domain) carries `PROVENANCE_DERIVED` and a visible badge.
- Static only from T-14 on: `frontend/src` must not reference `/api/`. The backend is dev-only.
- `pipeline.export` must be deterministic. Run it twice and diff.
- Comments sparse. No narration comments, no banner blocks.
- Follow `DESIGN.md` tokens and editorial rules for all UI copy. English UI; Welsh content verbatim with the official translation beneath.
- Do not touch `src/lib/3d/chamber/` geometry or `materials.ts` tones except where T-17, T-19 or T-23 say so.
- Do not reintroduce anything withdrawn: corridors, plinths, wings, trails, Journey Track, compare, quotation cards, runtime FastAPI.

Stop and ask only if: a Senedd source is down for the whole of a ticket that needs it, a secret is required that does not exist (Cloudflare token in T-15: prepare the workflow, document the two secrets, mark that criterion pending, continue), or a criterion would require inventing data.

At the end of each ticket, print a short recap: what was built, gate results, what the next ticket needs. At the end of the run, print a summary table of all fourteen tickets with status and any deferred criteria.
