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

## M11.1: running-jitter fix, round 2 (phone)
- **Fixed 60 Hz simulation + render interpolation.** `update()` now runs in fixed 1/60 s steps (max 7 per frame); the player root and the camera (position + quaternion) are interpolated between the last two steps for rendering, then restored. Frame time comes from the vsync-aligned rAF timestamp instead of `clock.getDelta()` at callback start, so JS start-latency noise and 30/60 Hz switching no longer make per-frame motion uneven. Teleports/cinematics skip the blend.
- **Touch stick conditioning.** Radial deadzone (0.15, rescaled) plus a dt-correct low-pass on the stick vector, so thumb noise at full deflection doesn't wiggle the heading (with a rigidly following camera, a wiggling heading slides the whole world sideways and back).
- **Facing.** Turns only with real input (|stick| > 0.2, or a big turn); small corrections are gentler than real turns; turn rate capped; angle wrapped.
- **No camera auto-swing while steering** (interaction camera-focus is cancelled by stick input). There is no other auto-yaw; the camera follows the root position (never a bone), with only the vertical terrain follow damped.
- `?legacymotion` (QA only) runs the old M11 path so `tools/motion-probe.cjs` can measure before/after in one build. The probe now uses CPU throttling ×5, a noisy touch stick and injected phone frame timing (straight and curving 10 s runs).

## M11.2: phone motion, round 3
- **Grass re-scatter hitch (likely the main remaining cause).** The near grass disc (≈15k instances on Lite) was rebuilt synchronously every 6 m — about once a second while running — costing ~140 ms on this box (~690 ms at 5× CPU throttle). That periodic stall + catch-up reads as a surge back and forth. It is now time-sliced per cell into a back buffer (2.5–4 ms per frame) with per-cell caching, and swapped in when done, aimed slightly ahead of the runner (a typical 5 m re-scatter: 89 ms total in ≤6 ms slices at 5× throttle, vs one 689 ms block); immediate rebuild only after teleports (>13 m).
- **Motion setting** (Menu → *Motion: Smooth (30 fps) / Fast (60 fps)*, saved as `vale3d-motion`; default Smooth on touch devices). Smooth presents every ~33.3 ms (2 vsyncs at 60 Hz, 3 at 90 Hz, 4 at 120 Hz) with the fixed 60 Hz simulation + interpolation underneath. `?motion=fast|smooth` overrides.
- **Touch camera fully rigid** relative to the interpolated player (occlusion pull-in and floor push applied directly); only ground height stays smoothed. Look-at and position come from the same interpolated sample.
- Menu *Show FPS / frame time* (now wired) — the chip shows fps · ms/frame · tris · quality.
- Run cycle measured: hips lateral 0 cm, head lateral sway 3.2 cm, hips bob 7.4 cm, no root motion — left as is (≈2 px at camera distance). Shadows: frustum is texel-snapped (world-stable); adaptive quality only ever steps down (High only).
- `tools/motion-probe.cjs` adds a pacing model (`__vale.simVsync`): 60/120 Hz vsync, 14–26 ms frame cost with 45–80 ms spikes, Smooth vs Fast.

## Chapter II: the Listening Pools (Milestone 12)
- **Coast fixes:** the Lite sea gets a deeper body colour, an extra fine normal layer, softened grazing Fresnel and a ripple light/dark term (no longer milky on phones). Lowered causeway stones now sink fully and are hidden until revealed, so no edges show through high water. The sea-cave mouth is no longer a flat black card: the arch flanks are opened slightly, and a tapering vertex-coloured throat falls from wet rock into darkness, with a glistening rock lip and a faint teal glow far inside.
- **The Listening Pools (sea-cave interior):** entering the mouth now leads into a playable tide-cave (its own scene, built once on first entry). It has three tide pools with ridged lamp-shells, glow-lichen, soft light shafts from roof cracks, wet rock, a chamber tide (22 s cycle) whose water shader carries depth tint, Fresnel and bioluminescent motes that stir around Ilka, and a deep west apse holding the round seal.
- **Puzzle:** at low water, raise the Tide-Glass at each lamp-shell. All three must burn within one ebb, or the returning tide covers and resets them. Solving wakes three of the seal's seven rings and reveals Enna's oilcloth packet. Reading it gives +45 XP once, and the lore shows the custodians drowned the second seam and left a keeper. Enna has gone for the seal's second key: "Do not open the door alone." Then the Chapter II card appears: *The Drowned Keeper*.
- **Boss arena setup:** the round seal stays shut, with 3 of 7 rings lit, for the next milestone.
- **Save, Journal and Map:** the new save field is `sea` (0–3). The Journal trail covers entering, the shells, the page and the Drowned Keeper. The map's coast inset charts the pools and the seal. Hints and the quest line follow the tide phase and the shell count. XP max is 450.
- **Perf:** nothing in the cave rebuilds per frame. It uses a hemisphere light, one directional light (shadows on High only) and one point light. Lichen is instanced and the rest of the light is emissive or additive. `tools/perf-sea.cjs` measures frame cost under Lite + 5× CPU throttle at phone size against the meadow. The motion architecture (fixed tick + interpolation, Smooth 30 fps default on phones, time-sliced grass) is unchanged.
- **QA:** `tools/qa-run.cjs` now plays through the cave: covered shell at high water, partial set reset, all three in one ebb, seal, page +45 once, back out, and reload persistence.

