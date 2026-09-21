---
id: T-34
title: "Sitting Record Module: Shell Pages, One Loader, Cached Data"
kind: frontend
status: done
depends: [T-14, T-33]
---

# T-34 — Sitting Record Module

**What to build:**  
Deepen `lib/data/loaders.ts` into the one module every route loads data through. The prerendered `/sitting/{date}` page stops inlining the sitting: 90% of its 1.34 MB today is `data-sveltekit-fetched` JSON.

---

### Step 1 — Shell sitting page

- [x] `routes/sitting/[date]/+page.server.ts` (build time only) returns `{ summary, prev, next }` from `sittings/index.json`. `+page.ts` is removed.
- [x] `Stage` fetches the sitting and its term in the browser through the module; the shell shows the header and a loading line until both arrive.
- [x] `<link rel="preload" as="fetch" crossorigin>` for the sitting JSON in the shell head.
- [x] `TopStrip` gets the sitting dates, not the whole sittings index.

### Step 2 — One loader, cached in the browser

- [x] In the browser, one promise per path: concurrent calls share a fetch, a failed fetch is dropped.
- [x] Sittings and terms: last 3 of each kept. Indexes kept for the tab's life.
- [x] During prerender nothing is cached, so each page inlines exactly what it fetched.
- [x] Pages read `site` from `await parent()`; no page calls `loadIndex` again.
- [x] The Register dossier loads its sitting through the cache.

### Step 3 — HTTP cache

- [x] `frontend/static/_headers`: `/data/*` → `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.

### Gates
- Vitest on the module with a fake `fetch`: one request per path, eviction after 3, failure not cached, no cache during prerender.
- `scripts/check-page-budget.mjs` after `npm run build`: every `build/sitting/*.html` under 250 KB, no `data-sveltekit-fetched` block over 16 KB. Runs in `deploy.yml`.
- `npm run check`, `npm test`, `npm run test:a11y`.

**Out of scope:** per-item sitting files from the export; the size of `/members/{id}` HTML.

**Notes:**

Done 2026-09-21.

- **Shell.** `+page.server.ts` returns the summary (date, term, titles) and every sitting date, about 200 B, since `TopStrip`'s picker lists all dates rather than stepping prev/next. `+page.svelte` shows the heading and "Loading the sitting…" until `loadStage` resolves, then mounts `Stage`. The preload link is emitted in prerendered HTML only; on client navigation it would re-request a sitting the store already holds.
- **Store.** `createDataStore(enabled)` in `loaders.ts`; the exported loaders are bound to `createDataStore(browser)`. Kept: indexes for the tab, last 3 sittings, terms, Member files and stats; the 6 MB search index never (the search page holds its own engine). A failed fetch is dropped.
- **Numbers** (`vite preview` of the production build, headless Chromium):
  - `/sitting/2026-07-14` HTML: 1,342,766 B → 7,489 B. All 17 sitting pages: 15,497,100 B → 127,313 B.
  - First visit, uncompressed bodies: 3,331,830 B → 3,063,781 B. The sitting JSON now arrives as its own cacheable file.
  - Client navigation 07-14 → 07-15 → 07-14 → 07-15: each sitting JSON requested once, `terms/7.json` once. Before, every navigation refetched the sitting.
  - `/register` 366,950 B → 364,136 B (one inlined `index.json` instead of two).
- **Test fix.** `siambr.spec.ts` camera test: the shell paints text early, so the webfonts now load before the canvas; at 1280 px the strip then wraps and the controls plate covers the click row. The test now waits for `document.fonts.ready` at 1600×900. On HEAD it passed only because the fonts never loaded while SwiftShader held the main thread.
- **Gates.** `npm run check` 0 errors; `npm test` 30 files, 305 passed; `check_prose` 0 findings; `check-page-budget.mjs` largest 7,489 B; a11y + stage + screen-video e2e 33 of 35 with 2 workers. The two failures (`screen-video` desktop and reduced motion, 30 s timeouts) fail identically on HEAD under 2 workers and pass with `--workers 1`.
