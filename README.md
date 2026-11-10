# The Broken Vale — 3D vertical slice

Play: https://chrism2598-sudo.github.io/broken-vale/

A standalone Three.js (r187) + Vite + TypeScript web game slice of *The Broken Vale*: a stylised meadow at spawn, the Wayfinder with his lantern staff, the path to the Wind Shrine, a creek, a floating island and the sky rift. Mobile-first (touch joystick + drag camera), with desktop WASD.

## Run

```bash
npm ci
npm run dev        # local dev server
npm run build      # type-check + production build into dist/
npx vite preview   # or: cd dist && python3 -m http.server 8090
```

The build uses `base: './'`, so `dist/` works from any subpath (e.g. `https://<user>.github.io/<repo>/`) or straight from a static file host.

## Controls

| | Touch | Desktop |
|---|---|---|
| Move | left joystick (push far to run) | WASD / arrows (Shift = walk) |
| Look | drag anywhere | drag, mouse wheel = zoom |
| Talk to the Wayfinder | double-tap near him | E (or double-click) |
| FPS readout | tap the FPS chip (bottom-right) | F |

## Character creation

On first visit (or via **New character**) the player types a first name — the family name **Marr** is fixed — and picks Female or Male, with a live turning preview. Default is canon: Ilka Marr, 17, Enna's daughter. The choice is stored in `localStorage` (`vale3d-hero`). Names are sanitised (letters of any script, digits, space, `'` and `-`, max 16).

Dialogue lives in `src/dialogue.ts` and supports tokens: `{name}`, `{fullname}` (→ "Name Marr"), `{surname}`, pronouns `{they} {them} {their} {theirs} {themself}` and `{child}` (daughter/son). Capitalise a token (`{They}`) to capitalise its output.

## Quality & performance

- **High** (desktop default): GTAO, bloom, vignette, mirror water, 56k grass clumps, full-mesh trees within 60 m capped at ~400k triangles, impostor cards beyond.
- **Lite** (default on phones/tablets): no post, simpler water, 15k lower-poly grass clumps, full trees within 38 m capped at 120k triangles.
- Override with `?q=high` / `?q=lite`, or the Quality button (remembered). `?fps` shows the readout.

## Debug / screenshots

`window.__vale` exposes `ready`, `fps`, `tris`, `framing()`, `preset(name)` and `profile`. URL `?shot=spawn-wide|ilka-close|creek|island|create-female|create-male` jumps to a preset. `tools/shots.cjs` takes headless Chrome screenshots into `shots/`.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds on push to `main` and publishes `dist/`. After pushing the repo to GitHub, set **Settings → Pages → Source → GitHub Actions**. Nothing has been pushed yet.

## Assets

All third-party assets are CC0 (Poly Haven, Quaternius via Poly Pizza) or MIT/Apache (three.js, Draco). See [CREDITS.md](CREDITS.md).

## Layout

```
src/main.ts       scene, player/camera, creation screen, presets
src/world.ts      layout + height field (spawn, Wayfinder, shrine, creek, path, mountains)
src/terrain.ts    splat-blended PBR terrain (grass/path/rock/creek bed, snow, macro variation)
src/grass.ts      instanced wind-swept grass that follows the player
src/nature.ts     tree/plant baking, autumn recolour, impostors + TreeField LOD
src/island.ts     floating island, waterfall, rift shard, the Wayfinder's lantern staff
src/shading.ts    rim + hemisphere fill helper
src/dialogue.ts   dialogue line bank with {name}/pronoun tokens
public/           compressed models (Draco), WebP textures, HDRI, Draco decoder
```

## Quest: The Four Seals (Milestone 4)

Talk to the Wayfinder near spawn (**E** on desktop, the round **Action** button on phones, or double-click) to begin.
Four glowing seals stand at the vale's landmarks: **Dawn Sigil** (Pale Keep, NW), **Tide Seal** (Azure Keep, NE),
**Sun Shard** (Sunspire, SW) and **Forge Heart** (Iron Dome, SE). Walk up and press Action to claim one: a light column
rises, +25 XP. Return to the Wayfinder with all four for +80 XP. The HUD tracker shows seals/level/XP and a compass
arrow to the nearest unclaimed seal. The creek is shallow — you can wade across (half speed).

Progress saves to `localStorage` (`vale3d-save`). **☰ Menu** has Quality, New character, Show FPS and Reset progress
(tap twice to confirm). Dialogue: Space / Enter / E / tap **Next**; Esc closes.

## Chapter I finale & performance (Milestone 5)

Claiming the fourth seal wakes the **Hollow Beacon** on the floating island (violet/gold beam): the camera pans to it,
the Wayfinder's completion line follows (+80 XP), then a **Chapter I complete** card with a teaser toward the Hollow
Beacon and the sea. Headless QA: `node tools/qa-run.cjs` plays the full four-seal run and Menu → Reset progress.

Performance: grass uses a dense near disc plus a sparse far ring and is excluded from the AO pass; AO and the creek
mirror cull beyond 110 m / 150 m; small flora skips the mirror. Typical triangles: High ≈ 2.7–2.9M, Lite ≈ 0.6M.

## Wind Shrine (optional, Milestone 6)

North-west of spawn, past the creek path. Read the **Wind Tablet** (E / Action), then turn the three mossy runes
(each cycles ○ Still → ▲ Rise → ✕ Gale). Clue: *West must Rise ▲ · North stays Still ○ · East calls the Gale ✕*.
Wrong combinations just say "not yet" (0 XP). Solving wakes the orrery (spinning gilded rings, glowing heart-stone,
wind ribbons) for a one-time **+35 XP** and the **Windward Blessing** (+15% move speed). Rune states and the blessing
are saved in `vale3d-save`; Menu → Reset progress clears them. The HUD tracker has a Wind Shrine locator line.

## Vale Warden (optional, Milestone 7)
- Placed from the Canvas Page's relative coordinates (~55, 35), near the Iron Dome approach; HUD tracker line "Vale Warden (optional) · N m".
- It wakes within 22 m. Each attack is telegraphed: it raises its arms overhead, a bright ground ring appears where you stand, and a "⚠ Warden winds up — move!" cue shows for ~1.25 s before the slam.
- You have 3 HP (♥ panel). Attack it with Action/E (0.55 s cooldown, shown as a ring on the button and as "Strike not ready"). 3 hits defeat it: +40 XP and the Warden's Crest, given once (no farming).
- At 0 HP the Wayfinder pulls you to safety 34 m away. Your HP is restored and you keep all XP; the Warden resets.
- `warden` is saved in `vale3d-save` and cleared by Reset. Menu → New character asks for confirmation when you have progress, then starts fresh progress in the character creator.
- Screenshots: `?shot=warden`, `?shot=warden-windup`, `?shot=warden-defeated`. QA: `tools/qa-run.cjs` covers hits, recovery, defeat, persistence, reset and New character.

## Hollow Beacon endgame, Journal & Map (Milestone 8)
- **Unlock (Page logic):** the Updraft east of the Wind Shrine stays dormant until the four seals burn and the Chapter I card has played. Riding it also needs the Wind Shrine's Windward Blessing, as on the Page. Action/E there lifts you on a ~6 s flight to the floating isle.
- **Puzzle:** four morning mirrors (Pale, Sun, Azure, Iron) stand around the beacon. Action turns a mirror N→E→S→W. The Unspent carving gives the Page's clue. Solution: Pale faces West, Sun faces South, Azure faces East, Iron faces South. An aligned mirror sends its coloured light into the hollow.
- **Dawn ending:**
  - A 9 s camera orbit climbs the beam while the world blends to sunrise:
    - the sun turns warm and drops low in the east, giving long shadows;
    - a sunrise sky shell fades in over the HDRI;
    - IBL and background intensity are lowered;
    - hemisphere and fog colours shift to peach;
    - exposure lifts;
    - the sky rift fades;
    - the beam and shard turn gold.
  - Then the ending card (Page text) appears and +60 XP is awarded once. The dawn persists, and turning mirrors afterwards gives nothing.
  - Ride down from the mint ring at the western edge.
- **Save:** `mirrors` and `beacon` are saved in `vale3d-save` and cleared by Reset and New character. Max XP is 315 (seals 100 + Chapter 80 + shrine 35 + Warden 40 + beacon 60). The Page's 335 also counts the Echo Grove (+20), which is not ported.
- **Journal** (☰ Menu or J) shows live state for the seals and their clues, the shrine, the Warden and the beacon, plus lore lines from the Page. **Map** (☰ Menu or M) is a parchment top-down map drawn from the terrain, with landmarks, seals, the Updraft and isle, the player arrow and the current objective. Gameplay pauses while either is open; Esc, J or M closes it.
- **Screenshot presets:** `?shot=beacon-puzzle`, `dawn`, `ending-card`, `journal`, `map`.

## Echo Grove, map charting & feel pass (Milestone 9)
- **Echo Grove** (optional, map 440,300): silent until any seal is claimed; then "listen" lights the five crystal pines and plays *Memory of the Break* (Page text). +20 XP once, persisted (`echo` in the save), re-listen replays the memory without XP. **Max XP is now 335** (seals 100 + chapter 80 + shrine 35 + Warden 40 + echo 20 + beacon 60).
- **Marr's Unfinished Map**: 7 landmarks (Pale Keep, Azure Keep, Sunspire, Iron Dome, Veilfall, Wind Shrine, Echo Grove) chart themselves when you come within ~32 m; shown in the Journal (n/7, Page text) and on the Map (uncharted = dashed "?" ring). Persisted (`charted[]`), cleared by reset.
- **Updraft gate** stays on the Wind Shrine blessing (Page rule); the locked prompt, toast, quest line, objective and Journal now all say *needs the Wind Shrine blessing* and point at the Wind Tablet.
- Fixes: Lite gold beam/updraft shaders now output sRGB (gold, not orange); creek water tints toward the dawn sky after the ending; the camera is pulled in instead of clipping through rim trees on the island; Updraft flight uses an airborne pose (arms out, legs trailing); Warden hit flash + spark; procedural right-arm attack swing.
- QA (`tools/qa-run.cjs`) covers Echo (silent before seals, +20 once, recall no XP, persist, reset) and 7/7 charting.

## Chapter II opener: Enna's Trail (Milestone 10)
- **After the dawn ending** the Wayfinder has word of Enna: her trail starts at a **collapsed stair just east of Pale Keep** (the keep's old water-road). Before the dawn ending (or before the Wayfinder's lead) the stair is choked and cannot be entered.
- **The ruin** is its own small scene (cave dome, carved pillars, rubble, a drip into a still pool, daylight down the stair, torches) with its own torch lighting; its Poly Haven textures (Cliff Side, Medieval Blocks 02) load only on first entry. Fade in/out on the stair.
- **Puzzle:** three braziers marked Spring ◎, Ford ⁘, Sea ≈ stand before a sealed door; the door's chalk signs and carving say "light them as the river runs — where it is born, where it is crossed, where it is lost" (Spring → Ford → Sea). A wrong order gutters them out (no penalty).
- **Discovery:** Enna's carved message in the alcove (addressed by the hero's first name) and **Enna's Tide-Glass**: +40 XP once (**max XP is now 375**), the trail points west under the hills to the sea caves. Journal: "Chapter II · Enna's Trail" section; Map: Collapsed Stair mark and, once found, a dashed trail "to the sea". Save field `cave` (0–4), cleared by reset.
- Art: Echo Grove crystal trees rebuilt from irregular faceted shards on dark stone-and-root bases (High: MeshPhysicalMaterial transmission + iridescence, enabled within ~42 m of the grove; Lite: glossy standard + fresnel edge glow). The north/right-edge white haze was bloom smearing HDR fireflies (sun glints at 40+ from glossy surfaces): a clamp pass before bloom (max 3.0, NaN-safe) removes it.

## Chapter II continues: the Tidewrack Coast (Milestone 11)

- **West passage → coast.** Once Enna's carving is read, the rubble in the ruin's west wall clears; *Follow the water-road west* fades to the **Tidewrack Coast** (its own scene at a far origin, loaded on first visit — phone-friendly). The tunnel in the east cliff leads back.
- **Sea.** Custom ocean shader: camera-following non-uniform grid, Gerstner waves (4 on High, 2 on Lite) damped by depth, two scrolling detail normals, Fresnel reflection of the same analytic sky as the dome/fog (no horizon seam), depth colour, sun glitter, shore foam bands + crest foam (High), depth-based transparency. A 24 s tide cycle moves the waterline; the sand darkens where it was wet.
- **Quest.** At the tide-shrine below the ruined **Lowtide Lamp**, raise Enna's Tide-Glass. At high tide the glass only clouds; at **low tide** the sea is held back and a line of custodian stones rises into a causeway to the sea-cave stack. At the cave mouth: lore beat about the **Second Seam**, +30 XP once, and a *Chapter II · to be continued* card. Save gains `coast` (0–3); reset clears it. Max XP is now 405.
- **Journal / Map.** Enna's Trail gains the coast steps; the map gets a Tidewrack Coast inset (sea, stacks, Lamp, causeway once revealed, sea cave).
- **Fixes.** Echo Grove bases are smooth mossy stone (triplanar Mossy Rock, lighter tint; crystals no longer cast hard shadows on them); the stray dark stroke under Enna's carving is replaced by a compact ← ≈ mark; the collapsed stair has baked contact shading on its steps plus an invisible shadow lid so the pit falls into shadow.
- **Adaptive quality (High only, silent).** If FPS stays under ~40 for 3 s (after a 6 s warm-up; not while paused/fading/hidden), step down: pixel ratio ≤1 → crystal transmission off → GTAO off → pixel ratio 0.75. Never steps back up within a session. The FPS chip shows `· aqN` when active; nothing else is shown. Disabled for `?shot`, automation, and `?noaq`.
- GTAO skips objects tagged `userData.noAO` (the sea) — its flat normal prepass otherwise drew a dark seam at the waterline.
- **Running jitter fix (phone).** The follow camera lerped its *position* toward a moving target with `min(1, 8·dt)`; the gap that leaves depends on the frame's dt, so with uneven phone frame times the camera→player distance pumped every frame while running (modelled/measured: 224 reversals in 420 frames, 35 cm range). Now the camera follows rigidly in the horizontal plane; only occlusion pull-in (fast in, slow out — hysteresis), the terrain floor push and the vertical terrain follow are smoothed, all with dt-correct `1 − e^(−k·dt)` damping (as are speed, facing and focus-yaw). Shadow frusta (vale + coast) snap to whole shadow-map texels so edges don't crawl while moving; per-frame vector allocations removed from the camera path. The hero clips have no root motion (checked: only IK foot/pole and a ≤1 mm body bob track), so none to strip.
- `tools/motion-probe.cjs`: phone-portrait Lite probe — real touch joystick at full deflection plus deterministic dt-jitter simulation (`__vale.sim`); records player root, hips, camera position/distance and the player's screen position per frame and reports reversals, ranges and update CPU time.
