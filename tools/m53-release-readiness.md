# M53: release readiness (stabilization only)

- **Release under test:** `main` HEAD **da53e7b** (da53e7b0683579516e50cff89fd4d94a33e646a7), the merge of M51 and M52, on top of M50 585bfd8.
- **Tags:** `release-M52` → da53e7b, `release-M49` → fa90926.
- **Branch m53:** created off da53e7b. It holds only test tooling, the `?perf=1` overlay and this report. It is not merged and not deployed.
- **Status words:** implemented / tested / verified / blocked / deferred.
- **Environment:** every number here is from the shared Linux box, running headless Chrome on SwiftShader (software GL, 8 vCPU, 16 GB nominal).
- **Logs:** under `/workspace/vale3d/logs/m53/`. They are not committed, per the repo rule.

## 1. Bundle verification: **verified**

- `npm run build` of a clean da53e7b produced `dist/assets/index-BK-IeqJ9.js` (logs/m53/build-da53e7b.log).
- The live site https://chrism2598-sudo.github.io/broken-vale/ references `assets/index-BK-IeqJ9.js`, the same name.

| File | Local sha256 | Live sha256 |
|---|---|---|
| index-BK-IeqJ9.js | `483b4a217ae4f70cb37e1093ac220581037abf7a41a84fbf742b42f538e66bc6` | identical |
| index.html | `aacb425299bf5ede8d70fe33a2c3d98d1fe0e8caebff1339e8a126be108ffb77` | identical |

Log: logs/m53/bundle-verify.log.

## 2. The 13 QA suites on da53e7b: **verified (13/13 pass)**

- Run serially on port 8090 with `/tmp/m53-qa.sh`, 7:11–7:31 PM PT.
- The chain log header records commit da53e7b and bundle index-BK-IeqJ9.js.
- Each suite was wrapped by a monitor (`/tmp/m53-mon.sh`) recording `free -m` before and after, peak Chrome RSS, and a server check afterwards.

| Suite | Exit | FAIL lines | Min available memory | Peak Chrome RSS | Server after |
|---|---|---|---|---|---|
| post | 0 | 0 | 2958 MB | 2069 MB | 200 |
| opening | 0 | 0 | 6174 | 2284 | 200 |
| world | 0 | 0 | 3720 | 4718 | 200 |
| ground | 0 | 0 | 5818 | 4689 | 200 |
| quests | 0 | 0 | 2250 | 2393 | 200 |
| castle | 0 | 0 | 1850 | 2792 | 200 |
| stair | 0 | 0 | 4494 | 2020 | 200 |
| cave | 0 | 0 | 6251 | 2284 | 200 |
| combat | 0 | 0 | 6182 | 2415 | 200 |
| finale | 0 | 0 | 6506 | 2144 | 200 |
| outlook | 0 | 0 | 6397 | 2396 | 200 |
| plate | 0 | 0 | 9342 | 2043 | 200 |
| title | 0 | 0 | 10774 | 3946 | 200 |

Logs: logs/m53/qa-chain.log and logs/m53/qa-<suite>.log.

## 3. Full playthrough (qa-run) on da53e7b, run alone: **verified, PASS on the first run**

- Exit 0, no FAIL or CRASH lines. Started 7:37:25 PM PT, RUNDONE 8:04:36 PM PT.
- Minimum available memory was 2314 MB; peak Chrome RSS 2687 MB; the server answered 200 afterwards.
- Logs: logs/m53/qa-run-chain.log, qa-run.log, and mem-run.log (sampled every 10 s).
- No rerun was needed and none was made, because the run did not fail.
- **Environment note:** mem-run.log has one 361 s gap in the 10 s sampler (7:43:46 → 7:49:47 PM PT), and `ps` start times shifted by about 6 minutes. The VM appears to have been paused or starved during the run. The playthrough still passed.
- The box's "used" memory also swings between about 2 GB and 12 GB, and running processes don't account for it (RSS totals about 2.9 GB; see logs/m53/mem-baseline.log). This points to host-side memory pressure, the likely cause of the earlier reboot during parallel QA, and it is a CI risk rather than a game defect.

## 4. Save migration and persistence: **tested, 111/111 pass**

- **Tool:** `tools/qa-save.cjs` (branch m53), run against the da53e7b build. Log: logs/m53/qa-save.log; per-check JSON: logs/m53/qa-save.json.
- **Method:** each crafted save is based on the `Save` type and `loadSave`/`gear()` in src/quest.ts. It is injected into localStorage, the page is reloaded, and then:
  - every field is checked;
  - Pale and Azure are entered to check the nook state;
  - the armoury loose stone (`pale-stone`) is used to check stash payout;
  - the page is reloaded a second time and checked again.

