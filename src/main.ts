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
import { makeFloatingIsland, makeLanternStaff, ISLAND_POS } from './island';
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
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = HIGH ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fogColor = new THREE.Color('#a8bfd2'); // cool blue atmospheric haze
scene.fog = new THREE.FogExp2(fogColor, HIGH ? 0.0034 : 0.0042);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1500);

const SUN_DIR = new THREE.Vector3(-0.45, 0.62, -0.64).normalize(); // late-morning sun ahead-left, backlighting the meadow
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
  scene.add(terrain);

  // Grass.
  // Grass LOD: a dense near disc of curved blades plus a sparse ring of simple wide blades further out.
  // (Lite keeps one mid-density disc of 2-segment blades: the sparse ring read as bare ground on small screens.)
  const grassField = makeGrass(HIGH ? 20000 : 15000, HIGH ? 20 : 22, HIGH ? 5 : 4, HIGH ? 3 : 2);
  const grassFar = makeGrass(HIGH ? 16000 : 1, HIGH ? 36 : 1, 3, 1, HIGH ? 18 : 0.5); grassFar.mesh.visible = HIGH;
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
  const handBone = wayfinder.root.getObjectByName('Wrist.R') ?? wayfinder.root; const handPos = new THREE.Vector3();

  // ---------- post ----------
  let composer: EffectComposer | null = null;
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
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.blendIntensity = 0.85;
    // Keep grass (layer 1) out of the AO normal/depth pass — it is the single largest triangle cost.
    const gRender = gtao.render.bind(gtao);
    // AO only matters up close: also pull the far plane in to 110 m for this pass so distant trees/landmarks are culled.
    const withFar = (far: number, fn: () => void) => { const f0 = camera.far; camera.far = far; camera.updateProjectionMatrix(); fn(); camera.far = f0; camera.updateProjectionMatrix(); };
    gtao.render = (...args: Parameters<GTAOPass['render']>) => { camera.layers.disable(1); water.mesh.visible = false; withFar(110, () => { gtao!.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); gRender(...args); }); camera.layers.enable(1); water.mesh.visible = true; };
    composer.addPass(gtao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.28, 0.6, 0.92));
    composer.addPass(new OutputPass());
    composer.addPass(vignette);
  }

  // ---------- player / camera state ----------
  const state = { yaw: Math.PI, pitch: 0.2, dist: 7.4, speed: 0, facing: Math.PI, px: SPAWN.x, pz: SPAWN.z };
  const keys: Record<string, boolean> = {};
  addEventListener('keydown', (e) => { if (creating || (e.target as HTMLElement).tagName === 'INPUT') return; keys[e.code] = true; if (e.code === 'KeyE') interact(); });
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
    if (save.done) return openDialog('Wayfinder', fillLines(WAYFINDER_LINES.after, profile));
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
    const dW = Math.hypot(state.px - WAYFINDER.x, state.pz - WAYFINDER.z);
    if (dW < 3.8) return { label: !save.started ? 'Talk · begin quest' : save.done ? 'Talk' : `Talk · seals ${sealCount(save)}/4`, act: talkWayfinder };
    for (const o of seals) if (!o.claimed && Math.hypot(state.px - o.def.x, state.pz - o.def.z) < 3.2) return { label: `Claim ${o.def.name}`, act: () => claimSeal(o), x: o.def.x, z: o.def.z };
    if (Math.hypot(state.px - TABLET.x, state.pz - TABLET.z) < 2.8) return { label: 'Read Wind Tablet', act: () => openDialog('Wind Shrine', TABLET_LINES), x: TABLET.x, z: TABLET.z };
    if (!save.warden && wardenDist() < W_MELEE) return { label: atkCd > 0 ? `Wait ${atkCd.toFixed(1)}s` : `Attack Warden · ${wd.hp}/${HP_MAX}`, act: attackWarden, x: WARDEN.x, z: WARDEN.z, combat: true };
    for (let i = 0; i < RUNES.length; i++) if (Math.hypot(state.px - RUNES[i].x, state.pz - RUNES[i].z) < 2.6) { const v = save.runes[i]; return { label: save.wind ? `${RUNES[i].name} · ${RUNE_GLYPHS[v]}` : `Turn ${RUNES[i].name} · ${RUNE_GLYPHS[v]} ${RUNE_LABELS[v]}`, act: () => turnRune(i), x: RUNES[i].x, z: RUNES[i].z }; }
    return null;
  }
  // ---------- Vale Warden (optional) ----------
  const wd = { hp: HP_MAX, phase: save.warden ? 3 : 0, teleT: 0, recT: 0, sx: WARDEN.x, sz: WARDEN.z, awake: false, warned: false, freeze: -1 };
  let playerHp = HP_MAX, atkCd = 0, shake = 0, swingT = 0;
  const wardenDist = () => Math.hypot(state.px - WARDEN.x, state.pz - WARDEN.z);
  function resetWarden() { if (save.warden) { wd.phase = 3; wd.hp = 0; return; } wd.hp = HP_MAX; wd.phase = 0; wd.teleT = 0; wd.recT = 0; wd.awake = false; wd.warned = false; }
  function attackWarden() {
    if (save.warden) { toast('The Warden remains dormant.', 2); return; }
    if (atkCd > 0) { toast('Strike not ready.', 1.2); return; }
    atkCd = PLAYER_ATK_CD; swingT = 0.25; player.play('Punch_Right');
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
    atkCd = Math.max(0, atkCd - dt); swingT = Math.max(0, swingT - dt);
    if (save.warden) { wd.phase = 3; return; }
    if (talking || cine || creating) return;
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
  function interact() { if (creating || cine || !chapterEl.hidden) return; if (talking) { advance(); return; } const it = nearestInteract(); if (!it) return; if (it.x !== undefined && it.z !== undefined) camFocus = { x: it.x, z: it.z, t: 1.4 }; it.act(); }
  function talk() { interact(); }
  actBtn.onclick = (e) => { e.stopPropagation(); interact(); };
  addEventListener('keydown', (e) => { if (creating || (e.target as HTMLElement).tagName === 'INPUT') return; if (talking && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { e.preventDefault(); if (e.code === 'Escape') { dq = []; } advance(); } });
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
  function updateHud(dt: number) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.15;
    const n = sealCount(save);
    qline.textContent = !save.started ? 'Speak with the Wayfinder' : save.done ? 'Vale Walker · the seals burn again' : n < 4 ? `The Four Seals · ${n}/4` : 'All four seals held — return to the Wayfinder';
    qstats.textContent = `Lv ${levelOf(save.xp)} · ${save.xp} XP · ${SEALS.map((d) => (save.seals[d.id] ? '◆' : '◇')).join('')}`;
    let tgt = { name: 'Wayfinder', x: WAYFINDER.x, z: WAYFINDER.z };
    if (save.started && n < 4) { let bd = 1e9; for (const d of SEALS) if (!save.seals[d.id]) { const dd = Math.hypot(d.x - state.px, d.z - state.pz); if (dd < bd) { bd = dd; tgt = { name: `${d.name} · ${d.at}`, x: d.x, z: d.z }; } } }
    const dx = tgt.x - state.px, dz = tgt.z - state.pz, dist = Math.hypot(dx, dz);
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw), rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
    const sx = dx * rx + dz * rz, sy = dx * fx + dz * fz;
    carrow.style.transform = `rotate(${(Math.atan2(-sy, sx) * 180 / Math.PI).toFixed(0)}deg)`;
    ctext.textContent = save.done && dist < 6 ? 'Explore freely' : `${tgt.name} · ${dist < 10 ? 'here' : Math.round(dist) + ' m'}`;
    // Optional Wind Shrine locator line.
    { const ws = { x: (RUNES[0].x + RUNES[2].x) / 2, z: RUNES[0].z }; const ddx = ws.x - state.px, ddz = ws.z - state.pz, dd = Math.hypot(ddx, ddz);
      const wx = ddx * rx + ddz * rz, wy = ddx * fx + ddz * fz;
      wArrow.style.transform = `rotate(${(Math.atan2(-wy, wx) * 180 / Math.PI).toFixed(0)}deg)`; wArrow.style.visibility = save.wind ? 'hidden' : 'visible';
      wText.textContent = save.wind ? 'Wind Shrine awake · Windward Blessing +15%' : `Wind Shrine (optional) · ${save.runes.map((v) => RUNE_GLYPHS[v]).join(' ')} · ${dd < 18 ? 'here' : Math.round(dd) + ' m'}`; }
    { const ddx = WARDEN.x - state.px, ddz = WARDEN.z - state.pz, dd = Math.hypot(ddx, ddz); const wx = ddx * rx + ddz * rz, wy = ddx * fx + ddz * fz;
      wdArrow.style.transform = `rotate(${(Math.atan2(-wy, wx) * 180 / Math.PI).toFixed(0)}deg)`; wdArrow.style.visibility = save.warden ? 'hidden' : 'visible';
      wdText.textContent = save.warden ? "Warden dormant · Warden's Crest" : `Vale Warden (optional) · ${dd < 12 ? 'here' : Math.round(dd) + ' m'}`;
      const show = !save.warden && (wd.awake || playerHp < HP_MAX);
      combatEl.hidden = !show; if (show) { hpEl.textContent = '♥'.repeat(playerHp) + '♡'.repeat(HP_MAX - playerHp); whpEl.textContent = '■'.repeat(wd.hp) + '□'.repeat(HP_MAX - wd.hp); combatEl.classList.toggle('alert', wd.phase === 1); } }
    const it = talking || cine ? null : nearestInteract();
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
  const hasProgress = () => { const sv = loadSave(); return sv.started || sv.xp > 0 || sv.wind || sv.warden || Object.keys(sv.seals).length > 0 || sv.runes.some((v) => v !== 0); };
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

  function update(dt: number, t: number) {
    if (creating) { previewUpdate(dt, t); return; }
    lastDt = dt;
    // Input → desired velocity in camera space.
    let ix = 0, iz = 0;
    if (talking || cine) { for (const k of Object.keys(keys)) keys[k] = false; }
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    let mag = Math.min(1, Math.hypot(ix, iz)); if (mag > 0) { const l = Math.hypot(ix, iz); ix /= l; iz /= l; }
    let target = mag * (keys.ShiftLeft || keys.ShiftRight ? 1.9 : 5.6);
    if (stick.id >= 0 && Math.hypot(stick.x, stick.y) > 0.12) { ix = stick.x; iz = stick.y; mag = Math.min(1, Math.hypot(ix, iz)); target = mag < 0.7 ? 1.9 * mag / 0.7 : 1.9 + (mag - 0.7) / 0.3 * 3.7; }
    if (save.wind) target *= WIND_BLESS; // Windward Blessing
    state.speed += (target - state.speed) * Math.min(1, dt * (target > state.speed ? 4 : 7));
    if (mag > 0.05) {
      const s = Math.sin(state.yaw), c = Math.cos(state.yaw);
      const wx = ix * c + iz * s, wz = -ix * s + iz * c;
      const want = Math.atan2(wx, wz);
      let d = want - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      state.facing += d * Math.min(1, dt * 10);
    }
    if (state.speed > 0.02) {
      let nx = state.px + Math.sin(state.facing) * state.speed * dt, nz = state.pz + Math.cos(state.facing) * state.speed * dt;
      for (const s of solids) { const dx = nx - s.x, dz = nz - s.z, dd = Math.hypot(dx, dz); if (dd < s.r) { nx = s.x + dx / dd * s.r; nz = s.z + dz / dd * s.r; } }
      const R = 235; const rr = Math.hypot(nx, nz); if (rr > R) { nx *= R / rr; nz *= R / rr; }
      // Wading: the creek is shallow — slow down instead of blocking.
      if (Math.abs(nx - creekX(nz)) < creekHalf(nz)) { nx = state.px + (nx - state.px) * 0.5; nz = state.pz + (nz - state.pz) * 0.5; }
      state.px = nx; state.pz = nz;
    }
    const gy = Math.max(heightAt(state.px, state.pz), WATER_Y - 0.7);
    player.root.position.set(state.px, gy, state.pz);
    player.root.rotation.y = state.facing;
    player.setSpeed(state.speed, dt);
    // Wayfinder looks at Ilka when near.
    const dW = Math.hypot(state.px - WAYFINDER.x, state.pz - WAYFINDER.z);
    if (dW < 9) { const want = Math.atan2(state.px - WAYFINDER.x, state.pz - WAYFINDER.z); let d = want - wayfinder.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); wayfinder.root.rotation.y += d * Math.min(1, dt * 3); }
    wayfinder.setSpeed(0, dt);
    tickWarden(dt);
    updateHud(dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
    // Interaction focus: swing the camera behind the player toward the target (keeps runes/seals in frame on portrait phones).
    if (camFocus) { camFocus.t -= dt; const want = Math.atan2(state.px - camFocus.x, state.pz - camFocus.z); if (Math.hypot(state.px - camFocus.x, state.pz - camFocus.z) > 0.6) { let d = want - state.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); state.yaw += d * Math.min(1, dt * 5); } if (camFocus.t <= 0) camFocus = null; }
    // Over-the-shoulder camera.
    camTarget.set(state.px, gy + 1.42, state.pz);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const back = new THREE.Vector3(Math.sin(state.yaw) * cp, sp, Math.cos(state.yaw) * cp);
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    camPos.copy(camTarget).addScaledVector(back, state.dist).addScaledVector(right, 0.65);
    const floor = heightAt(camPos.x, camPos.z) + 0.6; if (camPos.y < floor) camPos.y = floor;
    if (snapCam) { camera.position.copy(camPos); snapCam = false; } else camera.position.lerp(camPos, Math.min(1, dt * 8));
    tmp.copy(camTarget).addScaledVector(right, 0.65); tmp.y += 0.15;
    if (finaleDelay > 0) { finaleDelay -= dt; if (finaleDelay <= 0) startFinale(); }
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
    sun.position.copy(camTarget).addScaledVector(SUN_DIR, 120);
    sun.target.position.copy(camTarget).addScaledVector(new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)), SH * 0.55);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 120);
    treeField.update(state.px, state.pz);
    if (Math.hypot(state.px - grassField.center.x, state.pz - grassField.center.y) > (HIGH ? 9 : 6)) { grassField.recenter(state.px, state.pz); grassFar.recenter(state.px, state.pz); }
    for (const gf of [grassField, grassFar]) { gf.uniforms.uTime.value = t; gf.uniforms.uPlayer.value.set(state.px, gy, state.pz); }
    water.update(t);
    (rift.material as THREE.ShaderMaterial).uniforms.uTime.value = t; foliageUniforms.uTime.value = t;
    island.update(t, lastDt); landmarks.update(t); shrine.update(t, lastDt);
    { const k = wd.phase === 1 ? (wd.freeze >= 0 ? wd.freeze : 1 - wd.teleT / W_TELE) : 0;
      warden.update(t, lastDt, { phase: wd.phase, k, awake: wd.awake, face: wd.awake || wd.freeze >= 0 ? Math.atan2(state.px - WARDEN.x, state.pz - WARDEN.z) : null, zone: wd.phase === 1 }); } for (const o of seals) o.update(t, lastDt);
    wayfinder.root.updateMatrixWorld(true); handBone.getWorldPosition(handPos); staff.update(t, handPos, wayfinder.root.rotation.y);
    vignette.uniforms.uTime.value = t % 100;
  }

  // On-screen FPS readout (corner chip; tap it or press F to toggle; remembered).
  const fpsEl = document.getElementById('fps')!;
  let fpsOn = params.has('fps') || localStorage.getItem('vale3d-fps') === '1';
  const setFps = (on: boolean) => { fpsOn = on; fpsEl.classList.toggle('on', on); fpsEl.textContent = on ? '… fps' : 'FPS'; try { localStorage.setItem('vale3d-fps', on ? '1' : '0'); } catch { /* */ } };
  setFps(fpsOn);
  fpsEl.addEventListener('click', () => setFps(!fpsOn));
  addEventListener('keydown', (e) => { if (e.code === 'KeyF' && (e.target as HTMLElement).tagName !== 'INPUT') setFps(!fpsOn); });
  renderer.info.autoReset = false;
  function frame() {
    renderer.info.reset();
    const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
    update(dt, t);
    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++; totalFrames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (fpsOn) fpsEl.textContent = `${fps.toFixed(0)} fps · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris · ${quality}`; }
  }
  renderer.setAnimationLoop(frame);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight); gtao?.setSize(innerWidth, innerHeight);
  });

  // ---------- QA / screenshot hooks ----------
  const api = {
    ready: true, errors, quality,
    get fps() { return fps; },
    get frames() { return totalFrames; },
    get tris() { return renderer.info.render.triangles; },
    framing() {
      const p = player.root.position; const top = new THREE.Vector3(p.x, p.y + 1.68, p.z).project(camera), bot = p.clone().project(camera);
      return Math.abs(top.y - bot.y) / 2;
    },
    preset(name: string) {
      snapCam = true;
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
      if (name === 'beam') { save = { v: 1, started: true, done: false, xp: 75, seals: { dawn: true, sun: true, tide: true }, runes: [0, 0, 0], wind: false, warden: false }; for (const o of seals) if (save.seals[o.def.id]) o.claim(); const d = SEALS.find((x) => x.id === 'forge')!; state.px = d.x + 1.9; state.pz = d.z + 1.9; state.facing = Math.atan2(-1.9, -1.9); state.yaw = Math.PI / 4; state.pitch = 0.12; state.dist = 7; }
      if (name === 'sunspire' || name === 'dome' || name === 'veilfall') { const l = LANDMARKS.find((x) => x.id === name)!; const rot = name === 'sunspire' ? 0.55 : name === 'veilfall' ? -0.3 : 0, dx0 = SPAWN.x - l.x, dz0 = SPAWN.z - l.z, dx = dx0 * Math.cos(rot) + dz0 * Math.sin(rot), dz = -dx0 * Math.sin(rot) + dz0 * Math.cos(rot), d = Math.hypot(dx, dz), off = name === 'dome' ? 36 : name === 'veilfall' ? 40 : 40; state.px = l.x + dx / d * off; state.pz = l.z + dz / d * off; state.facing = Math.atan2(-dx, -dz); state.yaw = Math.atan2(dx, dz) + 0.1; state.pitch = name === 'dome' ? 0.02 : name === 'veilfall' ? -0.3 : -0.05; state.dist = 6.5; }
      if (name === 'run') { keys.KeyW = true; }
      camera.position.set(state.px, 50, state.pz); for (let i = 0; i < 90; i++) update(1 / 30, clock.elapsedTime + i / 30);
      if (name === 'dialog') { save = { v: 1, started: false, done: false, xp: 0, seals: {}, runes: [0, 0, 0], wind: false, warden: false }; interact(); }
      if (name === 'warden-windup') { wd.sx = state.px + 0.6; wd.sz = state.pz; warden.placeZone(wd.sx, wd.sz); wd.phase = 1; wd.teleT = W_TELE * 0.3; toast('⚠ Warden winds up — move!', 60, true); }
      if (name === 'shrine-awake') { save.runes = [1, 0, 2]; save.wind = true; for (let i = 0; i < 3; i++) shrine.setRune(i, save.runes[i], false); shrine.awaken(true); for (let i = 0; i < 60; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); }
      if (name === 'beam') { interact(); for (let i = 0; i < 50; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); if (cine) cine.hold = cine.dur * 0.6; for (let i = 0; i < 130; i++) update(1 / 30, clock.elapsedTime + 5 + i / 30); }
      if (name === 'seal') { save.started = true; interact(); for (let i = 0; i < 60; i++) update(1 / 30, clock.elapsedTime + 3 + i / 30); hudT = 0; updateHud(0); }
    },
    key(code: string, down: boolean) { keys[code] = down; },
    get profile() { return profile; },
    get creating() { return creating; },
    talkLine() { return say('Wayfinder', LINES.wayfinder.greet, profile); },
    warp(x: number, z: number) { state.px = x; state.pz = z; snapCam = true; },
    interact() { interact(); },
    advance() { if (talking) advance(); },
    runes: RUNES.map((r) => ({ x: r.x, z: r.z })), tablet: TABLET, speedMul: () => (save.wind ? WIND_BLESS : 1),
    warden: () => ({ x: WARDEN.x, z: WARDEN.z, hp: wd.hp, phase: wd.phase, awake: wd.awake, playerHp, atkCd, recovery: recoveryPoint(), melee: W_MELEE }),
    quest() { return { save: JSON.parse(JSON.stringify(save)), talking, cine: !!cine, dlg: talking ? dtxt.textContent : '', chapter: !chapterEl.hidden, near: nearestInteract()?.label ?? null, seals: seals.map((o) => ({ id: o.def.id, x: o.def.x, z: o.def.z, claimed: o.claimed })), wayfinder: { x: WAYFINDER.x, z: WAYFINDER.z } }; },
    debug: { scene, camera, renderer, get player() { return player.root; }, wayfinder: wayfinder.root },
  };
  (window as unknown as { __vale: typeof api }).__vale = api;
  document.getElementById('loading')!.remove();
  const shot = params.get('shot');
  if (shot?.startsWith('create-')) openCreate(shot === 'create-male' ? 'male' : 'female', shot === 'create-male' ? 'Aren' : 'Ilka');
  else if (shot) api.preset(shot);
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
      mixer.update(dt);
    },
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
    wm.fragmentShader = wm.fragmentShader.replace(/vec3 albedo = mix\([^;]*;/, 'vec3 albedo = mix( waterColor * ( 0.55 + 0.35 * diffuseLight.r ) + scatter * 0.5, reflectionSample * vec3( 0.72, 0.86, 0.88 ) + specularLight, clamp( reflectance * 1.4 + 0.12, 0.0, 0.7 ) );');
    return { mesh: w as THREE.Object3D, update: (t: number) => { u.time.value = t * 0.6; } };
  }
  normals.repeat.set(1, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#21424a', roughness: 0.06, metalness: 0.0, normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88, envMapIntensity: 1.3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = WATER_Y;
  return { mesh: m as THREE.Object3D, update: (t: number) => { normals.offset.set(t * 0.01, -t * 0.05); } };
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
  if (Math.hypot(x - WARDEN.x, z - WARDEN.z) < 14) return false;
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
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv*2.-1.; float bend=.18*sin(p.x*2.6+.8)+.07*sin(p.x*7.+uTime*.2);
        float d=abs(p.y-bend); float fall=smoothstep(1.,.55,abs(p.x));
        float flick=.75+.25*n(vec2(p.x*6.+uTime*.4,uTime*.3));
        float core=exp(-d*d*900.)*fall*flick, halo=exp(-d*d*22.)*fall*(.55+.45*n(p*3.+uTime*.05));
        vec3 col=vec3(.62,.42,1.)*core*1.6+mix(vec3(.25,.75,.85),vec3(.55,.35,.9),smoothstep(-.6,.6,p.x))*halo*.38;
        gl_FragColor=vec4(col,1.);}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 140), m);
  mesh.position.set(260, 230, -520); mesh.lookAt(0, 20, 0); mesh.rotateZ(-0.22);
  mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
}

main().catch((e) => { errors.push(String(e?.stack || e)); const l = document.getElementById('loading'); if (l) l.textContent = 'Failed to load: ' + e; console.error(e); });

