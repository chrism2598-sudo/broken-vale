# M60 report · progression and rewards

**Status:** implemented, tested, verified (internal/emulated). Tagged locally as **release-M60 = 1512ea0**. RC commit 1512ea0, bundle index-0kZfz36t.js. **Not deployed.** Audit: docs/m60-audit.md. Spec: docs/m60-spec.md. Evidence (untracked): /workspace/vale3d/logs/m60/. Before/after image (untracked): /workspace/vale3d/logs/m60/m60-before-after.png.

## Gates (exact commit 1512ea0, one at a time)
- All 13 suites PASS; full qa-run PASS (0 failures).
- Shaders, perfrun (headless estimate only), perf HUD, diag smoke and M57 diag: PASS.
- Draw calls identical to M59 at all 5 views (358/350/308/400/160).
- qa-onboard and new-player runs (follow-prompts and novice): PASS.
- Readability: every row 8/8 (hit checks 6/6), seal-camera clips 0/5.
- New m60-progress check: 21/21.
- qa-save: 145/145 PASS (rerun). Rollback M60 -> release-M54 -> M60: 20/20 PASS (rerun). release-M54 was rebuilt to its original bundle, index-Dan1OPQt.js.

Logs: /workspace/vale3d/logs/m60/gates-summary.log, rerun-summary.log.

## Test-harness crash investigation
- In the first chained run, qa-save and rollback stopped with environment errors, not test failures:
  - qa-save: 126 checks passed and none failed, then the browser frame detached.
  - rollback: it timed out loading the first page (240 s), before any check.
- At the time the shared box had only 2.2-3.4 GB free. My visible processes totaled about 5 GB of the 12+ GB in use, so most of the pressure came from outside them.
- Both local servers stayed healthy (HTTP 200, correct bundles). The same bundle booted fine through the 13 suites, qa-run and the other gates.
- Rerun one at a time on the same commit, with the harnesses unchanged: qa-save 145/145 (started at 3.8 GB free, lowest 2.1 GB); rollback 20/20 (started at 7.7 GB, lowest 3.9 GB).
- Conclusion: an environment problem (low memory), not a game or save defect.

## What changed (src: quest.ts, main.ts, combat.ts, journal.ts, finale.ts; index.html)
- **Levels give power:** `levelBonus = 0.04 × min(level − 1, 12)`, added to the whetstone multiplier inside `whetMul()`. Every melee path already goes through it (roamers, keeps, barrow, sea cave, Warden, Keeper). It is derived from XP, with no save field.
- **Level-up banner** (`#lvup`): `checkLevel()` runs inside the 0.15 s HUD tick, so it catches a level gained from any XP source. It shows the new level, the blow bonus and the next threshold, plays a chime, and lasts about 3.2 s. It is never shown on load.
- **Progress shown:**
  - HUD details line: "Lv N · x/next XP".
  - Journal header: blow bonus and next level.
  - Weapon picker header: total blow bonus (level and whetstones).
  - Each weapon line: Dmg, speed word, Reach, stagger word, and Heavy with its stamina cost.
- **Seals:** SEAL_XP 25 → 50. From seal 2 on, the claim toast says "n/4 · k seals left — clues in your Journal". At seal 1 the opening coach tip covers it.
- **Weapon tuning:**
  - Spear: dmg 1.15, stagger 0.4.
  - Knight: swing 0.36, heavy cost 24.
  - Halberd: reach 1.75, dmg 1.4.
  - Ember: swing 0.44, heavy cost 38.
  - Harpoon: reach 1.5.
  - Descriptions for Knight and Ember updated.
- **End screen:** "Level N · X XP" (the stale /580 is gone).
- **Tools:** tools/m60-econ.py (weapon maths) and tools/m60-progress.cjs (21 checks).

## Before → after (internal scripted runs / computed; EMULATED headless Chrome)
| Check | M59 (live) | M60 RC |
|---|---|---|
| m60-progress checks | 5/21 | 21/21 |
| Rusty light cut on a husk, Level 1 / Level 5 | 1.00 / 1.00 | 1.00 / 1.16 |
| Blow multiplier at 700 XP + 2 whetstones | 1.30 | 1.78 |
| Seal reward / toast pointer | +25 XP, "n/4" | +50 XP, "n/4 · k seals left — clues in your Journal" (from seal 2) |
| Level-up feedback | " · Level N" suffix | Banner + chime, bonus and next threshold |
| HUD | "Lv 5 · 230 XP" | "Lv 5 · 230/250 XP" |
| Main-path level at end of Chapter I / at the end | 7 / 12 | 9 / 14 |
| Non-starter weapons strictly beaten by another | Spear, Knight (×2) | none |
| Spear light DPS vs Rusty | 2.65 < 2.99 | 3.04 > 2.99 |
| Longest reach | Harpoon 1.60 (Halberd said "longest") | Halberd 1.75 |
| Banner overlap at 412×915 / 360×740 | — | none / none |

## Concerns
- **Real-phone test of the opening 2-husk fight is still outstanding.** That means frame pacing, and whether the wind-up/hit indicators are noticeable and usable. No emulated result counts as a substitute.
- Late-game difficulty drops. A thorough player can reach ×2.08 blow strength (whetstones +60 % plus level +48 %), against ×1.60 before. The opening is unchanged, because Level 1 = ×1.00.
- Roaming foes still give XP every day. Grinding levels is now possible but slow, and the Level 13 cap bounds it.
- Weapon tuning is computed, not play-tested. Ember is a little slower and costs more stamina, and the Harpoon has less reach. A player who used them before will notice.
- At seal 1, the toast, the level-up banner and the coach tip show together for about 3 s. They don't overlap, but it's busy.

## Readiness
Ready to deploy on C S approval. Rollback: release-M54. No new save fields; old saves load and derive their level bonus from XP. Decisions are listed in docs/m60-chatgpt-brief.txt.
