# M64 report · THE BROKEN VALE: REFORGED

**Status:** phases M64A–H implemented and tested (internal, automated/emulated only). Tagged locally **release-M64**. **Not deployed** — prod stays on M63 until C S approves this RC.
**No human playtest data exists.** Every result below is labelled **[CODE]** read from source, **[COMP]** computed from game constants, **[AUTO]** automated check against the real build, or **[EMU]** emulated play (scripted bot in headless Chrome, SwiftShader). Nothing here is player data.
Authority: C S (M64 brief and REFORGED scope change, Nov 23 2026; "long session, all phases A–H"). Plan: docs/m64-plan.md. Logs (untracked): /workspace/vale3d/logs/m64/ (STATE.txt, gates-*.log, RC/, H/).
Rollback points kept: **release-M63** (add7bc4) and **release-M54** (2027a56). No Chapter III content.

## Commits (branch m64, from release-M63 add7bc4)
| Commit | What | Phase tag |
|---|---|---|
| 7315ac1 | plan + M64A WIP (Wind Shrine wording, stun pressure, attack token, mixed groups, recovery, QA hooks) | |
| c0530bf | M64A foe tactics, riposte, roll refund, decaying stun pressure; tools/m64-combat.cjs | |
| 29d41ab | M64A BEFORE mode (M63 probe measurements) | **m64A** |
| 6a6ab24 | M64C Kindling + M64D bosses (one commit: shots/ is gitignored, so the C-only commit failed and C+D landed together) | **m64C**, **m64D** |
| 690264d | WIP: B feedback/audio, F perks/relics, E ruins/regions, G story/UI | |
| 810a4cd | E ruins moved to dry ground; test fixes | |
| 4742305 | B/G test fixes; perk card border-box | **m64B**, **m64E**, **m64F** |
| 5cea3de | M64H playthrough script fixes (test-only) | |
| 27d2b48 | overlay stacking fix (index.html CSS), overlap checks, perfcmp tool | **m64G** |
| 8407a95 | test-only: m64b harness retry, stricter m64g overlap checks  | |
| 2d727b6, 7e7be77 | test-only: m64c stale expectation, playthrough perk trace | |
| 65e24fa | **RC code**: beaten Warden no longer stuck 'awake' (rest/regen/perk card) | |
| (release) | docs: report, brief, before/after | **m64H**, **release-M64** |