| Case | Result |
|---|---|
| pre-M21b (no stashes, whet, tod or sq) | **PASS** 16/16 |
| pre-M47 (stashes, no pale-nook; male profile "Bram") | **PASS** 24/24 |
| pre-M49 (pale-nook, no azure-nook) | **PASS** 25/25 |
| current (everything) + unknown future fields | **PASS** 30/30 |
| corrupted JSON | **PASS** 3/3 |
| empty string | **PASS** 3/3 |
| `null` | **PASS** 3/3 |
| unknown version `v:2` | **PASS** 3/3 |
| wrong field types | **PASS** 3/3 |
| missing profile | **PASS** 1/1 (falls back to Ilka/female) |

What each case covers:
- **pre-M21b:**
  - XP, seals, quest flags, weapons and the equipped weapon, charted, secrets, chests, lore, fog bits and name/gender survive the reload.
  - The reload puts the player at SPAWN (0, 6), outside any keep.
  - An unlooted stash pays +15 once, does not pay a second time in the same visit, and does not pay again after a reload.
- **pre-M47:**
  - Everything above, plus whet, day, hpUp, sq and tod survive.
  - Both nooks stay shut.
  - The looted stash is neither offered nor paid.
- **pre-M49:** Pale nook open, Azure nook shut; rk, gone, kit and ressStair survive.
- **current + unknown fields:** both nooks open, all 5 stashes kept, unknown fields don't crash the loader.
- **Corrupted, empty and `null` saves:** no crash, and the game falls back to a fresh save.
- **`v:2`:** no crash, and the game falls back to a fresh save.
- **Wrong field types:** sanitised (xp 0, weapons [rusty], only string stashes kept).

**Findings (risks, not failures):**
- **(a) Unknown fields are dropped.** The loader whitelists fields, and the save is rewritten during load. An older build therefore permanently deletes fields it doesn't know.
- **(b) Bad saves are overwritten without a backup.** A corrupt or unknown-version save is overwritten with a fresh save at load (observed: storage rewritten with `started:false, xp:0`). A future `v:2` save opened by this build would be wiped.
- **Fix to plan for M54:** keep the raw string under a backup key before any rewrite, and refuse to overwrite a save whose `v` is higher than the build's.

## 5. High and Lite shader validation on da53e7b: **verified, 20/20 pass**

- **Tool:** `tools/m53-shaders.cjs`. Log: logs/m53/shaders.log; JSON: logs/m53/shaders.json.
- **Scenes:** spawn, hub, night-hub, castle hall, Pale nook, Azure nook, cave, veilfall, dome, coast, each at q=high and q=lite.
- **Results:** 0 shader compile errors, 0 `gl.getError()` errors, no context loss, 0 console or page errors.
- **Mean luminance:** High ranges from 24.3 (Azure nook) to 124.3 (coast); Lite from 28.9 to 128.2. Nothing is near zero, so the **old High black screen has not regressed**.
- **Warnings on High:** three.js deprecation notices only (log: logs/m53/high-warnings.log and shaders-warning-probe.log):
  - `PCFSoftShadowMap has been removed. Using PCFShadowMap`
  - `iridescenceThicknessRange` replaced
  - `THREE.Clock` deprecated
- **Screenshots:** `/workspace/vale3d-m53/shots/m53-shader-{high,lite}-<scene>.png` (20 files; `shots/` is gitignored, so they stay on the box).

## 6. `?perf=1` overlay (branch m53 only, NOT deployed): **implemented + tested**

- **Code:** `src/perfhud.ts` (new) plus one line in main.ts that dynamic-imports it only when `perf=1` is in the URL.
- **What it shows:**
  - FPS;
  - frame time avg/p95/p99 over the last 300 frames;
  - long frames over 33 ms and over 50 ms, in the window and since start;
  - load time from navigation start to the first rAF with the canvas, and to `__vale.ready`;
  - JS heap from `performance.memory` only when the browser exposes it, otherwise "memory: unavailable".
