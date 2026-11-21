# M61 report · phone UI/UX

Branch m61 off release-M60 (3dd2399). Tag release-M61 = docs commit on top of 0800bd0 (code identical).
Commits: 2c60ec5 audit+spec+tool · 99364d1 UI changes · 7724ccd m61-ui test fix · 0800bd0 qa-onboard test update · docs commit (tagged). Game code identical since 99364d1.
Changed files: index.html (one CSS block), src/coach.ts (seal-1 tip timing), src/main.ts (tap-outside/backdrop close). No save, mechanics, balance, content or text changes.
M56 adaptive resolution and Smooth 30 untouched. M11 movement untouched. No new HUD element.

## What changed (and why), per the audit (docs/m61-audit.md)
1. Touch targets: ☰ Menu 40→44 px, FPS chip 32→44, sheet ✕ Close 40→44, volume slider 16→44 px hit area, portrait quest card 41→44.
2. Text floor 12 px: quest stats 11→12. Combat pill labels 11→12, hearts 15 px. Weapon picker header 9.2→12 (sentence case), stats 11→12, descriptions 11.5→12.5.
3. Seal-1 cluster: the "Seal 1 of 4!" coach tip now waits 4.6 s (until the claim toast and level-up banner have gone). Any open opening tip is cleared at the claim.
   Before: 3 messages at once for 3.2 s, ≥2 for 4.5 s. After: toast + banner (one event) for 3.2 s, then the toast alone, then the coach tip alone.
