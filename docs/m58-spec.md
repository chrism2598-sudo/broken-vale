# M58 · First ten minutes / onboarding — spec and acceptance criteria

Branch `m58` (from main 2f97212 = release-M57-diag content). Production stays M56 until the parent deploys. Rollback point: release-M54 (2027a56).

## What the opening was (measured on the M56 production bundle, internal scripted run)
- The Guidance arrow is **off by default**, so a new player's compass reads "✎ Wayfinder · clues in Journal" at spawn and "✎ Forge Heart · Iron Dome · clues in Journal" after the quest starts. There's no arrow or distance.
- On touch there are **no control hints at all**: the keyboard hint line is hidden on phones and nothing replaces it.
- The compass's first seal (the nearest unclaimed one) is the Forge Heart, 54 m from the Wayfinder. There are **no foes on that walk** in the daytime start, so a new player claims a seal without ever seeing a wind-up, a roll or a parry. Combat is first met later, untaught.
- Feedback already in place: wind-up glow, ring and raised arm on foes, toasts and audio for hits, parries and blocks, and a stamina bar that turns orange when low. Nothing says which button answers a wind-up.

## Changes (targeted; existing systems only)
1. **Opening coach** (`src/coach.ts`, `#coach`). Short one-time tips, triggered by context and touch-aware (touch vs keyboard wording). They never pause the game, and they hide during dialogue, cinematics and the title screen.
   - Calm tips, in order: move/look, then walk to the Wayfinder and tap Talk, then "First seal: <name> — follow the arrow", then "Seal 1 of 4" with where the other clues live. A nearby weapon pickup gets a one-time "something glints nearby" tip.
   - Combat tips: "Foes! tap Attack" (pulses Attack). On the first wind-ups, "⚠ Wind-up — tap Roll!" (pulses Roll). After a successful roll, the next wind-ups say "⚠ Wind-up — tap Block just as it strikes!" (pulses Block). There are follow-ups for: rolled clear (cue + stamina), blocked too early, parried, first hit (hearts), and low stamina. Each lesson stops nagging after 3–4 wind-ups.
   - State is kept in localStorage `vale3d-coach`, never in the save. A fresh game resets it. Any save that holds a seal marks every tip done.
2. **Opening guide arrow**: the compass arrow and distance show until the first seal is claimed (`body.opening`). After that the player's own Guidance setting applies again (default off → Journal clues). The setting itself isn't touched.
3. **A gentle first fight**: one new daytime roaming group `d-dome` with 2 Wayside Husks (the weakest existing foe: 3 HP, 1 damage, 0.95 s wind-up). It sits at (8, 38), on the walk from the camp to the Forge Heart, and uses the normal day-group rules (cleared for the day, back after resting).
4. **Hit/parry readability on phones** (`#fx`): a 0.45 s dark-red edge vignette on every hit taken, and a 0.3 s soft white flash on a parry. Button pulses are a cream glow.
- Not changed: world art, landmarks, NPC lines, story, chapters, weapons, XP, save format, M11 movement, graphics settings, adaptive resolution and Smooth mode.

## Acceptance criteria
- A1. Fresh start on a 412×860 touch viewport: a move/look tip shows at spawn, and the compass shows an arrow and distance to the Wayfinder.
- A2. After the Wayfinder's start dialogue, the first-seal tip names the compass target, and the arrow and distance point at it.
- A3. The internal scripted run (`tools/m58-newplayer.cjs`) reaches and claims the first seal with no page errors, with a fight on the way that shows the Attack, Roll and Block prompts in that order. Game time to the first seal is ≤ 60 s, and the estimated wall time (reading time included) is ≤ 2 min.
- A4. A novice who ignores every tip survives the first fight (no defeat) or, if defeated, wakes at a fire with progress kept (existing rule).
- A5. After the first seal, the arrow and distance revert to the Guidance setting (off → "clues in Journal"), and `vale3d-guidance` is unchanged.
- A6. Returning players: a save holding ≥1 seal shows no tips and no forced arrow. A started save with 0 seals keeps the arrow.
- A7. Production gates on the exact commit: 13 suites, qa-run, qa-save, qa-rollback (M58 → release-M54 → M58), shaders, drawcalls (two-frame sums unchanged at the 5 audit views), perfrun, perfhud, diag smoke, plus the new qa-onboard.
- A8. Save compatibility: M58 adds no save fields. An M58 save loads on release-M54 and back (qa-rollback).

## Measurement labels
Every timing here comes from an **internal scripted run in headless Chrome**. It is not player validation, and no outside testers were used.
