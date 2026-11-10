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
