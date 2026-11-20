# M55 · phone diagnostics: test sequence (Pixel 9, ~17 min)

These links open the **separate diagnostics build** at `/broken-vale/diag/`. Normal players never load it, and the production game at `/broken-vale/` contains none of this code.
The diag build **reads** your save so it can load the same world, but it **cannot write, replace or delete** anything (all localStorage writes are blocked).

Each link runs a fixed sequence on its own, so just open it and leave the phone alone:
- Each config uses the same 60 s camera path, the same Lite quality, Fast motion (unless noted) and frozen time of day.
- Before each config there is a cool-down (nothing rendered) and then a 5 s warm-up.
- At the end, one combined card appears. Tap **Copy JSON** and paste it to me; a screenshot of the card is also fine.

Before you start: close other apps, keep the phone unplugged at normal brightness, and hold it in portrait. Don't touch the screen while a run is going.

| # | Link | What it isolates | Time |
|---|------|------------------|------|
| 1 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&cool=10&seq=base,pr0.75,shoff,vegoff | **Main split, meadow.** Baseline, then fill rate (render at 0.75 instead of 1.25 pixel ratio), shadow pass off, all vegetation (grass + alpha-tested foliage) off. Whichever change recovers the long frames points to the bottleneck. | ~5 min |
| 2 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=underbridge&warm=5&cool=10&seq=base,pr0.75,shoff | The same split under the bridge (second worst scene), to check the cause is the same. | ~4 min |
| 3 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&cool=10&seq=grassoff,foloff,shhalf | **Narrows down test 1.** Grass only off; alpha-tested foliage only off; shadow map refreshed every 2nd frame (half the shadow cost; shadows still visible). | ~4 min |
| 4 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&cool=10&seq=ovl,lodspread,folopaque | **CPU side and overlay.** Live overlay updating (default is collect-only); liteLod work spread over every frame instead of every 6th; foliage alpha test turned off (opaque cards: the cost of the alpha test itself, not of the leaves). | ~4 min |
| 5 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=smooth&diag=meadow&warm=5&seq=base | **Smooth-mode baseline** (30 fps pacing), same path. | ~1.5 min |
| 6 | https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&seq=base | **Thermal check:** repeat the baseline from test 1 at the end, while the phone is warm. If its numbers are clearly worse than test 1's `base`, heat or throttling is part of the story. | ~1.5 min |

Run them in this order; 1 and 2 matter most. If time is short, do 1, 2 and 6.

## What the card shows
- **Summary table:** one row per config with FPS avg, 1% low, p50/p95/p99 frame ms, long frames >33 and >50 ms, draw calls, triangles, and GPU shadow+main ms (or `-`).
- **Per config:**
  - pixel ratio and drawing-buffer size;
  - CPU ms (avg/p95) for the whole frame, the fixed-step simulation (including liteLod), the grass re-scatter pump, and render submission;
  - a histogram of fixed steps per frame, plus sim time by step count;
  - grass swaps and MB uploaded, and liteLod ticks;
  - for long frames, what came right before them: catch-up (steps ≥ 2), a liteLod tick, a grass swap, CPU > 16 ms, a previous long frame, or a GC (heap drop). Each is shown next to its rate over all frames.
- **"cpu<12 (indirect)":** the share of long frames where the main thread did under 12 ms of work. This is *indirect* evidence of GPU, compositor or vsync limits, **not** GPU time.
- **fps/10s:** an FPS trend in 10-second steps (thermal).
- **GPU timer:** `EXT_disjoint_timer_query_webgl2` if the browser exposes it (shadow pass vs main pass), otherwise `unsupported`. Android Chrome usually hides it, so expect `unsupported` on the Pixel.
- The label is **DEVICE** on the phone; headless runs say **HEADLESS ESTIMATE**.

## Switches (for reference)
Combine switches with `~`; each config is one variable.

| Switch | Effect |
|--------|--------|
| `base` | No change |
| `pr1.25` / `pr1` / `pr0.75` | Render pixel ratio (the Lite default is min(DPR, 1.25)) |
| `shoff` | Lights cast no shadows: no shadow pass, no shadow sampling |
| `shhalf` | Shadow map rendered every 2nd frame |
| `shfreeze` | Shadow map never re-rendered |
| `grassoff` | Grass hidden |
| `foloff` | Alpha-tested foliage hidden (main and shadow pass) |
| `folopaque` | Alpha test and A2C off on foliage |
| `vegoff` | Grass and foliage both hidden |
| `ovl` | Live overlay |
| `lodspread` | liteLod spread over every frame |
| `simcapN` | Diag-only fixed-step catch-up cap N; production stays at 7 |

Timing parameters: `secs` (default 60), `warm` (6), `cool` (15). The tests above use warm=5 and cool=10.
