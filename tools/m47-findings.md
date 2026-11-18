# M47 findings (base 0368857, M46 live index-CMivMlzg.js)

## 1. Combat feel (no M11/player-motion code touched)
- **Hit-stop (mobs.ts):** a struck foe freezes on contact for 0.055 s, or 0.09 s on a heavy/staggering blow. Its armour flashes hot while frozen. A killing blow skips the freeze.
- **Knockback + flinch (mobs.ts):**
  - `hit(dmg, stagger, fromX?, fromZ?)` slides the foe away from Ilka at 2.8 m/s, or 5.2 m/s heavy, decaying quickly. Every step goes through the mob's own `walk()` test, so it can't be pushed through walls, into water or out of a room.
  - The body snaps back in a lean-back flinch.
  - Parries (dmg 0) don't knock back.
  - The extra parameters are optional, so old call sites and the keeper/warden are unchanged.
- **Readable wind-ups (mobs.ts):** the foe rears back as it winds up and its armour glows hotter as the swing builds. It flickers bright for the last 0.2 s before the blow, on top of the existing ring telegraph.
- **Impact spark + camera punch (main.ts):** wired into all five Mob hit sites (castle, sea, barrow, roamers, sea-cave wights):
  - an 18-spark additive burst and a short hot flash sprite at the point of contact, on the transparent layer 1 (no AO pass);
  - a camera punch toward the foe (0.17 m, or 0.3 m heavy, decaying in about 0.1–0.2 s), on top of the existing shake.
- **Perf:** spark and flash are 2 draw calls, only while visible (about 0.34 s after a hit).

## 2. Pale Keep: second hidden passage
- **The hiding place:** a panelled-over doorway in the great hall's east wainscot, under the existing tree-of-life tapestry. In Pale the tapestry now hangs about 0.8 m higher.
- **Shut:** the panel is wainscot (rail and stiles) with a slab of wall above it. There is no stone frame, so it reads as more panelling.
- **Opening it:** the interaction is "Wainscot under the tapestry · one panel sits proud". Opening shoves the panel back and slides it aside inside the passage. The toast is a system line, not NPC dialogue.
- **The room:** "Hidden passage", x 9..13.6, z −0.6..3.8, h 3.6. It is the same kind of room as the existing "Hidden room", not a landmark.
- **Loot:**
  - Stash `pale-nook`: an iron-bound box under a mouldering sack holding a purse of old coin and blade-oil, +20 XP.
  - Opening the passage itself gives +10 XP ("secret found").
- **Furnishings** are all low (box, stool, a candle on a ledge, an old mat), so no camera blockers are needed. While shut, the door blocks movement and the camera through the shared door checks.
- **Save:**
  - The opened state is stored as `'pale-nook'` in `save.secrets`; the loot uses `save.stashes`.
  - Old saves have neither, so the passage stays shut and the box stays full.
  - The journal's "secret room found" check still keys on `'pale'` only.
- **Camera probe (Pale, default YS 0/4.5):** every existing room is identical to the HEAD baseline (logs/m47/cam-pale-base.log vs cam-pale.log). The new passage has min 1.80, the same floor as the existing Hidden room and Bedchamber.
  - A first version (2.4 m wide, h 3.0) had min 1.22, so I widened it to 3.6 m walkable and h 3.6.
- **Shots:**
  - shots/m47-nook-closed-open-inside.png: closed, open, inside.
  - shots/m39-m47c-lite-{nook,nookopen,nookin}.png.
  - New shot presets m20-nook / m20-nookopen / m20-nookin, and audit views nook / nookopen / nookin.

## Perf (Lite)
perf-m25: meadow 170 / 633k, paleWing 114, paleStair 114, keep 186 / 648k, hall 59 / 56k, kitchen 62.

## Open
- Hit-stop freezes only the struck foe. Ilka's own animation isn't paused, because that would mean touching the M11 player/mixer code.
- Keeper and Warden hits get the shake only, not the spark burst or camera punch.
- The QA suites don't exercise the new passage yet (no qa-castle step for it).
