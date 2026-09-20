---
id: T-23
title: "Chamber Polish Pass: Lighting, Materials, Clocks, Screens and Gallery"
kind: 3d
status: pending
depends: [T-17]
---

# T-23 — Chamber Polish Pass: Lighting, Materials, Clocks, Screens and Gallery

**What to build:**  
Passes over the existing chamber model against the 2026 Matterport scan (`hC9XLKU7RQ6`, snapshots `2VhcBCECD73`, `CwNsp65StxL`, `wSTA7sLq856`) until it reads as the real room from the Gallery, Y Llywydd and Speaker vantages. No new geometry systems; refinement of what T-08 built. Spec 2.0.0 section 4.1.

### Acceptance Criteria
- [ ] Side-by-side review: for each of the three snapshots, a screenshot of the matching vantage in Siambr is placed next to the scan in `docs/chamber-review/` with a short list of differences. Three passes minimum, each closing items from the previous list.
- [ ] Lighting: neutral daylight from the funnel throat, the white downlight ring, cornice uplighters on the wall, soft shadows; exposure set so the oak reads pale and the carpet reads its scan tone. Under WebGL2 fallback the look is within a visible tolerance of WebGPU (screenshot pair in the review folder).
- [ ] Materials: oak boards with visible grain direction per wedge; charcoal acoustic wall with subtle weave; slate roundel; glass band with reflection and the gallery seats behind; cedar slats with gaps.
- [ ] Wall furniture used by later tickets: the two red division clocks and four wall screens exist as named meshes with a texture slot each, so T-19 writes to them without changing geometry.
- [ ] Desk detail at Speaker vantage: monitor bezel, microphone gooseneck bend, party tab legible, chair back mesh tone.
- [ ] Performance gate from T-17 still holds after the pass (60 fps hardware, no frame over 33 ms software trace).
- [ ] No texture over 1024 px on a side; total texture budget under 12 MB; all textures generated procedurally or sourced under a licence recorded in `docs/chamber-review/ASSETS.md`.

**Notes:**
- The Matterport scan is reference, not an asset: nothing is extracted from it.
- Stop when the Gallery view could be mistaken for a photograph at thumbnail size. Do not chase the last 5 percent.