## What changed, by phase (before → after)
### A · Combat core [CODE]+[COMP]+[EMU]
- **Stun-lock fixed.** Before: foes stunned by Maul/Halberd/Tide light chains could be locked for the whole fight. After: stagger builds "stun pressure"; at 1.5 s the foe is *poised* — it breaks out, takes no stagger or knock-back until its next blow ends. Hard staggers (≥ 2, Temper) still break through. [COMP] foe blows landed in 20 s while the player mashes light attacks: Maul 0 → 6–7, Halberd 0 → 5–7, Tide-blade 1 → 6–7; longest unbroken stagger ~19.7 s → ~1.6–1.9 s. [EMU] Halberd 1 → 4 foe blows per 10 s; longest stagger 1.53–2.6 s → 1.77 s.
- **Attack token.** At most 2 foes in a group wind up together, 0.45 s apart. [COMP] blow pairs < 0.3 s apart in 20 s: 10–30 → 0; minimum gap 0 → 0.45 s.
- **Foe tactics** (all existing foe types): Shade circles to flank; Brute rushes ×2.1 to close; Cultist steps back after a blow; Husk lurches (+0.45 reach); **Sentinel guard** — a frontal light blow does half damage and no stagger (spear-class thrusts pierce; hard staggers break it).
- **Mixed groups**: n-sun brute+shade, n-east husk+shade, d-veil cultist+husk, d-south sentinel+husk. [AUTO] d-veil group 22 → 26 draw calls, tris 2736 → 2440.
- **Riposte** (after a parry, 1.0 s window, ×1.5 damage, staggers) and **roll refund** (rolling through a blow refunds 12 stamina).
- **Recovery**: overworld hearts return one at a time after 4 s calm (then every 2.5 s) instead of all at once after 6 s.
- **Weapon roles** come from matchups (no stat retune): spears pierce guards, Maul/Halberd hard-stagger, riposte works with all. [COMP] light DPS rusty 2.99 · spear 3.04 · maul 3.09 · tide 4.75 · knight 4.19 · halberd 3.11 · ember 4.41 · harpoon 3.89.
- **Wording**: Wayfinder line now "The Wind Shrine up the path holds the trial the Beacon will ask of you." HUD wind label: "blessing opens the Updraft" / "needed for the Beacon".
### B · Combat feedback & audio [CODE]+[AUTO]
- Swing arc in the weapon's colour (wide for heavy cleaves, a narrow wedge for thrusts); hit sparks tinted per weapon (riposte = pale gold); struck foes twist away from the blow's side; a felled foe leaves an ash puff and embers.
- WebAudio (procedural, no assets): struck sound per weapon class (blade / blunt / pierce / sea / fire), a wind-up voice per foe type (second, audible telegraph), a notice cue, a fall sound, boss stingers (intro/phase/win).
- Cost: [AUTO] a landed swing frame ≤ +5 draw calls over idle (arc is the only new one; sparks/flash/dust existed since M47–M52); no scene-object growth over repeated swings (pooled).
### C · Kindling, the signature mechanic [CODE]+[AUTO]
- After the first seal, defence earns sparks: parry +1, rolling through a blow +½, a felled seal-guard group +1 (cap 3; 4 with the Hearth-Kept perk). Spend one on the attuned seal's power: **Temper** (Forge: next 3 blows break any guard), **Daybreak** (Dawn: nearby foes reel, +1 heart), **Glare** (Sun: turns to the nearest foe, front cone reels 1.6 s), **Undertow** (Tide: foes thrown back). Tap Kindle (F) to use, hold (G) to re-attune. 62 px button, clear of every control at 360×740, 412×915, 915×412.
- A kindled seal (not Forge) breaks the Vale Warden's slam. Kindling also mends the new ruins' fractures (E).
### D · Bosses [CODE]+[AUTO]
- Title / phase / victory cards with stingers for the Vale Warden, Ossric and the Drowned Keeper.
- Warden phase 2 (≤ 3 HP): a follow-up slam 0.9 s later ("⚠ A second slam — move again!"). Ossric: after the risen appear, every third attack is a full-circle grave-sweep with a 1.3 s tell. [AUTO] every tell ≥ 1.1 s (Warden), ≥ 0.8 s (follow-up), ≥ 1.2 s (sweep) and avoidable.
### E · World & exploration [CODE]+[AUTO]
- Three new procedural ruins, clear of every canon site (Azure, Sunspire, Iron Dome, Veilfall, Pale untouched), every fire, roam group, outpost and the village: **The Hearth Ruin** (122, 32), **The Reed Shrine** (−65, 150), **Shepherd’s Rise** (155, −110). Each has a fracture: spend one spark to mend it, the stone sinks, take a relic + lore page. Discovered ruins go on the map (⌂ / ✦ mended). **Rewards are relics and lore, not XP** (the existing places still pay their old discovery XP, unchanged for save balance).
- Region name banners on entering a named place (45 s cooldown, never mid-fight) and region atmosphere: a fog tint per place (Veilfall cool mist, Iron Dome warm, Azure blue, Sunspire gold, Ashen Hollow ash, Barrow grey-green…).
- [AUTO] each ruin is on dry, walkable ground and reached on foot from 26 m; a ruin in view costs +5 draw calls, ≤ 1.2k triangles.
### F · Progression [CODE]+[AUTO]
- Level perks: one of two at Lv 3 / 6 / 9 / 12 — Hearth-Kept (+1 spark cap) | Light Stride (rolls −30 % stamina); Quick Riposte (1.5 s, ×1.75) | Field Mending (hearts return sooner); Steady Guard (parry 0.24 → 0.34 s) | Stout Heart (+1 heart); Bright Kindling (seal powers ×1.3 reach, ×1.5 daze) | Iron Arm (heavy −30 % stamina). The choice card appears only when calm outdoors; old saves catch up one owed choice at a time.
- Relic slot (one worn; weapon menu lists all): Emberstone (a roll-through gathers a whole spark), Tide-Pearl (a parry mends a heart, every 8 s), Oath-Ring (+10 % blows).
- Less grind: a roaming group cleared on an earlier day pays half XP (rounded up). [EMU] the bot reached Lv 9 by the end of Chapter I with only the fights on the main path (no grinding loops).
### G · Story, quests & UI [CODE]+[AUTO]
- Opening hook on a new game (3 lines, skippable, play never blocked): "The day the sky cracked over the Vale, the four beacons went dark." / "Your mother, Enna, took the old roads to mend it. She said she’d be back for winter." / "Winter is close, {name}. The Wayfinder waits at the meadow crossing." (built only from existing canon: the cracked sky, the dark beacons, Ress's "back for winter soles").
- Each seal has its own claim beat (card + line + its own Kindling tone).
- Overworld fights bring in the fight music, held 4 s after the last foe disengages, then the meadow theme returns.
- Earned ending: the final card adds a title from how you played (Ruin-Mender / Seal-Kindler / Turner of Blows / Wind-Footed / Vale-Warden / Wayfarer) and your own counts (parries, roll-throughs, foes felled, sparks kindled, ruins, relics, perks).
- Misleading-text audit [COMP]: every XP figure the Journal promises equals the constant that pays it (8/8); no placeholder / coming-soon text in the bundle; the Wind Shrine wording fix (A). New UI text contrast ≥ 4.5:1 against its panel over a bright sky [COMP]. One UI kit (Georgia, gold rules, dark-teal panels) for perk card, boss card, region banner, opening caption and relic menu. M61 accessibility kept (readability 8/8, onboard pass).
### H · Polish, perf, playthrough
- Graphics polish was limited to the new effects (weapon-coloured arcs/sparks, ash, region fog tint, ruin glow). No renderer or lighting changes — perf below.

- Overlay fix found in screenshot review (M64H): the seal/boss beat card (top 24 %) stacked over the claim toast and the level-up banner, and the region banner sat over the quest pill. Card moved to 38 %, banner to 58 %; m64g now checks at 360×740, 412×915 and 915×412 that neither touches the toast, level banner, quest pill or coach tip [AUTO].

## Gate regression on the exact RC (one heavy job at a time, shared 16 GB box)
RC commit **65e24fa** · prod bundle **index-DJVpi3r6.js** · diag **index-CvIDRSOm.js** · run 2026-11-24 04:20:09 → 05:59:18 (PST). Log: logs/m64/gates-RC3.log, per-gate logs in logs/m64/RC3/.
| gate | result | checks | min free RAM |
|---|---|---|---|
| m64h-playthrough | PASS | 11/11 | 11775 MB |
| post | PASS |  | 12457 MB |
| opening | PASS | 15 PASS lines | 12490 MB |
| world | PASS | 30 PASS lines | 10779 MB |
| ground | PASS | 18 PASS lines | 10482 MB |
| quests | PASS | 50 PASS lines | 12530 MB |
| castle | PASS | 65 PASS lines | 11593 MB |
| stair | PASS | 11 PASS lines | 12611 MB |
| cave | PASS | 26 PASS lines | 12407 MB |
| combat | PASS | 25 PASS lines | 12267 MB |
| finale | PASS |  | 12594 MB |
| outlook | PASS | 9 PASS lines | 12174 MB |
| plate | PASS | 7 PASS lines | 12497 MB |
| title | PASS |  | 9900 MB |
| save | PASS | 145 PASS lines | 11408 MB |
| rollback | PASS | 20 PASS lines | 9170 MB |
| shaders | PASS | 20 PASS lines | 12287 MB |
| drawcalls | PASS |  | 12383 MB |
| perfrun | PASS | 3 PASS lines | 12259 MB |
| perfhud | PASS | 8 PASS lines | 12465 MB |
| diagsmoke | PASS | 43 PASS lines | 12233 MB |
| m57diag | PASS | 16 PASS lines | 12575 MB |
| onboard | PASS | 17 PASS lines | 12377 MB |
| newplayer | PASS |  | 12632 MB |
| newplayer-novice | PASS |  | 12583 MB |
| readability | PASS |  | 12399 MB |
| progress | PASS | 21/21 | 12454 MB |
| label | PASS | 19 PASS lines | 12428 MB |
| m63 | PASS | 27/27 | 12482 MB |
| m64 | PASS | 23/23 | 12387 MB |
| m64b-feedback | PASS | 11/11 | 12327 MB |
| m64c-kindle | PASS | 20/20 | 12309 MB |
| m64d-bosses | PASS | 11/11 | 12593 MB |
| m64e-world | PASS | 15/15 | 12131 MB |
| m64f-progress | PASS | 18/18 | 12316 MB |
| m64g-story-ui | PASS | 18/18 | 12272 MB |
| run | PASS |  | 11859 MB |

**37/37 gates PASS.**

Notes:
- The earlier RC run on 5cea3de passed every gate through m64 23/23; m64b-feedback died with "Target closed" (SwiftShader renderer crash in the harness, both checks before it PASS). That run was stopped when the overlay fix changed the RC. m64b now relaunches the browser and retries a block once on a harness crash (logged as RETRY); dev rerun 11/11 with no retry needed.
- History of this RC (all logs kept): RC 5cea3de passed everything through m64 23/23, then m64b died with "Target closed" (SwiftShader renderer crash in the harness; m64b now relaunches and retries a block once, logged RETRY). Screenshot review then found the overlay stacking (fixed, 27d2b48). RC2 8407a95: 30/30 PASS through m64b 11/11 (script cut off by a session interruption), then the rest as RC2b: d 11/11, e 15/15, f 18/18, g 18/18, run PASS; m64c failed 1/20 on a stale M64C expectation (an unknown perk id 'x' kept; the M64F save repair drops it, as intended; test fixed, rerun 20/20).
- **Real bug found by the playthrough (fixed in 65e24fa):** once the Vale Warden is beaten, the Warden tick returned early and left `wd.awake` true for the rest of the session. Since M63 this refused campfire rests ("You can't rest with foes this close") until a reload; in M64 it also stopped heart regen and the perk card after the Warden. The m64h bot ended Chapter I at Lv 9 with only the Lv 3 perk; tracing showed no visible blocker, and a reload offered the card at once. Fix: a beaten Warden is never awake. Game code changed, so the full set was rerun on 65e24fa (this table).
- A first RC2b attempt hit ERR_CONNECTION_REFUSED because the local servers died with an interruption (logs kept); servers restarted.
- Memory: low points on the shared 16 GB box are in the last column; nothing failed for memory.
- Save compatibility: qa-save covers M54–M63 save shapes and the migrations; M64 adds fields (perks, relics, relic, kstat, sparks/attune, mended, disc) that gear() repairs: unknown perk ids dropped, one perk per tier, relics filtered to known ids, worn relic must be owned, ruins filtered to known ids [CODE]. rollback (M64 save opened by the M63 build) is the m56 rollback gate.

## Performance vs M63
### Draw calls / triangles per view (m39-audit, lite) · M63 → M64
| view | calls M63 → M64 | tris M63 → M64 |
|---|---|---|
| hub | 358 → 358 | 1273308 → 1272980 |
| night-hub | 350 → 350 | 1265664 → 1265664 |
| track | 308 → 312 | 1391028 → 1391356 |
| under-bridge | 400 → 400 | 1052564 → 1052564 |
| hall | 160 → 160 | 113424 → 113424 |

### perfrun (HEADLESS ESTIMATE, swiftshader, 412×915 lite) · M63 → M64
| scene | fps avg | frame ms p50 | p95 | draws avg / max | tris avg | heap MB | ready s |
|---|---|---|---|---|---|---|---|
| meadow | 1.4 → 1.3 | 716.6 → 716.6 | 1450 → 1566.6 | 173/257 → 173/227 | 630947 → 631134 | 118 → 117 | 1.89 → 1.85 |
| castle | 3.5 → 3.5 | 283.3 → 283.3 | 583.3 → 583.3 | 77/77 → 77/77 | 56264 → 56264 | 123 → 124 | 1.93 → 1.52 |
| underbridge | 1.2 → 1.2 | 800 → 816.7 | 1683.2 → 1866.6 | 170/218 → 171/217 | 499695 → 501270 | 117 → 117 | 1.99 → 1.68 |


Track view +4 calls / +328 tris vs M63 (M64 content near that camera, e.g. ruin/zone/mixed-group objects); all other views equal. Landed-swing frame ≤ +5 draws; a ruin in view +5 calls, ≤ 1.2k tris [AUTO].
All fps numbers are **headless estimates** (SwiftShader software GL on a shared CPU box) and only compare builds against each other; they say nothing about phone fps. Mobile safeguards unchanged: lite tier default on phones, M63 draw budgets, ruins hidden beyond 150 m, pooled swing/ash effects (no scene-object growth over repeated swings [AUTO]).

## Emulated playthrough, Chapters I–II [EMU]
RC result (gate-m64h.json):

```
{
 "checks": [
  {
   "name": "opening: hook plays, Wayfinder starts the quest",
   "pass": true,
   "d": {
    "cold": true,
    "started": true
   }
  },
  {
   "name": "first fight won by the bot and the first seal claimed",
   "pass": true,
   "d": {
    "f1": {
     "frames": 468,
     "parryTry": 7,
     "rollTry": 3,
     "late": 2,
     "attacks": 6,
     "downs": 0,
     "kindles": 0,
     "hpLow": 1,
     "done": true
    },
    "seal": true
   }
  },
  {
   "name": "guards of the dawn seal beaten by the bot; seal claimed",
   "pass": true,
   "d": {
    "fr": {
     "frames": 277,
     "parryTry": 4,
     "rollTry": 1,
     "late": 2,
     "attacks": 7,
     "downs": 0,
     "kindles": 3,
     "hpLow": 1,
     "done": true
    },
    "claimed": true
   }
  },
  {
   "name": "guards of the sun seal beaten by the bot; seal claimed",
   "pass": true,
   "d": {
    "fr": {
     "frames": 437,
     "parryTry": 4,
     "rollTry": 3,
     "late": 1,
     "attacks": 13,
     "downs": 0,
     "kindles": 4,
     "hpLow": 2,
     "done": true
    },
    "claimed": true
   }
  },
  {
   "name": "ruins mended with sparks earned in play; relics taken",
   "pass": true,
   "d": {
    "mended": 3,
    "of": 3
   }
  },
  {
   "name": "the Vale Warden beaten by the bot",
   "pass": true,
   "d": {
    "atk": 18,
    "dodge": 3,
    "downs": 0
   }
  },
  {
   "name": "guards of the tide seal beaten by the bot; seal claimed",
   "pass": true,
   "d": {
    "fr": {
     "frames": 1556,
     "parryTry": 29,
     "rollTry": 10,
     "late": 17,
     "attacks": 27,
     "downs": 0,
     "kindles": 9,
     "hpLow": 1,
     "done": true
    },
    "claimed": true
   }
  },
  {
   "name": "four seals \u2192 the Wayfinder finale runs and the chapter card shows",
   "pass": true,
   "d": {
    "done": true,
    "chap": true
   }
  },
  {
   "name": "progression in play: level \u2265 6 with perks chosen at each due level (no grinding loops)",
   "pass": true,
   "d": {
    "level": 9,
    "perks": [
     "hearth",
     "mend",
     "guard"
    ]
   }
  },
  {
   "name": "no page errors in the Ch I play",
   "pass": true,
   "d": []
  },
  {
   "name": "the full Ch I + II story run completes on this build (exit 0, no page errors)",
   "pass": true,
   "d": {
    "chapterCard": true,
    "keeper": true,
    "lamp": true,
    "errors": "[]",
    "crash": false
   }
  }
 ],
 "timeline": [
  {
   "ev": "opening",
   "cold": true,
   "lines": 3
  },
  {
   "ev": "fight d-dome husks",
   "frames": 468,
   "parryTry": 7,
   "rollTry": 3,
   "late": 2,
   "attacks": 6,
   "downs": 0,
   "kindles": 0,
   "hpLow": 1,
   "done": true,
   "level": 1,
   "sparks": 0
  },
  {
   "ev": "fight guards of dawn",
   "frames": 277,
   "parryTry": 4,
   "rollTry": 1,
   "late": 2,
   "attacks": 7,
   "downs": 0,
   "kindles": 3,
   "hpLow": 1,
   "done": true,
   "level": 2,
   "sparks": 2
  },
  {
   "ev": "perk chosen",
   "lv": 3,
   "pick": "hearth"
  },
  {
   "ev": "fight guards of sun",
   "frames": 437,
   "parryTry": 4,
   "rollTry": 3,
   "late": 1,
   "attacks": 13,
   "downs": 0,
   "kindles": 4,
   "hpLow": 2,
   "done": true,
   "level": 4,
   "sparks": 3.5
  },
  {
   "ev": "ruin hearth",
   "sparksBefore": 3.5,
   "mended": true,
   "relic": true
  },
  {
   "ev": "ruin reed",
   "sparksBefore": 2.5,
   "mended": true,
   "relic": true
  },
  {
   "ev": "ruin rise",
   "sparksBefore": 1.5,
   "mended": true,
   "relic": true
  },
  {
   "ev": "warden",
   "at
```

Dev run (5cea3de, same code path) [EMU]: d-dome, dawn, sun and tide guard fights won with 0 downs (tide: 17 late reactions); 3/3 ruins mended with sparks earned in play; Vale Warden beaten (18 attacks, 3 dodges, 0 downs); finale + chapter card shown. End of Chapter I: Lv 9, 427 XP, 3 relics; kstat parry 43, slip 13, felled 11, forge 3, dawn 13; 7 boss/seal cards; no page errors. Chapter II via qa-run (story to the Keeper and the Lowtide Lamp): exit 0 in 1643 s, chapter card + Keeper + Lamp milestones, errors [].
The bot is a script, not a player: it parries 55 %, rolls 25 % and reacts late 20 % of the time, never heals, and walks the main path. It proves the path is completable and nothing crashes; it does not measure fun or difficulty for people.

## Weaknesses and risks
- **Prod (M63) still has the Warden-awake bug**: a player who beats the Vale Warden cannot rest at a campfire until they reload. Fixed only in M64 (65e24fa); it reaches players when release-M64 is deployed.
- **No human playtest.** Every difficulty and feel claim is computed or emulated. Real players may find tactics + attack token + Sentinel guard harder than M63 at seal 3–4, or Kindling under-used.
- Audio is procedural WebAudio; QA counts the cues but nobody has listened on a phone speaker.
- Headless perf only (SwiftShader). Real-phone fps for the new arcs/ash/fog tint is unmeasured; draw-call cost is the guard (≤ +5 per landed-swing frame, +5 per ruin in view).
- The overlay stacking bug was found by eye in screenshots, not by the tests; other overlay combinations (e.g. a coach tip during a boss card in landscape) are only partly covered.
- Perk balance is computed; Stout Heart + Tide-Pearl may make late Chapter I easy.
- Ruins are procedural stone forms (one merged mesh each); they read as ruins but are plain next to the canon sites.
- The playthrough bot reaches Lv 9 at the end of Chapter I; whether perks arrive at a good pace for real players is unknown.
- Large single main.ts keeps growing (maintenance risk), bundle unchanged in shape.

## Commercial-readiness assessment
- **Combat depth** — now has real decisions (parry→riposte, roll-through, tactics, guard-breaking weapons, Kindling) [CODE][AUTO]. Feel untested by people.
- **Content** — Chapters I–II complete and playable end to end [EMU]; three side ruins, perks and relics add reasons to explore [AUTO]. Still short for a paid release; no Chapter III (by instruction).
- **Presentation** — consistent UI kit, boss/seal cards, opening hook, earned ending [AUTO]; procedural art is coherent but not premium.
- **Stability** — full V2 regression green on the RC, no page errors in the playthrough [AUTO][EMU].
- **Verdict** — a solid free/early-access RC. It is not commercially ready until a closed human playtest confirms difficulty, readability on real phones and real-device fps. Recommended next step: closed playtest on release-M64.

## Release
- Tags (local): m64A, m64B, m64C, m64D, m64E, m64F, m64G, m64H, **release-M64** (RC 65e24fa). Rollback: release-M63 (add7bc4), release-M54 (2027a56).
- Zip: /workspace/vale3d-m64-release.zip (git archive of release-M64, no refs/ or logs/) · sha256 (recorded outside the zip in logs/m64/STATE.txt and the release reply; a zip cannot contain its own hash).
- **Not deployed.** Prod stays on M63 until C S approves.
- Screenshots: /workspace/vale3d-m64/shots/m64/*.png (gitignored, so not in the zip; rewritten by the tests on the RC run): m64b-swing.png, m64c-kindle-hud.png, m64d-ossric-victory.png, m64d-warden-victory.png, m64e-ruin-hearth.png, m64f-perk-card.png, m64g-ending-recap.png, m64g-region-banner.png, m64g-seal-beat.png. Note: m64g-region-banner.png forces the region banner and the opening caption on together for the fit check; in play they cannot normally meet (the banner needs a started quest and an untalked, unpaused moment, the caption ends 10.8 s after hero creation).


## Before / after

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
