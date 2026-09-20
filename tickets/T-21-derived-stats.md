---
id: T-21
title: "Derived Stats: Speaking Time by Party and Member, per Sitting and per Term"
kind: pipeline+frontend
status: pending
depends: [T-20, T-16]
---

# T-21 — Derived Stats: Speaking Time by Party and Member, per Sitting and per Term

**What to build:**  
Answer "which parties spoke about what, and for how long" with sums of the record, badged as derived. Spec 2.0.0 section 5.2.

### Acceptance Criteria
- [ ] `pipeline.export` writes `stats/sittings/{date}.json` and `stats/terms/{n}.json`, each with `provenance: "PROVENANCE_DERIVED"` at the top level and a `method` string in plain English ("Speaking time is the gap between a contribution's Senedd TV start and the next timed contribution's start. Untimed contributions carry no time.").
- [ ] Per sitting: speaking seconds and contribution count by Member; by party (using `party_id_at_date`); by agenda item; count and share of Welsh-language contributions; number of untimed contributions (reported, not hidden); divisions count.
- [ ] Per term: the same aggregated across sittings, plus contributions and speaking seconds by party by policy domain (domain badged derived).
- [ ] `/sitting/[date]/stats`: a Register-style page with a derived badge in the header, a horizontal bar chart of speaking time by party, a table by Member (sortable), a table by item, and the untimed count. Charts follow the `dataviz` skill conventions and DESIGN.md tokens; party colours only where the bar is a party.
- [ ] `/terms/[n]/stats`: the same plus a party-by-domain matrix (counts, not percentages, with the row and column totals shown).
- [ ] The Stage top strip links to the sitting's stats page; the Register term header links to the term's.
- [ ] Every figure on both pages reconciles to the sitting JSON: a `vitest` test recomputes one sitting's stats from its exported JSON and compares.
- [ ] Provenance badging test (T-24) recognises these pages.

**Notes:**
- No percentages of "attention" or "dominance", no rankings with adjectives. Counts, seconds, and shares of a stated total only. The prose linter bans the rest.
