---
id: T-20
title: "The Register: Member Pages, Members Index, Postcode Lookup and Client Search"
kind: frontend
status: pending
depends: [T-14]
---

# T-20 — The Register: Member Pages, Members Index, Postcode Lookup and Client Search

**What to build:**  
The 2D register of record: where a constituent finds what their Member said, and then watches it. Spec 2.0.0 section 5.2.

### Acceptance Criteria
- [ ] `/members`: every Member of the current term from `members/index.json`, grouped by party (largest first) then alphabetical, with portrait, seat or region, roles. A name filter (client-side, instant). A postcode field: browser-side call to `https://api.postcodes.io/postcodes/{postcode}` for the Senedd constituency GSS code, matched on `gss_constituency_code`; regional Members for that region listed beneath; unknown or non-Welsh postcode says so plainly.
- [ ] `/members/[id]`: prerendered per Member from `members/{id}.json`. Header: portrait, name, Welsh name, honorific, party, seat, tenures, ministerial roles with dates, official profile link. Then **contributions grouped by sitting day**, newest first, each with date, item title, language tag, full verbatim text (collapsed after 6 lines with "Read in full"), a *See it in the chamber* link to `/sitting/{date}?t={t_start}` (omitted with a note when untimed), and the Senedd TV link. Then the roll-call divisions table. Then the citation footer.
- [ ] `/register`: sittings index from `sittings/index.json`, newest first, grouped by term; filters by term, policy domain (badged derived) and speaker; each item opens the Dossier Plate and carries *Watch it play* to `/sitting/{date}?item={id}`. Each sitting row shows `record_published_at`.
- [ ] `/search`: `pipeline.export` writes `search/index.json` (MiniSearch serialised index over contribution text, member name, item title, date). The page loads it lazily, searches client-side, shows snippets with the match highlighted, and links each result to the Register item and to the Stage moment. Empty query shows nothing; no results says so.
- [ ] The Member plate drawer gains a link to `/members/{id}`.
- [ ] axe WCAG 2.2 AA on all four routes; prose linter clean; Lighthouse performance 90+ on `/members/[id]` for the Member with the most contributions.

**Notes:**
- The FTS5 table in Gold is not used at runtime. It stays for `run_checks` and local inspection.
- Search index size: budget 3 MB gzipped for a full term. If it grows past that, split by term and load on demand.
