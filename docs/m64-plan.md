# M64 · THE BROKEN VALE: REFORGED — audit and phase plan

Scope change by C S, Nov 23 2026 9:23 PM (PST): M64 becomes a game-wide overhaul and replaces the smaller M64 brief. Work already
done for the smaller brief (Wind Shrine wording, stun-lock poise, attack token, mixed groups, slower overworld recovery) is kept and
becomes the first part of phase M64A.

Base: branch `m64` from `release-M63` (add7bc4). Rollback points `release-M63` and `release-M54` stay untouched. No deploy:
prod stays on M63 until C S approves the final RC. No Chapter III. No new npm dependencies (audio is WebAudio/procedural).

Evidence labels used throughout: **[CODE]** read from source, **[COMP]** computed balance, **[AUTO]** automated test,
**[EMU]** emulated gameplay (scripted headless Chrome). There is **no human playtest data**; none will be invented.

## 1. Audit findings (from M62 evaluation + a fresh read of the M63 source)

| Area | Finding | Evidence |
|---|---|---|
| Combat · stun-lock | Before M64A: Maul and Halberd held one foe staggered indefinitely (0 foe blows in 20 s of light mashing); Tide-blade did the same with light staggers alone (1 blow / 20 s). Fixed in M64A-1 (poise: ≤1.5 s unbroken stagger). | [COMP] tools/m64-combat.py, [EMU] tools/m64-combat.cjs |
| Combat · AI | 9 regular foe types share one chase → wind-up → swing loop; they differ only in numbers. Several foes could wind up on the same frame (two blows on one beat, can't answer both). | [CODE] mobs.ts; [COMP] token sim: 10–30 blow pairs < 0.30 s apart per 20 s |
| Combat · defence | Parry/roll/block exist but stun-lock made them optional; parry rewards only +10 stamina; perfect dodge has no reward. | [CODE] combat.ts; M62 |
| Combat · weapons | 8 weapons, light DPS 2.99–4.75; stagger was the main identity (Maul/Halberd) and it was the lock. Heavies differ by move name (cleave/lunge/slam/wave) more than by effect. | [COMP] |
| Combat · feedback | Hit-stop, flash, knock-back, wind-up glow exist. No weapon trail, no hit sparks per material, one generic hit sound, no enemy voice/tell sounds beyond a shared warn. Death = topple. | [CODE] mobs.ts, audio.ts (19 voices, all shared) |
| Healing | Full heal 6 s after any fight (overworld), 5 s in castle/barrow; defeat costs nothing. Changed in M64A-1 to 1 heart at 4 s calm then 1 per 2.5 s (overworld). | [CODE], [COMP] |
| World | Strong lighting/terrain; regions share one ambience bed and fog; transitions are invisible; many POIs reward XP only; few hidden places outside the castle/keeps. | [CODE] audio.setRegion, landmarks.ts; M62 |
| Progression | Levels give +3 % blow power only (cap Lv 13); exploration rewards mostly XP; no choices; roaming foes grant XP daily (grind bounded by cap). | [CODE] quest.ts, M60 |
| Quest/story | Opening is a list of four places; seals 2–4 had weak felt payoff (M63 added guards); dialogue is short single lines; misleading text: Wind Shrine "optional" (fixed in M64A-1); other descriptions to re-audit. | [CODE], [AUTO] m621-label |
| Bosses | Keeper (tide windows), Vale Warden (stagger/telegraph), Ossric the Barrow-King, Vale Walker. Single-phase patterns, little arena atmosphere, victory is a toast/XP. | [CODE] keeper.ts, warden.ts, barrow.ts |
| Graphics/animation | Good PBR/terrain/lighting and adaptive resolution. Characters are rigid primitives with arm-swing poses; no transitions/anticipation squash; combat FX minimal. | [CODE] |
| Audio | Procedural WebAudio, region music volume; no per-location identity beyond setRegion, no music transitions into combat/boss. | [CODE] audio.ts |
| UI | M61 accessible HUD (contrast, tap targets); journal, map, weapon picker are separate styles; rewards are toasts. | [CODE], M61 audit |
| Performance | Lite budget held through M63; draw-call audit and perfrun gates exist. Every phase must hold draws/perf vs M63. | [AUTO] m39-audit, m54-perfrun |

## 2. Signature mechanic — Kindling (lore: custodians, seals, beacons, the fractured sky)

The old custodians kept the beacons lit by *kindling*: carrying a spark of a seal's fire. Ilka learns it at the first seal.
- **Kindle meter (0–3 sparks):** filled by *precise defence* only — a parry (+1), a dodge through a blow (+½), and a seal-guard
  victory (+1). Not by mashing. Shown as three small flames beside the hearts.
- **Kindle a seal (spend 1 spark, one button):** the effect is the claimed seal's nature, so the toolkit grows with the story:
  Forge Heart → *Temper* (next 3 hits stagger, even on a poised foe); Dawn Sigil → *Daybreak* (a short radiant burst: nearby
  foes flinch, the amber rings of shades show 0.2 s earlier for 6 s); Sun Shard → *Glare* (foes in front lose their wind-up);
  Tide Seal → *Undertow* (pulls foes in, then pushes them away — breaks surrounds).
- **Exploration use:** *fractures* — hairline seams of old custodian light in ruins. Kindling one (1 spark) mends it for a while
  and opens a hidden alcove, stair or bridge (new POIs in M64E). Rewards are relics/lore, not XP.
- Not copied from a popular RPG: resource earned only by defence, spent on story-unlocked seal powers that also mend the world.

## 3. Phases (each: targeted test + relevant gates → commit → local tag m64A…m64H; STATE.txt after each)

| Phase | Goal | Targeted test | Gates before tag |
|---|---|---|---|
| **M64A Combat core** | (1, done) wording fix, poise/no stun-lock, attack token, mixed groups, slower recovery. (2) foe-type behaviours from existing models: Shade flanks/circles before striking, Brute charge with long tell, Cultist feint-and-step-back, Sentinel guard stance (front light hits glance off, heavy/flank opens it), Husk lunging lurch. (3) defence pays: parry opens a 1 s riposte window (×1.5 dmg), dodge through a blow refunds stamina. (4) weapon identity pass (computed DPS/reach/stagger/stamina table; modest tuning). | m64-combat.cjs (+ behaviours, riposte, refund), m64-combat.py | qa-combat, qa-world, readability, m63-guards, newplayer ×2, onboard, m621-label |
| **M64B Combat feedback & audio** | Weapon trails, hit sparks by material, enemy hit reactions (twist/flinch by direction), death dissolve to ash, procedural audio: impact per weapon class, enemy tell cues per type, footsteps by surface, parry ring. | m64b-feedback.cjs (FX objects pooled, audio voices fire, draw-call delta) | perfrun, drawcalls, perfhud, shaders, readability |
| **M64C Kindling** | Signature mechanic: meter, four seal powers, HUD, coach tip, fractures hooks; save field `kindle` with migration. | m64c-kindle.cjs (earn only by defence, each power, old saves) | qa-save, qa-combat, onboard, newplayer |
| **M64D Bosses** | Warden, Ossric, Keeper, Vale Walker: two phases each, unique pattern, every dangerous attack telegraphed ≥0.6 s and avoidable by roll, arena ambience + music swell, victory card. | m64d-bosses.cjs (phases, telegraph timing, avoidability by scripted roll) | qa-finale, qa-castle, qa-run, readability |
| **M64E World & exploration** | Region atmosphere sets (fog tint, light, ambience bed), region name banners on transition, new ruins/POIs/hidden alcoves away from canon sites (Azure, Sunspire, Iron Dome, Veilfall fixed), fractures (Kindling), discoveries give relics/lore not XP. | m64e-world.cjs (POIs reachable, rewards, banners, draw budget per region) | qa-world, qa-ground, drawcalls, perfrun, rollback |
| **M64F Progression** | Level perks: choose 1 of 2 at Lv 3/6/9/12 (e.g. +stamina, +1 spark cap, faster riposte, wider parry); relic slot (charms from discoveries); reward redistribution; roaming XP once per group per day after cap reached. Migration for `perks`, `relics`. | m64f-progress.cjs (+ migration from M54–M63 saves) | qa-save, m60-progress, qa-run |
| **M64G Story, quests & UI** | Stronger opening hook (Enna's lamp scene), seal encounters each with a distinct set-piece, dialogue/objective pass, misleading-text audit, earned ending beat; cohesive UI kit (menus, inventory/relics, journal, weapon select, reward cards); music transitions. M61 accessibility kept. | m64g-story-ui.cjs (all objectives truthful, UI layout at 360×740/412×915, contrast) | qa-opening, qa-quests, qa-title, qa-outlook, onboard, readability |
| **M64H Graphics polish, perf, RC** | Graphics audit wins (character animation blends, combat FX polish, lighting consistency), perf vs M63, emulated full Ch I–II playthrough, full V2 gates, screenshots, report, brief, release-M64 zip. | m64h-playthrough.cjs | Full V2 set, one at a time |

Order of value if time runs short: A → C → D → B → F → E → G → H (H always runs). Each phase is finished and tagged before the
next starts; a smaller set of complete phases beats half-done everything.

## 4. Non-negotiables carried into every phase
Save compatibility (new fields optional with defaults; migrations tested from M54–M63 saves) · mobile-first, adaptive resolution and
draw budgets · M11 movement · canon rules (Azure, Sunspire, Iron Dome, Veilfall fixed; refs/ never pushed) · M61 accessibility ·
no new dependencies · no invented playtest data · no Chapter III · no deploy.
