# M57 Phase 3: independent gameplay review (current build, M56 in production)

**Method.** This review is based on reading the code (about 10k lines of TypeScript), running the existing QA suites (all 13 plus the full automated playthrough pass), and looking at QA and diag screenshots and the M57 phone data. I did not do a long hands-on touch play session, so anything about feel is marked as a judgement call to confirm with real playtesters. No features were implemented. Canon and M11 movement were not touched.

**What the game is today.**
- **Story:** two chapters.
  - Chapter I: the Four Seals, the Wind Shrine, the Vale Warden and the Hollow Beacon.
  - Chapter II: Enna's Trail, the Tidewrack Coast, the Listening Pools, the Drowned Keeper boss and the Lowtide Lamp, which is the ending.
- **World:** one open vale with six named landmarks, castles to explore (Pale Keep and the Azure keep, with stashes, secrets, nooks and lore), the barrow, a cave, the coast and a sea cave.
- **Combat:** 8 weapons, each with its own combo and heavy move. There is block and parry, a dodge-roll, stamina and hit-stop.
- **Foes:** husks, sentinels, wraiths and the drowned, plus the Warden and the Keeper bosses.
- **Other systems:** XP and levels, heart upgrades, 6 small side quests, a journal and map, a title screen with save and continue, procedural WebAudio music per region (no audio samples), and an ending with credits.

## Scores (1–10, judged as a commercial indie phone RPG)
| Category | Score | Why |
|---|---|---|
| Core loop | 5 | Explore, find a landmark or seal, fight a few foes, get a cutscene or card. The structure is clear but thin, with little reason to go back to cleared areas. |
| Combat | 5 | The systems are there (combos, heavies, parry, roll, stamina, 8 weapon styles). Few enemy types and little encounter design limit the depth. Feel on touch still needs to be confirmed in playtests. |
| Exploration | 6 | This is the strongest pillar: a dense handmade vale, keeps with stashes and secrets, distinct biomes. Rewards are mostly XP and items you collect once. |
| Progression | 4 | Weapons are the main progression. XP, levels and hearts are light, there's no build choice, and the difficulty curve is shallow. |
| Quest and narrative delivery | 5 | The canon and tone are coherent (Ilka Marr, Enna's trail). Delivery relies on short dialogue lines and chapter cards. There are few memorable character moments outside the bosses. |
| Phone UI/UX | 5 | Joystick, action and combat buttons work. The HUD text is small and dense on a 448-pt-wide screen, and the menus are functional rather than polished. |
| Onboarding | 5 | Character creation, the Wayfinder and a quest line are good. Combat techniques and systems (parry, stamina, weapon swap) are taught lightly. |
| Content length | 4 | Two chapters. Rough estimate: 2–3 hours for a first playthrough (not measured with players). Short for a paid RPG. |
| Audio | 5 | Original procedural music per region plus effects. It's coherent but thin, with no voice or recorded ambience. |
| Polish | 6 | Stable: all regression suites pass, saves are protected and rollback works. Strong lighting and environments. Performance on the target phone is 56 fps with adaptive resolution and a 20 fps 1% low in the meadow. |
| Distinctiveness | 5 | A handmade, storybook-mythic vale that runs in a phone browser is unusual. The mechanics themselves are genre-standard. |
| **Overall** | **5 / 10** | A solid, unusually good-looking vertical slice. It isn't yet a product people would pay for. |

## Major weaknesses (most important first)
1. **Thin core loop and progression.** Little reason to replay or to fight optional foes, and rewards plateau.
2. **Low enemy and encounter variety.** Combat systems outpace the content that uses them.
3. **Short.** Two chapters, and Chapter III isn't approved yet.
4. **Phone readability and controls.** Dense HUD text and lightly taught combat inputs. The first 10 minutes rely on the player experimenting.
5. **Performance headroom.** Open areas are GPU or fill-limited at the 0.8 floor (indirect evidence). Smooth (30 fps) is still the honest default on phones.
6. **No outside playtest data.** All judgements so far come from the team and automated QA.

## Prioritized gameplay-first roadmap
Each milestone needs approval before it starts, gets its own branch, and must pass all 13 suites and the full playthrough. M11 movement and canon stay protected, and nothing new is added to canon without approval.

1. **M58: First-10-minutes and onboarding pass.**
   - *Scope:*
     - Instrument the opening with local, privacy-safe timers: time to first combat, first seal, deaths, menu opens.
     - Add contextual teach prompts for the existing moves (attack, heavy, block/parry, roll, weapon swap) and stamina.
     - Tighten the first-quest wording. No new NPC dialogue without approval.
   - *Acceptance:* a scripted first-10-minutes QA path. Three or more outside testers reach the first seal in under 10 minutes without help, and each uses parry and roll at least once. No regressions.
2. **M59: Combat readability and encounter design.**
   - *Scope:*
     - Wind-up telegraphs and hit feedback for existing foes.
     - Tune parry and roll windows for touch.
     - Arrange existing foes into mixed encounters.
     - Make each of the 8 weapons feel distinct.
   - *Acceptance:* the combat suite passes. Telemetry shows parry use above 20% of blocks in playtests. Tester-rated fight variety improves.
3. **M60: Progression and rewards.**
   - *Scope:*
     - Make levels matter: stat steps, unlocks of existing moves, weapon upgrades through the whetstone or smith.
     - Rebalance stash and chest rewards.
     - Add a difficulty setting.
   - *Acceptance:* a progression curve document, save-compatibility tests including rollback, and at least 80% of testers saying rewards feel worth exploring for.
4. **M61: Phone UI/UX pass.**
   - *Scope:*
     - HUD legibility: text at least 14 pt, tap targets at least 44 pt, a decluttered quest line.
     - Clearer journal and map, plus settings polish.
     - Make Smooth vs Fast clearer in the menu.
   - *Acceptance:* screenshot review on the phone viewport, plus a tap-target audit script. The perfhud and perfrun gates show no regression.
5. **M62: Pacing review and Chapter III proposal (design only).**
   - *Scope:*
     - Measure chapter pacing from playtests.
     - Write a Chapter III design proposal for canon approval, and only then build.
     - Close the remaining performance item (step-up rule and shader pre-warm options) if approved.
   - *Acceptance:* an approved design document and a pacing report. No content is built before approval.

## Realistic commercial assessment
- **As is:** a strong free web demo or portfolio piece. It is **not** commercially viable as a paid phone app: about 2–3 hours of content, thin progression, no store build, and only 30 fps on the target phone by default.
- **Best path:**
  - Release it free on the web or itch.io as Chapters I–II, with a mailing list or wishlist link, to collect playtest data and an audience.
  - Then go premium ($5–10) on Steam, or as a wrapped mobile app, once there are three chapters, deeper combat and progression, and stable 60 fps in Fast mode on mid-range phones.
- **Expected outcome, without marketing:** small. Typically a few hundred to low thousands of dollars for a solo browser-born RPG. Real upside depends on wishlist and community traction, which is untested.
- **Differentiation to lean on:** a handmade, hand-lit mythic vale that plays instantly in a phone browser, with an intimate parent-and-child story (Ilka and Enna).
