# M60 · Progression and rewards — spec and acceptance criteria

Branch `m60` from main b2ad8e4 (= live M59). Rollback point: release-M54. C S approved it at 9:20 PM PT on 2026-11-20. Audit: docs/m60-audit.md.

## Changes (existing systems only; no new currency, crafting, skill tree, content or save field)
1. **Levels give power.** Each level above 1 makes your blows +3 % stronger, capped at Level 13 (+36 %; C S decision at 12:37 AM PT on 2026-11-21, was +4 %/+48 %). The bonus adds to the whetstone bonus (+15 % each). Total blow strength = 1 + 0.15 × whetstones + 0.03 × min(level − 1, 12). It is derived from XP, so it needs no save change. It applies wherever whetstones already apply (all melee targets; the Keeper through the existing path).
2. **Level-ups are announced and explained.** A short level-up banner with a chime shows when XP crosses a level boundary, from any source. Example: "Level 4 · blows +9 % · next at 200 XP"; at the cap: "Level 13 · blows +36 % (max)". It sits apart from the toast and coach tip, never over the controls, and lasts about 3 s.
3. **Understandable progress.**
   - HUD details line: "Lv N · x/next XP".
   - Journal header: level, blow bonus, next level.
   - Weapon picker header: "Your blows +X % (level +a %, whetstones +b %)".
   - Each weapon line shows Dmg, Speed (fast/medium/slow), Reach, Stagger, and Heavy with its stamina cost.
4. **Seals matter more.** A seal pays +50 XP (was 25), so every seal is a level. From seal 2 on, the claim toast names what is left and where to look: "Sun Shard claimed · +50 XP · 2/4 · 2 seals left — clues in your Journal". At seal 1 the opening coach tip already says this.
5. **Weapon differentiation** (stat tuning; same models, moves and controls):
   - Ashwood Spear: dmg 1 → 1.15 and stagger 0.2 → 0.4, so reach no longer costs damage per second against the Rusty Sword, and the Spear isn't strictly beaten by the Harpoon.
   - Knight’s Longsword: swing 0.40 → 0.36, heavy cost 30 → 24. Its role is the quick, cheap-heavy blade.
   - Emberbrand: swing 0.40 → 0.44, heavy cost 32 → 38. Still the hardest hitter, now slower and stamina-hungry.
   - Azure Halberd: reach 1.55 → 1.75, dmg 1.3 → 1.4. Now genuinely the longest reach, and every hit staggers.
   - Teo’s Harpoon: reach 1.6 → 1.5. Its role is long, quick thrusts with the cheap heavy (26) and a Keeper bonus.
   - Descriptions are updated to match. Rusty Sword, Smith’s Maul and Tide-blade are unchanged.
6. **End screen:** "Level N · X XP" (the stale "/580" is removed).
- Not changed: story, dialogue, world, art, enemy stats and AI, combat controls, opening coach rules, M11 movement, graphics, adaptive resolution, Smooth 30, save format.

## Acceptance criteria
- C1. Blow multiplier: Level 1 = 1.00 (opening fight unchanged); Level 5 = 1.12; Level 13+ = 1.36; whetstones stack additively. Verified through the QA API (`quests().power`).
- C2. Crossing a level boundary from any XP source shows the banner exactly once, with the new level, the bonus and the next threshold. It is not shown on load, and not when XP rises without a level change.
- C3. Claiming a seal gives +50 XP. The toast shows "n/4"; from seal 2 on it also shows the number left and a Journal pointer.
- C4. Weapon maths (tools/m60-econ.py; "strictly beaten" = worse or equal on light DPS, heavy DPS, reach, stagger, heavy damage per stamina and time to first hit):
  - no weapon other than the starter Rusty Sword is strictly beaten by another;
  - the Spear's light DPS is ≥ the Rusty Sword's;
  - the Halberd has the longest reach;
  - the Knight has the cheapest heavy and the fastest swing among swords other than the Tide-blade;
  - Ember keeps the highest damage per hit among blades.
- C5. Old saves (pre-M60, any XP) load. Their level and bonus derive from XP, nothing is written that release-M54 can't read, and the qa-rollback round trip passes.
- C6. The banner and the new UI lines don't overlap the controls, the coach tip or the toast at 412×915 and 360×740 (emulated layout check).
- C7. Full gates on the exact RC commit, one at a time: 13 suites, qa-run, qa-save, qa-rollback, shaders, drawcalls (unchanged vs M59), perfrun, perfhud, diagsmoke, m57diag, onboard, newplayer (both policies), readability, plus the new tools/m60-progress.cjs.

## Measurement labels
These are internal scripted runs and computed values. Real-phone frame pacing and indicator noticeability for the opening 2-husk fight are **still outstanding** and are not replaced by emulation.
