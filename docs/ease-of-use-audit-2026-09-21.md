# Ease-of-use audit, 2026-09-21

Heuristic walkthrough of the production build (`vite build` + `vite preview`) against the code, at three viewports: desktop 1440x900, phone 390x844 (touch), kiosk 1080x1920 portrait (touch). English interface only. Screenshots and DOM probes were taken with Playwright; the script is not kept.

**Surfaces:** Sitting Stage (`/sitting/{date}`), Register (`/register`), Members (`/members`, `/members/{id}`), Search, landing page, kiosk mode (`?kiosk=1`).

**Personas:** first-visit citizen; journalist or researcher; walk-up kiosk visitor.

**Tasks tested:**

| # | Task | Desktop | Phone | Kiosk |
|---|------|---------|-------|-------|
| 1 | Find what happened on a given day | Pass, with no orientation (F2, F3) | Pass, plates cover the text (F4) | Pass |
| 2 | Find my Member and what they said | **Fail from the front door** (F1) | Fail (F1, F5) | Fail (F1) |
| 3 | Find how Members voted on a topic | Pass only via the Register and one sitting at a time (F13) | Same | Same |
| 4 | Verify a quote against Y Cofnod in two clicks | **Fail**: XML download or no link (F7) | Fail | Fail (QR to XML) |

Severity: **Blocker** stops a task; **Major** makes a task slow or unlikely without help; **Minor** is friction.

---

## Findings

### F1. The Stage has no route to Members, Search or the Guide. Blocker for task 2.
`/` redirects to the latest sitting, and `+layout.svelte` hides `GlobalHeader` on every `/sitting` route. The Stage's `TopStrip` links only to "Session stats" and "Register". A visitor who arrives at the front door has no link to `/members`, `/search`, the landing page or the Guide, and must guess a URL. The kiosk visitor has the same problem with no address bar.
Files: `frontend/src/routes/+layout.svelte`, `frontend/src/lib/stage/ui/TopStrip.svelte`.

### F2. The landing page and the onboarding Guide are unreachable by address. Major.
`routes/+page.ts` redirects during prerender, so `build/index.html` is a script-and-meta redirect; `/?home=1` typed into the address bar loses the query and also redirects. The only working path is the brand link in `TopStrip`, which is a client-side navigation. The Guide opens only from the `GlobalHeader` button (hidden on the Stage) or `?guide=1`, which nothing links to. `OnboardingModal` writes `siambr_onboarded` on "Don't show this guide on startup", but no code reads it: the guide never shows on startup, so the checkbox is dead.
Files: `frontend/src/routes/+page.ts`, `frontend/src/lib/nav/OnboardingModal.svelte`, `frontend/src/lib/nav/GlobalHeader.svelte`.

### F3. First arrival on the Stage offers no orientation. Major.
The sitting opens paused. The only hint plate says "Drag to orbit · wheel to zoom · click a desk", which is about the camera, not about what the page is or that Play starts the day. Nothing names the three regions (chamber, transcript, running order) or the scrub bar. Combined with F1 and F2 a first visitor has no path to help.
File: `frontend/src/lib/hud/SiambrHud.svelte` (controls plate).

### F4. Phone: HUD plates cover the transcript sheet. Major on phone.
`SiambrHud`'s `.bottom-stack` (controls hint, vote legend, seating and provenance notice) is absolute to `.chamber`, and on phones the `StageSheet` (transcript) is also inside `.chamber` at 50 to 90 vh. The plates sit on top of the running text and the "What was voted on" block; the visitor must find and press two small dismiss buttons before reading. Screenshot: phone at `?t=13320` shows the legend and the seating notice over the motion text.
Files: `frontend/src/lib/hud/SiambrHud.svelte`, `frontend/src/lib/stage/ui/StageSheet.svelte`, `frontend/src/routes/sitting/[date]/+page.svelte`.

### F5. Phone: the global nav overflows and hides Search and Stats. Major on phone.
`.primary-nav` is `overflow-x: auto; white-space: nowrap` with no scroll affordance. At 390 px "Search" and "Stats" are clipped off the right edge (probe: `Search:false, Stats:false` within viewport). A phone visitor on the Register or Members cannot see that Search exists.
File: `frontend/src/lib/nav/GlobalHeader.svelte`.

### F6. Keyboard entry on the Stage lands in the running order, not the transport. Major.
Pressing Tab on a freshly loaded sitting focuses the first running-order row, not the Play button; the next thirteen Tabs walk rows of a 237-row list. There is no skip link to the transcript or the transport, and each row is a tab stop. Space does play, but only once focus is somewhere that is not a button.
Files: `frontend/src/lib/stage/ui/RunningOrder.svelte`, `frontend/src/routes/sitting/[date]/+page.svelte`.

