# M64 before / after (M63 release-M63 add7bc4 → M64 release-M64)

No human playtest data. Labels: [CODE] read from source · [COMP] computed from game constants · [AUTO] automated check on the real build · [EMU] scripted bot in headless Chrome (SwiftShader). Screenshots: /workspace/vale3d-m64/shots/m64/ (gitignored, not in the zip).

| Area | M63 (before) | M64 (after) | Evidence |
|---|---|---|---|
| Stun-lock | Maul/Halberd/Tide light chains could hold a foe for the whole fight; longest unbroken stagger ~19.7 s | stun pressure → foe breaks out ("poised") at 1.5 s; longest ~1.6–1.9 s; foe blows landed in 20 s of mashing 0 → 5–7 | [COMP] [EMU] |
| Group pressure | 2–3 foes could swing in the same instant (10–30 blow pairs < 0.3 s apart / 20 s) | attack token: max 2 winding up, 0.45 s apart (0 such pairs) | [COMP] [AUTO] |
| Foe behaviour | all foes approach and swing | Shade flanks, Brute rushes, Cultist steps back, Husk lurches, Sentinel guards its front (spears pierce) | [CODE] [AUTO] |
| Defence payoff | parry only blocks | riposte window (1.0 s, ×1.5, staggers); roll-through refunds 12 stamina | [CODE] [AUTO] |
| Recovery | all hearts after 6 s calm | one heart after 4 s, then every 2.5 s | [CODE] [AUTO] |
| Hit feedback | same spark and sound for every weapon | swing arc + spark in the weapon's colour, struck sound per class (blade/blunt/pierce/sea/fire), foes twist from the blow, ash on death | [AUTO] m64b 11/11 |
| Telegraphs | visual wind-up only | plus a wind-up voice per foe type and a notice cue | [AUTO] |
| Signature mechanic | seals were collectibles | Kindling: parries/roll-throughs earn sparks; four seal powers (Temper, Daybreak, Glare, Undertow) | [AUTO] m64c |
| Bosses | Warden single phase; no cards | title/phase/victory cards + stingers; Warden follow-up slam; Ossric grave-sweep; a kindled seal breaks the Warden's slam | [AUTO] m64d |
| Exploration | canon sites only | 3 procedural ruins (Hearth Ruin, Reed Shrine, Shepherd's Rise): mend with a spark → relic + lore; map glyphs; region banners + fog tint | [AUTO] m64e 15/15 |
| Progression | level = damage bonus only | perk choice at Lv 3/6/9/12 (8 perks), relic slot (3 relics), repeat-clear groups pay half XP | [AUTO] m64f 18/18 |
| Story/UI | game starts at the meadow | 3-line skippable opening; per-seal claim beat; fight music in overworld fights; ending names how you played | [AUTO] m64g 18/18 |
| Overlay stacking | n/a (new in M64) | found in M64 screenshots: seal card over toast + level banner, region banner over the quest pill → fixed (card at 38 %, banner at 58 %), checked at 360×740, 412×915, 915×412 | [AUTO] |
| Draw calls (5 views) | hub 358 · night-hub 350 · track 308 · under-bridge 400 · hall 160 | see perf table (identical except track +4) | [AUTO] |
| Beaten Warden (bug live since M63) | after the Warden win the game kept it 'awake' for the session: campfire rest refused until reload (M63 prod has this); in M64 dev builds it also stopped heart regen and perk cards | a beaten Warden is never awake; m64h bot gets all perk cards in one session (hearth/mend/guard at Lv 9) | [EMU] [CODE] |
