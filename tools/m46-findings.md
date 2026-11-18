# M46 findings (base aee9666, M45 live index-D6GO-o2o.js)

## 1. Azure Keep exterior (same treatment as Pale in M45; nothing moved, no recolouring)
- Azure wall material gets `ash: 0.5` (per-block tone, rain streaks, damp) and base grime (`ground` = pad − 0.9).
- The curtain-wall detail and keep window depth from M45 now apply to both keeps: machicolation ledge and slots, string courses, stepped buttresses with caps, arrow slits, window jambs and sills.
- Azure has no glacis, so each buttress gets its own solid (r 0.95), which keeps the player out of the stone.
- Cost: +0 draw calls, about +12k tris.
- Before/after:
  - shots/m46-before-after-azure-side.png: the clearest.
  - shots/m46-before-after-azure-near.png.
  - shots/m46-before-after-azure.png.
- New audit views: azure-side, azure-near.

## 2. Bleached creek bank: root cause found and fixed
- It wasn't albedo. Two debug builds showed this:
  - With bed albedo forced to black, the bank still rendered mid-grey with the gravel pattern.
  - With the creek water hidden, it looked the same.
- Cause: the bed's roughness was pulled to 0.25 ("wet") everywhere on the bed. The gravel mirrored the bright sky env map at grazing angles, through the thin water film.
- Fix (terrain.ts):
  - Wet is now height-based (`WETB`: under water and a lip just above WATER_Y).
  - Dry gravel bars are clamped matte (≥ 0.9).
  - Submerged gravel goes to 0.6 instead of 0.25.
  - Dry bank gravel is a touch darker and warmer.
- Before/after: shots/m46-before-after-banks.png (mean pixel diff 5.8/255). The gravel reads as stones, not a pale sheet.
- The grass bank right of the path is still a little washed out in full sun. That's the grass layer, so it's left as is.

## 3. Wing Gate plaza / castle road (partial)
- Plaza texture weathering, with design and colours unchanged: grimy joints, chipped slab corners, hairline cracks, damp/soot blotches.
- The effect is subtle on Lite, because the plaza material's metalness 0.45 mirrors the sky. Lowering it would shift the look, so it's left for C S to decide.
- Castle road: not changed (M30/M31 ruts, puddles and crown already exist).
- Before/after: shots/m46-before-after-plaza.png, shots/m46-before-after-castle-road.png, shots/m46-before-after-pale-approach.png.

## Perf (Lite)
- perf-m25: meadow 170 calls / 633k, paleWing 114 / 467k, paleStair 114 / 486k, keep 186 / 648k, hall 59, kitchen 61.
- m39-audit (halved): hub 179, night-hub 183, under-bridge 200, track 150 / 695k, azure 110.

## Camera
- Castle interiors and castle.ts are untouched.
- The only new outdoor solids are the Azure buttress discs, outside the curtain wall.
