# M48 findings (base 01c6c05, M47 live index-rmGAIXzg.js). Not committed, not deployed.

## 1. Keeper and Warden hits get the M47 impact FX
- `hitKeeper` and the Warden strike now call `impactFx`, giving the spark burst, the hot flash and the camera punch on top of the existing shake.
  - Keeper: the punch is heavy on phase-ups and on the killing blow.
  - Warden: heavy on heavy strikes.
- The armoured (glancing) Keeper hit stays a clank with no sparks.
- The M11 player and mixer code are untouched.

## 2. qa-castle step 20: the Pale hidden passage (`pale-nook`)
- **What it checks:**
  - The passage is shut on a save that never opened it (the old-save case).
  - The shut panel blocks walking.
  - The wainscot prompt is offered, and opening the passage gives +10 XP and adds `pale-nook` to `save.secrets`.
  - You can walk into "Hidden passage".
  - The stash pays once (+20 XP, `pale-nook` in `save.stashes`).
  - After a page reload, the passage is still open, the stash is still looted, and the box isn't offered again.
- **Bug found and fixed (quest.ts, pre-existing since M21b):** the save loader's list of preserved arrays didn't include `stashes`. Every castle stash (armoury loose stone, bed lever, cell scratches, now the nook) was dropped on reload and paid out again. `stashes` is now kept and sanitised like the other string lists. Old saves without it load as before.

## 3. Washed-out grass bank by the creek path (Lite, full sun)
- A grass band 0–8 m from the creek edge (`BANKG`) is deeper, less yellow and matte (roughness ≥ 0.95), so it stops catching the sky env map.
- The M46 gravel and wetness fix is unchanged.
- Before/after: shots/m48-before-after-banks.png (m39-m46a4-lite-banks vs m39-m48a-lite-banks; mean pixel diff 7.4/255).

## Perf (Lite)
- perf-m25: meadow 170 calls / 633k, paleWing 114, paleStair 114, keep 186 / 648k, hall 59, kitchen 61.
- m39-audit (halved): hub 179, night-hub 183, under-bridge 200, track 150 / 695k. All unchanged from M47.

## Camera
- No castle or camera code changed. The castle QA runs the full room walk.

## Open
- Ilka's own animation still doesn't hit-stop (that would mean touching the M11 mixer).

## QA (logs/m48/qa-chain.log)
All 13 suites passed with exit 0: post, opening, world, ground, quests, castle (with the new step 20), stair, cave, combat, finale, outlook, plate and title. qa-run (timeout 1800) exited 0 with no FAIL or CRASH. The log ends with ALLDONE and RUNDONE. No re-runs were needed.
