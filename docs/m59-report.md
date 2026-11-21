# M59 report · combat readability + opening polish

**Status:** implemented, tested, verified (internal/emulated). Tagged locally as **release-M59 = c21394f**, bundle index-zXPa7RLt.js (sha256 4716d277…). Its code tree is identical to the gated RC 653f4d1; only logs/m59 screenshots were removed, with C S's approval. Gates (all PASS, 0 failures, run one at a time): 13 suites, full qa-run, qa-save, rollback M59 -> release-M54 -> M59, shaders, draw calls (identical to M58 at all 5 audit views: 358/350/308/400/160), perfrun (headless estimate only), perf HUD, diag smoke, M57 diag, qa-onboard, new-player run (follow-prompts and novice), readability audit. The box rebooted mid-run (about 20:23 PT). Gates finished before the reboot stand because the rebuild is byte-identical; shaders onward were re-run afterwards. Logs: /workspace/vale3d/logs/m59/ (gates-summary.log, gates2-summary.log). Approved by C S at 20:39 PT; not deployed by me. Spec: docs/m59-spec.md.

## What changed (src/main.ts, index.html; +30/−8 lines)
- `foeWinding()`: a per-frame check for a foe in striking range that is winding up, in every scene (roamers, castle, barrow + King, sea cave, Warden strike radius, Keeper wind-up). It drives `#cbt.warn` (an amber ring on Roll and Block) and the threat-pill alert. CSS only, so no draw-call cost.
- Threat pill: a new Sea Cave Tide-Wight branch, and the pill is hidden outside the vale scenes, so there is no stale "Warden" pill.
- `fx('block')`: a cool-grey edge flash. `#stam.fail`: a shake whenever `cb.lastFail` rises.
- Coach tip: moved above the non-calm action button; smaller on viewports 800 px tall or less.
- Seal camera: a damped pitch lift (`sealLift`, capped at 1.0 rad) when a seal lies between the camera and the player. It replaces an earlier pull-in attempt that put the camera 0.54 m from the crystal.
- Tools: tools/m59-readability.cjs (8-arena audit + block/stamina/seal-camera 3D clip check), tools/m59-layout.cjs (emulated phone layout; BASE= for local builds).

## Results (internal scripted runs, EMULATED headless Chrome)
| Check | M58 | M59 |
|---|---|---|
| Pill/boss bar, label, alert during wind-up | 7/8 each | 8/8 each |
| Control cue during wind-up | 0/8 | 8/8 |
| Correct pill / hurt flash when hit (blow landed) | 5/6, 6/6 | 6/6, 6/6 |
| Block flash / stamina shake | none / no | yes / yes |
| Tip ∩ action button (412, 448, 360 px wide) | 12.6k / 13.7k / 11.0k px² | 0 / 0 / 0 |
| Tip ∩ joystick or combat buttons | 0 | 0 |
| Tip cover of hero at 360×740 (max / median) | 44% / 33% | 35% / 26% |
| Seal camera sight line through crystal | 5/5 | 0/5 |

Evidence (outside the repo): /workspace/vale3d/logs/m59-evidence/ (read-before.json, read-after.json, layout/, before/, after/). Gate logs: /workspace/vale3d/logs/m59/. The RC readability gate re-confirmed 8/8 on every audit row, seal clips 0/5, the block flash and the stamina shake. Image: docs/m59-before-after.png.

## Concerns
- **Real-device performance of the opening encounter is still outstanding.** No emulated result here counts as a pass.
- The wind-up ring's real-world noticeability is untested with players.
- The seal lift gives a short, steeper look-down near seals.
- The tip still covers about a quarter of the hero on short phones.

## Readiness
**READY TO DEPLOY.** Deploy zip: /workspace/vale3d-m59-release.zip (git archive of release-M59; no refs/, no logs). Rollback: release-M54. Saves unchanged (no new fields). C S decisions (20:39 PT): wind-up ring game-wide, seal lift kept as-is, logs removed from history.
