import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeTerrain, type GroundTex } from './terrain';
import { makeGrass } from './grass';
import { makeLandmarks } from './landmarks';
import { makeWarden, WARDEN, W_WAKE, W_SLEEP, W_MELEE, W_STRIKE_R, W_TELE, W_RECOVER, PLAYER_ATK_CD, HP_MAX, WARDEN_XP, RECOVERY_LINES, recoveryPoint } from './warden';
import { makeWindShrine, RUNES, TABLET, TABLET_LINES, SOLVED_LINES, RUNE_GLYPHS, RUNE_LABELS, SHRINE_XP, WIND_BLESS, runesMatch } from './shrine';
import { SealObject, loadSave, writeSave, clearSave, sealCount, levelOf, fillLines, WAYFINDER_LINES, SEAL_XP, QUEST_XP, CHAPTER_TEASER } from './quest';
import { addRimFill } from './shading';
import { LINES, say, fill, SURNAME, type Sex, type Profile } from './dialogue';
import { bakeKinds, instanceKind, foliageUniforms, kindTris, TreeField, type Kind, type TreeInst } from './nature';
import { makeFloatingIsland, makeLanternStaff, ISLAND_POS, islandTopY } from './island';
import { UPDRAFT, MIRRORS, MORNING_DIRS, DIR_ARROWS, BEACON_XP, BEACON_L, CLUE_L, RETURN_L, LANDING_L, ISLAND_WALK_R, CLUE_LINES, UPDRAFT_DORMANT, UPDRAFT_NEEDS_WIND, ENDING_TITLE, ENDING_LINES, ENDING_REWARD, WAYFINDER_BEACON, mirrorsMatch, makeHollowPuzzle, makeUpdraft, makeDawnSky } from './beacon';
import { buildJournal, drawValeMap, MAPBOX } from './journal';
import { COAST_LINES, COAST_O, COAST_XP, makeCoast, type Coast } from './coast';
import { cutTerrain, cutGrass, STAIR, STAIR_DIR, CAVE_LINES, CAVE_XP, BRAZIERS, RIVER_ORDER, makeStairEntrance, makeCaveInterior, type CaveInterior } from './cave';
import { ECHO, ECHO_RANGE, ECHO_XP, ECHO_SILENT, echoMemoryLines, MARR_MARKS, CHART_R, CHART_DONE, makeEchoGrove } from './echo';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS, SEALS, heightAt, normalAt, pathMask, creekX, creekHalf, rng, SPAWN, WAYFINDER, SHRINE, WATER_Y, smoothstep } from './world';

// ---------- quality ----------
type Quality = 'high' | 'lite';
const params = new URLSearchParams(location.search);
// Phones/tablets default to Lite (incl. iPadOS, which reports as Macintosh with touch).
const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);
let quality: Quality = (params.get('q') as Quality) || (localStorage.getItem('vale3d-quality') as Quality) || (isPhone ? 'lite' : 'high');
if (quality !== 'high' && quality !== 'lite') quality = 'high';
const HIGH = quality === 'high';
const qBtn = document.getElementById('quality') as HTMLButtonElement;
qBtn.textContent = `Quality: ${HIGH ? 'High' : 'Lite'}`;
qBtn.onclick = () => { localStorage.setItem('vale3d-quality', HIGH ? 'lite' : 'high'); const u = new URL(location.href); u.searchParams.delete('q'); location.href = u.toString(); };

// ---------- renderer / scene ----------
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: !HIGH, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, HIGH ? 1.75 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.transmissionResolutionScale = 0.5; // Echo Grove crystal transmission pass at half res
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = HIGH ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fogColor = new THREE.Color('#a8bfd2'); // cool blue atmospheric haze
scene.fog = new THREE.FogExp2(fogColor, HIGH ? 0.0034 : 0.0042);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1500);

const SUN_DIR = new THREE.Vector3(-0.45, 0.62, -0.64).normalize(); // late-morning sun ahead-left, backlighting the meadow
const DAWN_DIR = new THREE.Vector3(0.9, 0.16, 0.12).normalize(); // released dawn: a low sun in the east, behind the floating isle from the meadow
const sunDir = SUN_DIR.clone();
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(HIGH ? 2048 : 1024, HIGH ? 2048 : 1024);
const SH = HIGH ? 34 : 24;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe0ff', '#4b5a2e', 0.25);
scene.add(hemi);

// ---------- loading ----------
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const draco = new DRACOLoader(manager).setDecoderPath('./draco/');
const gltfLoader = new GLTFLoader(manager).setDRACOLoader(draco);
const loadTex = (n: string) => texLoader.loadAsync(`./tex/${n}.webp`);
const loadSet = async (n: string): Promise<GroundTex> => ({ diff: await loadTex(`${n}_diff`), nor: await loadTex(`${n}_nor`), arm: await loadTex(`${n}_arm`) });
const loadGltf = (n: string) => gltfLoader.loadAsync(`./models/${n}.glb`);

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));

