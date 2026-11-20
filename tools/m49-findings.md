# M49: graphics pass, slice 1 (Lite)

## Survey: weakest views first
Lite portrait audit shots (`TAG=m49s-lite node tools/m39-audit.cjs …`).
Contact sheet: shots/m49-survey-contact.png.

| Rank | View | What's wrong | M49 |
|---|---|---|---|
| 1 | **dome** (Iron Dome, close) | The drum window fills the frame as a flat, uniform orange arch: no glazing, no depth, no light falloff. It is the most "placeholder" thing on screen in the whole survey. | **Fixed** (see below). |
| 2 | **coast** | Milky and washed out. Peach fog flattens the cliffs, sea and sky into one value range, and the sand and sea barely separate. | **Improved** (lighter, cooler fog). |
| 3 | **stair / hub foliage** | The near hazel/orchard leaf cards read as blocky, flat green slabs. Every tree looks the same and none of them move. | **Improved** (per-tree variation, wind, grounding). Close cards are still blocky → M50. |
| 4 | **veilfall** | The falls ribbon is bright, flat and white against dark, flat rock, with little mist or wet sheen at the foot. | M50 candidate. |
| 5 | **castle-road / banks** | The road and bank ground is uniform pale grey-brown with weak texture breakup. The Wing Gate reads fine. | M50 candidate (path albedo and wear). |
| 6 | **cave** | The floor and walls read OK. The torch light pool is small and the back wall is flat dark. | M50 candidate (bounce/fill). |
| 7 | **echo** | Hazy and pastel. The crystals are fine; the distance is a little milky. | Low priority. |
| — | hall, azure, bridge, falls, banks | Acceptable for Lite. Interiors (hall) are the strongest views. | — |

## Changes
1. **Foliage** (src/nature.ts, src/terrain.ts):
   - Per-tree non-uniform scale and a second hash tint.
   - Gust-modulated sway plus leaf flutter.
   - Soil under the 16 nearest crowns is darkened in the terrain shader (`uTB[16]`, no extra calls).
   - Shots: shots/m49-before-after-{orchard,hub,track}.png.
2. **Iron Dome** (src/landmarks.ts):
   - Drum windows: a per-vertex local-pane attribute drives leaded cames, a mullion and a transom. Firelight is hot low in each pane and fades up into smoke, with a per-window flicker. Same mesh, same draw call.
   - Forge mouth: a shader material replaces the flat orange. It has a hot core falling off to dark red, heat haze, flicker, and an anvil and hearth-lip silhouette.
   - Shot: shots/m49-before-after-dome.png.
3. **Coast fog** (src/coast.ts): density 0.0042 → 0.0032; the horizon colour is a bit deeper and less peach. Shot: shots/m49-before-after-coast.png (subtle).
4. **Azure hidden passage** (src/castle.ts):
   - The M47 nook room and door are now in the shared layout, so Azure has the same split wainscot, the tapestry raised to 3.55 and the sliding panel.
   - Opening it saves `azure-nook` to `secrets` (+10 XP); main.ts already used `c.id + '-nook'`.
   - Stash `azure-nook`: "A small chest wedged behind a fallen shelf" (coin and a whetstone, +20 XP), saved in `stashes`.
   - Props: chest, fallen shelf, coil of rope, dead lamp on a ledge, runner. All low pieces.
   - No landmarks, no NPC dialogue, and Azure is not moved.
   - New shot preset `m20-aznook` / audit view `aznook`.
   - qa-castle step 21 mirrors step 20 for Azure.

## Perf (Lite, audit calls halved)
- hub 179 · night-hub 183 · under-bridge 198 (≤200) · track 150 calls / 695k tris (≤720k) · azure 110 · dome 104 · coast 64 · aznook 37.
- perf-m25: meadow 170 · paleWing 114 · paleStair 114 · keep 186 · hall 59 · kitchen 61 calls.

## Camera probe (Azure, SHOT=m20-azure PEACE=1, HEAD baseline vs M49)
- Every existing room has an identical min/p10/median. The one exception is the Great hall p10, 4.61 → 4.58, from the wall opening.
- New Hidden passage: min 1.80, the same as Pale's passage.
- Logs: logs/m49/cam-azure-base.log, cam-azure.log.

## M50 next (weakest left)
- Close leaf cards on the stair and hub (denser, rounder clusters).
- Veilfall foot mist and wet rock.
- Castle-road/banks path breakup.
- Cave fill light.

## QA
All 13 suites passed (logs/m49/qa-chain.log). qa-run was interrupted once, re-run against the same build and exited 0 with no FAIL or CRASH.
