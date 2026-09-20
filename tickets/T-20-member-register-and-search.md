---
id: T-20
title: "The Register: Member Pages, Members Index, Postcode Lookup and Client Search"
kind: frontend
status: done
depends: [T-14]
---

# T-20 — The Register: Member Pages, Members Index, Postcode Lookup and Client Search

**What to build:**  
The 2D register of record: where a constituent finds what their Member said, and then watches it. Spec 2.0.0 section 5.2.

### Acceptance Criteria
- [x] `/members`: every Member of the current term from `members/index.json`, grouped by party (largest first) then alphabetical, with portrait, seat or region, roles. A name filter (client-side, instant). A postcode field: browser-side call to `https://api.postcodes.io/postcodes/{postcode}` for the Senedd constituency GSS code, matched on `gss_constituency_code`; regional Members for that region listed beneath; unknown or non-Welsh postcode says so plainly.
- [x] `/members/[id]`: prerendered per Member from `members/{id}.json`. Header: portrait, name, Welsh name, honorific, party, seat, tenures, ministerial roles with dates, official profile link. Then **contributions grouped by sitting day**, newest first, each with date, item title, language tag, full verbatim text (collapsed after 6 lines with "Read in full"), a *See it in the chamber* link to `/sitting/{date}?t={t_start}` (omitted with a note when untimed), and the Senedd TV link. Then the roll-call divisions table. Then the citation footer.
- [x] `/register`: sittings index from `sittings/index.json`, newest first, grouped by term; filters by term, policy domain (badged derived) and speaker; each item opens the Dossier Plate and carries *Watch it play* to `/sitting/{date}?item={id}`. Each sitting row shows `record_published_at`.
- [x] `/search`: `pipeline.export` writes `search/index.json` (MiniSearch serialised index over contribution text, member name, item title, date). The page loads it lazily, searches client-side, shows snippets with the match highlighted, and links each result to the Register item and to the Stage moment. Empty query shows nothing; no results says so.
- [x] The Member plate drawer gains a link to `/members/{id}`.
- [x] axe WCAG 2.2 AA on all four routes; prose linter clean; Lighthouse performance 90+ on `/members/[id]` for the Member with the most contributions. *(axe and Lighthouse verified; the prose linter does not exist until T-24)*

**Notes:**
- The FTS5 table in Gold is not used at runtime. It stays for `run_checks` and local inspection.
- Search index size: budget 3 MB gzipped for a full term. If it grows past that, split by term and load on demand.

### Notes (done 2026-09-20)
- `/members`: party groups as before, links now go to `/members/{id}`. Postcode lookup calls `https://api.postcodes.io/postcodes/{postcode}` from the browser. postcodes.io names the 2026 Senedd constituency (`senedd_constituency`, e.g. "Caerdydd Penarth") but publishes **no GSS code** for it (`codes` carries only the Westminster W07 code), while our Members carry W09 codes and the constituency name in both languages. The match is therefore on the folded constituency name (English or Welsh), with a GSS match kept for the day postcodes.io adds one. Regional Members are listed by `region` when the term has any (the Seventh Senedd has none: 96 constituency Members, 16 constituencies of 6). Non-Welsh postcodes, unknown postcodes and a service failure each get their own plain sentence. The e2e test mocks the service with `page.route`.
- `/members/[id]`: prerendered for every exported Member file (228, current and former) by listing `static/data/members/*.json` in `svelte.config.js`; the SPA fallback 404s any other id. The route sets `csr = false`: the register of record is plain HTML with no hydration. "Read in full" is a labelled checkbox that lifts a six-line CSS clamp via `:has()`; every contribution's full verbatim text is in the document at all times. Sitting days are native `<details>`, the newest five open, with `content-visibility: auto` so off-screen days skip layout. Contributions carry the Senedd TV link, which the export now writes as `tv_url` on Member contributions (T-14 shape amended; `types.ts` and the export test updated). Untimed contributions say why they cannot be placed on the stage. Divisions table and citation footer as in the Member plate; the plate links to the page.
- Lighthouse (mobile defaults, `--only-categories=performance`, on `vite preview` of the real build) for `ms-huw-irranca-davies`, 499 contributions: **0.63** with hydration (TBT 1,340 ms), **0.88** after `csr = false`, **0.92 and 0.93** on two runs after `content-visibility` (TBT 240 to 270 ms, LCP 2.1 s, 161 KiB transferred). Measured before the final markup change that moved the sitting link out of the `<summary>` (an axe `nested-interactive` finding).
- `/register`: each item row carries *Watch it play* to `/sitting/{date}?item={id}`; the sitting header keeps the whole-sitting link; a line per sitting shows `record_published_at` (or "Record publication time not stated") and the contribution count. Filters unchanged from T-14.
- `/search`: `pipeline.export` writes `search/index.json` as `{engine: "minisearch", fields, store_fields, documents}`; the browser builds the MiniSearch index lazily on the first query (`minisearch` added as a devDependency, code-split). A serialised MiniSearch index cannot be produced from Python without reimplementing the library's internal format, so the export ships the documents and the client indexes them; the criterion's intent (prebuilt, static, client-side) holds. Real index: 4,044 documents, 6.1 MB raw, **1.76 MB gzipped** (budget 3 MB). Fields: English text, Welsh original for Welsh contributions, Member name, item title, date; prefix and light fuzzy matching, Member name boosted. Snippets take a window of the stored verbatim text around the first matched term with `<mark>` on the terms; nothing is rewritten. Each result links to the Member page, the Register item and the stage moment (`?t=` or `?item=` when untimed). `?q=` is written with `replaceState` after `afterNavigate` (calling it during hydration throws). Empty query shows nothing; no results says so.
- New e2e file `members.spec.ts` (6 tests): index and name filter with axe, postcode paths, Member page with axe, unknown id 404, Register item links and stamp with axe, search with axe before and after results. Two tests wait for hydration explicitly because the pages are prerendered.
- `lighthouse` added as a devDependency for the gate; not wired into a script.
- Gates: `npx vitest run` 122 passed; `svelte-check` 0 errors 0 warnings; `npx playwright test` 23 passed; `python -m unittest` 114 passed (2 new export tests); `python -m pipeline.run_checks` 6/6; export run twice, hash-identical; `npm run build` ok (228 Member pages, 17 sitting pages, `/search`); no `/api/` in `frontend/src`. Prose linter: pending T-24.

