---
id: T-28
title: "Record Links on Every Quote: a Readable Y Cofnod Page, Not an XML Download"
kind: pipeline + frontend
status: pending
depends: [T-14, T-20]
---

# T-28 — Record Links on Every Quote

**What to build:**  
From `docs/ease-of-use-audit-2026-09-21.md` finding F7. The mission rule says every quote is traceable to an active canonical URL. Today the Stage's only Record link is the XML export download, and Search results and Member page speeches carry no Record link at all. A reader verifying a quote gets a file or nothing.

---

### Step 1 — Export the human-readable Record URL per sitting

- [ ] `pipeline/export.py` adds `record_page_url` to each sitting (index summary and `sittings/{date}.json`): the `record.senedd.wales/Plenary/{meetingID}` page for the meeting, derived from the same meeting id as `source_xml_url`. If the Record publishes a per-contribution anchor (check the page for `#C{id}` or similar), export `record_anchor` per contribution too; if it does not, export nothing rather than a guess.
- [ ] `source_xml_url` stays; it is the audit target and the verbatim gate uses it.
- [ ] `tests/test_export.py` asserts the URL shape for one sitting and that export stays deterministic.
- [ ] Verify one URL manually against the live site before shipping and record it in the notes.

### Step 2 — Link the Record wherever a quote is shown

- [ ] `ProvenanceStrip`: "Record of Proceedings · {date}" links to `record_page_url`; a second, smaller "XML" link keeps the export download. Kiosk: the QR encodes the page, not the XML.
- [ ] `Transcript` contribution view: below "Watch this moment on Senedd TV" add "Read this in the Record" to `record_page_url` (plus anchor when exported).
- [ ] `SpeechStack` (dossier and Member record drawer): the same link per speech.
- [ ] Search results: the same link per hit; the search index export carries `record_page_url` per document (or the page joins on `date` from the sittings index).
- [ ] Member page contributions: the same link per speech; the citation footer names the Record page for each day rather than the site root.
- [ ] Copy is one phrase everywhere: "Read this in the Record". Passes `scripts/check_prose.py`.

### Step 3 — Two-click check

- [ ] Playwright: from `/search?q=grooming`, the first result reaches a `record.senedd.wales` page link in one click (the link is on the result). From `/sitting/{date}`, the live contribution has the link visible without opening a drawer. From `/members/{id}`, every rendered speech has the link.

### Gates
- `python -m unittest`; `python -m pipeline.run_checks --sample 40` still zero drift; export determinism.
- `npx vitest run`; `svelte-check` 0 errors; `npm run build`.
- No `/api/` references.

**Notes:**
- The verbatim audit gate stays on the XML; this ticket changes what the reader is offered, not what is checked.
