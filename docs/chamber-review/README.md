# Chamber review (T-23)

Side-by-side review of the Siambr chamber model against the 2026 Matterport rescan of the Senedd
debating chamber (model `hC9XLKU7RQ6`, snapshots `2VhcBCECD73`, `CwNsp65StxL`, `wSTA7sLq856`).
The scan is reference only: nothing is extracted from it. Every Siambr frame here is a screenshot
of the live scene taken by `frontend/scripts/chamber-review.mjs` with headed Chrome on the
dev machine (RTX 4060), 1518x854, then downscaled to the scan's 759x427.

Reproduce a pass with the dev server on port 5176:

```
cd frontend
node scripts/chamber-review.mjs <label>          # screenshots only
PERF=1 node scripts/chamber-review.mjs <label>   # plus the 10 s frame trace
```

The script uses three review-only query parameters on `/sitting/{date}`: `?vantage=gallery|llywydd|floor`,
`?pose=x,y,z,tx,ty,tz` (camera and target in chamber metres) and `?renderer=webgl2`.

## Vantages

| Scan | Siambr shot | Where |
|---|---|---|
| `scan-wSTA7sLq856.jpg` | `passN-gallery-seat.png` | Standing in a public gallery seating bay, looking across the bell and glass to the floor |
| `scan-CwNsp65StxL.jpg` | `passN-dais.png` | On the floor by the roundel, facing Y Llywydd's desk |
| `scan-2VhcBCECD73.jpg` | `passN-well.png` | In the well, looking across the roundel at the inner desk rows |
| (no scan) | `passN-gallery.png`, `passN-llywydd.png`, `passN-floor.png` | The product's three guided vantages |
| (no scan) | `pass3-speaker.png` | Over a second-row Member's shoulder, for the desk-detail criterion |
| (no scan) | `passN-gallery-webgl2.png` | The Gallery vantage on the WebGL2 fallback backend |

## Pass 0: baseline (before T-23)

`pass0-*.png`. Differences from the scan, worst first:

1. Doorways were open white holes; the scan has closed flush oak doors with charcoal panels.
2. No public gallery seating; the gallery floor was slate and the fascia a dark red-brown.
3. Cedar bell dark and orange, slats too fine; the scan bell is pale honey with wide ribs and a lit rim.
4. Chairs towered 1.2 m over the desks in solid black; in the scan they are tucked in and barely visible.
5. Desks were separate blocks with 12 cm gaps; the scan reads as continuous runs with board joints.
6. Flat lighting: no shadows read, no pendant pools on the wall, no cornice fittings, a bright strip light instead.
7. Plain oak well with no roundel; the scan has a blue mosaic roundel at the centre.
8. Single narrow pilasters on a regular grid; the scan has paired oak pilasters with charcoal fabric between.
9. Texture set over the 12 MB budget (five 1024 px textures, several created twice).

## Pass 1: structure and tones

`pass1-*.png`. Closed: 1 (oak door leaves with two inset panels), 2 (dark carpet, oak-clad seating bays,
tiered seats, glass balustrade on steel posts with a cedar handrail), 3 (honey slats, lit rim ring),
4 (chairs lowered to 0.78 m, moved in, mesh-textured), 5 (3 cm joint, row-alternating board sets),
7 (mosaic roundel with a steel trim ring), 8 (paired pilasters, cornice pendants with warm pools),
9 (memoised texture set, sizes capped, budget test).

Still open after pass 1:

1. Wall washed to pale grey: the additive cornice-pool overlay reached the floor and the room
   environment lifted every diffuse surface.
2. Bell flat and pale from inside the chamber.
3. Oak too yellow; the scan's joinery is a more saturated straw with darker streaks.
4. Product Gallery vantage sits below the parapet, so the gallery seating is never in frame.

## Pass 2: light and exposure

`pass2-*.png`. Closed: 1 (pool gradient gone by a third of the wall height, opacity 0.4, environment
intensity 0.14, hemisphere 0.5, ambient 0.05, key light 2.1, fabric darkened), 2 (wider slat gaps,
lower emissive), 3 (oak `#cfb27f`, cedar `#d3b27c`), 4 (review pose from a gallery seat added;
the product vantage is unchanged on purpose so the balustrade posts never cross the desks).

Still open after pass 2:

1. Gallery-seat pose was pitched too far down and sat between the seating-bay dividers.
2. Carpet ran between the well and the inner desk front; the scan's oak reaches the desks.
3. Texture budget over 12 MB once the two division-display canvases are counted.
4. Frame time doubled against T-17 (median 7.3 ms against 4.1 ms) from ~300 extra draw calls.
5. No Speaker-vantage frame for the desk-detail criterion.

## Pass 3: detail and performance

`pass3-*.png`. Closed: 1 (pose behind a bay at r 15.8), 2 (oak apron out to the inner desk front),
3 (floor boards 512 px, screen canvas 768x432: 9.2 MB total), 4 (pilasters, pendants, posts,
dividers, downlights and mullions instanced), 5 (`pass3-speaker.png`: dark monitor bezel with a
silver back, bent gooseneck with its head turned to the Member, wider party tab on the front lip,
mesh chair back).

Remaining differences, left deliberately (the Gallery view reads as the room at thumbnail size):

- The scan bell has finer, more irregular slat tones; ours is a 32-slat tile repeated five times.
- The scan's gallery seats are individual oak-and-fabric chairs; ours are three tiered shells.
- The ceiling outside the bell is a flat pale ring; the scan's is darker and partly hidden.
- Y Llywydd's desk has five monitors in one run in the scan; ours keeps the T-08 clerks' run in front.

## Gates

- Performance (Gallery vantage, 1440x900, sitting playing, RTX 4060, WebGPU, 10 s after a 6 s warm-up):
  1729 frames, median 5.7 ms, p95 6.8 ms, max 21.1 ms, none over 33 ms.
- WebGL2 pair: `pass3-gallery.png` and `pass3-gallery-webgl2.png` are indistinguishable by eye; three's
  node materials render the same on both backends.
- Textures: `frontend/src/lib/3d/materials.test.ts` builds the full set and asserts no side over 1024 px
  and under 12 MB including the display canvases. Licences in `ASSETS.md`.

## Pass 4: vote legibility (T-25)

`pass4/before-*.png` and `pass4/after-*.png`, taken mid-division (`T=13320` on 2026-09-16, the first
division beat). Before: party tabs warmed towards cream once a Member had spoken, and For/Against
were blue and orange, the blue colliding with the Conservative tab. After: tabs are party colour
always; For is teal `#1a7d7d`, Against amber `#f5b445`, worktops take the tone fully. Compare
`speaker` (tabs against the tint, over the shoulder) and `gallery` (tint legibility at distance).
