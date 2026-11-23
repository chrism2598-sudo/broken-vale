# M63 report · Seal guards, difficulty curve, coach-tip spacing

**Status:** implemented, tested, verified (internal/emulated only). Tagged locally **release-M63**. **Not deployed** (no deploy tool available to me; zip ready for deploy). **No outside playtesting has happened**; nothing here is player data.
Authority: C S, Nov 23 2026 7:56 AM ("Just keep building I can't test now"). Spec: docs/m63-spec.md. Logs (untracked): /workspace/vale3d/logs/m63/ (gates.log, final/, rerun/, curve-m63.txt).

## Commits (branch m63, from release-M62.1 f784a50)
- f757cf9 · game change (src/roam.ts, src/mobs.ts, src/main.ts, src/coach.ts) + spec + tools/m63-guards.cjs + tools/m62-curve.py before/after.
- a3d9ce6 · **RC (code)**: qa-onboard returning-player check follows the new tip spacing (test-only).
- release-M63 = report/brief commit on top (docs only; bundle identical).
- Prod bundle **index-D3kfSYa6.js**, diag **index-BtZr9L1Z.js** (M62.1: index-BX1wNavJ.js / index-D9jzTqmP.js).

## What changed
1. **Seal guards** (implemented, tested). After the first seal, every unclaimed seal gets a guard group of existing foes on its approach, just outside the nearby fire's safe ring. The seal shows "Guarded · <seal>" until they fall. Composition:
   - seal 2: Sentinel + Wayside Husk (HP at tier 1: 4, 3)
   - seal 3: Sentinel + Husk + Sentinel (HP at tier 2: 5, 4, 5)
   - seal 4: Sentinel + Husk + Sentinel + Gloam Brute (HP at tier 3: 5, 4, 5, 12)
   - Guard spots (x, z): Dawn (−44.8, −71.7), Sun (−51.0, 45.0), Tide (34.5, −83.8), Forge (10.8, 48.4) (Forge only if it isn't the first seal).
   - Felled guards are recorded in the existing save.rk; resting brings them back only if the seal is still unclaimed. No new save fields. QA runs without a time of day have no roamers, so no guards (existing rule).
2. **Difficulty curve** (implemented, tested). Roaming foes scale by tier t = seals claimed (+1 in Chapter II, max 5): HP ×(1+0.1t), wind-up ×(1−0.03t), speed ×(1+0.04t), notice ×(1+0.05t). t = 0 is unchanged. Damage unchanged (whole hearts; deferred). Castles, barrow, sea cave, bosses unchanged (deferred).
3. **Coach-tip spacing** (implemented, tested). Opening fight: Attack and Roll (and the hit/hearts tip) only. Block/parry, "Parried!" and stamina tips wait until a seal is held (the first guard fight). No new text. Emulated opening sequence: Attack, Roll ×3, hit tip; first guard fight: "Wind-up — tap Block just as it strikes!".
4. Kept: Wind Shrine Journal label (M62.1). Not changed: Wayfinder dialogue, HUD "(optional)" shrine pill.

## Difficulty before → after (tools/m62-curve.py; CODE, computed)
Rusty Sword light hits to kill; challenge = foe HP / hero blow multiplier (1.00 = opening).
| Stage | Tier | Hero | Husk HP / hits | Shade HP / hits | Brute HP / hits | Challenge | Shade wind-up |
|---|---|---|---|---|---|---|---|
| Start | 0 | ×1.00 | 3→3 / 3→3 | 5→5 / 5→5 | 9→9 / 8→8 | 1.00→1.00 | 0.70→0.70 s |
| After seal 1 | 1 | ×1.03 | 3→3 / 3→3 | 5→6 / 5→6 | 9→10 / 8→9 | 0.97→1.07 | 0.70→0.68 |
| After seal 2 | 2 | ×1.06 | 3→4 / 3→4 | 5→6 / 5→6 | 9→11 / 8→9 | 0.94→1.13 | 0.70→0.66 |
| After seal 3 | 3 | ×1.09 | 3→4 / 3→4 | 5→6 / 5→6 | 9→12 / 8→10 | 0.92→1.19 | 0.70→0.64 |
| After seal 4 | 4 | ×1.15 | 3→4 / 3→3 | 5→7 / 4→6 | 9→13 / 7→10 | 0.87→1.22 | 0.70→0.62 |
| End Ch I / Ch II | 5 | ×1.21 | 3→4 / 3→3 | 5→8 / 4→6 | 9→14 / 7→11 | 0.83→1.24 | 0.70→0.59 |
| Ending (Lv 13) | 5 | ×1.36 | 3→4 / 3→3 | 5→8 / 4→6 | 9→14 / 6→9 | 0.74→1.10 | 0.70→0.59 |
Thorough player at the ending (×1.96): 0.51 → 0.77. Before, challenge only fell; now it rises gently through Chapter I and eases slightly at the end. Feel is unverified by players.

## Gates (RC a3d9ce6, one at a time; ports 8100 build / 8101 rollback dir)
| Gate | Result |
|---|---|
| 13 suites (post, opening, world 30, ground 18, quests 50, castle 65, stair 11, cave 26, combat 25, finale, outlook 9, plate 7, title) | all PASS, 0 fails |
| qa-run (full playthrough) | PASS, errors [] |
| qa-save | first run ENV ERROR (frame detached at 101 passes, 2.26 GB free); solo rerun **145/145 PASS** (11.4 GB free) |
| rollback M63 → release-M54 → M63 | first run ENV ERROR (240 s first-page timeout, 2.9 GB free, before any check); solo rerun **20/20 PASS** |
| shaders | PASS 20/20 |
| draw calls (5 views) | identical to M62.1: 358 / 350 / 308 / 400 / 160 |
| perfrun (headless estimate) | PASS; draws avg 173 (same), max 257 vs 255, heap 118 MB (same), fps 1.4 (same; SwiftShader) |
| perf HUD | PASS 8/8 |
| diag smoke | PASS 43/43 |
| M57 diag | PASS 16/16 |
| qa-onboard | PASS 17/17 |
| new-player follow-screen / novice | PASS / PASS |
| readability | 8/8 rows |
| m60-progress | 21/21 |
| m621-label | 19/19 |
| m63-guards | 27/27 |
Environment errors: both happened while the shared box was low on memory; both passed solo with the same harness and build, so they're environment, not game defects.
Extra enemies: a 3-foe guard group in view adds about 18 draw calls and ~3.4k triangles (m63-guards, emulated); guards are only drawn within 85 m of their seal, so none of the audited views change.

## Deploy
Release zip /workspace/vale3d-m63-release.zip (git archive of release-M63, no refs/ or logs/). Deploy and live curl verification **not done by me** (no CloudAgent tool in this session); rollback point **release-M54** (2027a56) preserved; previous release release-M62.1.

## Risks / deferred
- Guard fights, tier scaling and the moved Block tip are computed/emulated only; real-player feel unknown (deferred to the closed playtest).
- Foe damage scaling, Chapter II/castle/barrow scaling, out-of-combat healing and stagger cooldown: deferred.
- The playtest kit (M62.1) still applies; the live build will include M63 once deployed, so testers will meet the guards.
