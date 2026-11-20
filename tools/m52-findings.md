# M52 · characters, enemies and VFX realism (parallel graphics round, branch m52 off fa90926)

Lite portrait audit shots: `TAG=m52a-lite node tools/m39-audit.cjs hub night-hub under-bridge track night-stair` (port 8092).
Before/after (left = M49 m49g, right = M52): shots/m52-before-after-{night-hub,hub,under-bridge}.png.
Note: the m52a audit shots were taken just before the final rim/firefly strength bump (rim 0.55→1.0 at night, firefly size 0.22→0.3); the QA'd bundle includes the bump.

## Changes (materials, shaders and particles only; no M11 motion/mixer, no animation logic, no save fields)
1. **Foe materials** (src/mobs.ts): one shared 128² procedural wear texture (grain, scratches, pitting) is the roughnessMap + bumpMap for every foe's plate/robe and dark leather/iron (bump 0.35 armour, 0.5 leather, 0.6 robes).
   A shared `onBeforeCompile` (one program cache key `mobrim`) adds a cool fresnel rim to the foe's emissive: faint by day, strong at night (`mobFx.night`), and 0.45 indoors (keeps, castle, cave, barrow) so silhouettes read in the dark.
2. **Night readability** (src/mobs.ts): eye colour is pushed into HDR at night (×(1+2.2·night)) so bloom gives a glow, and flares further on the wind-up (with the existing orange wind-up tint and ring). No extra meshes or calls.
3. **Combat VFX** (src/main.ts): the M47 spark burst is smaller and warmer (0.2→0.14, softer orange). New soft **dust puff** at the struck foe's feet: 10 normal-blended radial sprites that drift out, rise, swell and fade (0.6 s, 0.85 s heavy); one Points draw only while alive, transparent-FX layer (skips AO).
4. **Fireflies** (src/main.ts): 48 additive soft points in one Points draw around the player outdoors at night (nightK > 0.25; hidden in caves, coast, sea cave, keeps, castle, barrow, island, lifts). They wander, bob above the terrain, pulse and respawn around the player.
   Castle shaft dust motes already exist (castle.ts, M-earlier), so they were left alone; drifting leaves were skipped for time.
- Not done (time): contact blob shadows under feet (each would add a draw call per foe and push the hub/under-bridge budgets), skin-tint on NPCs.

## Perf (Lite, audit calls halved)
- hub 179 · night-hub 183 · under-bridge 200 (≤200, M49 198) · track 150 calls / 694.7k tris (≤720k) · night-stair 130.
- perf-m25: meadow 170 · paleWing 114 · paleStair 114 · keep 186 · hall 59 · kitchen 62 calls.

## QA
Full chain against 8092, log logs/m52/qa-chain.log (see the result there). The box restarted at ~17:17 PT during qa-ground; dist and the server were rebuilt from the same source (same bundle index-CmpCikT8.js) and the chain resumed from ground (post, opening, world had passed).
