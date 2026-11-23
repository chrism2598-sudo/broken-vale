# M63 spec · Seal guards, difficulty curve, coach-tip spacing

**Authority:** C S, Nov 23 2026 7:56 AM: "Just keep building I can't test now" (overrides the M62 hold on M63 until playtest results). Scope from the M62 evaluation top 3.
**Base:** release-M62.1 = f784a50 (keeps the Wind Shrine Journal label fix). **Branch:** m63.
**Not changed:** Wayfinder dialogue, the HUD shrine "(optional)" pill, NPC dialogue, landmarks and their positions (Azure, Sunspire, Iron Dome, Veilfall), M11 movement, graphics/lighting/materials, adaptive resolution and Smooth mode, save format (v1, no new fields), Chapter II scenes, castles, barrow, bosses. No Chapter III. No red/pink paths, gold rings or sci-fi.

## 1 · Seal guards (seals 2–4)
- Once the first seal is claimed (any seal), every still-unclaimed seal gets a guard group, using the existing roaming-group system (roam.ts) and existing foe types only.
- Placed on the seal's approach (toward the Wayfinder), just outside the nearby campfire's safe ring (ring + 4 m) and the village; the fire ring stays safe, foes never enter it.
- Size follows the seal being guarded: 2nd seal Sentinel + Wayside Husk; 3rd + Sentinel; 4th + Gloam Brute. Present day and night.
- The seal can't be claimed while its guard group stands near the player: the prompt reads "Guarded · <seal>", and using it says "Its guards still stand · defeat them to claim the <seal>". When the last guard falls: "· its guards have fallen — the seal is yours to claim".
- Fairness: same foes, same amber wind-up ring and telegraphs; the safe ring and fire beside each seal remain a heal/respawn point; a defeat costs nothing (existing rule).
- Persistence: a felled guard group is recorded in the existing `save.rk` (cleared for today), like any roaming group. Resting brings it back if the seal wasn't claimed. A claimed seal's guards never return.
- QA hook: `__vale.guardsClear(seal?)` and `__vale.foeTier()`.

## 2 · Difficulty curve (roaming foes)
- Tier t = seals claimed, +1 once the Beacon is lit (Chapter II), capped at 5. t = 0 is the shipped tuning, so the opening is unchanged.
- Per tier: HP ×(1 + 0.10t) (whole points), wind-up ×(1 − 0.03t), chase speed ×(1 + 0.04t), notice radius ×(1 + 0.05t). At t = 5: HP ×1.5, wind-up ×0.85, speed ×1.2, notice ×1.25.
- Applies to all overworld roaming foes (day husks, night shades/brutes, Ashen Hollow camp, seal guards). HP takes effect on the next respawn; wind-up/speed/notice at once.
- Damage stays whole hearts (deferred: +1 heart would be +100 %, not modest). Castles, barrow, Chapter II sea-cave foes and bosses unchanged.
- Shown before/after with tools/m62-curve.py.

## 3 · Coach-tip spacing
- The opening two-husk fight teaches Attack and Roll only (plus the hit/hearts tip).
- Block/parry, "Parried!" and low-stamina tips wait until the player holds a seal (normally the first guard fight).
- A returning player with exactly one seal who never saw those tips can still get them; with two or more seals all tips are skipped (as before).
- No new tip text.

## Saves
No new fields. Old saves (M62.1 and earlier) load; tier and guards derive from seals/beacon. Unknown `save.rk` ids are harmless to older builds (rollback to release-M54 is gated).

## Acceptance
- tools/m63-guards.cjs (guards at seals 2–4 and sizes, claim gating, tier values at t = 0..5, coach spacing, old-save load/carry-over, draw-call cost of a guard group).
- Full V2 gate set on the exact RC commit, one heavy test at a time; draw calls at the 5 audit views not worse than M62.1; perfrun/perf HUD pass.
