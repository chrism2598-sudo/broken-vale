# M50: graphics pass, slice 2 (Lite)

This slice covers the next weakest views from the M49 survey (tools/m49-findings.md).

## Changes
1. **Close leaf cards (stair, hub)** in src/nature.ts, leaf material:
   - Back faces get a translucent yellow-green light-through glow, scaled by `uGlow` so it fades at night.
   - Each ~0.3 m cluster gets its own shade and hue (hashed from the leaf's object-space cell).
   - The canopy shadow floor is raised from .42 to .5.
   - Close crowns now read as many lit sprigs instead of dark flat slabs. No geometry or draw-call change.
   - Shot: shots/m50-before-after-stair.png.
2. **Veilfall** in src/landmarks.ts:
   - The rock behind and beside the falls sheet is wet: darker, cooler, roughness down to .22, with streaks running down the face, fading with lateral distance, depth and height. The rock material has its own program cache key.
   - The 6 existing mist sprites are wider, lower, larger and denser at the foot. Same count.
   - Shot: shots/m50-before-after-veilfall.png.
3. **Paths and banks** in src/terrain.ts:
   - Path albedo gets broad light/dark wear, darker damp patches and pale grit flecks.
   - A trodden dark-earth fringe where path meets grass.
   - Dry bank gravel above the waterline gets tonal breakup, so it no longer reads as one flat grey sheet.
   - Shots: shots/m50-before-after-banks.png (clear) and m50-before-after-castle-road.png (subtle, because the view is mostly plaza and grass).
4. **Cave fill** in src/cave.ts: hemisphere 0.16 → 0.23 with a warmer ground colour, so the back walls keep some form. Shot: shots/m50-before-after-cave.png (subtle).

## Perf (Lite, audit calls halved)
- stair 129 · hub 179 · veilfall 129 · castle-road 126 · banks 131 · under-bridge 200 (cap 200; it was already at 198–200) · night-hub 189 · track 156 calls / 695k tris (cap 720k) · cave 41.
- perf-m25: meadow 170 · paleWing 114 · paleStair 114 · keep 186 · hall 59 · kitchen 62 calls.
- None of the M50 changes add meshes; the call differences are shot-timing variance (sprites and mobs).

## Not changed
- M11 motion code, plaza metalness, saves, landmarks and dialogue.

## Next (M51 candidates)
- Leaf card silhouettes on the nearest hazels (rounder alpha clusters need new textures).
- Castle-road plaza-edge wear.
- Water-surface sparkle at the creek.

## QA
All 13 suites passed on the final build (logs/m50/qa-chain.log, 18:16). qa-run not run: no time before the 18:41 reset; changes are shader/material only.