## Chapter II finale: the Drowned Keeper (Milestone 13)
- **The second key:** at the round seal (after Enna's page), raise the Tide-Glass to the three lit rings. The Lowtide Lamp's beam (Enna relit it far overhead) comes down the roof-crack, the four dark rings wake and the seal rolls aside like a millstone. It's one short beat with no fetch.
- **The drowned chamber:** its own scene, built once on first entry. It's a flooded dome with four raised custodian stones, an entrance ledge (safe, and the fight waits while you stand there), glow-lichen, and fight-driven water with scrolling normals.
- **The Keeper:** a coiled nacre sea-guardian with a ringed neck wearing custodian collars, a hooded head with a lantern-lure, and a tide-glass heart behind two chest-plates. It's built from primitives and animated only with transforms and uniforms.
- **The fight (6 heart hits, 3 phases, about 1–2 min):**
  - **Tide-spouts:** an orange ring appears under Ilka and the Keeper rears. Move before the windup ends (1.35 s, then 1.15 s, then 1.0 s).
  - **Tide sweep:** the Keeper turns its coil, the water rises and the stones glow. Stand on a raised stone.
  - **Low water:** the Keeper slumps sideways. Get close and raise the Tide-Glass; the plates open for 4.6 s. Strike the heart with Action.
  - **Phases:** each phase change shuts the plates and the Keeper rises angrier (more spouts, shorter telegraphs).
  - **HUD:** the boss health bar shows the state, and so do Ilka's hearts.
- **Defeat:** the surge throws Ilka onto the ledge with full HP. XP and progress are kept, and the Keeper resets.
- **Victory:** +60 XP once (XP max 510), then Enna's knotted note on why the Keeper was never the enemy ("You did not open the door alone… Meet me at the Lamp"), then the **Chapter II complete** card. The Keeper sleeps afterwards with no farming. Save `sea` 4 = seal open, 5 = Keeper at rest. The Journal, map inset (seal open / Keeper ✦), quest line and hints are updated.
- **Fixes:** the seal glyph rings are now circle-UV overlays (base, inner three, outer four) instead of an emissive map on the cylinder. The sea-cave floor gets vertex-colour wet/salt mottling, which gives the Lite floor shape.

## M14: polish pass
- **The Drowned Keeper, remodelled:**
  - **Neck:** one continuous tapered tube skinned to the existing 7-bone chain. The fight animation still just rotates bones; nothing is rebuilt.
  - **Hide:** a procedural plated texture set (albedo, normal and roughness, built once) on the neck, coil and head. On High it also has a wet clearcoat.
  - **Coil:** a lumpy coil with slate dorsal scutes, instanced barnacle clusters, and kelp strands swayed in the vertex shader.
  - **Collars:** worn bronze custodian collars with verdigris, polished bands and glowing glyphs.
  - **Head:** sculpted skull with a brow ridge and tapering snout, crest scutes, eye sockets with glow, and a hinged toothed jaw that opens on windups.
  - **Unchanged:** the heart, chest-plate and hit positions.
- **Spout telegraph:** not tone-mapped and more opaque, so it reads orange-red on Lite instead of beige. The ring is also thicker.
- **Lite heart glow:** dimmed to keep the core shaded rather than a flat white disc (Lite has no bloom).
- **Portrait framing near the Keeper:** within 10.5 m, the camera eases back by 3.2 m and up by 0.06 rad. It's damped on the fixed tick and interpolated, so there's no jitter.

## M15 — phone HUD cleanup + pose fix + causeway stones
- **Ilka "folded in half" fix:** three's PropertyMixer only writes a bone when its blended clip value changes, so the procedural
  pose overlays (flight lean, swing) that are premultiplied after `mixer.update` accumulated tick after tick on bones whose clip
  value is constant (idle hips/arms) — e.g. after an Updraft flight the hips could end up rotated ~180°, persisting onto the coast.
  `setSpeed` now restores each posed bone to its clean clip pose before the mixer runs and layers the overlay for one tick only.
  `__vale.pose()` returns head height above hips; qa-run samples it through the whole run and asserts it never drops below 0.2 m.
- **Causeway stones:** lathed, rounded, out-of-round weathered stones (domed top, softened rim, flared foot), darker wet tops, a
  slick green band at the held low-water line and hanging weed strips (11 per stone High / 7 Lite). Own RNG stream, so the rest of
  the coast layout is unchanged; sink/hide logic unchanged.
- **Phone HUD:** portrait quest panel is a compact one-line objective + XP; tap it to expand the secondary lines. Keyboard hint
  ("E / Action …") hidden on touch devices and narrow portrait.
- **Lite coast haze:** fog density 0.005 → 0.0042 to match High (the horizon washed out on phones).
