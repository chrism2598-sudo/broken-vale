# M51 · parallel graphics round (branch m51, based on fa90926 / M49)

Worked in the /workspace/vale3d-m51 worktree only, served on port 8091. Kept clear of M50's areas: the close leaf cards on the stair and hub, the Veilfall mist and wet rock, the castle-road and bank path albedo, and the cave fill light.

## Survey (Lite audit, `TAG=m51s-lite`, shots/m39-m51s-lite-*.png)
- Day meadow/hub: milky and low-contrast. The IBL fill (env 0.85) flattened the sun's modelling, so the ground and foliage read hazy.
- Night hub: readable, with stars and moon in place. Left alone apart from the grade.
- Creek (Lite): a single scrolling normal map read as a sliding sheet, with a uniform body colour across the channel.
- Sunspire, Echo, bridge and cottage stone: already triplanar with M22/M30/M45 weathering. Nothing placeholder found, so no change.
  Note: Sunspire's existing gilded crown ring is visible in the shot. It predates this round and was left untouched (canon says don't move or alter Sunspire).
- Castle interiors: the audit shots land in Azure Keep (quest state). Pale used one flat 1.05 hemisphere.

## Changes (no new meshes, lights or draw calls)
1. `shading.ts` valeGrade: S-curve 0.18 → 0.24, for slightly more filmic contrast. Applies everywhere, night included.
2. `main.ts` day lighting: sun 2.6 → 2.78 (both the locked and cycling branches). Day IBL environmentIntensity 0.85 → 0.76.
   The night value is unchanged: `(0.76 + 0.09n - 0.3kp)(1-0.8n)` is the same as before at n=1.
3. `main.ts` Lite creek water:
   - A second ripple scale samples the same normal map at 0.37× with a crossing scroll.
   - Ripples are softened in the shallows. Normal scale 0.35 → 0.40.
   - The channel centre is up to 18% deeper/darker. Shoreline thinning (M30/M41) is kept.
4. `castle.ts` Pale Keep interiors: hemisphere 1.05 → 0.96, with a warmer floor bounce (#4a3220). Azure is unchanged.
5. QA/audit tools: `PORT` env override (default still 8090) in every qa-*.cjs. `SHOTDIR` env for m39-audit. qa-outlook shots go to relative `shots/`.

## Perf (m39-audit, Lite, before → after)
Draw calls are identical and triangle counts are within noise, because no geometry was added.
- hub: 358 calls → 358 calls.
- night-hub: 366 → 366.
- banks: 258 → 258.
- bridge: 316 → 316.
- c-chapel: 86 → 86.
- Triangles: hub 1.274M → 1.273M, night-hub 1.267M → 1.268M.

The audit's bench number counts calls differently from perf-m25 (shadow pass included). Because nothing was added, the perf-m25 caps (track ≤ ~720k tris / ≤ 200 calls; hub, keep, night-hub, under-bridge ≤ 200) are unaffected.

## Shots
- Before: shots/m39-m51s-lite-{hub,track,night-hub,under-bridge,sunspire,echo,banks,hall,c-lib,c-chapel,bridge}.png
- After: shots/m39-m51a-lite-{hub,night-hub,banks,bridge,c-chapel}.png

## QA (port 8091, logs/m51/qa-chain.log)
See the QA section appended below.