async function main() {
  const [brick, roofT, sandT, metalT, hdr, grass, path, rock, bed, waterNormals, heroFG, heroMG, wayG, treesG, plantsG, rocksG, boulderG, shrubG, fernG] = await Promise.all([
    loadSet('castle_brick_02_white'), loadSet('grey_roof_tiles'), loadSet('large_sandstone_blocks'), loadSet('rusty_metal_02'),
    new HDRLoader(manager).loadAsync('./hdr/sky_2k.hdr'),
    loadSet('leafy_grass'), loadSet('stony_dirt_path'), loadSet('mossy_rock'), loadSet('river_small_rocks'),
    loadTex('waternormals'),
    loadGltf('hero_f'), loadGltf('hero_m'), loadGltf('wayfinder'), loadGltf('nature_trees'), loadGltf('nature_plants'), loadGltf('rock_moss_set_01'), loadGltf('boulder_01'), loadGltf('shrub_02'), loadGltf('fern_02'),
  ]);
  // HDRI image-based lighting + sky background.
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  // Clamp the HDRI's sun core: its raw radiance overflows half-float in the bloom chain (a black dot + full-screen glare when looking at it).
  { const d = hdr.image.data as Uint16Array | Float32Array, half = d instanceof Uint16Array, cap = 48;
    if (half) { const capH = THREE.DataUtils.toHalfFloat(cap); for (let i = 0; i < d.length; i++) if ((i & 3) !== 3 && (d[i] & 0x7fff) > capH) d[i] = capH; }
    else for (let i = 0; i < d.length; i++) if ((i & 3) !== 3 && d[i] > cap) d[i] = cap;
    hdr.needsUpdate = true; }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.85;
  scene.background = hdr;
  scene.backgroundIntensity = 0.95;
  scene.backgroundRotation.y = scene.environmentRotation.y = 1.2;

  // Terrain.
  const terrain = makeTerrain(760, HIGH ? 320 : 256, { grass, path, rock, bed });
  scene.add(terrain); cutTerrain(terrain.material as THREE.Material);

  // Grass.
  // Grass LOD: a dense near disc of curved blades plus a sparse ring of simple wide blades further out.
  // (Lite keeps one mid-density disc of 2-segment blades: the sparse ring read as bare ground on small screens.)
  const grassField = makeGrass(HIGH ? 20000 : 15000, HIGH ? 20 : 22, HIGH ? 5 : 4, HIGH ? 3 : 2);
  const grassFar = makeGrass(HIGH ? 16000 : 1, HIGH ? 36 : 1, 3, 1, HIGH ? 18 : 0.5); grassFar.mesh.visible = HIGH; cutGrass(grassField.mesh.material as THREE.Material); cutGrass(grassFar.mesh.material as THREE.Material);
  scene.add(grassField.mesh, grassFar.mesh); grassFar.mesh.layers.set(1);
  // Grass lives on layer 1: the main camera sees it, the water's mirror camera (layer 0 only) skips it.
  grassField.mesh.layers.set(1); camera.layers.enable(1);

  // Creek water.
  const water = makeCreek(waterNormals);
  scene.add(water.mesh);
  // The creek mirror only needs nearby banks, trees and sky: cull beyond 150 m during the reflection render.
  { const ob = water.mesh.onBeforeRender.bind(water.mesh); water.mesh.onBeforeRender = (r, sc, cam, ...rest) => { const pc = cam as THREE.PerspectiveCamera; const f0 = pc.far; pc.far = 150; pc.updateProjectionMatrix(); ob(r, sc, cam, ...rest); pc.far = f0; pc.updateProjectionMatrix(); }; }

  const treeKinds = bakeKinds(treesG), plantKinds = bakeKinds(plantsG);
  const treeField = scatter(treeKinds, plantKinds, rocksG, boulderG, shrubG, fernG);
  const island = makeFloatingIsland(renderer, grass, rock, treeKinds.slice(0, 5));
  scene.add(island.group);
  // Landmarks from the Page map (keeps, Sunspire, Iron Dome, Veilfall) and the four seals.
  const landmarks = makeLandmarks({ brick, roof: roofT, sand: sandT, metal: metalT, rock }, SOLIDS, { lights: HIGH });
  scene.add(landmarks.group);
  let save = loadSave();
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#cfc3a8', roughness: 0.9 }); addRimFill(plinthMat, { fill: 0.2, rim: 0.2 });
  const shrine = makeWindShrine(rock, { runes: save.runes, solved: save.wind }); scene.add(shrine.group);
  const warden = makeWarden({ rock, metal: metalT }); scene.add(warden.group); SOLIDS.push({ x: WARDEN.x, z: WARDEN.z, r: 1.5 });
  // Hollow Beacon endgame: the Updraft, the four morning mirrors on the island, and the sunrise sky shell.
  const updraft = makeUpdraft(rock); scene.add(updraft.group); updraft.setActive(save.done, true);
  const hollow = makeHollowPuzzle(rock, islandTopY, { mirrors: save.mirrors, solved: save.beacon }); island.group.add(hollow.group);
  const dawnSky = makeDawnSky(DAWN_DIR); scene.add(dawnSky.mesh);
  island.solve(save.beacon);
  const grove = makeEchoGrove(HIGH, rock); scene.add(grove.group);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3; SOLIDS.push({ x: ECHO.x + Math.cos(a) * 10, z: ECHO.z + Math.sin(a) * 10, r: 1.2 }); if (save.echo) grove.light(i); }
  if (save.echo) grove.memory(true, true);
  const stair = makeStairEntrance({ brick, rock }); scene.add(stair.group); stair.setLit(save.cave >= 1);
  for (const k of [-1.6, -0.4, 0.8, 2.0]) SOLIDS.push({ x: STAIR.x + STAIR_DIR.x * k, z: STAIR.z + STAIR_DIR.z * k, r: 1.75 });
  for (const r of RUNES) SOLIDS.push({ x: r.x, z: r.z, r: 0.9 }); SOLIDS.push({ x: TABLET.x, z: TABLET.z, r: 1.2 });
  const seals = SEALS.map((d) => { const o = new SealObject(d, plinthMat, !!save.seals[d.id]); scene.add(o.group); SOLIDS.push({ x: d.x, z: d.z, r: 1.3 }); return o; });
  const rift = makeRift();
  scene.add(rift);

  // Characters.
  // Player heroes (both CC0 Quaternius, recoloured to the navy/teal cloak look); the creation screen picks one.
  const heroes = {
    // Hooded Adventurer: warm skin, chestnut hair (the model's 'White' is her hair), lighter navy cloak, clear teal accents.
    female: makeCharacter(heroFG, 1.66 / 1.877, { Skin: '#d89a70', LightBrown: '#3fa7a8', DarkBrown: '#2c4579', Black: '#33405e', Brown: '#4a2a1c', White: '#7a4630', Gold: '#d9b35c', Metal: '#9fb4bf' }, ['Sword']),
    // Hoodie Character (young, beardless): navy hoodie, teal trim, dark leggings under the shorts, brown boots.
    male: makeCharacter(heroMG, 1.74 / 1.866, { Skin: '#d39a72', Purple: '#2c4579', LightBlue: '#2f8f93', 'Casual_Legs/Skin': '#2a3550', White: '#6b4a32', Hair: '#3b2a1f', Eyebrows: '#3b2a1f' }, []),
  };
  for (const h of Object.values(heroes)) { h.root.visible = false; h.root.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z); scene.add(h.root); }
  let profile = loadProfile();
  let player = heroes[profile.sex]; player.root.visible = true;
  // The Wayfinder: Quaternius "King", crown removed, armour recoloured to a weathered plum travelling coat; white hair/beard.
  const wayfinder = makeCharacter(wayG, 1.72 / 1.903, { Metal: '#5b4a3e', Metal_Dark: '#3d3229', Blue: '#4a3d5c', Beige: '#b9ab8c', Hair_White: '#e4e0d8', DarkBrown: '#3a2c22' }, ['mat:Gold']);
  wayfinder.root.position.set(WAYFINDER.x, heightAt(WAYFINDER.x, WAYFINDER.z), WAYFINDER.z);
  wayfinder.root.rotation.y = Math.atan2(SPAWN.x - WAYFINDER.x, SPAWN.z - WAYFINDER.z);
  scene.add(wayfinder.root);
  const staff = makeLanternStaff(); scene.add(staff.group);
  const handBone = wayfinder.root.getObjectByName('Wrist.R') ?? wayfinder.root.getObjectByName('WristR') ?? wayfinder.root; const handPos = new THREE.Vector3();

  // ---------- post ----------
  let composer: EffectComposer | null = null, renderPass: RenderPass | null = null;
  let gtao: GTAOPass | null = null;
  const vignette = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uAmt: { value: 0.32 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uAmt;uniform float uTime;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;float v=1.-uAmt*smoothstep(.25,.85,dot(d,d)*2.2);
      c.rgb*=v; c.rgb=mix(c.rgb,c.rgb*vec3(1.03,1.0,.96),.6); c.rgb+=(h(vUv*913.+uTime)-.5)*.012; gl_FragColor=c;}`,
  });
  if (HIGH) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
    gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    { // Keep displaced/transparent surfaces (the sea) out of GTAO's flat normal/depth prepass — it drew a dark seam at the waterline.
      const g = gtao as unknown as { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[]; scene: THREE.Scene }; const ov = g._overrideVisibility.bind(g);
      g._overrideVisibility = () => { ov(); g.scene.traverse((o) => { if (o.userData.noAO && o.visible) { o.visible = false; g._visibilityCache.push(o); } }); }; }
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.blendIntensity = 0.85;
    // Keep grass (layer 1) out of the AO normal/depth pass — it is the single largest triangle cost.
    const gRender = gtao.render.bind(gtao);
    // AO only matters up close: also pull the far plane in to 110 m for this pass so distant trees/landmarks are culled.
    const withFar = (far: number, fn: () => void) => { const f0 = camera.far; camera.far = far; camera.updateProjectionMatrix(); fn(); camera.far = f0; camera.updateProjectionMatrix(); };
    gtao.render = (...args: Parameters<GTAOPass['render']>) => { camera.layers.disable(1); water.mesh.visible = false; withFar(110, () => { gtao!.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); gRender(...args); }); camera.layers.enable(1); water.mesh.visible = true; };
    composer.addPass(gtao);
    // Clamp HDR fireflies (tiny specular/sun-glint pixels at 40+ and any NaN) before bloom; otherwise the bloom mip chain smears them into a white haze.
    composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(any(isnan(c))||any(isinf(c)))c=vec4(0.,0.,0.,1.);float m=max(c.r,max(c.g,c.b));c.rgb*=min(1.,3./max(m,1e-4));gl_FragColor=c;}' }));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.28, 0.6, 0.92));
    composer.addPass(new OutputPass());
    composer.addPass(vignette);
  }

  // ---------- player / camera state ----------
  const state = { yaw: Math.PI, pitch: 0.2, dist: 7.4, speed: 0, facing: Math.PI, px: SPAWN.x, pz: SPAWN.z };
  const keys: Record<string, boolean> = {};
  let paused = false;
  addEventListener('keydown', (e) => {
    if (creating || (e.target as HTMLElement).tagName === 'INPUT') return;
    if (paused) { if (e.code === 'Escape' || e.code === 'KeyJ' || e.code === 'KeyM') closeSheets(); return; }
    if (e.code === 'KeyJ' && !e.repeat) { openSheet('journal'); return; } if (e.code === 'KeyM' && !e.repeat) { openSheet('map'); return; }
    keys[e.code] = true; if (e.code === 'KeyE') interact();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  // Joystick.
  const joy = document.getElementById('joy')!, knob = document.getElementById('knob')!;
  const stick = { x: 0, y: 0, id: -1 };
  joy.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; joy.setPointerCapture(e.pointerId); moveStick(e); e.stopPropagation(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
  const endStick = (e: PointerEvent) => { if (e.pointerId !== stick.id) return; stick.id = -1; stick.x = stick.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', endStick); joy.addEventListener('pointercancel', endStick);
  function moveStick(e: PointerEvent) {
    const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    stick.x = x; stick.y = y; knob.style.transform = `translate(${x * 38}px,${y * 38}px)`;
  }
  // Camera drag (anywhere else).
  const drag = { id: -1, x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => { drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.id) return;
    state.yaw -= (e.clientX - drag.x) * 0.0055; state.pitch = THREE.MathUtils.clamp(state.pitch + (e.clientY - drag.y) * 0.004, -0.15, 0.85);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e: PointerEvent) => { if (e.pointerId === drag.id) drag.id = -1; };
  renderer.domElement.addEventListener('pointerup', endDrag); renderer.domElement.addEventListener('pointercancel', endDrag);
  renderer.domElement.addEventListener('wheel', (e) => { state.dist = THREE.MathUtils.clamp(state.dist + e.deltaY * 0.004, 3.5, 12); }, { passive: true });

  // ---------- dialogue, interaction, quest ----------
  const dlgEl = document.getElementById('dlg')!, dspk = document.getElementById('dspk')!, dtxt = document.getElementById('dtxt')!, dnext = document.getElementById('dnext') as HTMLButtonElement;
  const actBtn = document.getElementById('action') as HTMLButtonElement, toastEl = document.getElementById('toast')!;
  let talking = false, dq: string[] = [], toastT = 0, lastDt = 1 / 60, onDlgClose: (() => void) | null = null;
  function openDialog(speaker: string, lines: string[], onClose: (() => void) | null = null) { onDlgClose = onClose; dq = [...lines]; dspk.textContent = speaker; talking = true; dlgEl.hidden = false; document.body.classList.add('talking'); for (const k of Object.keys(keys)) keys[k] = false; advance(); }
  function advance() { const l = dq.shift(); if (l === undefined) { talking = false; dlgEl.hidden = true; document.body.classList.remove('talking'); const cb = onDlgClose; onDlgClose = null; cb?.(); return; } dtxt.textContent = l; dnext.textContent = dq.length ? 'Next ▸' : 'Close'; }
  dnext.onclick = advance;
  function toast(msg: string, secs = 3.2, danger = false) { toastEl.textContent = msg; toastEl.classList.add('on'); toastEl.classList.toggle('danger', danger); toastT = secs; }
  const persist = () => writeSave(save);
  function talkWayfinder() {
    wayfinder.play('Wave');
    const n = sealCount(save);
    if (save.beacon) {
      if (save.cave === 0) { save.cave = 1; persist(); stair.setLit(true); hudT = 0; return openDialog('Wayfinder', fillLines(CAVE_LINES.lead, profile), () => toast('Quest: Enna’s Trail · the collapsed stair east of Pale Keep', 4)); }
      return openDialog('Wayfinder', fillLines(save.cave >= 4 ? CAVE_LINES.found : CAVE_LINES.remind, profile));
    }
    if (save.done) return openDialog('Wayfinder', fillLines([WAYFINDER_LINES.after[0], save.beacon ? WAYFINDER_BEACON.done : WAYFINDER_BEACON.open, WAYFINDER_LINES.after[1]], profile));
    if (!save.started) { save.started = true; persist(); toast('Quest: The Four Seals'); return openDialog('Wayfinder', fillLines(WAYFINDER_LINES.start, profile)); }
    if (n < 4) return openDialog('Wayfinder', fillLines(WAYFINDER_LINES.progress, profile, { n }));
    startFinale();
  }
  // ---------- Chapter I finale: beacon wakes → camera pan → Wayfinder's line → chapter card ----------
  const chapterEl = document.getElementById('chapter')!;
  document.getElementById('chtease')!.textContent = CHAPTER_TEASER;
  document.getElementById('chok')!.onclick = () => { chapterEl.hidden = true; };
  let cine: { t: number; dur: number; hold: number } | null = null;
  function startFinale() {
    if (cine || save.done) return;
    island.light(true); cine = { t: 0, dur: 6.5, hold: -1 };
    document.body.classList.add('cine'); actBtn.hidden = true;
    for (const k of Object.keys(keys)) keys[k] = false;
    toast('The Hollow Beacon wakes…', 3);
  }
  function finishFinale() {
    cine = null; document.body.classList.remove('cine');
    const lv = levelOf(save.xp); save.done = true; save.xp += QUEST_XP; persist();
    document.getElementById('chxp')!.textContent = `+${QUEST_XP} XP · Vale Walker · Level ${levelOf(save.xp)}${levelOf(save.xp) > lv ? ' (up!)' : ''}`;
    openDialog('Wayfinder', fillLines(WAYFINDER_LINES.complete, profile), () => { chapterEl.hidden = false; });
  }
  if (save.done || sealCount(save) === 4) island.light(true, true);
  // Transparent effects (smoke/mist sprites, waterfalls, beams, ribbons) live on layer 1: the AO pass would otherwise
  // draw them as opaque cards and darken a box around each one.
  scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m) && m.transparent && ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite)) o.layers.set(1); });
  function claimSeal(o: SealObject) {
    if (o.claimed) return;
    const lv = levelOf(save.xp); o.claim(); save.seals[o.def.id] = true; save.xp += SEAL_XP; persist();
    const n = sealCount(save);
    toast(`${o.def.name} claimed · +${SEAL_XP} XP${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''} · ${n}/4`, 4);
    if (n === 4 && !save.done) finaleDelay = 1.4;
  }
  let finaleDelay = -1;
  type Inter = { label: string; act: () => void; x?: number; z?: number; combat?: boolean };
  let camFocus: { x: number; z: number; t: number } | null = null;
  function nearestInteract(): Inter | null {
    if (lift || dawnCine) return null;
    if (onIsland) return islandInteract();
    if (inCave) return caveInteract();
    if (inCoast) return coastInteract();
    if (Math.hypot(state.px - stair.mouth.x, state.pz - stair.mouth.z) < 3.4) return { label: save.cave >= 1 ? 'Descend the collapsed stair ↓' : 'Collapsed stair · rubble and dark', act: useStair, x: STAIR.x, z: STAIR.z };
    const dW = Math.hypot(state.px - WAYFINDER.x, state.pz - WAYFINDER.z);
    if (dW < 3.8) return { label: !save.started ? 'Talk · begin quest' : save.beacon && save.cave === 0 ? 'Talk · word of Enna' : save.done ? 'Talk' : `Talk · seals ${sealCount(save)}/4`, act: talkWayfinder };
    for (const o of seals) if (!o.claimed && Math.hypot(state.px - o.def.x, state.pz - o.def.z) < 3.2) return { label: `Claim ${o.def.name}`, act: () => claimSeal(o), x: o.def.x, z: o.def.z };
    if (Math.hypot(state.px - TABLET.x, state.pz - TABLET.z) < 2.8) return { label: 'Read Wind Tablet', act: () => openDialog('Wind Shrine', TABLET_LINES), x: TABLET.x, z: TABLET.z };
    if (Math.hypot(state.px - ECHO.x, state.pz - ECHO.z) < ECHO_RANGE) return { label: save.echo ? 'Echo Grove · recall the Memory' : echoT >= 0 ? 'Echo Grove · the crystal trees remember…' : sealCount(save) < 1 ? 'Echo Grove · silent' : 'Echo Grove hums · listen', act: useEcho, x: ECHO.x, z: ECHO.z };
    if (Math.hypot(state.px - UPDRAFT.x, state.pz - UPDRAFT.z) < 4.6) return { label: !save.done ? 'Updraft · dormant' : !save.wind ? 'Updraft · locked — needs Wind Shrine blessing' : 'Ride the Updraft ↑', act: useUpdraft, x: UPDRAFT.x, z: UPDRAFT.z };
    if (!save.warden && wardenDist() < W_MELEE) return { label: atkCd > 0 ? `Wait ${atkCd.toFixed(1)}s` : `Attack Warden · ${wd.hp}/${HP_MAX}`, act: attackWarden, x: WARDEN.x, z: WARDEN.z, combat: true };
    for (let i = 0; i < RUNES.length; i++) if (Math.hypot(state.px - RUNES[i].x, state.pz - RUNES[i].z) < 2.6) { const v = save.runes[i]; return { label: save.wind ? `${RUNES[i].name} · ${RUNE_GLYPHS[v]}` : `Turn ${RUNES[i].name} · ${RUNE_GLYPHS[v]} ${RUNE_LABELS[v]}`, act: () => turnRune(i), x: RUNES[i].x, z: RUNES[i].z }; }
    return null;
  }
  // ---------- Chapter II opener: the collapsed stair and the water-road ruin ----------
  let inCave = false, cave: CaveInterior | null = null, caveLoading = false, fading = false, litOrder: number[] = [], gutterT = -1;
  const fadeEl = document.getElementById('fade')!;
  const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const setFade = (on: boolean) => { fadeEl.classList.toggle('on', on); };
  async function ensureCave() {
    if (cave) return cave; caveLoading = true;
    const tx = await ruinTex();
    cave = makeCaveInterior(HIGH, { rock: tx.cliff, blocks: tx.blocks, bed }, scene.environment, profile.name); caveLoading = false; return cave;
  }
  let ruinTexP: Promise<{ cliff: GroundTex; blocks: GroundTex }> | null = null;
  function ruinTex() { return (ruinTexP ??= Promise.all([loadSet('cliff_side'), loadSet('medieval_blocks_02')]).then(([cliff, blocks]) => ({ cliff, blocks }))); }
  // ---------- Tidewrack Coast (Chapter II, part 2) ----------
  let inCoast = false, coast: Coast | null = null;
  async function ensureCoast() {
    if (coast) return coast; caveLoading = true; const tx = await ruinTex();
    coast = makeCoast(HIGH, { grass, pebble: bed, rock: tx.cliff, blocks: tx.blocks }, waterNormals, scene.environment); caveLoading = false; return coast;
  }
  const setScene = (sc: THREE.Scene) => { sc.add(player.root); if (renderPass) renderPass.scene = sc; if (gtao) (gtao as unknown as { scene: THREE.Scene }).scene = sc; };
  async function enterCoast(instant = false) {
    if (inCoast || fading) return; fading = true; state.speed = 0;
    if (!instant) { setFade(true); await sleepMs(520); }
    const c = await ensureCoast(); if (save.coast >= 2) c.reveal(true);
    inCave = false; inCoast = true; setScene(c.scene);
    state.px = c.arrive.x; state.pz = c.arrive.z; state.facing = -Math.PI / 2; state.yaw = Math.PI / 2 - 0.12; state.pitch = 0.14; state.dist = 7; snapCam = true;
    if (save.coast < 1) { save.coast = 1; persist(); }
    hudT = 0; fading = false; c.audio(true);
    if (!instant) { setFade(false); toast(COAST_LINES.arrive, 3.5); }
  }
  async function leaveCoast() {
    if (!inCoast || fading) return; fading = true; state.speed = 0; coast?.audio(false);
    setFade(true); await sleepMs(520); inCoast = false; fading = false; await enterCave(true, 'passage'); setFade(false);
  }
  function raiseGlass() {
    if (!coast) return; if (save.coast >= 2) return toast(COAST_LINES.revealed, 2.6);
    if (!coast.isLow()) { coast.glowShrine(false); return toast(COAST_LINES.shrineHigh, 3.4); }
    save.coast = 2; persist(); coast.glowShrine(true); coast.reveal(); hudT = 0; camFocus = { x: coast.pathStart.x, z: coast.pathStart.z, t: 2.5 };
    openDialog('Tide-shrine', COAST_LINES.reveal, () => coast?.glowShrine(false));
  }
  function reachSeaCave() {
    if (save.coast >= 3) return openDialog('Sea cave', COAST_LINES.seaCave(false));
    const lv = levelOf(save.xp); save.coast = 3; save.xp += COAST_XP; persist(); hudT = 0;
    toast(`The Second Seam · +${COAST_XP} XP${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''}`, 5);
    openDialog('Sea cave', COAST_LINES.seaCave(true), () => {
      chapterEl.querySelector('.chk')!.textContent = COAST_LINES.card.k; document.getElementById('chtitle')!.textContent = COAST_LINES.card.title;
      document.getElementById('chtease')!.textContent = COAST_LINES.card.tease; document.getElementById('chxp')!.textContent = `+${COAST_XP} XP · Level ${levelOf(save.xp)} · To be continued`; chapterEl.hidden = false; });
  }
  function coastInteract(): Inter | null {
    if (!coast || fading) return null; const c = coast, d = (p: { x: number; z: number }) => Math.hypot(state.px - p.x, state.pz - p.z);
    if (d(c.tunnel) < 2.6) return { label: 'Back along the water-road ↩', act: () => { void leaveCoast(); } };
    if (d(c.shrine) < 2.4) return { label: save.coast >= 2 ? 'Tide-shrine · the sea holds back' : `Raise Enna’s Tide-Glass · tide ${c.tidePhase}`, act: raiseGlass, x: c.shrine.x, z: c.shrine.z };
    if (d(c.lamp) < 2.0) return { label: 'Read the lamp-keeper’s stone', act: () => openDialog('The Lowtide Lamp', COAST_LINES.lamp), x: c.lamp.x, z: c.lamp.z };
    if (save.coast >= 2 && d(c.caveMouth) < 3.0) return { label: save.coast >= 3 ? 'Sea cave · listen again' : 'Enter the sea cave mouth', act: reachSeaCave, x: c.caveMouth.x - 3, z: c.caveMouth.z };
    return null;
  }
  async function enterCave(instant = false, at: 'entry' | 'passage' = 'entry') {
    if (inCave || (fading && at === 'entry')) return; fading = true; state.speed = 0;
    if (!instant) { setFade(true); await sleepMs(520); }
    const c = await ensureCave();
    c.setDoor(save.cave >= 3, true); for (let i = 0; i < 3; i++) c.lightBrazier(i, save.cave >= 3, true); c.setGlass(save.cave >= 4, true); litOrder = []; gutterT = -1;
    c.setPassage(save.cave >= 4); inCave = true; setScene(c.scene);
    if (at === 'passage') { state.px = c.passage.x + 0.6; state.pz = c.passage.z; state.facing = Math.PI / 2; state.yaw = -Math.PI / 2 + 0.3; } else { state.px = c.entry.x; state.pz = c.entry.z; state.facing = Math.PI; state.yaw = 0.05; }
    state.pitch = 0.16; state.dist = 5.4; snapCam = true;
    if (save.cave < 2) { save.cave = 2; persist(); }
    hudT = 0; fading = false;
    if (!instant && at === 'entry') { setFade(false); toast(save.cave >= 4 ? 'The water-road beneath Pale Keep' : 'Beneath Pale Keep · the old water-road', 3); }
  }
  async function exitCave(instant = false) {
    if (!inCave || fading) return; fading = true; state.speed = 0;
    if (!instant) { setFade(true); await sleepMs(520); }
    inCave = false; setScene(scene);
    state.px = stair.mouth.x - STAIR_DIR.x * 1.2; state.pz = stair.mouth.z - STAIR_DIR.z * 1.2; state.facing = Math.atan2(-STAIR_DIR.x, -STAIR_DIR.z); state.yaw = Math.atan2(STAIR_DIR.x, STAIR_DIR.z); state.pitch = 0.16; state.dist = 7; snapCam = true;
    grassField.recenter(state.px, state.pz); grassFar.recenter(state.px, state.pz); treeField.update(state.px, state.pz);
    hudT = 0; fading = false; if (!instant) setFade(false);
  }
  function useStair() {
    if (!save.beacon) return toast(CAVE_LINES.locked, 3.2);
    if (save.cave < 1) return toast(CAVE_LINES.quiet, 3.6);
    void enterCave();
  }
  function lightBrazier(i: number) {
    if (!cave || save.cave >= 3 || gutterT >= 0) return;
    if (litOrder.includes(i)) return toast(`The ${BRAZIERS[i].name} brazier already burns.`, 2);
    cave.lightBrazier(i, true); litOrder.push(i);
    if (RIVER_ORDER[litOrder.length - 1] !== i) { gutterT = 0.9; toast(CAVE_LINES.wrong, 3); return; }
    if (litOrder.length === 3) { save.cave = 3; persist(); cave.setDoor(true); camFocus = { x: cave.door.x, z: cave.door.z, t: 2.2 }; shake = 0.35; toast(CAVE_LINES.open, 4); hudT = 0; }
    else toast(`The ${BRAZIERS[i].name} brazier catches · ${litOrder.length}/3`, 2.2);
  }
  function readCarving() {
    if (save.cave >= 4) return openDialog('Enna Marr', CAVE_LINES.carving(profile.name, false));
    const lv = levelOf(save.xp); save.cave = 4; save.xp += CAVE_XP; persist(); cave?.setGlass(true); cave?.setPassage(true); hudT = 0;
    toast(`Enna’s Tide-Glass found · +${CAVE_XP} XP${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''}`, 5);
    openDialog('Enna Marr', CAVE_LINES.carving(profile.name, true));
  }
  function tickCave(dt: number) {
    if (gutterT >= 0 && cave) { gutterT -= dt; if (gutterT < 0) { for (let i = 0; i < 3; i++) cave.lightBrazier(i, false); litOrder = []; } }
  }
  function caveInteract(): Inter | null {
    if (!cave || fading) return null; const c = cave, d = (p: { x: number; z: number }) => Math.hypot(state.px - p.x, state.pz - p.z);
    if (d(c.exit) < 2.0) return { label: 'Climb the collapsed stair ↑', act: () => { void exitCave(); } };
    if (d(c.passage) < 2.2) return { label: save.cave >= 4 ? 'Follow the water-road west → the sea' : 'West passage · choked with rubble', act: () => { if (save.cave >= 4) void enterCoast(); else toast('Rubble chokes the west passage. A cold, salt draught slips through the gaps.', 3); }, x: c.passage.x - 1, z: c.passage.z };
    if (c.doorOpen && d(c.carving) < 1.9) return { label: save.cave >= 4 ? 'Read Enna’s carving again' : 'Read the carving · Enna’s hand', act: readCarving, x: c.carving.x, z: c.carving.z - 1 };
    for (let i = 0; i < 3; i++) if (d(c.braziers[i]) < 1.9) return { label: save.cave >= 3 || litOrder.includes(i) ? `${BRAZIERS[i].name} brazier · burning ${BRAZIERS[i].glyph}` : `Light the ${BRAZIERS[i].name} brazier ${BRAZIERS[i].glyph}`, act: () => lightBrazier(i), x: c.braziers[i].x, z: c.braziers[i].z };
    if (!c.doorOpen && d(c.door) < 2.4) return { label: 'Read the sealed door', act: () => openDialog('Sealed door', CAVE_LINES.hint), x: c.door.x, z: c.door.z };
    return null;
  }
  // ---------- Hollow Beacon: Updraft lift, morning mirrors, dawn ending ----------
  let onIsland = false, lift: { t: number; dur: number; down: boolean; p0: THREE.Vector3; hold?: number } | null = null, dawnCine: { t: number; a0: number } | null = null, dawnDelay = -1;
  const ray = new THREE.Raycaster(), rv = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), lp = new THREE.Vector3();
  function islandY(x: number, z: number): number | null { ray.set(rv.set(x, 400, z), DOWN); ray.far = 600; const h = ray.intersectObject(island.top, false)[0]; return h ? h.point.y : null; }
  const toLocal = (x: number, z: number, y = player.root.position.y) => island.group.worldToLocal(lp.set(x, y, z));
  const toWorld = (lx: number, lz: number) => island.group.localToWorld(new THREE.Vector3(lx, islandTopY(lx, lz), lz));
  const aligned = () => save.mirrors.filter((v, i) => v === MIRRORS[i].solve).length;
  const ISOLIDS = [{ x: BEACON_L.x, z: BEACON_L.z, r: 4.6 }, { x: CLUE_L.x, z: CLUE_L.z, r: 1.1 }, ...MIRRORS.map((m) => ({ x: BEACON_L.x + m.dx, z: BEACON_L.z + m.dz, r: 1.15 }))];
  function islandConstrain(nx: number, nz: number): [number, number] {
    const L = toLocal(nx, nz); const r = Math.hypot(L.x, L.z); if (r > ISLAND_WALK_R) { L.x *= ISLAND_WALK_R / r; L.z *= ISLAND_WALK_R / r; }
    for (const o of ISOLIDS) { const dx = L.x - o.x, dz = L.z - o.z, dd = Math.hypot(dx, dz); if (dd < o.r) { L.x = o.x + dx / dd * o.r; L.z = o.z + dz / dd * o.r; } }
    const w = island.group.localToWorld(L); return [w.x, w.z];
  }
  function islandInteract(): Inter | null {
    const L = toLocal(state.px, state.pz);
    for (let i = 0; i < MIRRORS.length; i++) {
      const m = MIRRORS[i], mx = BEACON_L.x + m.dx, mz = BEACON_L.z + m.dz; if (Math.hypot(L.x - mx, L.z - mz) > 2.7) continue;
      const v = save.mirrors[i], w = toWorld(mx, mz);
      if (save.beacon) return { label: `${m.name} mirror · ${MORNING_DIRS[v]} ✓`, act: () => toast('The mirror holds its morning.', 2), x: w.x, z: w.z };
      return { label: `Turn ${m.name} mirror · ${DIR_ARROWS[v]} ${MORNING_DIRS[v]}${v === m.solve ? ' ✓' : ''}`, act: () => turnMirror(i), x: w.x, z: w.z };
    }
    if (Math.hypot(L.x - CLUE_L.x, L.z - CLUE_L.z) < 2.6) { const w = toWorld(CLUE_L.x, CLUE_L.z); return { label: 'Read the Unspent carving', act: () => openDialog('Hollow Beacon', CLUE_LINES), x: w.x, z: w.z }; }
    if (Math.hypot(L.x - RETURN_L.x, L.z - RETURN_L.z) < 2.8) return { label: 'Ride down ↓', act: () => beginLift(true) };
    return null;
  }
  function useUpdraft() {
    if (!save.done) return openDialog('Updraft', fillLines(UPDRAFT_DORMANT, profile));
    if (!save.wind) return openDialog('Updraft', fillLines(UPDRAFT_NEEDS_WIND, profile));
    beginLift(false);
  }
  function beginLift(down: boolean) {
    lift = { t: 0, dur: down ? 5 : 6, down, p0: player.root.position.clone() }; state.speed = 0; for (const k of Object.keys(keys)) keys[k] = false;
    toast(down ? `${profile.name} glides back to the meadow crossing…` : `The Updraft carries ${profile.name} toward the held morning…`, 3);
  }
  const bz = new THREE.Vector3(), b1 = new THREE.Vector3(), b2 = new THREE.Vector3(), b3 = new THREE.Vector3();
  function liftPoint(e: number, out: THREE.Vector3) {
    const l = lift!, p0 = l.p0;
    if (!l.down) { b3.copy(toWorld(LANDING_L.x, LANDING_L.z)); b1.set(UPDRAFT.x, p0.y + 46, UPDRAFT.z); const dx = UPDRAFT.x - b3.x, dz = UPDRAFT.z - b3.z, d = Math.hypot(dx, dz); b2.set(b3.x + dx / d * 18, b3.y + 12, b3.z + dz / d * 18); }
    else { b3.set(UPDRAFT.x + 2.4, heightAt(UPDRAFT.x + 2.4, UPDRAFT.z + 3.2), UPDRAFT.z + 3.2); const dx = UPDRAFT.x - p0.x, dz = UPDRAFT.z - p0.z, d = Math.hypot(dx, dz); b1.set(p0.x + dx / d * 16, p0.y + 7, p0.z + dz / d * 16); b2.set(UPDRAFT.x, b3.y + 30, UPDRAFT.z); }
    const u = 1 - e; out.copy(p0).multiplyScalar(u * u * u).addScaledVector(b1, 3 * u * u * e).addScaledVector(b2, 3 * u * e * e).addScaledVector(b3, e * e * e); return out;
  }
  function turnMirror(i: number) {
    if (save.beacon || dawnCine) return;
    const m = MIRRORS[i], v = (save.mirrors[i] + 1) % 4; save.mirrors[i] = v; persist(); hollow.setMirror(i, v);
    toast(`${m.name} mirror now faces ${MORNING_DIRS[v]} ${DIR_ARROWS[v]}${v === m.solve ? ' · its light reaches the hollow' : ''} · ${aligned()}/4`, 2.2);
    if (mirrorsMatch(save.mirrors)) dawnDelay = 0.9;
  }
  function startDawn() {
    if (dawnCine || save.beacon) return;
    const bw = island.beaconWorld(); dawnCine = { t: 0, a0: Math.atan2(camera.position.x - bw.x, camera.position.z - bw.z) };
    island.solve(true); hollow.solve(true); document.body.classList.add('cine'); actBtn.hidden = true; for (const k of Object.keys(keys)) keys[k] = false;
    toast('The Unspent Morning is opening…', 4);
  }
  const endEl = document.getElementById('ending')!;
  document.getElementById('endok')!.onclick = () => { endEl.hidden = true; toast('Morning-Bearer · ride the return current at the western island edge.', 5); };
  function finishDawn() {
    dawnCine = null; document.body.classList.remove('cine');
    const lv = levelOf(save.xp);
    if (!save.beacon) { save.beacon = true; save.xp += BEACON_XP; persist(); }
    document.getElementById('endtitle')!.textContent = ENDING_TITLE;
    const box = document.getElementById('endlines')!; box.textContent = '';
    for (const l of fillLines(ENDING_LINES, profile)) { const pEl = document.createElement('p'); pEl.textContent = l; box.appendChild(pEl); }
    document.getElementById('endxp')!.textContent = `${ENDING_REWARD} · Level ${levelOf(save.xp)}${levelOf(save.xp) > lv ? ' (up!)' : ''}`;
    endEl.hidden = false;
  }
  // ---------- Dawn: sun colour/angle, sky shell, IBL/exposure and fog blend ----------
  const DC = { sun0: new THREE.Color('#fff1d6'), sun1: new THREE.Color('#ffb07a'), fog0: new THREE.Color('#a8bfd2'), fog1: new THREE.Color('#e2b29c'), hs0: new THREE.Color('#cfe0ff'), hs1: new THREE.Color('#ffc6a6'), hg0: new THREE.Color('#4b5a2e'), hg1: new THREE.Color('#5e4634') };
  const fogD0 = (scene.fog as THREE.FogExp2).density; let dawnK = -1;
  function applyDawn(k: number) {
    if (Math.abs(k - dawnK) < 1e-3) return; dawnK = k;
    sun.color.copy(DC.sun0).lerp(DC.sun1, k); sun.intensity = 2.6 + 0.35 * k; sunDir.copy(SUN_DIR).lerp(DAWN_DIR, k).normalize();
    hemi.color.copy(DC.hs0).lerp(DC.hs1, k); hemi.groundColor.copy(DC.hg0).lerp(DC.hg1, k); hemi.intensity = 0.25 + 0.3 * k;
    const fog = scene.fog as THREE.FogExp2; fog.color.copy(DC.fog0).lerp(DC.fog1, k); fog.density = fogD0 * (1 + 0.18 * k);
    renderer.toneMappingExposure = 0.92 + 0.1 * k; scene.environmentIntensity = 0.85 - 0.3 * k; scene.backgroundIntensity = 0.95 - 0.4 * k;
    (rift.material as THREE.ShaderMaterial).uniforms.uFade.value = 1 - 0.9 * k; island.setDawn(k);
    water.setDawn(k); const wu = ((water.mesh as THREE.Mesh).material as THREE.ShaderMaterial).uniforms; if (wu?.sunColor) { wu.sunColor.value.copy(sun.color); wu.sunDirection.value.copy(sunDir); }
  }
  // ---------- Echo Grove (optional) + Marr's Unfinished Map charting ----------
  let echoT = -1, chartT = 0;
  function useEcho() {
    if (save.echo) return openDialog('Echo Grove', echoMemoryLines(false));
    if (sealCount(save) < 1) return toast(ECHO_SILENT, 3);
    if (echoT < 0) { echoT = 0; state.speed = 0; toast('Five crystal boughs answer, one by one…', 2.2); }
  }
  function tickEcho(dt: number) {
    if (echoT >= 0 && !save.echo && !talking) {
      echoT += dt; for (let i = 0; i < 5; i++) if (echoT >= i * 0.28) grove.light(i);
      if (echoT >= 1.8) { echoT = -1; const lv = levelOf(save.xp); save.echo = true; save.xp += ECHO_XP; persist(); grove.memory(true); toast(`Echo Grove remembered · +${ECHO_XP} XP · Echo${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''}`, 5); openDialog('Echo Grove', echoMemoryLines(true)); }
    }
    chartT -= dt; if (chartT > 0 || onIsland || lift || inCave || inCoast) return; chartT = 0.4;
    for (let i = 0; i < MARR_MARKS.length; i++) {
      const m = MARR_MARKS[i]; if (save.charted[i] || Math.hypot(state.px - m.x, state.pz - m.z) > CHART_R) continue;
      save.charted[i] = true; persist(); const n = save.charted.filter(Boolean).length;
      toast(n === MARR_MARKS.length ? CHART_DONE : `Charted on Marr’s Unfinished Map: ${m.name} · ${n}/${MARR_MARKS.length}`, n === MARR_MARKS.length ? 5 : 3);
    }
  }
  // ---------- Vale Warden (optional) ----------
  const wd = { hp: HP_MAX, phase: save.warden ? 3 : 0, teleT: 0, recT: 0, sx: WARDEN.x, sz: WARDEN.z, awake: false, warned: false, freeze: -1 };
  let playerHp = HP_MAX, atkCd = 0, shake = 0, swingT = 0, swingFreeze = false;
  const wardenDist = () => Math.hypot(state.px - WARDEN.x, state.pz - WARDEN.z);
  function resetWarden() { if (save.warden) { wd.phase = 3; wd.hp = 0; return; } wd.hp = HP_MAX; wd.phase = 0; wd.teleT = 0; wd.recT = 0; wd.awake = false; wd.warned = false; }
  function attackWarden() {
    if (save.warden) { toast('The Warden remains dormant.', 2); return; }
    if (atkCd > 0) { toast('Strike not ready.', 1.2); return; }
    atkCd = PLAYER_ATK_CD; swingT = 0.32; player.play('Punch_Right');
    state.facing = Math.atan2(WARDEN.x - state.px, WARDEN.z - state.pz);
    wd.hp = Math.max(0, wd.hp - 1); warden.hit();
    if (wd.hp <= 0) {
      wd.phase = 3; const lv = levelOf(save.xp);
      if (!save.warden) { save.warden = true; save.xp += WARDEN_XP; persist(); toast(`Vale Warden falls dormant · +${WARDEN_XP} XP · Warden's Crest${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''}`, 5); }
      return;
    }
    toast(`Hit! Warden ${wd.hp}/${HP_MAX}`, 1.6);
  }
  function tickWarden(dt: number) {
    atkCd = Math.max(0, atkCd - dt); if (!swingFreeze) swingT = Math.max(0, swingT - dt);
    if (save.warden) { wd.phase = 3; return; }
    if (talking || cine || creating || dawnCine || lift || onIsland) return;
    const dist = wardenDist();
    if (dist < W_WAKE) { if (!wd.warned) { wd.warned = true; toast('Warden stirs — step out of the ring', 3.2); } wd.awake = true; }
    else if (dist > W_SLEEP) { wd.awake = false; if (wd.phase === 1 || wd.phase === 2) { wd.phase = 0; wd.teleT = 0; wd.recT = 0; } if (playerHp < HP_MAX && dist > W_SLEEP + 15) playerHp = HP_MAX; }
    if (!wd.awake || wd.freeze >= 0) return;
    if (wd.phase === 0) { wd.sx = state.px; wd.sz = state.pz; warden.placeZone(wd.sx, wd.sz); wd.phase = 1; wd.teleT = W_TELE; toast('⚠ Warden winds up — move!', 1.3, true); return; }
    if (wd.phase === 1) {
      wd.teleT -= dt; if (wd.teleT > 0) return;
      warden.impact(wd.sx, wd.sz); shake = 0.35;
      if (Math.hypot(state.px - wd.sx, state.pz - wd.sz) < W_STRIKE_R) {
        playerHp -= 1; player.play('HitRecieve');
        if (playerHp <= 0) {
          const rp = recoveryPoint(); state.px = rp.x; state.pz = rp.z; state.speed = 0; snapCam = true;
          state.facing = Math.atan2(WARDEN.x - rp.x, WARDEN.z - rp.z); state.yaw = state.facing + Math.PI;
          playerHp = HP_MAX; atkCd = 0; resetWarden();
          toast('Wayfinder pulls you to safety.', 4); openDialog('Wayfinder', RECOVERY_LINES); return;
        }
        toast(`Warden strike! HP ${playerHp}/${HP_MAX}`, 2, true);
      }
      wd.phase = 2; wd.recT = W_RECOVER; return;
    }
    if (wd.phase === 2) { wd.recT -= dt; if (wd.recT <= 0) { wd.phase = 0; wd.recT = 0; } }
  }
  function turnRune(i: number) {
    if (save.wind) { toast('The Wind Shrine already sings.', 2.5); return; }
    const v = (save.runes[i] + 1) % 3; save.runes[i] = v;
    if (runesMatch(save.runes)) {
      const lv = levelOf(save.xp); save.wind = true; save.xp += SHRINE_XP; persist();
      shrine.setRune(i, v, false); shrine.awaken();
      toast(`Wind Shrine wakes! +${SHRINE_XP} XP · Windward Blessing${levelOf(save.xp) > lv ? ` · Level ${levelOf(save.xp)}` : ''}`, 5);
      openDialog('Wind Shrine', SOLVED_LINES);
    } else { persist(); shrine.setRune(i, v, true); toast(`${RUNES[i].name} → ${RUNE_GLYPHS[v]} ${RUNE_LABELS[v]} · not yet`, 2.2); }
  }
  function interact() { if (creating || cine || dawnCine || lift || fading || paused || !chapterEl.hidden || !endEl.hidden) return; if (talking) { advance(); return; } const it = nearestInteract(); if (!it) return; if (it.x !== undefined && it.z !== undefined) camFocus = { x: it.x, z: it.z, t: 1.4 }; it.act(); }
  function talk() { interact(); }
  actBtn.onclick = (e) => { e.stopPropagation(); interact(); };
  addEventListener('keydown', (e) => { if (creating || paused || (e.target as HTMLElement).tagName === 'INPUT') return; if (talking && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { e.preventDefault(); if (e.code === 'Escape') { dq = []; } advance(); } });
  renderer.domElement.addEventListener('dblclick', talk);
  // Menu: quality, new character, FPS, reset (tap twice).
  const menuBtn = document.getElementById('menubtn')!, menuEl = document.getElementById('menu')!, resetBtn = document.getElementById('reset')!;
  const setMenu = (on: boolean) => { menuEl.hidden = !on; menuBtn.setAttribute('aria-expanded', String(on)); };
  menuBtn.onclick = () => setMenu(!!menuEl.hidden);
  let resetArm = 0;
  resetBtn.onclick = () => {
    if (performance.now() - resetArm < 3500) { clearSave(); location.reload(); return; }
    resetArm = performance.now(); resetBtn.textContent = 'Tap again to reset'; resetBtn.classList.add('warn');
    setTimeout(() => { resetBtn.textContent = 'Reset progress'; resetBtn.classList.remove('warn'); }, 3500);
  };
  // HUD: quest tracker + compass.
  const wdArrow = document.getElementById('wdarrow')!, wdText = document.getElementById('wdtext')!, combatEl = document.getElementById('combat')!, hpEl = document.getElementById('hp')!, whpEl = document.getElementById('whp')!;
  const wArrow = document.getElementById('warrow')!, wText = document.getElementById('wtext')!;
  const qline = document.getElementById('qline')!, qstats = document.getElementById('qstats')!, carrow = document.getElementById('carrow')!, ctext = document.getElementById('ctext')!;
  let hudT = 0;
  function objective(): { name: string; x: number; z: number } {
    const n = sealCount(save);
    if (inCave && cave) {
      if (save.cave < 3) { const c = cave.braziers[1]; return { name: 'Braziers · the river’s order', x: c.x, z: c.z }; }
      if (save.cave < 4) return { name: 'Behind the door · Enna’s alcove', x: cave.carving.x, z: cave.carving.z };
      if (save.coast < 3) return { name: 'West passage · the water-road to the sea', x: cave.passage.x, z: cave.passage.z };
      return { name: 'Climb out · collapsed stair', x: cave.exit.x, z: cave.exit.z };
    }
    if (inCoast && coast) {
      if (save.coast < 2) return { name: `Tide-shrine · tide ${coast.tidePhase}`, x: coast.shrine.x, z: coast.shrine.z };
      if (save.coast < 3) return { name: 'Sea cave mouth · along the causeway', x: coast.caveMouth.x, z: coast.caveMouth.z };
      return { name: 'Tunnel · back to the vale', x: coast.tunnel.x, z: coast.tunnel.z };
    }
    if (save.beacon && save.cave >= 4 && save.coast < 3) return { name: 'Collapsed stair · the water-road west', x: stair.mouth.x, z: stair.mouth.z };
    if (save.beacon && save.cave >= 1 && save.cave < 4) return { name: 'Collapsed stair · east of Pale Keep', x: stair.mouth.x, z: stair.mouth.z };
    if (save.beacon && save.cave === 0) return { name: 'Wayfinder · word of Enna', x: WAYFINDER.x, z: WAYFINDER.z };
    if (save.started && n < 4) { let bd = 1e9, t = { name: '', x: 0, z: 0 }; for (const d of SEALS) if (!save.seals[d.id]) { const dd = Math.hypot(d.x - state.px, d.z - state.pz); if (dd < bd) { bd = dd; t = { name: `${d.name} · ${d.at}`, x: d.x, z: d.z }; } } return t; }
    if (save.done && !save.beacon) {
      if (onIsland) { const w = toWorld(BEACON_L.x, BEACON_L.z); return { name: `Hollow Beacon · mirrors ${aligned()}/4`, x: w.x, z: w.z }; }
      if (!save.wind) return { name: 'Wind Shrine · its blessing opens the Updraft', x: (RUNES[0].x + RUNES[2].x) / 2, z: RUNES[0].z };
      return { name: 'Updraft · Hollow Beacon', x: UPDRAFT.x, z: UPDRAFT.z };
    }
    if (onIsland) { const w = toWorld(RETURN_L.x, RETURN_L.z); return { name: 'Ride down · western edge', x: w.x, z: w.z }; }
    return { name: 'Wayfinder', x: WAYFINDER.x, z: WAYFINDER.z };
  }
  function updateHud(dt: number) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.15;
    const n = sealCount(save);
    qline.textContent = !save.started ? 'Speak with the Wayfinder' : !save.done ? (n < 4 ? `The Four Seals · ${n}/4` : 'All four seals held — return to the Wayfinder') : !save.beacon ? (onIsland ? `The Unspent Morning · mirrors ${aligned()}/4` : save.wind ? 'The Unspent Morning · ride the Updraft' : 'The Unspent Morning · needs the Wind Shrine blessing') : ['Morning-Bearer · the Wayfinder has word of Enna', 'Enna’s Trail · the collapsed stair by Pale Keep', 'Enna’s Trail · light the braziers as the river runs', 'Enna’s Trail · the sealed door stands open', 'Enna’s Trail · the water-road runs to the sea'][save.cave];
    if (save.cave >= 4 && save.coast >= 1) qline.textContent = save.coast >= 3 ? 'Chapter II · The Second Seam — to be continued' : save.coast >= 2 ? 'Enna’s Trail · the causeway to the sea cave' : `Enna’s Trail · Tidewrack Coast${inCoast && coast ? ` · tide ${coast.tidePhase}` : ''}`;
    qstats.textContent = `Lv ${levelOf(save.xp)} · ${save.xp} XP · ${SEALS.map((d) => (save.seals[d.id] ? '◆' : '◇')).join('')}`;
    const tgt = objective();
    const away = inCave || inCoast, hx = away ? STAIR.x : state.px, hz = away ? STAIR.z : state.pz;
    const dx = tgt.x - state.px, dz = tgt.z - state.pz, dist = Math.hypot(dx, dz);
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw), rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
    const sx = dx * rx + dz * rz, sy = dx * fx + dz * fz;
    carrow.style.transform = `rotate(${(Math.atan2(-sy, sx) * 180 / Math.PI).toFixed(0)}deg)`;
    ctext.textContent = save.beacon && save.cave >= 4 && save.coast >= 3 && !onIsland && !inCave && !inCoast && dist < 6 ? 'Explore freely' : `${tgt.name} · ${dist < 10 ? 'here' : Math.round(dist) + ' m'}`;
    // Optional Wind Shrine locator line.
    { const ws = { x: (RUNES[0].x + RUNES[2].x) / 2, z: RUNES[0].z }; const ddx = ws.x - hx, ddz = ws.z - hz, dd = Math.hypot(ddx, ddz);
      const wx = ddx * rx + ddz * rz, wy = ddx * fx + ddz * fz;
      wArrow.style.transform = `rotate(${(Math.atan2(-wy, wx) * 180 / Math.PI).toFixed(0)}deg)`; wArrow.style.visibility = save.wind ? 'hidden' : 'visible';
      wText.textContent = save.wind ? 'Wind Shrine awake · Windward Blessing +15%' : `Wind Shrine (${save.done ? 'blessing opens the Updraft' : 'optional'}) · ${save.runes.map((v) => RUNE_GLYPHS[v]).join(' ')} · ${dd < 18 ? 'here' : Math.round(dd) + ' m'}`; }
    { const ddx = WARDEN.x - hx, ddz = WARDEN.z - hz, dd = Math.hypot(ddx, ddz); const wx = ddx * rx + ddz * rz, wy = ddx * fx + ddz * fz;
      wdArrow.style.transform = `rotate(${(Math.atan2(-wy, wx) * 180 / Math.PI).toFixed(0)}deg)`; wdArrow.style.visibility = save.warden ? 'hidden' : 'visible';
      wdText.textContent = save.warden ? "Warden dormant · Warden's Crest" : `Vale Warden (optional) · ${dd < 12 ? 'here' : Math.round(dd) + ' m'}`;
      const show = !save.warden && (wd.awake || playerHp < HP_MAX);
      combatEl.hidden = !show; if (show) { hpEl.textContent = '♥'.repeat(playerHp) + '♡'.repeat(HP_MAX - playerHp); whpEl.textContent = '■'.repeat(wd.hp) + '□'.repeat(HP_MAX - wd.hp); combatEl.classList.toggle('alert', wd.phase === 1); } }
    const it = talking || cine || dawnCine || fading ? null : nearestInteract();
    actBtn.hidden = !it; if (it) actBtn.textContent = it.label; actBtn.classList.toggle('combat', !!it?.combat); actBtn.style.setProperty('--cd', it?.combat ? (atkCd / PLAYER_ATK_CD).toFixed(2) : '0');
    document.getElementById('hint')!.textContent = it ? `E / Action: ${it.label}` : 'Drag to look · WASD / stick to move · Shift walks';
  }

  // ---------- character creation ----------
  const createEl = document.getElementById('create') as HTMLFormElement, nameIn = document.getElementById('cname') as HTMLInputElement;
  const sexBtns = Array.from(createEl.querySelectorAll<HTMLButtonElement>('[data-sex]'));
  let creating = false, previewSex: Sex = profile.sex, spin = 0.4;
  const applyName = () => { document.getElementById('pname')!.textContent = ` · ${profile.name} ${SURNAME}`; };
  const subEl = document.getElementById('csub')!;
  const applySub = () => { subEl.textContent = fill('Seventeen, Enna’s {child}. Choose a first name — {surname} is your family’s.', { name: nameIn.value || 'Ilka', sex: previewSex }); };
  applyName();
  function setPreview(sex: Sex) {
    previewSex = sex; for (const b of sexBtns) b.setAttribute('aria-pressed', String(b.dataset.sex === sex));
    for (const [k, h] of Object.entries(heroes)) h.root.visible = k === sex;
    player = heroes[sex]; applySub();
  }
  function openCreate(sex: Sex = profile.sex, name = profile.name) {
    creating = true; createEl.hidden = false; document.body.classList.add('creating'); nameIn.value = name; setPreview(sex);
    for (const k of Object.keys(keys)) keys[k] = false;
  }
  for (const b of sexBtns) b.onclick = () => setPreview(b.dataset.sex as Sex);
  nameIn.addEventListener('input', () => { const c = nameIn.value.replace(/[<>&"`\\/{}\[\]=;]/g, ''); if (c !== nameIn.value) nameIn.value = c; });
  createEl.onsubmit = (e) => {
    e.preventDefault();
    profile = { name: sanitizeName(nameIn.value), sex: previewSex }; saveProfile(profile); applyName();
    creating = false; createEl.hidden = true; document.body.classList.remove('creating'); nameIn.blur();
    camera.clearViewOffset(); snapCam = true; state.facing = Math.PI; state.yaw = Math.PI; state.speed = 0;
  };
  // New character = fresh progress (with a confirm when there is progress to lose).
  const ncBox = document.getElementById('ncconfirm')!;
  const hasProgress = () => { const sv = loadSave(); return sv.started || sv.xp > 0 || sv.wind || sv.warden || sv.beacon || sv.echo || sv.charted.some(Boolean) || sv.cave > 0 || sv.mirrors.some((v) => v !== 0) || Object.keys(sv.seals).length > 0 || sv.runes.some((v) => v !== 0); };
  document.getElementById('newchar')!.onclick = () => { if (hasProgress()) ncBox.hidden = !ncBox.hidden; else { document.getElementById('menu')!.hidden = true; openCreate(); } };
  document.getElementById('ncno')!.onclick = () => { ncBox.hidden = true; };
  document.getElementById('ncyes')!.onclick = () => { clearSave(); try { sessionStorage.setItem('vale3d-newchar', '1'); } catch { /* */ } location.reload(); };
  function previewUpdate(dt: number, t: number) {
    const gy = heightAt(SPAWN.x, SPAWN.z); spin += dt * 0.45;
    player.root.position.set(SPAWN.x, gy, SPAWN.z); player.root.rotation.y = spin; player.setSpeed(0, dt);
    // Camera south of the hero looking north up the meadow path; offset the view so the hero sits clear of the panel.
    const w = innerWidth, h = innerHeight, wide = w >= 760 && w >= h;
    const back = wide ? 3.7 : 5.6;
    camera.position.set(SPAWN.x + 0.5, gy + (wide ? 1.25 : 1.45), SPAWN.z + back); camera.lookAt(SPAWN.x, gy + 0.98, SPAWN.z);
    if (wide) camera.setViewOffset(w, h, -Math.min(200, w * 0.18), 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    camTarget.set(SPAWN.x, gy + 1.4, SPAWN.z);
    tick(t, gy);
  }

  const solids = SOLIDS;
  const clock = new THREE.Clock();
  const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  let fpsT = 0, frames = 0, fps = 0, totalFrames = 0, snapCam = true;

  /** Frame-rate-independent damping factor: 1 - e^(-k·dt). */
  const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
  let camYOff = 0, camDistS = -1, camGy = 0; const stickF = { x: 0, y: 0 }; const backV = new THREE.Vector3(), rightV = new THREE.Vector3(), fwdV = new THREE.Vector3(), shU = new THREE.Vector3(), shV = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  function update(dt: number, t: number) {
    if (creating) { previewUpdate(dt, t); return; }
    lastDt = dt;
    // Input → desired velocity in camera space.
    let ix = 0, iz = 0;
    if (talking || cine || dawnCine || lift || fading) { for (const k of Object.keys(keys)) keys[k] = false; }
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    let mag = Math.min(1, Math.hypot(ix, iz)); if (mag > 0) { const l = Math.hypot(ix, iz); ix /= l; iz /= l; }
    let target = mag * (keys.ShiftLeft || keys.ShiftRight ? 1.9 : 5.6);
    if (legacyMotion) { if (stick.id >= 0 && Math.hypot(stick.x, stick.y) > 0.12) { ix = stick.x; iz = stick.y; mag = Math.min(1, Math.hypot(ix, iz)); target = mag < 0.7 ? 1.9 * mag / 0.7 : 1.9 + (mag - 0.7) / 0.3 * 3.7; } }
    else {
      // Touch stick: radial deadzone (rescaled), then a dt-correct low-pass on the vector so thumb noise at full deflection
      // doesn't wiggle the heading (a wiggling heading = the world sliding left/right behind a rigidly following camera).
      let rx = 0, ry = 0; if (stick.id >= 0) { const l = Math.hypot(stick.x, stick.y); if (l > 0.15) { const k = Math.min(1, (l - 0.15) / 0.8) / l; rx = stick.x * k; ry = stick.y * k; } }
      const kk = damp(rx || ry ? 9 : 20, dt); stickF.x += (rx - stickF.x) * kk; stickF.y += (ry - stickF.y) * kk;
      const fm = Math.hypot(stickF.x, stickF.y); if (fm > 0.06) { ix = stickF.x; iz = stickF.y; mag = Math.min(1, fm); target = mag < 0.7 ? 1.9 * mag / 0.7 : 1.9 + (mag - 0.7) / 0.3 * 3.7; }
      if (mag > 0.05 && camFocus) camFocus = null; // never auto-swing the camera while the player is steering
    }
    if (save.wind) target *= WIND_BLESS; // Windward Blessing
    state.speed += (target - state.speed) * damp(target > state.speed ? 4 : 7, dt);
    if (mag > 0.05) {
      const s = Math.sin(state.yaw), c = Math.cos(state.yaw);
      const wx = ix * c + iz * s, wz = -ix * s + iz * c;
      const want = Math.atan2(wx, wz);
      let d = want - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (legacyMotion) state.facing += d * damp(10, dt);
      else if (mag > 0.2 || Math.abs(d) > 0.6) { const step = d * damp(Math.abs(d) < 0.25 ? 6 : 10, dt), cap = 9 * dt; /* gentle for small corrections (noise), brisk for real turns */ state.facing += Math.max(-cap, Math.min(cap, step)); state.facing = Math.atan2(Math.sin(state.facing), Math.cos(state.facing)); }
    }
    if (lift) state.speed = 0;
    if (state.speed > 0.02 && inCoast && coast) {
      [state.px, state.pz] = coast.constrain(state.px, state.pz, state.px + Math.sin(state.facing) * state.speed * dt, state.pz + Math.cos(state.facing) * state.speed * dt);
    } else if (state.speed > 0.02 && inCave && cave) {
      [state.px, state.pz] = cave.constrain(state.px + Math.sin(state.facing) * state.speed * dt, state.pz + Math.cos(state.facing) * state.speed * dt);
    } else if (state.speed > 0.02 && onIsland) {
      [state.px, state.pz] = islandConstrain(state.px + Math.sin(state.facing) * state.speed * dt, state.pz + Math.cos(state.facing) * state.speed * dt);
    } else if (state.speed > 0.02) {
      let nx = state.px + Math.sin(state.facing) * state.speed * dt, nz = state.pz + Math.cos(state.facing) * state.speed * dt;
      for (const s of solids) { const dx = nx - s.x, dz = nz - s.z, dd = Math.hypot(dx, dz); if (dd < s.r) { nx = s.x + dx / dd * s.r; nz = s.z + dz / dd * s.r; } }
      const R = 235; const rr = Math.hypot(nx, nz); if (rr > R) { nx *= R / rr; nz *= R / rr; }
      // Wading: the creek is shallow — slow down instead of blocking.
      if (Math.abs(nx - creekX(nz)) < creekHalf(nz)) { nx = state.px + (nx - state.px) * 0.5; nz = state.pz + (nz - state.pz) * 0.5; }
      state.px = nx; state.pz = nz;
    }
    let gy: number;
    if (lift) {
      if (!(lift.hold !== undefined && lift.t >= lift.hold)) lift.t += dt; const u = Math.min(1, lift.t / lift.dur), e = u * u * (3 - 2 * u);
      liftPoint(e, bz); const ahead = liftPoint(Math.min(1, e + 0.02), new THREE.Vector3());
      if (Math.hypot(ahead.x - bz.x, ahead.z - bz.z) > 0.05) { const want = Math.atan2(ahead.x - bz.x, ahead.z - bz.z); let d = want - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); state.facing += d * Math.min(1, dt * 3); let dy = state.facing + Math.PI - state.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); state.yaw += dy * Math.min(1, dt * 1.6); }
      state.pitch += (0.3 - state.pitch) * Math.min(1, dt * 2);
      state.px = bz.x; state.pz = bz.z; gy = bz.y;
      if (u >= 1) { const down = lift.down; lift = null; onIsland = !down; hudT = 0; if (onIsland) toast(save.beacon ? 'The held morning is spent · ride down from the western edge.' : 'Turn the four morning mirrors · read the Unspent carving.', 4); }
    } else if (inCave) gy = 0;
    else if (inCoast && coast) gy = coast.groundY(state.px, state.pz);
    else if (onIsland) gy = islandY(state.px, state.pz) ?? player.root.position.y;
    else gy = Math.max(heightAt(state.px, state.pz), WATER_Y - 0.7);
    player.root.position.set(state.px, gy, state.pz);
    player.root.rotation.y = state.facing;
    player.pose.fly += ((lift ? 1 : 0) - player.pose.fly) * Math.min(1, dt * 3); player.pose.swing = swingT > 0 ? 1 - swingT / 0.32 : 0;
    player.setSpeed(state.speed, dt);
    // Wayfinder looks at Ilka when near.
    const dW = Math.hypot(state.px - WAYFINDER.x, state.pz - WAYFINDER.z);
    if (dW < 9) { const want = Math.atan2(state.px - WAYFINDER.x, state.pz - WAYFINDER.z); let d = want - wayfinder.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); wayfinder.root.rotation.y += d * Math.min(1, dt * 3); }
    wayfinder.setSpeed(0, dt);
    tickWarden(dt); tickEcho(dt); tickCave(dt);
    updateHud(dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
    // Interaction focus: swing the camera behind the player toward the target (keeps runes/seals in frame on portrait phones).
    if (camFocus) { camFocus.t -= dt; const want = Math.atan2(state.px - camFocus.x, state.pz - camFocus.z); if (Math.hypot(state.px - camFocus.x, state.pz - camFocus.z) > 0.6) { let d = want - state.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); state.yaw += d * damp(5, dt); } if (camFocus.t <= 0) camFocus = null; }
    // Over-the-shoulder camera.
    if (snapCam || Math.abs(gy - camGy) > 3) camGy = gy; else camGy += (gy - camGy) * damp(12, dt); // soften terrain bumps, no horizontal lag
    camTarget.set(state.px, camGy + 1.42, state.pz);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const back = backV.set(Math.sin(state.yaw) * cp, sp, Math.cos(state.yaw) * cp);
    const right = rightV.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    camPos.copy(camTarget).addScaledVector(back, state.dist).addScaledVector(right, 0.65);
    if (onIsland) {
      // Rim trees: pull the camera in front of any trunk/canopy between it and the player.
      const a = toLocal(camTarget.x, camTarget.z, camTarget.y).clone(), b = toLocal(camPos.x, camPos.z, camPos.y).clone();
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz; let tMin = 1;
      if (len2 > 0.01) for (const tr of island.trees) { const r = 2.0; const u = ((tr.x - a.x) * dx + (tr.z - a.z) * dz) / len2; if (u <= 0 || u >= 1.2) continue; const px = a.x + dx * u - tr.x, pz = a.z + dz * u - tr.z; const d = Math.hypot(px, pz), rr = Math.min(2.4, r); if (d < rr) tMin = Math.min(tMin, u - Math.sqrt(rr * rr - d * d) / Math.sqrt(len2)); }
      if (tMin < 1) camPos.lerpVectors(camTarget, camPos, Math.max(0.3, tMin - 0.05));
    }
    if (inCave && cave) cave.clampCam(camTarget, camPos);
    const floor = inCoast && coast ? coast.camFloor(camPos.x, camPos.z) + 0.25 : inCave ? -1e9 : (onIsland || lift ? (islandY(camPos.x, camPos.z) ?? -1e9) : heightAt(camPos.x, camPos.z)) + 0.6;
    // Rigid horizontal follow (no positional lag): a lagged lerp toward a moving target leaves a dt-dependent gap, so on a phone with
    // uneven frame times the camera→player distance pumped every frame while running ("view goes back and forth").
    // Only the occlusion pull-in and the terrain floor push are smoothed (dt-correct), as offsets along the boom / in height.
    const want = camPos.distanceTo(camTarget);
    if (snapCam || camDistS < 0) camDistS = want; else camDistS += (want - camDistS) * damp(want < camDistS ? 14 : 4, dt);
    tmp.copy(camPos).sub(camTarget).setLength(camDistS); const rigidY = camTarget.y + tmp.y;
    const fl = floor - rigidY; // how far the floor pushes the camera up
    const yOffWant = Math.max(0, fl);
    if (snapCam) camYOff = yOffWant; else camYOff += (yOffWant - camYOff) * damp(yOffWant > camYOff ? 18 : 5, dt);
    camera.position.set(camTarget.x + tmp.x, Math.max(rigidY + camYOff, floor - 0.25), camTarget.z + tmp.z); snapCam = false;
    tmp.copy(camTarget).addScaledVector(right, 0.65); tmp.y += 0.15;
    if (finaleDelay > 0) { finaleDelay -= dt; if (finaleDelay <= 0) startFinale(); }
    if (dawnDelay > 0) { dawnDelay -= dt; if (dawnDelay <= 0) startDawn(); }
    if (onIsland && !lift && !dawnCine && !save.beacon && dawnDelay <= 0 && mirrorsMatch(save.mirrors)) startDawn();
    if (dawnCine) {
      // The Unspent Morning: orbit out from the beacon and climb the beam while the sky turns to sunrise.
      dawnCine.t += dt; const u = Math.min(1, dawnCine.t / 9), e = u * u * (3 - 2 * u), kin = THREE.MathUtils.smoothstep(dawnCine.t, 0, 1.4);
      const bw = island.beaconWorld(), a = dawnCine.a0 + e * 1.35, r = 12 + 22 * e;
      const pos = new THREE.Vector3(bw.x + Math.sin(a) * r, bw.y - 3 + 12 * e, bw.z + Math.cos(a) * r);
      camera.position.lerp(pos, kin); tmp.lerp(bw.clone().add(new THREE.Vector3(0, 1 + 16 * e, 0)), kin);
      if (u >= 1) finishDawn();
    }
    applyDawn(save.beacon ? 1 : dawnCine ? THREE.MathUtils.smoothstep(dawnCine.t, 1.2, 7.6) : 0);
    if (cine) {
      // Pan: rise and pull back while the gaze swings from the hero to the waking beacon, hold, then return.
      if (cine.hold < 0 || cine.t < cine.hold) cine.t += dt;
      const u = cine.t / cine.dur, ease = (x: number) => x * x * (3 - 2 * x);
      const k = ease(THREE.MathUtils.clamp(u / 0.35, 0, 1)) * (1 - ease(THREE.MathUtils.clamp((u - 0.82) / 0.18, 0, 1)));
      const bw = island.beaconWorld(); bw.y += 2;
      const dir = tmp.clone().sub(bw).setY(0).normalize();
      const pos = camTarget.clone().addScaledVector(dir, 7).add(new THREE.Vector3(0, 1.6, 0));
      camera.position.lerp(pos, k); tmp.lerp(bw, k);
      if (u >= 1) finishFinale();
    }
    camera.lookAt(tmp);
    if (shake > 0) { shake = Math.max(0, shake - dt); camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
    tick(t, gy);
  }

  function tick(t: number, gy: number) {
    // Sun shadow frustum follows the player (fitted).
    sun.position.copy(camTarget).addScaledVector(sunDir, 120);
    sun.target.position.copy(camTarget).addScaledVector(fwdV.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)), SH * 0.55);
    { // Snap the shadow frustum to whole shadow-map texels in light space: stops shadow edges crawling while running.
      const texel = (2 * SH) / sun.shadow.mapSize.x; shU.crossVectors(sunDir, UPV).normalize(); shV.crossVectors(shU, sunDir).normalize(); const tp = sun.target.position;
      const a = Math.round(tp.dot(shU) / texel) * texel - tp.dot(shU), b = Math.round(tp.dot(shV) / texel) * texel - tp.dot(shV); tp.addScaledVector(shU, a).addScaledVector(shV, b); }
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 120);
    dawnSky.mesh.position.copy(camera.position); dawnSky.set(Math.max(0, dawnK), t);
    const aloft = onIsland || !!lift; grassField.mesh.visible = !aloft; grassFar.mesh.visible = HIGH && !aloft;
    if (onIsland) { const L = toLocal(state.px, state.pz); island.treesNear(L.x, L.z); } else island.treesNear(1e4, 1e4);
    updraft.update(t, lastDt); hollow.update(t, lastDt); grove.update(t, lastDt); grove.near(inCave || inCoast || aqLevel >= 2 ? 1e9 : Math.hypot(camera.position.x - ECHO.x, camera.position.z - ECHO.z)); updraft.setActive(save.done);
    stair.update(t, lastDt); if (inCave && cave) cave.update(t, lastDt); if (inCoast && coast) coast.update(t, lastDt, camera, camTarget);
    if (!inCave && !inCoast) treeField.update(state.px, state.pz);
    if (!inCave && !inCoast && Math.hypot(state.px - grassField.center.x, state.pz - grassField.center.y) > (HIGH ? 9 : 6)) { grassField.recenter(state.px, state.pz); grassFar.recenter(state.px, state.pz); }
    for (const gf of [grassField, grassFar]) { gf.uniforms.uTime.value = t; gf.uniforms.uPlayer.value.set(state.px, gy, state.pz); }
    water.update(t);
    (rift.material as THREE.ShaderMaterial).uniforms.uTime.value = t; foliageUniforms.uTime.value = t;
    island.update(t, lastDt); landmarks.update(t); shrine.update(t, lastDt);
    { const k = wd.phase === 1 ? (wd.freeze >= 0 ? wd.freeze : 1 - wd.teleT / W_TELE) : 0;
      warden.update(t, lastDt, { phase: wd.phase, k, awake: wd.awake, face: wd.awake || wd.freeze >= 0 ? Math.atan2(state.px - WARDEN.x, state.pz - WARDEN.z) : null, zone: wd.phase === 1 }); } for (const o of seals) o.update(t, lastDt);
    wayfinder.root.updateMatrixWorld(true); handBone.getWorldPosition(handPos); staff.update(t, handPos, wayfinder.root.rotation.y);
    vignette.uniforms.uTime.value = t % 100;
  }

  // ---------- Journal & Map (☰ Menu, J / M): gameplay pauses while open ----------
  const jEl = document.getElementById('journal')!, mapEl = document.getElementById('mapov')!, mapCv = document.getElementById('mapcv') as HTMLCanvasElement;
  let mapT = 0;
  function renderJournal() {
    const j = buildJournal(save, profile, onIsland);
    document.getElementById('jtitle')!.textContent = j.title; document.getElementById('jsub')!.textContent = j.sub;
    const body = document.getElementById('jbody')!; body.textContent = '';
    for (const sec of j.sections) {
      const h = document.createElement('h3'); h.textContent = sec.h; body.appendChild(h);
      const ul = document.createElement('ul');
      for (const it of sec.items) { const li = document.createElement('li'); li.textContent = it.t; if (it.done) li.className = 'done'; if (it.lore) li.className = 'lore'; ul.appendChild(li); }
      body.appendChild(ul);
    }
  }
  function drawMap(t: number) {
    const maxW = Math.min(560, innerWidth - 24) - 20, maxH = innerHeight - 140, ar = (MAPBOX.z1 - MAPBOX.z0) / (MAPBOX.x1 - MAPBOX.x0);
    const w = Math.floor(Math.min(maxW, maxH / ar)), h = Math.floor(w * ar);
    drawValeMap(mapCv, w, h, { player: inCave || inCoast ? { x: STAIR.x, z: STAIR.z, facing: state.facing } : { x: state.px, z: state.pz, facing: state.facing }, target: inCave || inCoast ? { name: 'Collapsed Stair', x: STAIR.x, z: STAIR.z } : save.started ? objective() : { name: 'Wayfinder', x: WAYFINDER.x, z: WAYFINDER.z }, save, onIsland, t });
  }
  function openSheet(which: 'journal' | 'map') {
    if (creating || cine || dawnCine || lift) return;
    closeSheets(); setMenu(false);
    paused = true; for (const k of Object.keys(keys)) keys[k] = false; stick.id = -1; stick.x = stick.y = 0; knob.style.transform = ''; state.speed = 0;
    if (which === 'journal') { renderJournal(); jEl.hidden = false; } else { mapEl.hidden = false; drawMap(clock.elapsedTime); }
    document.body.classList.add('sheet');
  }
  function closeSheets() { jEl.hidden = true; mapEl.hidden = true; paused = false; document.body.classList.remove('sheet'); clock.getDelta(); }
  document.getElementById('jbtn')!.onclick = () => openSheet('journal');
  document.getElementById('mbtn')!.onclick = () => openSheet('map');
  document.getElementById('jclose')!.onclick = closeSheets; document.getElementById('mclose')!.onclick = closeSheets;
  // On-screen FPS readout (corner chip; tap it or press F to toggle; remembered).
  const fpsEl = document.getElementById('fps')!;
  let fpsOn = params.has('fps') || localStorage.getItem('vale3d-fps') === '1';
  const setFps = (on: boolean) => { fpsOn = on; fpsEl.classList.toggle('on', on); fpsEl.textContent = on ? '… fps' : 'FPS'; try { localStorage.setItem('vale3d-fps', on ? '1' : '0'); } catch { /* */ } };
  setFps(fpsOn);
  fpsEl.addEventListener('click', () => setFps(!fpsOn));
  addEventListener('keydown', (e) => { if (e.code === 'KeyF' && (e.target as HTMLElement).tagName !== 'INPUT') setFps(!fpsOn); });
  renderer.info.autoReset = false;
  // Adaptive quality (High only, silent): if FPS stays under ~40 for 3 s, step down one notch at a time —
  // 1 pixel ratio ≤ 1 · 2 no crystal transmission · 3 no GTAO · 4 pixel ratio 0.75. Never steps back up within a session.
  let aqLevel = 0, aqLow = 0, aqWarm = 0;
  const aqOn = HIGH && !params.has('shot') && !params.has('noaq') && (!navigator.webdriver || params.has('aq'));
  const setPR = (pr: number) => { renderer.setPixelRatio(pr); composer?.setPixelRatio(pr); composer?.setSize(innerWidth, innerHeight); gtao?.setSize(innerWidth, innerHeight); };
  let aqLast = performance.now();
  function adaptQuality(_win: number) {
    const now = performance.now(), win = Math.min(2, (now - aqLast) / 1000), wallFps = frames / Math.max(win, 1e-3); aqLast = now; // wall clock: game dt is clamped
    if (!aqOn || paused || fading || talking || document.hidden || aqLevel >= 4) return;
    aqWarm += win; if (aqWarm < 6) return;
    aqLow = wallFps < 40 ? aqLow + win : Math.max(0, aqLow - win);
    if (aqLow < 3) return; aqLow = 0; aqWarm = 3; aqLevel++;
    if (aqLevel === 1) setPR(Math.min(renderer.getPixelRatio(), 1));
    if (aqLevel === 3 && gtao) gtao.enabled = false;
    if (aqLevel === 4) setPR(0.75);
  }
  // Per-frame motion recorder (QA): wall time, dt, player root, hips (mesh) world pos, camera pos, camera→target distance, player screen pos.
  let legacyMotion = params.has('legacymotion'); // QA only: the M11 motion path, for before/after probes
  let rec: number[][] | null = null; const hipsBone = player.root.getObjectByName('Hips'); const recV = new THREE.Vector3();
  function recFrame(dt: number) {
    camera.updateMatrixWorld(); const hp = hipsBone ? hipsBone.getWorldPosition(recV).clone() : player.root.position.clone(); recV.copy(player.root.position).add(new THREE.Vector3(0, 1.1, 0)).project(camera);
    rec!.push([performance.now(), dt, player.root.position.x, player.root.position.z, hp.x, hp.z, camera.position.x, camera.position.y, camera.position.z, camera.position.distanceTo(player.root.position) , recV.x, recV.y, state.speed, player.root.rotation.y, state.yaw, camera.rotation.y]);
  }
  // Fixed 60 Hz simulation + render interpolation. Frame dt comes from the vsync-aligned rAF timestamp (not from when the
  // callback happens to start), so irregular JS start latency on phones no longer turns into uneven per-frame motion.
  const FIXED = 1 / 60; let acc = 0, simT = 0, lastTs = -1, interpOn = false;
  const ipP0 = new THREE.Vector3(), ipP1 = new THREE.Vector3(), ipC0 = new THREE.Vector3(), ipC1 = new THREE.Vector3(), ipQ0 = new THREE.Quaternion(), ipQ1 = new THREE.Quaternion(); let ipR0 = 0, ipR1 = 0;
  function stepFrame(frameDt: number) {
    if (legacyMotion) { update(frameDt, clock.elapsedTime); interpOn = false; return; }
    if (simT === 0) { simT = clock.elapsedTime; acc = FIXED; } // first frame always simulates once (state/sky applied immediately)
    acc += frameDt; let n = 0;
    while (acc >= FIXED && n < 7) { ipP0.copy(player.root.position); ipR0 = player.root.rotation.y; ipC0.copy(camera.position); ipQ0.copy(camera.quaternion); simT += FIXED; update(FIXED, simT); acc -= FIXED; n++; }
    if (n === 7) acc = Math.min(acc, FIXED);
    ipP1.copy(player.root.position); ipR1 = player.root.rotation.y; ipC1.copy(camera.position); ipQ1.copy(camera.quaternion);
    const a = acc / FIXED; interpOn = true;
    if (ipP0.distanceToSquared(ipP1) > 9 || ipC0.distanceToSquared(ipC1) > 9 || cine || dawnCine) return; // teleports/cinematics: no blend
    player.root.position.lerpVectors(ipP0, ipP1, a); let dr = ipR1 - ipR0; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); player.root.rotation.y = ipR0 + dr * a;
    camera.position.lerpVectors(ipC0, ipC1, a); camera.quaternion.slerpQuaternions(ipQ0, ipQ1, a);
  }
  function unInterp() { if (!interpOn) return; player.root.position.copy(ipP1); player.root.rotation.y = ipR1; camera.position.copy(ipC1); camera.quaternion.copy(ipQ1); interpOn = false; }
  function frame(ts?: number) {
    renderer.info.reset();
    const cd = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
    let dt = cd; if (!legacyMotion && ts !== undefined) { dt = lastTs < 0 ? cd : Math.max(0, Math.min(0.1, (ts - lastTs) / 1000)); lastTs = ts; }
    if (!paused) stepFrame(dt); else if (!mapEl.hidden) { mapT -= dt; if (mapT <= 0) { mapT = 0.12; drawMap(t); } }
    if (rec) recFrame(dt);
    if (composer) composer.render(); else renderer.render(inCave && cave ? cave.scene : inCoast && coast ? coast.scene : scene, camera);
    unInterp();
    frames++; totalFrames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; adaptQuality(fpsT); frames = 0; fpsT = 0; if (fpsOn) fpsEl.textContent = `${fps.toFixed(0)} fps · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris · ${quality}${aqLevel ? ` · aq${aqLevel}` : ''}`; }
  }
  renderer.setAnimationLoop(frame);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight); gtao?.setSize(innerWidth, innerHeight);
  });

  // ---------- QA / screenshot hooks ----------
  const api = {
    get ready() { return !fading && !caveLoading; }, errors, quality,
    get fps() { return fps; },
    get frames() { return totalFrames; },
    get tris() { return renderer.info.render.triangles; },
    framing() {
      const p = player.root.position; const top = new THREE.Vector3(p.x, p.y + 1.68, p.z).project(camera), bot = p.clone().project(camera);
      return Math.abs(top.y - bot.y) / 2;
    },
    preset(name: string): Promise<void> | void {
      snapCam = true;
      if (name.startsWith('haze-')) { const yaw = { n: 0, e: -Math.PI / 2, s: Math.PI, w: Math.PI / 2 }[name.slice(5) as 'n' | 'e' | 's' | 'w'] ?? 0; state.px = SPAWN.x; state.pz = SPAWN.z; state.yaw = yaw; state.facing = yaw + Math.PI; state.pitch = 0.06; state.dist = 7; }
      if (name === 'spawn-wide') { state.px = SPAWN.x; state.pz = SPAWN.z; state.facing = Math.PI + 0.25; state.yaw = Math.PI + 0.32; state.pitch = 0.16; state.dist = 7.4; }
      if (name === 'ilka-close') { state.px = SPAWN.x + 1; state.pz = SPAWN.z - 2; state.facing = 0.6; state.yaw = 0.25; state.pitch = 0.1; state.dist = 3.6; }
      if (name === 'creek') { state.pz = -14; state.px = creekX(-14) + 8; state.facing = -Math.PI / 2; state.yaw = Math.PI / 2 - 0.35; state.pitch = 0.22; state.dist = 6.5; }
      if (name === 'island') { const dx = ISLAND_POS.x - SPAWN.x, dz = ISLAND_POS.z - SPAWN.z; state.px = SPAWN.x; state.pz = SPAWN.z; state.facing = Math.atan2(dx, dz); state.yaw = Math.atan2(-dx, -dz) + 0.1; state.pitch = -0.12; state.dist = 6.2; }
      if (name === 'spawn') { state.px = SPAWN.x; state.pz = SPAWN.z; state.facing = Math.PI; state.yaw = 0; state.pitch = 0.1; state.dist = 7.4; }
      if (name === 'landmark') { const l = LANDMARKS[0]; const dx = SPAWN.x - l.x, dz = SPAWN.z - l.z, d = Math.hypot(dx, dz); state.px = l.x + dx / d * 44; state.pz = l.z + dz / d * 44; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + 0.12; state.pitch = -0.1; state.dist = 6.5; }
      if (name === 'dialog') { state.px = WAYFINDER.x + 0.6; state.pz = WAYFINDER.z + 2.4; state.facing = Math.PI; state.yaw = 0.55; state.pitch = 0.12; state.dist = 4.6; }
      if (name === 'seal') { const d = SEALS[0]; state.px = d.x + 1.9; state.pz = d.z + 1.9; state.facing = Math.atan2(-1.9, -1.9); state.yaw = Math.PI / 4 + 0.15; state.pitch = 0.05; state.dist = 12; }
      if (name === 'shrine' || name === 'shrine-awake') { state.px = TABLET.x + 2.2; state.pz = TABLET.z + 13; state.facing = Math.PI; state.yaw = 0.16; state.pitch = 0.06; state.dist = 12; }
      if (name === 'warden' || name === 'warden-windup') { const dx = SPAWN.x - WARDEN.x, dz = SPAWN.z - WARDEN.z, d = Math.hypot(dx, dz), off = name === 'warden' ? 7 : 3; state.px = WARDEN.x + dx / d * off + (name === 'warden' ? 1.5 : 0); state.pz = WARDEN.z + dz / d * off; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + (name === 'warden' ? 0.35 : 0.3); state.pitch = name === 'warden' ? 0.12 : 0.02; state.dist = name === 'warden' ? 7 : 8.5; wd.freeze = name === 'warden' ? 0 : 0.7; wd.awake = true; wd.warned = true; }
      if (name === 'warden-defeated') { save.warden = true; save.xp = 40; wd.phase = 3; const dx = SPAWN.x - WARDEN.x, dz = SPAWN.z - WARDEN.z, d = Math.hypot(dx, dz); state.px = WARDEN.x + dx / d * 5 + 1.2; state.pz = WARDEN.z + dz / d * 5; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + 0.4; state.pitch = 0.15; state.dist = 6.5; }
      if (name === 'beam') { save = { v: 1, started: true, done: false, xp: 75, seals: { dawn: true, sun: true, tide: true }, runes: [0, 0, 0], wind: false, warden: false, mirrors: [0, 0, 0, 0], beacon: false, echo: false, charted: [false, false, false, false, false, false, false], cave: 0, coast: 0 }; for (const o of seals) if (save.seals[o.def.id]) o.claim(); const d = SEALS.find((x) => x.id === 'forge')!; state.px = d.x + 1.9; state.pz = d.z + 1.9; state.facing = Math.atan2(-1.9, -1.9); state.yaw = Math.PI / 4; state.pitch = 0.12; state.dist = 7; }
      if (name === 'sunspire' || name === 'dome' || name === 'veilfall') { const l = LANDMARKS.find((x) => x.id === name)!; const rot = name === 'sunspire' ? 0.55 : name === 'veilfall' ? -0.3 : 0, dx0 = SPAWN.x - l.x, dz0 = SPAWN.z - l.z, dx = dx0 * Math.cos(rot) + dz0 * Math.sin(rot), dz = -dx0 * Math.sin(rot) + dz0 * Math.cos(rot), d = Math.hypot(dx, dz), off = name === 'dome' ? 36 : name === 'veilfall' ? 40 : 40; state.px = l.x + dx / d * off; state.pz = l.z + dz / d * off; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + 0.1; state.pitch = name === 'dome' ? 0.02 : name === 'veilfall' ? -0.3 : -0.05; state.dist = 6.5; }
      if (name === 'run') { keys.KeyW = true; }
      const endgame = (beacon: boolean, mirrors: number[]) => { save = { v: 1, started: true, done: true, xp: beacon ? 335 : 255, seals: { dawn: true, sun: true, tide: true, forge: true }, runes: [1, 0, 2], wind: true, warden: true, mirrors: [...mirrors], beacon, echo: beacon, charted: Array(7).fill(true), cave: 0, coast: 0 }; for (const o of seals) o.claim(); island.light(true, true); updraft.setActive(true, true); island.solve(beacon); hollow.solve(beacon); mirrors.forEach((v, i) => hollow.setMirror(i, v)); };
      if (name === 'beacon-puzzle' || name === 'ending-card') {
        endgame(false, name === 'ending-card' ? MIRRORS.map((m) => m.solve) : [3, 0, 1, 1]); onIsland = true; island.group.updateMatrixWorld(true);
        const P = toWorld(BEACON_L.x + 3.5, BEACON_L.z + 8.2), B = toWorld(BEACON_L.x, BEACON_L.z);
        state.px = P.x; state.pz = P.z; state.facing = Math.atan2(B.x - P.x, B.z - P.z); state.yaw = state.facing + Math.PI + 0.2; state.pitch = 0.42; state.dist = 7.5;
      }
      if (name === 'dawn') { endgame(true, MIRRORS.map((m) => m.solve)); const dx = ISLAND_POS.x - SPAWN.x, dz = ISLAND_POS.z - SPAWN.z; state.px = SPAWN.x - 4; state.pz = SPAWN.z - 6; state.facing = Math.atan2(dx, dz) - 0.2; state.yaw = Math.atan2(-dx, -dz) + 0.06; state.pitch = innerHeight > innerWidth ? -0.2 : -0.1; state.dist = innerHeight > innerWidth ? 7.4 : 6.4; }
      if (name === 'flight') { endgame(false, [0, 0, 0, 0]); state.px = UPDRAFT.x; state.pz = UPDRAFT.z + 2; snapCam = true; player.root.position.set(state.px, heightAt(state.px, state.pz), state.pz); beginLift(false); lift!.hold = 2.3; state.dist = 6; }
      if (name === 'echo-grove') { save = { v: 1, started: true, done: false, xp: 50, seals: { dawn: true, tide: true }, runes: [0, 0, 0], wind: false, warden: false, mirrors: [0, 0, 0, 0], beacon: false, echo: false, charted: [false, false, false, false, false, false, false], cave: 0, coast: 0 }; for (const o of seals) if (save.seals[o.def.id]) o.claim(); state.px = ECHO.x - 3; state.pz = ECHO.z + 15; state.facing = Math.PI; state.yaw = 0.15; state.pitch = 0.12; state.dist = 7; }
      if (name === 'warden-hit') { const dx = SPAWN.x - WARDEN.x, dz = SPAWN.z - WARDEN.z, d = Math.hypot(dx, dz); state.px = WARDEN.x + dx / d * 2.6; state.pz = WARDEN.z + dz / d * 2.6; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + 0.9; state.pitch = 0.08; state.dist = 5.2; wd.freeze = 0; wd.awake = true; wd.warned = true; }
      if (name === 'cave-entrance' || name === 'cave-interior' || name === 'cave-discovery' || name === 'cave-puzzle') {
        endgame(true, MIRRORS.map((m) => m.solve)); save.cave = name === 'cave-entrance' ? 1 : name === 'cave-discovery' ? 3 : 2; stair.setLit(true);
        state.px = stair.mouth.x + STAIR_DIR.x * 0.9 - STAIR_DIR.z * 2.6; state.pz = stair.mouth.z + STAIR_DIR.z * 0.9 + STAIR_DIR.x * 2.6; state.facing = Math.atan2(STAIR_DIR.x, STAIR_DIR.z) + 0.9; state.yaw = Math.atan2(-STAIR_DIR.x, -STAIR_DIR.z) + 0.95; state.pitch = 0.42; state.dist = 6.0;
        if (name !== 'cave-entrance') return (async () => { await enterCave(true); const c = cave!;
          if (name === 'cave-interior') { state.px = c.entry.x + 0.3; state.pz = c.entry.z - 1.8; state.yaw = -0.06; state.pitch = 0.14; state.dist = 4.6; lightBrazier(2); }
          if (name === 'cave-puzzle') { state.px = c.braziers[1].x + 0.4; state.pz = c.braziers[1].z + 3.2; state.yaw = 0.1; state.pitch = 0.2; state.dist = 4.5; lightBrazier(2); lightBrazier(0); }
          if (name === 'cave-discovery') { state.px = c.carving.x - 0.55; state.pz = c.carving.z + 0.7; state.facing = Math.PI - 0.25; state.yaw = 0.02; state.pitch = 0.12; state.dist = 2.5; for (let i = 0; i < 90; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); readCarving(); }
          snapCam = true; for (let i = 0; i < 40; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); })();
      }
      if (name === 'coast' || name === 'tide-low' || name === 'sea-cave-mouth' || name === 'coast-tide-high') {
        endgame(true, MIRRORS.map((m) => m.solve)); save.cave = 4; save.coast = name === 'coast' || name === 'coast-tide-high' ? 1 : 2; save.xp = 375;
        return (async () => { await enterCoast(true); const c = coast!;
          const look = (fx: number, fz: number, tx: number, tz: number, pitch: number, dist: number, side = 0) => { state.px = fx; state.pz = fz; const a = Math.atan2(tx - fx, tz - fz); state.facing = a; state.yaw = a + Math.PI + side; state.pitch = pitch; state.dist = dist; };
          if (name === 'coast' || name === 'coast-tide-high') look(c.pathStart.x + 7, c.pathStart.z - 9, -58 + COAST_O.x, -14 + COAST_O.z, 0.2, 10, -0.2);
          if (name === 'tide-low') look(c.pathStart.x + 2.5, c.pathStart.z - 3.5, c.caveMouth.x, c.caveMouth.z, 0.2, 7.5, 0.25);
          if (name === 'sea-cave-mouth') look(c.caveMouth.x + 1.2, c.caveMouth.z - 0.6, c.caveMouth.x - 8, c.caveMouth.z, 0.14, 7.5, 0.3);
          snapCam = true; for (let i = 0; i < 40; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); if (name === 'coast') { for (let i = 0; i < 360 && !c.isLow(); i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); } })();
      }
      if (name === 'grove-bases') { save.echo = true; for (let i = 0; i < 5; i++) grove.light(i); grove.memory(true, true); const a = 0.3 + Math.PI * 2 / 5; const tx = ECHO.x + Math.cos(a) * 10, tz = ECHO.z + Math.sin(a) * 10; state.px = tx + 3.2; state.pz = tz + 2.2; state.facing = Math.atan2(tx - state.px, tz - state.pz); state.yaw = state.facing + Math.PI - 0.5; state.pitch = 0.32; state.dist = 4.2; }
      if (name === 'journal-charting') { save = { v: 1, started: true, done: true, xp: 215, seals: { dawn: true, sun: true, tide: true, forge: true }, runes: [1, 0, 2], wind: true, warden: false, mirrors: [0, 0, 0, 0], beacon: false, echo: true, charted: [true, true, false, true, false, true, true], cave: 0, coast: 0 }; for (const o of seals) o.claim(); }
      if (name === 'journal' || name === 'map') { save = { v: 1, started: true, done: false, xp: 85, seals: { dawn: true, tide: true }, runes: [1, 0, 2], wind: true, warden: false, mirrors: [0, 0, 0, 0], beacon: false, echo: false, charted: [false, false, false, false, false, false, false], cave: 0, coast: 0 }; for (const o of seals) if (save.seals[o.def.id]) o.claim(); state.px = SHRINE.x + 22; state.pz = SHRINE.z + 10; state.facing = 2.4; state.yaw = 2.4 + Math.PI; }
      camera.position.set(state.px, 50, state.pz); for (let i = 0; i < 90; i++) update(1 / 30, clock.elapsedTime + i / 30);
      if (name === 'dialog') { save = { v: 1, started: false, done: false, xp: 0, seals: {}, runes: [0, 0, 0], wind: false, warden: false, mirrors: [0, 0, 0, 0], beacon: false, echo: false, charted: [false, false, false, false, false, false, false], cave: 0, coast: 0 }; interact(); }
      if (name === 'warden-windup') { wd.sx = state.px + 0.6; wd.sz = state.pz; warden.placeZone(wd.sx, wd.sz); wd.phase = 1; wd.teleT = W_TELE * 0.3; toast('⚠ Warden winds up — move!', 60, true); }
      if (name === 'shrine-awake') { save.runes = [1, 0, 2]; save.wind = true; for (let i = 0; i < 3; i++) shrine.setRune(i, save.runes[i], false); shrine.awaken(true); for (let i = 0; i < 60; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); }
      if (name === 'beam') { interact(); for (let i = 0; i < 50; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); if (cine) cine.hold = cine.dur * 0.6; for (let i = 0; i < 130; i++) update(1 / 30, clock.elapsedTime + 5 + i / 30); }
      if (name === 'ending-card') { for (let i = 0; i < 330 && endEl.hidden; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); }
      if (name === 'journal' || name === 'map') openSheet(name);
      if (name === 'journal-charting') openSheet('journal');
      if (name === 'echo-grove') { useEcho(); for (let i = 0; i < 70; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); while (talking) advance(); for (let i = 0; i < 40; i++) update(1 / 30, clock.elapsedTime + 6 + i / 30); toastEl.classList.remove('on'); }
      if (name === 'warden-hit') { wd.freeze = -1; attackWarden(); for (let i = 0; i < 4; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); wd.freeze = 0; wd.phase = 0; swingFreeze = true; warden.hit(true); toast('Hit! Warden 2/3', 60); }
      if (name === 'seal') { save.started = true; interact(); for (let i = 0; i < 60; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); hudT = 0; updateHud(0); }
    },
    key(code: string, down: boolean) { keys[code] = down; },
    get profile() { return profile; },
    get creating() { return creating; },
    talkLine() { return say('Wayfinder', LINES.wayfinder.greet, profile); },
    /** Phone-condition simulation through the real frame path (minus GPU): f = [vsync dt, callback-measured dt, stickX, stickY]. */
    simFrames(fr: number[][]) { const id = stick.id; stick.id = 999; rec = []; for (const [vd, md, sx, sy] of fr) { stick.x = sx; stick.y = sy; stepFrame(legacyMotion ? md : vd); recFrame(vd); unInterp(); } stick.id = id; stick.x = stick.y = 0; const r = rec; rec = null; return r; },
    setLegacyMotion(on: boolean) { legacyMotion = on; stickF.x = stickF.y = 0; acc = 0; },
    recStart() { rec = [];}, recStop() { const r = rec; rec = null; return r; },
    /** Deterministic stepping: run update() with a given dt sequence while holding the stick at (sx, sy); returns recorder rows. */
    sim(dts: number[], sx: number, sy: number) { const id = stick.id; stick.id = 999; stick.x = sx; stick.y = sy; rec = []; let t = clock.elapsedTime; for (const d of dts) { t += d; const t0 = performance.now(); update(d, t); const t1 = performance.now(); recFrame(d); rec![rec!.length - 1].push(t1 - t0); } stick.id = id; stick.x = stick.y = 0; const r = rec; rec = null; return r; },
    warp(x: number, z: number) { state.px = x; state.pz = z; snapCam = true; },
    interact() { interact(); },
    advance() { if (talking) advance(); },
    runes: RUNES.map((r) => ({ x: r.x, z: r.z })), tablet: TABLET, speedMul: () => (save.wind ? WIND_BLESS : 1),
    beacon: () => { island.group.updateMatrixWorld(true); const w = (lx: number, lz: number) => { const v = toWorld(lx, lz); return { x: v.x, z: v.z }; };
      return { updraft: UPDRAFT, onIsland, lift: !!lift, mirrors: [...save.mirrors], solve: MIRRORS.map((m) => m.solve), beacon: save.beacon, dawn: dawnK, cine: !!dawnCine, ending: !endEl.hidden, endingText: endEl.innerText,
        mirrorW: MIRRORS.map((m) => w(BEACON_L.x + m.dx + (BEACON_L.x + m.dx > BEACON_L.x ? 0 : 0), BEACON_L.z + m.dz)), clueW: w(CLUE_L.x, CLUE_L.z), returnW: w(RETURN_L.x, RETURN_L.z), beamColor: '#' + sun.color.getHexString() }; },
    echo: () => ({ x: ECHO.x, z: ECHO.z, done: save.echo, active: echoT >= 0, charted: [...save.charted], marks: MARR_MARKS.map((m) => ({ name: m.name, x: m.x, z: m.z })) }),
    coast: () => ({ stage: save.coast, inCoast, tide: coast?.tide() ?? null, phase: coast?.tidePhase ?? null, low: coast?.isLow() ?? null, revealed: !!coast?.revealed, rise: coast?.rise ?? 0, passage: cave?.passage, shrine: coast?.shrine, caveMouth: coast?.caveMouth, pathStart: coast?.pathStart, tunnel: coast?.tunnel, aq: aqLevel }),
    cave: () => ({ stage: save.cave, inCave, fading, mouth: stair.mouth, stair: STAIR, lit: [...litOrder], door: !!cave?.doorOpen, entry: cave?.entry, exit: cave?.exit, braziers: cave?.braziers, carving: cave?.carving, doorAt: cave?.door, order: RIVER_ORDER, names: BRAZIERS.map((b) => b.name) }),
    sheets: () => ({ journal: !jEl.hidden, map: !mapEl.hidden, paused, journalText: jEl.innerText }),
    warden: () => ({ x: WARDEN.x, z: WARDEN.z, hp: wd.hp, phase: wd.phase, awake: wd.awake, playerHp, atkCd, recovery: recoveryPoint(), melee: W_MELEE }),
    quest() { return { save: JSON.parse(JSON.stringify(save)), talking, cine: !!cine, dlg: talking ? dtxt.textContent : '', chapter: !chapterEl.hidden, near: nearestInteract()?.label ?? null, seals: seals.map((o) => ({ id: o.def.id, x: o.def.x, z: o.def.z, claimed: o.claimed })), wayfinder: { x: WAYFINDER.x, z: WAYFINDER.z } }; },
    debug: { scene, camera, renderer, get composer() { return composer; }, get aq() { return { level: aqLevel, low: aqLow, warm: aqWarm, on: aqOn, fps, paused, fading, talking }; }, get player() { return player.root; }, wayfinder: wayfinder.root },
  };
  (window as unknown as { __vale: typeof api }).__vale = api;
  document.getElementById('loading')!.remove();
  const shot = params.get('shot');
  if (shot?.startsWith('create-')) openCreate(shot === 'create-male' ? 'male' : 'female', shot === 'create-male' ? 'Aren' : 'Ilka');
  else if (shot) await api.preset(shot);
  else if (!hasProfile()) openCreate();
  else if ((() => { try { const f = sessionStorage.getItem('vale3d-newchar'); sessionStorage.removeItem('vale3d-newchar'); return !!f; } catch { return false; } })()) openCreate();
}

