# M57 technical report: performance reliability (Phase 1 and Phase 2)

Build: production index-Cpp7D6Td.js, unchanged since M56 and still live. Diag build index-XUGb7ohX.js (release-M57-diag, 96531ac).
Device: Pixel 9 class phone, ANGLE Mali-G715, 448x827 CSS px at 2.25x. Every phone run used the same save (xp 924, game finished, day 10). Every run uses tod 0.42 and a fixed scripted camera path.
Raw phone JSON: logs/m57/phone-t1-underbridge.json and logs/m57/phone-t2-meadow.json. Headless A/B runs: logs/m57/ab-*.json.
Evidence labels: **CONFIRMED** means measured. **HYPOTHESIS** means inferred or not measured. The phone has no GPU timer queries, so every statement about GPU or fill-rate limits is indirect evidence.

## Phase 1: under-bridge draw calls (195 vs 307)

### CONFIRMED
- **The 307 did not reproduce on the phone.** M57 diag test 1 gave **195 draws on average, 251 max, 512k triangles**. M55 on the phone gave 195 / 251 / 511k. Headless runs with the M55, M56 and M57 diag builds gave 190–214 average and 222–247 max, across fresh, mid-game and end-game saves.
- **Not a rendering regression.**
  - The M56/M57 production bundle has the same hash as M56.
  - The diag camera path code is the same in M55, M56 and M57.
  - The camera start position was identical on the phone and headless (−47.99, 3.38, −58.45).
- **The breakdown counts every draw.** The breakdown tallied 195.4 draws per frame against the renderer's own count of 195.
- **Save state** is worth about +20 draws headless (fresh 191 vs end-game 213).
- **Simulated time** doesn't matter: 60 s of extra game time before recording changed draws by −14 to +6.
- **Starting cold** doesn't matter: every run started cold with base first.
- **Distance LOD** is the only lever found that moves draws toward 307. With LOD off headless (`&nolod`), draws went from 191 to 235 average and 293 max, and triangles from 525k to 581k. The extra draws were small props (35 → 67) and landmark shadows.

### Phone draw breakdown (under the bridge, test 1, average per frame, main + shadow pass)
| Category | Main | Shadow | Total |
|---|---|---|---|
| Buildings and landmarks (r>3) | 24.4 | 15.6 | 40.0 |
| Small props (r≤3) | 25.8 | 12.0 | 37.8 |
| Hero | 16.6 | 18.0 | 34.6 |
| Foliage (alpha-tested) | 32.4 | 2.0 | 34.4 |
| Glow effects and particles | 23.1 | 0 | 23.1 |
| Characters, foes and NPCs | 18.5 | 0 | 18.5 |
| Instanced props, terrain, grass, water | 5 | 2 | 7 |
| **Total** | 145.8 | 49.6 | **195.4** |

- **Main pass:** 120 opaque and 25 transparent draws.
- **Materials:** Standard 144, Basic 31, Shader 16, Sprite 3, Points 1.
- **Biggest owner groups:** the shrine (35.6), the hero (34.6), landmarks (24.6), a 48-child foliage group (24), the island (20.4).
- **Visibility:** 598 meshes in the scene, 148 hidden by distance LOD, 146 inside the camera view, 162 shadow casters.

### HYPOTHESIS: the original M56 307 reading
The original M56 run (307 average, 359 max, 599k triangles) can't be re-examined. That build didn't record a camera start position, a save snapshot or a draw breakdown, and its JSON isn't on the box. The best-supported explanation is that **distance LOD wasn't hiding small props during that run**, possibly combined with extra characters or effects in view.
- **For:** LOD off is the only change that pushes draws and triangles up together in the right direction (+44 average, +70 max, +56k triangles headless). The phone delta was larger (+112, +88k).
- **Against:** the gap is only partly explained, and nothing in the code shows why LOD would have been skipped.
- **Alternatives:** a different camera landing, for example if the warp ran during a transition, or a different world state at that time.
- **Status:** a one-off that is **bounded but unresolved**. The new JSON fields (`camStart`, `world`, `draws.visibility.lodHidden`, `callsPer10s`) will attribute it if it happens again. No fix is proposed.

## Phase 2: adaptive resolution

