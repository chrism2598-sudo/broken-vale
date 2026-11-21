# M60 audit · progression and rewards (before any change)

Source: the shipping code at main b2ad8e4 (= live M59, bundle index-zXPa7RLt.js). The figures are **computed from the shipping constants** (`tools/m60-econ.py`, plus constant reads of combat.ts, mobs.ts, quest.ts, castle.ts, sidequests.ts, finale.ts, roam.ts). The opening figure was **observed in an emulated headless-Chrome run** (logs/m58-live and the M59 layout run). Nothing here is player data.

## 1. XP and levels
- Formula: `level = 1 + floor(xp / 50)`. It's linear: every 50 XP is a level, with no cap.
- **Levels do nothing.** `levelOf` is read only for display (HUD line, journal header, title screen, toasts). No stat, heart, stamina or damage depends on it. A level-up is a " · Level N" suffix on whatever toast is showing: no sound, no banner, and no statement of what changed.
- Main-path XP, deterministic, in story order:

| Milestone | XP | Level |
|---|---|---|
| Seal 1 (Forge Heart) | 25 | 1 |
| Seal 2 / 3 / 4 | 50 / 75 / 100 | 2 / 2 / 3 |
| Vale Walker (4 seals) | 180 | 4 |
| Wind Shrine · Warden · Echo · Beacon (end of Chapter I) | 215 · 255 · 275 · 335 | 5 · 6 · 6 · 7 |
| Cave · Coast · Sea page · Keeper · Lamp (end) | 375 · 405 · 450 · 510 · 580 | 8 · 9 · 10 · 11 · 12 |

- Optional one-time XP is about 1,400 (estimate). It comes from:
  - Side tales (Sefa, Dov, Ress, plus steps): about 330.
  - The Barrow (hall, the King, risen dead, the vault): about 190.
  - The Ashen Hollow camp and its strongbox: about 100.
  - The two keeps: chests 2 × 120, 7 stashes 120, lookouts 30, secret doors about 40, sentinels about 100.
  - Sea-cave chests, the tablet and the Wights: about 160.
  - Place discoveries: about 145.
  - Roaming foes give XP **again every day** (husk 5, shade 9, brute 22). A full night sweep is about 240 XP.
- A thorough player therefore ends around **Level 35–45**, a main-path player at **Level 12**.
- The end screen still prints `xp / 580` (`MAX_XP`, last updated in M16). A thorough player sees something like "1,900/580 XP".
- Opening (emulated run): after the first seal the HUD reads **"Lv 1 · 30 XP"**. Players don't reach a level-up until after the first seal, and the first one says nothing.

## 2. Weapons (light combo chained; heavy fully charged; tools/m60-econ.py; time-to-kill in seconds)

| Weapon | Light DPS | Heavy DPS | Reach | Stagger | Kill a shade | Kill a zealot | Kill the King |
|---|---|---|---|---|---|---|---|
| Rusty Sword (start) | 2.99 | 1.55 | 1.00 | 0 | 1.68 | 4.02 | 8.7 |
| Ashwood Spear | **2.65** | 1.46 | 1.45 | 0.2 | 1.59 | 4.42 | 9.6 |
| Smith’s Maul | 3.09 | 2.04 | 0.95 | 1.1 (every hit) | 1.10 | 3.54 | 8.4 |
| Tide-blade | 4.75 | 2.16 | 1.15 | 0.3 | 0.86 | 2.35 | 5.3 |
| Knight’s Longsword | 3.77 | 2.03 | 1.15 | 0.25 | 1.47 | 3.17 | 7.1 |
| Azure Halberd | 2.89 | 1.96 | **1.55** | 0.9 | 1.89 | 4.14 | 8.6 |
| Emberbrand | **4.85** | **2.57** | 1.10 | 0.45 | 1.01 | 2.31 | 5.4 |
| Teo’s Harpoon | 3.89 | 2.11 | **1.60** | 0.35 | 1.32 | 3.25 | 6.8 |

- **The Knight’s Longsword is strictly beaten** (worse or equal on every stat) by both the Tide-blade and Teo’s Harpoon. Emberbrand also beats it on damage, DPS, stagger and stamina, leaving the Knight only 0.05 more reach. Once you own one of those there's no reason to carry it.
- The early Ashwood Spear is strictly beaten by the Harpoon. (The Rusty Sword being outclassed is expected for a starter.)
- **The Halberd says "Longest reach" but the Harpoon reaches further** (1.60 vs 1.55), hits as hard and swings faster. The Halberd's only edge is stagger.
- **The Spear does less damage per second than the starting sword.** Its only trade is reach.
- The weapon picker shows "Dmg · Heavy · Reach" only, with no speed, stagger or stamina cost. So the Maul (Dmg 2) looks best and the fast blades look weak.
- Whetstones (+15 % each, up to 4, from 5 sources) are the only lasting power growth, and they're easy to miss.

## 3. Rewards
- Every chest, stash, lookout, secret and discovery pays **XP only**. Because XP does nothing (§1), most exploration rewards have no mechanical value.
- The lasting rewards are 3 weapons (keep secrets, Dov), 2 weapons as pickups (Spear, Maul), the Tide-blade, whetstones, and Sefa's heartstone (+1 heart). Those are good, but they come from about 10 of roughly 60 reward sources.
- Side-tale payoffs are strong (Ember, Harpoon, heartstone) and clued in the Journal. Fine as they are.

## 4. The pull toward seals 2–4
- A seal pays +25 XP and a "n/4" counter, and that's all. Seals 2 and 3 are mechanically identical to a 25-XP stash.
- After seal 1 the M58 guide arrow switches off (by design). The only pointers forward are the Journal clues and "Seal 1 of 4" in the coach tip. The claim toast doesn't say what is next or why it matters.

## 5. Where progression feels unrewarding, repetitive or unclear (ranked)
1. Level-ups are meaningless and silent (§1). This affects every reward in the game.
2. Exploration rewards are XP-only, so with point 1 they feel empty.
3. Seals 2–4 give no felt payoff and no "what's next" (§4).
4. Weapon overlap: Ember beats Knight, Harpoon beats Halberd, Spear is weaker than Rusty. The picker hides the trade-offs.
5. The end screen's "/580" is wrong for most players.
6. (Note, no change) Roaming XP repeats daily. Harmless today; after M60 it becomes a slow grind path, capped by the level cap below.
