# M45 findings (base 8d2cd21, M44 live index-C9tIdxNb.js)

## 1. Stream/pool gravel bed (terrain.ts ~48)
- Bug: since M41, the trailing `// M41: ragged bank line` comment swallowed the `bed=max(bed, streamD…, POOL…)` statement. Side streams and the quarry pool lost their gravel-bed weight.
- Fix: put the statement on its own line.
- Before/after: shots/m45-before-after-stream.png (m39-m45b3-lite-stream vs m39-m45a2-lite-stream; new audit view `stream`).
- The change is subtle on Lite: the stream banks pick up a browner gravel verge (mean pixel diff 1.3/255). The water mesh covers most of the bed. The falls view is unchanged, because the pool is hidden by grass from that camera.

## 2. Pale Keep exterior realism (Pale only; Azure untouched; layout, colours and Wing Gate unchanged)
- Shader (triplanar option `ash`, zero extra calls):
  - Each ashlar block gets its own tone (warm/cool, light/dark) on vertical faces.
  - Rain-wash streaks.
  - Green-grey damp creeping 4.5–6.5 m up from the footing.
  - Base grime is now on (`ground` = pad − 0.9).
- Curtain walls (5 non-gate segments, merged into the existing st/trim/SLIT materials):
  - Corbelled machicolation ledge with dark drop-slots under the merlons.
  - A string course on both faces.
  - Two stepped buttresses per segment with sloped trim caps (they sit inside the glacis collision band, so no new solids).
  - Three dressed arrow slits per segment.
- Keep windows: projecting dressed jambs and a deeper sill on all 18 windows, for depth.
- Cost: +0 draw calls, about +6k tris per castle view.
- Before/after:
  - shots/m45-before-after-pale-side.png: curtain wall from outside, the best one.
  - shots/m45-before-after-pale-approach.png: approach through the Wing Gate.
  - shots/m45-before-after-rock-far.png.
- New audit views: pale-approach, pale-yard, pale-side, stream.

## 3. Bleached creek bank
- Not attempted again this round (budget). The M44 tests showed bank tint changes are invisible under Lite sun and tone mapping. A fix likely needs a darker or more saturated gravel texture (tBd) or a lower bed albedo gain, not tint math.

## Perf (Lite)
- perf-m25: meadow 170 calls / 632k, paleWing 114 / 467k, paleStair 114 / 486k, keep 186 / 647k, hall 59, kitchen 62.
- m39-audit (halved): hub 179, night-hub 183, under-bridge 200, track 150 / 695k.

## Camera
- castle.ts and the interiors (offset 6000) are untouched, so the castle camera probe isn't affected.
- No outdoor solids changed (the new buttresses sit inside the existing glacis solids).