### Meadow A/B, Fast motion, two rounds of each (CONFIRMED)
| Config (round 1 / round 2) | fps | 1% low | p95 ms | >33 ms | >50 ms | Seconds at PR 0.8 |
|---|---|---|---|---|---|---|
| adaptoff (fixed 1.25) | 46.7 / 45.3 | 14.1 / 13.3 | 50 / 50 | 488 / 524 | 94 / 115 | n/a |
| base (production adaptive) | 56.4 / 56.1 | 20.0 / 19.8 | 33.2 / 33.3 | 171 / 193 | 6 / 11 | 40.7 / 45.1 |
| adaptfast (emergency rule) | 56.4 / 55.5 | 19.6 / 19.4 | 33.2 / 33.3 | 175 / 228 | 3 / 5 | 38.6 / 52.4 |

- **Adaptive clearly helps.** Average fps rose by about 10, the 1% low by about 45%, frames over 50 ms fell by about 92% and frames over 33 ms by about 64%.
- **adaptfast adds nothing measurable.** It triggered 0 and 1 emergency jumps, and its 1% low and frames over 33 ms were the same or slightly worse. **Not recommended.**
- **Thermal drift is small.** From round 1 to round 2, adaptoff lost 1.4 fps and base lost 0.3 fps.
- **The meadow is floor-limited.** Adaptive reaches 0.8 within about 12 s and stays there for 68–75% of the run. Even at 0.8, p95 is about 33 ms (more than 5% of frames missed). CPU frame time is about 10 ms (render submit about 9.2). *Indirect evidence only:* the remaining cost is GPU or fill-rate bound.
- **Resizing is cheap enough.** The largest single resize took 8.9–18.3 ms (one frame per step).

### Under the bridge, Fast, production adaptive (CONFIRMED)
- **Results:** 57.6 fps, 1% low 24.4, p95 16.8, p99 33.4, 128 frames over 33 ms, 2 over 50 ms.
- **Resolution history:** 1.25 → 0.8 by 18 s. Seconds at each level: 1.15: 1.5, 1.05: 2.6, 0.95: 6.1, 0.85: 12.7, 0.80: 37.1. It stepped up once, at about 55 s.
- **Why it stays down (CONFIRMED by the rule):** stepping up requires at most 1% missed frames (p99 ≤ 20 ms), held for 4 s. Here p95 was on budget but p99 was 33.4 ms, with 2–4% of frames missed. That held the ratio at the floor even though the scene mostly had headroom.
- **Option, needing approval, not implemented:** loosen stepping up (for example p98 ≤ 20 ms, or p95 ≤ 17.5 ms held for 8 s, keeping the backoff). Try it first as a diag-only switch (e.g. `adaptup98`) in a phone A/B. Risk: more resolution changes, i.e. visible pumping.

### Castle, Fast, twice (CONFIRMED)
- **Results:** 59.9 / 59.9 fps, 1% low 51.1 / 48.8, p95 and p99 16.8, 6 / 8 frames over 33 ms, none over 50 ms.
- **Load:** 83 draws, 55k triangles, CPU 4.7 ms. The ratio stayed at 1.25 and there were no stalls.

### Smooth meadow, twice (adaptive inactive, PR 1.25)
- **CONFIRMED:**
  - **Results:** 29.7 / 29.9 fps, 1% low 18.9 / 20.8, p99 50 / 33.6, frames over 50 ms 5 / 3.
  - **Stall:** run 1 had a single 100 ms gap at t = 41966 ms. The frame before it spent 93.7 ms on the CPU, 92.4 ms of it in render submit.
  - **No page events nearby:** no focus, visibility, resize or WebGL context events.
  - **Did not recur:** it didn't happen in run 2 on the same scripted path.
  - **No shader pre-warm in the code:** there is no `renderer.compile` or `compileAsync` anywhere in `src/`.
- **HYPOTHESIS:** a one-off main-thread block the first time a shader program or texture is used, for example when an object comes back into view from LOD. It's cached afterwards.
- **Option, needing approval:** pre-warm with `renderer.compile(scene, camera)` during loading. This is a code change, not a graphics change, but it would lengthen loading.

### Image quality at PR 1.25 / 1.0 / 0.8 (done in M57)
Headless Lite shots on the phone viewport, same view, full frame plus a 1:1 crop:
- logs/m57/m57-pr-compare-meadow.png
- logs/m57/m57-pr-compare-underbridge.png
- logs/m57/m57-pr-compare-castle.png

These are for C S's visual review. The floor stays 0.8 unless approved.

## Recommendations (all need approval)
1. Keep M56 adaptive resolution in production. Don't adopt adaptfast.
2. Optional: A/B a less conservative step-up rule as a diag switch first.
3. Optional: pre-warm shaders at load to remove first-use stalls.
4. The meadow remains GPU/fill-limited at the 0.8 floor (indirect evidence). Any further gain needs targeted rendering work or a lower floor, and both need visual approval.
5. Rollback stays release-M54. Production stays M56.
