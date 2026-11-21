# M59 · Combat readability + opening polish — spec and acceptance criteria

Branch `m59` (from main 8d497a3; production is M58, bundle index-VkvUynn4.js). Rollback point: release-M54 (2027a56). Approved by C S at 7:13 PM PT on 2026-11-20.

## Problems (measured on M58 with an internal scripted audit, `tools/m59-readability.cjs`, headless Chrome at 412×915)
- In all 8 arenas (husk, cultist, shade, sentinel, barrow, Tide-Wight, Warden, Keeper), wind-ups are telegraphed on the foe only (glow, ring, raised arm). No touch control tells you which button answers a wind-up: controlCue was 0/8.
- In the Sea Cave, the threat pill showed **"Warden"** and nothing for the Tide-Wights. The keep, coast and island could also show a stale Warden pill.
- A blocked blow had no screen feedback. Running out of stamina gave none either, beyond the bar's colour.
- In the M58 emulated live check (logs/m58-live/), the non-calm action button (bottom 268 px) drew over the coach tip for about 4 s after fights. On a 360×740 phone, the tip covered up to 44 % of the hero.
- When you stood by a seal facing away from it (common after the opening fight), the camera's sight line passed through the plinth/crystal: 5/5 audit angles clipped.

## Changes (targeted; existing systems only)
1. **Tip vs action button**: while the action button is visible outside calm, the coach tip moves above it (bottom +316 px). On short viewports (≤ 800 px tall), the tip font and padding are smaller, so the tip covers less of the hero. It never sits over the joystick or the combat buttons.
2. **Seal camera**: if a seal plinth/crystal lies between the camera and the player, the camera pitch lifts, damped, until the sight line clears the crystal top (lift capped at 1.0 rad). It is vale-only and has no effect elsewhere. Distance, yaw and M11 movement are unchanged.
3. **Game-wide wind-up cue**: when a foe within striking range (4.6 m; 5.6 m for the Barrow King) is winding up, the Roll and Block buttons get an amber ring. This also covers the Warden strike radius and the Keeper wind-up. The threat pill gets its alert state. It is CSS only, with no new meshes or draw calls.
4. **Threat pill**: a correct Tide-Wight pill (label, HP squares, hearts) in the Sea Cave. The pill is hidden outside the vale scenes it belongs to.
5. **Hit/parry/block feedback**: the existing hurt vignette and parry flash are kept. A new 0.25 s cool-grey edge flash plays on a block. The stamina bar shakes when an action fails for lack of stamina.
6. **Coaching** stays opening-only (M58 coach, unchanged rules). There are no new or repeated tutorial prompts.
- Not changed: graphics, detail, adaptive resolution, Lite/Smooth 30, world art, landmarks, NPC lines, story, enemy stats or AI timings, save format, M11 movement.

## Acceptance criteria
- B1. Readability audit (8 arenas): pill or boss bar 8/8, correct label 8/8, alert during wind-up 8/8, control cue during wind-up 8/8. A hurt flash and a correct pill at the moment of a hit in every arena where a blow lands. Block flash and stamina shake are both observed.
- B2. Seal camera: 0/5 audit angles where the camera→player sight line passes through the crystal (3D check: horizontal clearance < 1.15 m *and* below the crystal top). A screenshot confirms it.
- B3. Layout: the coach tip and the visible action button don't overlap. The tip doesn't overlap the joystick or the combat buttons at 412×915, 448×827 and 360×740.
- B4. Opening coach behaviour is unchanged: qa-onboard and m58-newplayer pass.
- B5. Production gates on the exact commit: 13 suites, qa-run, qa-save, qa-rollback (M59 → release-M54 → M59), shaders, drawcalls (two-frame sums unchanged vs M58 at the 5 audit views), perfrun, perfhud, diag smoke, m57diag, onboard, newplayer, readability.
- B6. No save fields are added, so saves stay compatible both ways.

## Measurement labels
Every result here is from **internal scripted runs in headless/emulated Chrome**. Real-device performance of the opening encounter is **still outstanding** and is not claimed.