4. Toast and banner sized to their text (were squeezed to 50 % width by `left:50%`), toast moved up to max(164 px, 21 %), banner stacked under it (was at 40 % over the hero's head).
5. Coach box: border-box (was 2 px past each edge at 360 px and 375 px). Landscape: coach at the bottom between joystick and buttons (was over the toast and quest card).
6. Weapon picker: ends above the button cluster (was overlapping Jump by 18 px). Landscape: beside the cluster with ≥3 rows (was 60 px tall, about one row).
7. Navigation: menu and picker close on a tap elsewhere. Journal/map/settings/credits close on a backdrop tap. Journal/credits ✕ Close is pinned while scrolling (was off-screen at the end).

## Measurements (tools/m61-ui.cjs, emulated headless Chrome; raw: logs/m61/before.json, after.json, final/gate-m61ui.json; tables before.md/after.md)
| | 360x740 | 375x667 | 390x844 | 412x915 | 844x390 |
|---|---|---|---|---|---|
| tap targets < 44 px (unique) | 6 → 0 | 6 → 0 | 6 → 0 | 6 → 0 | 6 → 0 |
| smallest text px | 9.2 → 12 | 9.2 → 12 | 9.2 → 12 | 9.2 → 12 | 9.2 → 12 |
| text runs < 12 px (calm+combat+picker) | 35 → 0 | 35 → 0 | 35 → 0 | 35 → 0 | 22 → 0 |
| seal-1 claim: hero covered | coach 34 %, banner 10 % → 0 | 37 % / 16 % → 0 | 37 % / 7 % → 0 | 34 % → 0 | banner 31 % → 0 |
| seal-1: messages overlapping each other / quest card | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 12 630 px² → 0 |
| picker over controls | Jump 972 px² → 0 | 972 → 0 | 972 → 0 | 0 → 0 | 0 → 0 (rows 0 → 3) |
| journal ✕ at end of scroll | off-screen → reachable | same | same | same | same |
| combat: hero covered by HUD / controls reachable | 0 % / all 7 ✓ (both) | same | same | same | same |
Combat controls (Attack 84, Roll/Block/Heavy 62, Jump/Weapon 54, joystick 122 px; 76/56/49 in landscape) are unchanged and pass the elementFromPoint check at every size.

## Accepted trade-offs / remaining concerns
- The coach tip still covers ~34–37 % of the hero box at the seal (portrait) once it appears at +4.6 s. Its position is the M59-tuned spot above the action button, so it isn't moved; it no longer stacks with the toast and banner.
- Landscape picker now covers the hero while open (it used to be only 60 px tall). It's transient, opened on purpose, and closes on any tap outside.
- The menu dropdown still covers Jump (and Attack on short screens) while open, but now closes on any outside tap.
- The opening coach tip appears 4.6 s later than before for first-time players (wording and duration unchanged).
- Seal 2–4 toasts are longer. In landscape they wrap to 2–3 lines and can touch the banner's top edge (seal 1 measured clear).

## Gates (one at a time, memory-guarded; logs /workspace/vale3d/logs/m61/final/)
Main run on 7724ccd (11:52–13:50 PST, script /workspace/qa-tmp/m61-gates.sh, logs final/), solo reruns on 0800bd0 (13:51–14:45 PST, logs rerun/).
0800bd0 differs from 7724ccd only in tools/qa-onboard.cjs. Rebuilt dist is byte-identical (whole-tree sha256 832a57dd…, bundle index-BigYTxm4.js sha256 51ce1592…), so the main-run gates carry over to 0800bd0.

| gate | result |
|---|---|
| 13 suites: post, opening, world, ground, quests, castle, stair, cave, combat, finale, outlook, plate | PASS (main run) |
| suite: title | main run ERR "frame got detached" (fails=0) → solo rerun PASS |
| qa-run (full) | main run ERR boot "Waiting failed: 240000 ms" at the first page load (fails=0) → solo rerun PASS (exit 0, 0 FAIL, no page errors) |
| qa-save | PASS · rollback M61 → release-M54 → M61 | PASS |
| shaders · draw calls · perfrun · perf HUD · M57 diag | PASS |
| diag smoke | main run FAIL (CRASH timeout + pixelRatio TypeError) → solo rerun PASS |
| onboard | main run FAIL 1 (expected: spec'd timing change) → test updated → PASS |
| newplayer (default + novice) · readability · m60-progress 21/21 | PASS |
| m61 UI (new, CHECK=1, 5 viewports) | PASS (0 fails; release-M60 baseline: 116 fails) |

### Failures and what they were
- **title, "frame got detached"**: crashed at the reload right after "Erase → creator", with every earlier check passing. Same harness symptom as the M60 qa-save crash. It ran at min 2.2 GB free while other agents had the box at load avg ~5–7. The solo rerun passed (min 2.0 GB, so memory alone wasn't the trigger; box load is the likely cause). M61 touches nothing on the title/erase path. **Environment.**
- **qa-run, 240 s boot timeout**: failed at the very first page load (2-line log), right when my box connection dropped (~12:2x PST). Server :8096 was healthy afterwards (200 in ~2 ms), and there were no OOM kills in the kernel log. The solo rerun passed in full. **Environment.**
- **diag smoke, "Cannot read properties of undefined (reading 'pixelRatio')"**: the meadow diag sequence hit the harness timeout at step 14/15 [simcap2]. SwiftShader was rendering at ~1 fps (box loaded), so meadow had no results. The later cross-check `g('pr0.75').pixelRatio` then read an undefined run and threw. The first error is a timeout, the second follows from it. M61 doesn't touch rendering, diag or quality code. The solo rerun passed, including "pixel-ratio switch applied". **Environment** (the tool could guard the missing-run case; left unchanged).
- **onboard, FAIL 1 "first seal claimed → Seal 1 of 4 tip"**: caused by M61, as intended. The test checked the tip 10 frames after the claim, which encodes the old stacked timing that spec item 3 deliberately removes. The tip still appears with the same text and duration, 4.6 s later. The updated test is stricter: it requires *no* tip at the claim and the tip by +4.7 s. No game change. Committed separately (0800bd0), then onboard rerun PASS. **Not a game defect: the test encoded the timing M61 changes.**

## NOT tested on a real device
- Everything above is emulated headless Chrome (SwiftShader, mobile viewport + touch emulation). No real phone was used in M61.
- Not checked: real thumb reach/comfort, notch/safe-area insets and the iOS home bar, browser toolbars changing the viewport height, glare/outdoor readability, real touch-target adjustment, font rendering on device.
- Still outstanding from M58–M60: real-phone run of the opening two-husk fight (frame pacing and wind-up cue noticeability). Never substituted with emulation; to be reported separately when done.

Evidence: logs/m61/m61-before-after.png (seal-1 shots: before-seal/, after-seal/ via /workspace/qa-tmp/m61-sealshots.cjs, banner pinned for the capture; other cells from before/, after/).