- `window.__perf.stats()` returns the same numbers for automated runs.
- **Cost when the flag is off:**
  - The overlay is a separate 1.7 kB chunk (`perfhud-*.js`), and it is never requested without the flag (tested).
  - The only runtime cost is the URL check. The main bundle grew by about 1.8 kB (Vite's dynamic-import preload helper).
- **m53 build:** `index-BIucBSLo.js`, sha256 6f03d2a7a1b69ccb…, served on port 8093.
- **Tests:** qa-perfhud (8/8), post, opening, title and castle all exit 0 with no FAIL lines. Log: logs/m53/m53build-chain.log and m53build-qa-*.log. Screenshot: /workspace/vale3d-m53/shots/m53-perfhud-on.png.
- **Caveat:** on Chrome/Android, `performance.memory` is a coarse **JS heap** figure only. It is not GPU or total process memory. The overlay labels it that way.

## 7. Headless perf on da53e7b: **tested (headless SwiftShader software rendering, NOT phone numbers)**

### Draw calls and triangles per frame

Log: logs/m53/drawcalls.log. The m39-audit values are 2-frame sums, divided by 2 here.

| View | Lite calls | Lite tris | High calls | High tris |
|---|---|---|---|---|
| hub | 179 | 636k | 570 | 2.80M |
| night-hub | 184 | 633k | 602 | 2.73M |
| track | 150 | 695k | 546 | 3.31M |
| under-bridge | **200 (at cap)** | 526k | 729 | 2.21M |
| castle hall | 80 | 57k | 144 | 113k |
| castle-road | 126 | 557k | 438 | 2.04M |

perf-m25 (Lite, per frame):
- meadow 170 calls / 633k tris
- paleWing 114 / 467k
- paleStair 114 / 486k
- keep 186 / 648k
- hall 59 / 56k
- kitchen 61 / 57k

All Lite caps are met; under-bridge has zero headroom. High has no caps.

### Frame times

- **Tool:** `tools/m53-frametimes.cjs`, using the same statistics logic as the overlay. The camera orbits 360° over 8 s.
- **Logs:** logs/m53/frametimes.log and frametimes.json.
- **Lite:** about 1 fps outdoors (rAF avg 835–1115 ms; synchronous bench avg 588–894 ms); castle hall 4.1 fps (avg 243 ms).
- **High:** 0.6–0.7 fps outdoors (bench avg 1.3–1.5 s); castle 3.2 fps.
- These numbers only say that High costs about 1.6–2.3× Lite and that interiors are about 3–4× cheaper than outdoors. **They say nothing about phone FPS.**
- **Load:** `__vale.ready` at about 2.0–3.2 s outdoors and 8.9–11.6 s for the castle preset (localhost, no network). The first-frame figure is not meaningful headless, because the canvas exists almost immediately.

### Not measured (deferred until C S runs `?perf=1` on his Pixel 9)

- Real-device FPS and frame times
- Long-frame spikes
- Load time over the network
- Memory

## Remaining risks

1. **Real-device performance is unmeasured.** Lite under-bridge sits exactly at the 200-call cap, and High is 3–4× Lite on calls and tris.
2. **Save safety:**
   - unknown fields are dropped on load;
   - corrupt or unknown-version saves are overwritten with no backup (section 4);
   - this matters for any rollback or any future save version.
3. **Gameplay quality is not established by these tests.** Per C S's V2 amendment 6, the automated suites and screenshots check function and rendering, not feel or quality. An independent review is still needed.
4. **The CI environment is unstable:**
   - host memory pressure swings (2–12 GB "used" not owned by any process);
   - one VM pause of about 6 minutes during qa-run;
   - the earlier reboot during parallel QA.
   - Keep one heavy browser job at a time.
5. **Coverage:**
   - M50–M52 visual changes are only screenshot-checked (no visual baselines or diffs);
   - qa-save covers the castle stash path and the nooks, not every stash.
6. **Deprecations:** three.js `PCFSoftShadowMap` has been removed (High silently falls back to PCF), and `Clock` and `iridescenceThicknessRange` are deprecated. They're harmless now but should be cleaned up before the next three.js upgrade.

## Recommendation: **retain the current release, da53e7b**

- The live bundle is byte-identical to a clean da53e7b build.
- da53e7b now has its own documented full gate: all 13 suites plus a full playthrough PASS on this exact build, 111/111 save-migration checks, and 20/20 shader validation with no High black screen.
- A rollback would only lose M50–M52 with nothing to fix.
- **If a rollback to M49 fa90926 is ever needed:**
  - src/quest.ts (Save type and loader) is **byte-identical** between fa90926 and da53e7b, and M50–M52 add no save fields, so player saves are preserved as they are.
  - Any later milestone that adds save fields must land the backup and no-downgrade guard from risk 2 **before** a rollback could be safe.
