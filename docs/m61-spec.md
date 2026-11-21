# M61 spec · phone UI/UX — targeted fixes to existing UI (no new elements, mechanics, content or save fields)

Base: release-M60 3dd2399 → branch m61. Save format unchanged. M56 adaptive resolution and Smooth 30 untouched. M11 movement untouched.

## Changes
1. **Touch targets ≥ 44 px (A1, A2):** ☰ Menu, FPS chip and sheet ✕ Close min-height 44. Volume slider hit-area 44 px tall (visual track unchanged). Portrait quest card min-height 44.
2. **Readability (B1–B3):** no HUD/sheet text below 12 px in portrait. Quest stats 11 → 12 px. Combat pill labels 11 → 12 px and hearts 15 px (the key combat info). Weapon picker header sub-line 9.2 → 12 px (no uppercase tracking), stat lines 11 → 12, descriptions 11.5 → 12.5.
3. **Seal-1 cluster (C1):** on the claim the current opening tip is cleared, and the "Seal 1 of 4!" coach tip waits until the toast and level-up banner have gone (4.6 s game time) instead of appearing on top of them. Text and duration unchanged. At most two messages (toast + banner, the same event) at once, and the coach tip never shares the screen with them.
4. **Toast and banner placement (C2, C3):** toast and banner are sized to their text (`width:max-content`, max 86 vw), and the toast moves up to max(164 px, 21 %). The banner stacks directly under it instead of at 40 % (where the hero's head sits). Landscape phones (height ≤ 500 px): toast and banner sit near the top.
5. **Coach box (C4):** border-box sizing so it never exceeds the screen width. Landscape: coach sits low between the joystick and the button cluster instead of on top of the toast.
6. **Weapon picker (D1):** border-box sizing so it ends above the button cluster (no Jump overlap). Landscape: placed left of the button cluster with a usable height.
7. **Close by tapping elsewhere (D2, E2):** menu and weapon picker close on a tap outside them (the tap still does its normal job, e.g. Attack). Journal/map/settings/credits close on a backdrop tap.
8. **Journal close always reachable (E1):** ✕ Close stays pinned at the top of the sheet while it scrolls.

## Not changing
Coach portrait position (M59), control sizes/positions, HUD content, timers other than the seal-1 tip start, colours/art direction, any gameplay.

## Acceptance (new `tools/m61-ui.cjs` with CHECK=1, all five viewports)
- Every visible tappable element ≥ 44 px in every measured state (calm, combat, picker, seal-1, journal, map, menu, settings).
- No text < 12 px in any HUD panel or sheet in portrait (landscape: same).
- Calm and combat: no HUD panel covers the hero box. All six combat buttons and the joystick are reachable (elementFromPoint) in combat.
- Weapon picker overlaps no control. Landscape picker shows ≥ 3 weapon rows.
- Seal-1 claim: coach is off at t=0 and on by +4.7 s. Toast and banner don't overlap each other or the hero box (portrait). Toast, banner and coach don't overlap the quest card or each other (all sizes).
- Coach box within screen width at 360 px.
- Journal scrolled to the end: ✕ Close reachable.
- Menu open → tap on the game view closes it. Picker open → tap outside closes it. Sheet backdrop tap closes it.
- All standard gates unchanged (13 suites, qa-run, qa-save, rollback, shaders, draws, perfrun, perf HUD, diag smoke, M57 diag, onboard, newplayer ×2, readability, m60-progress).