// ---------- helpers ----------
const PROFILE_KEY = 'vale3d-hero';
/** Letters (any script), digits, spaces, apostrophes and hyphens; collapsed, trimmed, max 16; falls back to Ilka. */
function sanitizeName(raw: string): string {
  const s = raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 16).join('').trim() || 'Ilka';
}
function hasProfile(): boolean { try { return !!localStorage.getItem(PROFILE_KEY); } catch { return false; } }
function loadProfile(): Profile {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); if (p && (p.sex === 'female' || p.sex === 'male')) return { name: sanitizeName(String(p.name ?? '')), sex: p.sex }; } catch { /* ignore */ }
  return { name: 'Ilka', sex: 'female' };
}
function saveProfile(p: Profile) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
const SOLIDS: { x: number; z: number; r: number }[] = [{ x: WAYFINDER.x, z: WAYFINDER.z, r: 0.7 }, { x: SHRINE.x, z: SHRINE.z, r: 5.2 }];

function makeCharacter(g: GLTF, s: number, colors: Record<string, string>, hide: string[]) {
  const root = SkeletonUtils.clone(g.scene) as THREE.Object3D;
  // Skinned bounds can't be read from node transforms (armature is ×100), so the bind-pose height is passed in.
  root.scale.setScalar(s);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mn = (m.material as THREE.Material).name;
    if (hide.some((h) => (h.startsWith('mat:') ? mn === h.slice(4) : m.name.startsWith(h)))) { m.visible = false; return; }
    m.castShadow = true; m.receiveShadow = true;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mm) => {
      const c = (mm as THREE.MeshStandardMaterial).clone();
      const base = m.name.replace(/_\d+$/, '');
      const key = Object.keys(colors).find((k) => k === `${base}/${c.name}`) ?? Object.keys(colors).find((k) => c.name === k);
      if (key) c.color.set(colors[key]);
      c.roughness = c.name === 'Eye' ? 0.2 : c.name === 'Gold' ? 0.35 : 0.78; c.metalness = c.name === 'Gold' ? 0.8 : 0; c.envMapIntensity = 0.9;
      if (c.name !== 'Eye') addRimFill(c, { fill: 0.16, rim: 0.32 });
      return c;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
  const wrap = new THREE.Group(); wrap.add(root);
  // Procedural overlays on top of the clips: airborne pose (arms out, legs trailing) and an attack swing.
  const bone = (n: string) => root.getObjectByName(n) ?? root.getObjectByName(n.replace('.', '')) ?? null;
  const PB = { hips: bone('Hips'), uaL: bone('UpperArm.L'), uaR: bone('UpperArm.R'), laL: bone('LowerArm.L'), laR: bone('LowerArm.R'), ulL: bone('UpperLeg.L'), ulR: bone('UpperLeg.R'), llL: bone('LowerLeg.L'), llR: bone('LowerLeg.R'), chest: bone('Chest') };
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qw = new THREE.Quaternion(), axv = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  /** Rotate a bone about an axis given in character space (+X left, +Y up, +Z forward). */
  const rotC = (b: THREE.Object3D | null, axis: THREE.Vector3, ang: number) => {
    if (!b || !b.parent || Math.abs(ang) < 1e-4) return;
    wrap.getWorldQuaternion(qw); b.parent.getWorldQuaternion(qp);
    axv.copy(axis).applyQuaternion(qw).applyQuaternion(qp.invert()).normalize(); qa.setFromAxisAngle(axv, ang); b.quaternion.premultiply(qa);
  };
  const pose = { fly: 0, swing: 0 }; let poseT = 0;
  function applyPose(dt: number) {
    poseT += dt; const f = pose.fly, s = pose.swing;
    if (f > 0.01) {
      const flap = Math.sin(poseT * 2.2) * 0.12;
      rotC(PB.hips, X, 0.5 * f);
      rotC(PB.uaL, Z, (1.25 + flap) * f); rotC(PB.uaR, Z, -(1.25 + flap) * f); rotC(PB.laL, Z, 0.2 * f); rotC(PB.laR, Z, -0.2 * f);
      rotC(PB.ulL, X, (0.35 + Math.sin(poseT * 1.7) * 0.06) * f); rotC(PB.ulR, X, (0.45 - Math.sin(poseT * 1.7) * 0.06) * f);
      rotC(PB.llL, X, 0.55 * f); rotC(PB.llR, X, 0.4 * f);
    }
    if (s > 0 && s < 1) {
      // Wind up high, then slash down and across.
      const up = s < 0.35 ? s / 0.35 : 1 - (s - 0.35) / 0.65, strike = s < 0.35 ? 0 : Math.sin(Math.PI * (s - 0.35) / 0.65);
      rotC(PB.chest, Y, 0.35 * up - 0.45 * strike);
      rotC(PB.uaR, X, -2.3 * up - 1.0 * strike); rotC(PB.uaR, Z, -0.35 * strike);
      rotC(PB.hips, X, 0.18 * strike);
    }
  }
  const mixer = new THREE.AnimationMixer(root);
  const clip = (n: string) => g.animations.find((a) => a.name.endsWith('|' + n) || a.name === n);
  const idle = mixer.clipAction(clip('Idle')!), walk = mixer.clipAction(clip('Walk')!), run = mixer.clipAction(clip('Run')!);
  const once = new Map<string, THREE.AnimationAction>();
  for (const a of [idle, walk, run]) { a.play(); a.setEffectiveWeight(0); }
  idle.setEffectiveWeight(1);
  let waving = 0;
  mixer.addEventListener('finished', () => { waving = 0; });
  return {
    root: wrap,
    play(n: string) { const c = clip(n); if (!c) return; let a = once.get(n); if (!a) { a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; once.set(n, a); } for (const o of once.values()) if (o !== a) o.stop(); a.reset().play(); a.setEffectiveWeight(1); waving = 1; },
    setSpeed(v: number, dt: number) {
      // Blend idle → walk (≈1.9 m/s) → run (≈5.6 m/s) by speed; time-scale to keep feet planted.
      const wWalk = smoothstep(0.05, 1.6, v) * (1 - smoothstep(2.4, 4.6, v)), wRun = smoothstep(2.4, 4.6, v), wIdle = Math.max(0, 1 - wWalk - wRun);
      idle.setEffectiveWeight(wIdle * (waving ? 0.2 : 1)); walk.setEffectiveWeight(wWalk); run.setEffectiveWeight(wRun);
      walk.timeScale = THREE.MathUtils.clamp(v / 1.9, 0.6, 1.6); run.timeScale = THREE.MathUtils.clamp(v / 5.6, 0.75, 1.25);
      mixer.update(dt); applyPose(dt);
    },
    pose,
  };
}

