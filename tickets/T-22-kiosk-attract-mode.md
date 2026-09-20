---
id: T-22
title: "Kiosk and Attract Mode"
kind: frontend
status: done
depends: [T-18]
---

# T-22 — Kiosk and Attract Mode

**What to build:**  
Let the stage run unattended on a screen at the Senedd or anywhere else. Spec 2.0.0 section 9.3.

### Acceptance Criteria
- [x] `?kiosk=1` sets `localStorage.siambr.kiosk = "1"`; `?kiosk=0` clears it. Kiosk state is read on every route.
- [x] In kiosk: after 120 s without input, the camera drifts slowly between vantage points (a 40 s loop, eased, no cuts) and playback runs the latest sitting at 1x with the transcript column visible. Any pointer, touch or key input stops the drift, returns to the Gallery vantage and shows the transport. Idle timer restarts.
- [x] After 10 minutes idle the sitting resets to its first timed contribution and keeps playing.
- [x] Hidden in kiosk: walk toggle, pointer lock, the browser-style external links. Senedd TV and senedd.wales links render as a small QR code (generated client-side) with the URL printed beneath.
- [x] Reduced motion in kiosk: no drift; playback still runs; camera holds Gallery.
- [x] A 1920x1080 Playwright run at 1x for 3 minutes with `kiosk=1` shows no console errors, no memory growth over 50 MB, and the drift loop is continuous (screenshots at 0, 60, 120, 180 s differ).

**Notes:**
- Off by default on the public web. Nothing here changes the non-kiosk experience.
- Kiosk lockdown (browser kiosk flags, no address bar) is the venue's job, not Siambr's.
