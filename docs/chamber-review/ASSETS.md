# Chamber assets and licences

## Textures

Every texture the chamber draws with is generated procedurally at runtime in
`frontend/src/lib/3d/materials.ts` (`chamberTextures()`), from seeded noise and the tone constants
in that file. No image files ship. Sizes and the 12 MB budget are asserted by
`frontend/src/lib/3d/materials.test.ts`.

| Key | Generator | Size | Bytes (RGBA) |
|---|---|---|---|
| bellRibs | cedarSlats | 512 | 1.0 MB |
| bellThroat | cedarSlats | 512 | 1.0 MB |
| galleryFascia | cedarSlats | 512 | 1.0 MB |
| joineryA | cedarBoard | 512 | 1.0 MB |
| joineryB | cedarBoard | 512 | 1.0 MB |
| floorBoards | oakBoards | 512 | 1.0 MB |
| wallFabric | acousticPanel | 256 | 0.25 MB |
| cornicePools | cornicePool | 128 | 0.06 MB |
| galleryCarpet | galleryCarpet | 256 | 0.25 MB |
| chairMesh | meshWeave | 128 | 0.06 MB |
| roundel | mosaicRoundel | 512 | 1.0 MB |
| division screen | DivisionDisplays canvas | 768x432 | 1.27 MB |
| division clock | DivisionDisplays canvas | 480x128 | 0.23 MB |

Total 9.2 MB before mipmaps. The room environment for reflections is three.js's `RoomEnvironment`
(MIT), rendered to a small PMREM at startup, not a stored image.

## Reference images

`scan-*.jpg` are tour snapshots from the Senedd's public virtual tour, hosted by Matterport
(model `hC9XLKU7RQ6`, "Senedd Debating Chamber 2026", presented by 4Pi Productions for Senedd
Cymru). They are kept here only as review references for the side-by-side comparison and are not
loaded by the site, not bundled, and not used to derive any geometry or texture. Copyright rests
with Senedd Cymru and 4Pi Productions; if that reuse is not acceptable, delete the three files and
the README links still describe each vantage.

## Fonts on the division displays

The wall screens and clocks draw with the browser's generic `sans-serif`, `serif` and `monospace`
families, so no font file is shipped for the chamber.