function makeCreek(normals: THREE.Texture) {
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  const zs: number[] = []; for (let z = -170; z <= 170; z += 1.5) zs.push(z);
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  zs.forEach((z, i) => {
    const c = creekX(z), w = creekHalf(z) + 1.4;
    pos.push(c - w, -z, 0, c + w, -z, 0); uv.push(0, z / 8, 1, z / 8);
    if (i < zs.length - 1) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } // CCW seen from above after the -90° X rotation
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  if (HIGH) {
    const w = new Water(geo, { textureWidth: 512, textureHeight: 512, waterNormals: normals, sunDirection: SUN_DIR.clone(), sunColor: 0xfff1d6, waterColor: 0x1f4a4c, distortionScale: 1.2, fog: true, alpha: 0.92 });
    w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y;
    const wm = w.material as THREE.ShaderMaterial; const u = wm.uniforms; u.size.value = 3.2;
    // Deeper teal body colour; Fresnel-weighted sky reflection (stock Water reads as grey under a hazy sky).
    // Dawn: the reflection and body colour lean toward the sunrise sky (the mirror pass can't see the far sky shell).
    u.uDawn = { value: 0 };
    wm.fragmentShader = 'uniform float uDawn;\n' + wm.fragmentShader.replace(/vec3 albedo = mix\([^;]*;/, 'vec3 albedo = mix( mix( waterColor, vec3( 0.22, 0.13, 0.14 ), uDawn * 0.6 ) * ( 0.55 + 0.35 * diffuseLight.r ) + scatter * 0.5, reflectionSample * mix( vec3( 0.72, 0.86, 0.88 ), vec3( 1.18, 0.76, 0.62 ), uDawn ) + specularLight, clamp( reflectance * 1.4 + 0.12 + uDawn * 0.12, 0.0, 0.78 ) );');
    return { mesh: w as THREE.Object3D, update: (t: number) => { u.time.value = t * 0.6; }, setDawn: (k: number) => { u.uDawn.value = k; } };
  }
  normals.repeat.set(1, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#21424a', roughness: 0.06, metalness: 0.0, normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88, envMapIntensity: 1.3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = WATER_Y;
  const wmat = m.material as THREE.MeshStandardMaterial, c0 = new THREE.Color('#21424a'), c1 = new THREE.Color('#5a3a3c');
  return { mesh: m as THREE.Object3D, update: (t: number) => { normals.offset.set(t * 0.01, -t * 0.05); }, setDawn: (k: number) => { wmat.color.copy(c0).lerp(c1, k); wmat.emissive.setRGB(0.16 * k, 0.07 * k, 0.04 * k); } };
}

function prep(g: GLTF, cast = true): THREE.Object3D {
  g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; const mat = m.material as THREE.MeshStandardMaterial; if (mat.map) mat.map.anisotropy = 4; if (mat.alphaTest === 0 && mat.transparent) { mat.alphaTest = 0.4; mat.transparent = false; } } });
  return g.scene;
}
function okSpot(x: number, z: number, clearPath = 2.2, clearCreek = 2): boolean {
  if (pathMask(x, z) > 0.05 || Math.abs(x - creekX(z)) < creekHalf(z) + clearCreek) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6 || Math.hypot(x - SPAWN.x, z - SPAWN.z - 6) < 6 || Math.hypot(x - WAYFINDER.x, z - WAYFINDER.z) < 3 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < 20) return false;
  for (const l of LANDMARKS) if (Math.hypot(x - l.x, z - l.z) < l.r * (l.id === 'veilfall' ? 1.7 : 1.25)) return false;
  for (const d of SEALS) if (Math.hypot(x - d.x, z - d.z) < 7) return false;
  if (Math.hypot(x - WARDEN.x, z - WARDEN.z) < 14 || Math.hypot(x - UPDRAFT.x, z - UPDRAFT.z) < 9 || Math.hypot(x - ECHO.x, z - ECHO.z) < 16) return false;
  void clearPath; return true;
}
function place(src: THREE.Object3D, x: number, z: number, s: number, ry: number, sink = 0.05) {
  const o = src.clone(true); o.position.set(x, heightAt(x, z) - sink * s, z); o.rotation.y = ry; o.scale.setScalar(s); scene.add(o); return o;
}
function scatter(trees: Kind[], plants: Kind[], rocksG: GLTF, boulderG: GLTF, shrubG: GLTF, fernG: GLTF) {
  const r = rng(42);
  const boulder = prep(boulderG), shrub = prep(shrubG, false), fern = prep(fernG, false);
  const rockParts: THREE.Object3D[] = []; prep(rocksG).traverse((o) => { if ((o as THREE.Mesh).isMesh) rockParts.push(o); });
  // ---- Trees (instanced): hero trees near the path, groves/tree lines mid-distance, pines up the mountain flanks. ----
  const treeList: TreeInst[] = [];
  const TARGET_H = [7.5, 8, 7.5, 7.2, 8, 9, 8.5, 9.5, 9.5];
  const addTree = (k: number, x: number, z: number, s: number, autumn: boolean) => {
    s *= TARGET_H[k] / trees[k].height; if (k >= 7) autumn = true; // twisted trees carry the gold/amber canopy
    const y = heightAt(x, z) - 0.15; const d = Math.hypot(x - SPAWN.x, z - SPAWN.z);
    treeList.push({ k, autumn, x, y, z, s, ry: r() * 6.28 });
    if (d < 60) SOLIDS.push({ x, z, r: 0.55 * s });
  };
  const broad = [0, 1, 2, 3, 4], pines = [5, 6], twisted = [7, 8];
  const pick = (a: number[]) => a[Math.floor(r() * a.length)];
  // Hero trees framing the meadow (one golden tree by the Wayfinder).
  const hero: [number, number, number, boolean][] = [[13, -5, 0, false], [17, 4, 7, false], [-11, -13, 2, true], [9, -36, 8, true], [24, -21, 3, false], [-27, 9, 1, false], [8.5, -4, 4, true], [-19, -30, 7, false], [-44, -36, 2, true], [30, 12, 0, false]];
  for (const [x, z, k, au] of hero) if (okSpot(x, z)) addTree(k, x, z, 0.95 + r() * 0.3, au);
  // Groves: clumps of 6–14 trees in a ring 38–140 m out; ~1 in 4 groves turns autumn-gold.
  for (let c = 0; c < (HIGH ? 38 : 22); c++) {
    const a = r() * Math.PI * 2, d = 38 + r() * 150, cx = Math.cos(a) * d, cz = Math.sin(a) * d - 10;
    const autumnGrove = r() < 0.22, n = 6 + Math.floor(r() * (HIGH ? 9 : 5)), kindSet = r() < 0.12 ? twisted : broad;
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 22, z = cz + (r() - 0.5) * 16;
      if (!okSpot(x, z) || normalAt(x, z)[1] < 0.8 || Math.hypot(x, z) < 22) continue;
      addTree(pick(kindSet), x, z, 0.85 + r() * 0.55, autumnGrove ? r() < 0.85 : r() < 0.08);
    }
  }
  // Pines on the lower mountain slopes.
  for (let i = 0; i < (HIGH ? 220 : 110); i++) {
    const a = r() * Math.PI * 2, d = 150 + r() * 95, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (heightAt(x, z) > 40 || normalAt(x, z)[1] < 0.72 || !okSpot(x, z)) continue;
    addTree(pick(pines), x, z, 1.0 + r() * 0.7, r() < 0.06);
  }
  // Distance LOD: full meshes near the player under a triangle budget (~400k High / 120k Lite), impostor cards beyond.
  const field = new TreeField(renderer, trees, treeList, SUN_DIR, { nearR: HIGH ? 52 : 38, triBudget: HIGH ? 300000 : 120000, shadowR: 0 });
  scene.add(field.group); field.update(SPAWN.x, SPAWN.z, true);

  // ---- Meadow flora: clover carpets and wildflower patches near the path (instanced). ----
  const flora: number[][][] = plants.map(() => []);
  for (let i = 0; i < (HIGH ? 1400 : 600); i++) {
    // Patchy: pick a patch centre, then scatter tightly around it.
    const a = r() * Math.PI * 2, d = 3 + Math.sqrt(r()) * 55, px = Math.cos(a) * d, pz = Math.sin(a) * d - 12;
    const kindRoll = r(); const k = kindRoll < 0.45 ? (r() < 0.5 ? 0 : 1) : kindRoll < 0.8 ? (r() < 0.5 ? 2 : 3) : kindRoll < 0.95 ? 4 : 5;
    for (let j = 0; j < 3; j++) {
      const x = px + (r() - 0.5) * 2.5, z = pz + (r() - 0.5) * 2.5;
      if (pathMask(x, z) > 0.15 || Math.abs(x - creekX(z)) < creekHalf(z) + 0.8 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < 18) continue;
      const s = k <= 1 ? 0.16 + r() * 0.1 : k === 5 ? 0.35 + r() * 0.2 : 0.14 + r() * 0.08;
      flora[k].push([x, heightAt(x, z) - 0.02, z, s, r() * 6.28]);
    }
  }
  // Flora triangle budget: keep the nearest patches (to spawn) within ~250k High / 60k Lite triangles.
  let floraTris = 0; const floraBudget = HIGH ? 250000 : 60000;
  const floraAll = flora.flatMap((l, k) => l.map((t) => ({ k, t, d: Math.hypot(t[0] - SPAWN.x, t[2] - SPAWN.z) }))).sort((a, b) => a.d - b.d);
  const keep: number[][][] = plants.map(() => []);
  for (const f of floraAll) { const tr = kindTris(plants[f.k]); if (floraTris + tr > floraBudget) continue; floraTris += tr; keep[f.k].push(f.t); }
  // Small flora sits on layer 1 too: skipped by the water mirror and the AO pass.
  plants.forEach((k, i) => { if (keep[i].length) { const o = instanceKind(k, keep[i], { shadows: false }); o.traverse((c) => c.layers.set(1)); scene.add(o); } });
  return field;
  // ---- Rocks, boulders, shrubs, ferns (Poly Haven scans). ----
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 10 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d - 10; if (!okSpot(x, z)) continue; const p = rockParts[i % rockParts.length]; const o = place(p, x, z, 1.4 + r() * 2.2, r() * 6.28, 0.25); o.rotation.x = (r() - 0.5) * 0.3; }
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 16 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d - 15; if (!okSpot(x, z)) continue; const s = 0.6 + r() * 0.9; place(boulder, x, z, s, r() * 6.28, 0.3); SOLIDS.push({ x, z, r: 1.4 * s }); }
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 8 + r() * 80, x = Math.cos(a) * d, z = Math.sin(a) * d - 8; if (!okSpot(x, z)) continue; place(shrub, x, z, 0.7 + r() * 0.8, r() * 6.28); }
  for (let i = 0; i < 90; i++) { const z = -90 + r() * 170, side = r() < 0.5 ? -1 : 1, x = creekX(z) + side * (creekHalf(z) + 1.2 + r() * 3.5); place(fern, x, z, 0.8 + r() * 0.9, r() * 6.28); }
}
function makeRift() {
  // Sky rift: a soft violet/teal glow tear in the north-east sky (additive, unaffected by fog).
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uFade;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv*2.-1.; float bend=.18*sin(p.x*2.6+.8)+.07*sin(p.x*7.+uTime*.2);
        float d=abs(p.y-bend); float fall=smoothstep(1.,.55,abs(p.x));
        float flick=.75+.25*n(vec2(p.x*6.+uTime*.4,uTime*.3));
        float core=exp(-d*d*900.)*fall*flick, halo=exp(-d*d*22.)*fall*(.55+.45*n(p*3.+uTime*.05));
        vec3 col=vec3(.62,.42,1.)*core*1.6+mix(vec3(.25,.75,.85),vec3(.55,.35,.9),smoothstep(-.6,.6,p.x))*halo*.38;
        gl_FragColor=vec4(col*uFade,1.);}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 140), m);
  mesh.position.set(260, 230, -520); mesh.lookAt(0, 20, 0); mesh.rotateZ(-0.22);
  mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
}

main().catch((e) => { errors.push(String(e?.stack || e)); const l = document.getElementById('loading'); if (l) l.textContent = 'Failed to load: ' + e; console.error(e); });

