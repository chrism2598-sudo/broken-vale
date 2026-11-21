# M61 audit · phone UI/UX (baseline = release-M60 3dd2399, prod bundle index-0GsyDnjR.js)

Method: `tools/m61-ui.cjs` (new, headless Chrome + SwiftShader, mobile/touch viewport — **emulated, not a real phone**).
Viewports 360x740, 375x667, 390x844, 412x915 and landscape 844x390 (the game runs in landscape; there's no rotate prompt).
States: calm explore, opening-husk combat (engaged), weapon picker, seal-1 claim (t=0 and +4.7 s), journal (top and scrolled to end), map, menu, settings.
Measured: every visible tappable element (min side), text sizes inside HUD panels and sheets, overlap of each HUD panel with the hero's
projected screen box and with the controls, `elementFromPoint` at each control's centre (is it reachable?).
CSS transitions are turned off for the measurement only (SwiftShader frames lag them; geometry is what counts).
Raw data: `/workspace/vale3d/logs/m61/before.json`, table `before.md`, screenshots `before/` (untracked).

## What's fine (keep)
- Combat controls: Attack 84 px, Roll/Block/Heavy 62 px, Jump/Weapon 54 px, joystick 122 px — all ≥ 44 px, all reachable in combat at every size.
- No HUD panel covers the hero in calm explore or in combat at any size. The combat pill sits top-left (y≈108–140), clear of the hero and controls.
- Menu rows 48 px. Journal/map/settings body text 13–13.3 px. Menu, journal, map and settings all fit at 360 px wide.
- Health = hearts in the combat pill (only during fights); stamina bar shows only when used (M59). XP/level and the seal diamonds are on the quest card's stats line.

## Problems found (measured)
| # | Area | Finding | Size |
|---|---|---|---|
| A1 | Touch | ☰ Menu 71×40, FPS chip 44×32, sheet ✕ Close 84×40 (journal/map/settings/credits), volume slider 16 px tall | below 44 px at every size |
| A2 | Touch | Portrait quest card (tap to expand) is 41 px tall | just under 44 |
| B1 | Text | Quest stats line (Lv · XP · seals · time) 11 px in portrait | 11 px |
| B2 | Text | Combat pill labels ("HP", foe name) 11 px. The hearts are the key combat info but use the same small type | 11 px |
| B3 | Text | Weapon picker: header sub-line 9.2 px (uppercase, wide tracking), stat lines 11 px, descriptions 11.5 px. 31 text runs < 12 px | 9.2–11.5 px |
| C1 | Opening | Seal-1 claim fires three messages at once: toast (4.5 s), level-up banner (3.2 s), coach "Seal 1 of 4!" tip (10 s). All three are up for 3.2 s and two or more for 4.5 s (from code timers) | 3 at once |
| C2 | Opening | At the claim, coach covers 34–38 % and banner 7–16 % of the hero box (portrait). Landscape: coach sits on the toast (5 830 px²), banner covers 31 % of the hero | |
| C3 | Layout | Toast and level-up banner are centred with `left:50%` and shrink to half the screen width, so even short lines wrap (toast 180 px wide, 2 lines at 360 px) | |
| C4 | Layout | Coach tip box is 364 px wide on a 360 px screen (max-width 94 vw plus padding, content-box), so 2 px spill past each edge | 360 px |
| D1 | Obstruction | Weapon picker overlaps the Jump button by 18 px (972 px²) on 360–390 px phones. Landscape: picker max-height = 100vh − 330 = 60 px, so about one row shows | |
| D2 | Obstruction | Menu dropdown stays open until ☰ is tapped again. It covers Jump (and Attack on 375×667 and in landscape), so those controls can't be tapped while it's open | b-jmp, b-atk blocked |
| E1 | Navigation | Journal ✕ Close scrolls away with the content: after scrolling to the end it's off-screen at every size (only Esc/J or scrolling back up closes it) | off-screen |
| E2 | Navigation | Sheets (journal/map/settings/credits) don't close when you tap the dimmed backdrop. Menu and weapon picker don't close when you tap elsewhere | |

## Not problems / out of scope
- Compass/arrow: readable (12–13 px glyphs, guidance toggle in Settings). Map legend text 13 px. No change.
- Inventory = weapon picker (the only inventory). Covered by B3/D1.
- Coach position in portrait (above the action button) was tuned and accepted in M59. It's not moved; C1 is fixed by timing instead.
- Real-phone checks (thumb reach, notch/safe-area on a real device, glare/readability outdoors, frame pacing) can't be measured here.