### F7. Verifying a quote against the Record is a download or impossible. Major, all personas.
On the Stage the only Record link is the timestamp in the provenance plate, which points at `record.senedd.wales/XMLExport/Download?...` and downloads an XML file. Search results and the Member page speeches link to Senedd TV only, with no link to the Record at all. The spec's promise is "every quote traceable to an active canonical URL"; today a reader gets a file, not a page. In kiosk mode the XML link becomes a QR code that opens a download on a phone.
Files: `frontend/src/lib/stage/ui/ProvenanceStrip.svelte`, `frontend/src/routes/search/+page.svelte`, `frontend/src/routes/members/[id]/+page.svelte`, `frontend/src/lib/hud/SpeechStack.svelte`; export in `pipeline/export.py` (a per-sitting Record page URL is not exported).

### F8. The Stage's "Register" link discards the sitting. Minor.
`TopStrip` links to `/register` with no `?item=`, so the visitor lands at the top of a 17-sitting page. The vote view's "Read it in the Register" does carry the item and is the better pattern.

### F9. Register filters behave two ways. Major.
Typing in "Filter debates" filters live; the Term, Domain and Speaker selects do nothing until "Apply filters" is pressed. Nothing says so. The first three sittings open by default, which makes the page 5,500 px tall on desktop and 8,700 px on phone before the visitor reaches sitting four.
File: `frontend/src/routes/register/+page.svelte`.

### F10. Members page: postcode field has no example, and a copy slip. Minor.
The postcode input has no placeholder or example format. The lede reads "Seventh Senedd:96 Members" (missing space after the colon). Regional Members are listed as "(regional)" with no explanation of what a regional seat is.
File: `frontend/src/routes/members/+page.svelte`.

### F11. Member page opens five sitting days of full speeches. Minor.
Every contribution for the first five days renders open, clamped to six lines with a "Read in full" checkbox. The page reaches 10,000 px on desktop before the ballots section, which is the part most citizens want. A one-line summary strip at the top (last spoke, contributions this term, divisions) would let the reader jump.
File: `frontend/src/routes/members/[id]/+page.svelte`.

### F12. Stats table scrolls sideways on phone and wraps durations. Minor.
The Member table needs horizontal scroll at 390 px and "34 m 31 s" wraps across two lines. Consider dropping the Untimed column below a breakpoint and formatting as `34:31`.
File: `frontend/src/lib/stats/MemberTable.svelte`.

### F13. Votes cannot be found across sittings. Major for journalists.
There is no list, filter or search of divisions. The routes to a vote are: Register → a sitting → "Voting Time" → dossier; or the Stage's scrub bar; or one Member's ballot history. A journalist asking "how did the Senedd vote on X" must know the date. Search indexes contributions only.
Files: `frontend/src/routes/search/+page.svelte`, `pipeline/export.py` (search index), `frontend/src/routes/register/+page.svelte`.

### F14. Dates are ISO in most places and prose in the Register. Minor.
The Stage picker, Member page, Search results and Stats show `2026-09-16`; the Register shows "16 September 2026". Pick one; prose reads better for citizens and `<time datetime>` keeps the machine form.

### F15. The sitting picker is a select with no previous or next. Minor.
`TopStrip` offers a `<select>` of ISO dates grouped by month. A previous-sitting and next-sitting pair beside it would serve the "what happened yesterday" question faster.

### F16. Kiosk mode is sticky in localStorage. Minor, worth knowing.
`kiosk.sync` stores `siambr.kiosk=1` and keeps it on every later visit until `?kiosk=0`. A visitor who follows a shared `?kiosk=1` link on their own device is left with no header, QR codes instead of links, and no obvious way out. Also unverified: a tap on "Register" from the kiosk Stage did not navigate in the probe; it may have been a hit-test miss on the small link (53x19 px). Both links in that corner are below the 44 px tap minimum.

### F17. Search has no scope controls. Minor.
Results cap at 50 with a "50+" marker, no filter by Member, date or item type, no sort. Result rows repeat "See it in the chamber" and "Register item" fifty times.

### F18. Dismissed plates return on every load. Minor.
The controls hint and the seating notice are dismissed per page instance only. A regular visitor closes them on every sitting.

### F19. The "Speaking now" pill covers the lit desk. Minor.
On desktop the beacon sits over the speaker's own desk, hiding the floor light it points at. Offsetting it above the desk by one desk height would show both.

### F20. Small text and small targets. Minor, note for the a11y pass.
Register renders 126 text runs under 12 px (type and domain badges). Stage top-right links are 19 px tall. Member page "Read in full" checkboxes are 13 px.

---

## Tickets raised

Blockers and majors only, per the brief.

- T-26 Stage wayfinding and first run (F1, F2, F3, F6, F18)
- T-27 Phone stage and header layout (F4, F5)
- T-28 Record links on every quote (F7)
- T-29 Divisions index and search (F13)
- T-30 Register filter behaviour and page length (F9)

Minors (F8, F10, F11, F12, F14, F15, F16, F17, F19, F20) stay here for a later polish ticket.
