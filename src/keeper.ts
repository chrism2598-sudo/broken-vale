import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triplanar } from './landmarks';
import { gradTex, rockBlob } from './seacave';
import type { GroundTex } from './terrain';

/** M13 · The Drowned Keeper: the flooded chamber behind the round seal and its guardian.
 *  Built once on first entry (own scene at KEEP_O). The fight is a small state machine stepped on the fixed 60 Hz tick:
 *  surface → tide-spout slams (telegraphed rings under Ilka) → tide sweep (stand on a raised stone) → ebb → low water (Tide-Glass opens the core plates; strike) → … */
export const KEEP_O = { x: 4000, z: 4000 };
export const KEEPER_XP = 60, KEEPER_HP = 6;
const R = 20.5, DOME_H = 17, FLOOR = -0.9, STONE_TOP = 0.8, STONE_R = 1.65, BODY_R = 4.3, MELEE = 5.9;
// M20b · bigger arena: an inner ring of four stones and three outer ones (none in front of the entrance ledge) so a stone is always in reach of the sweep.
const STONES = [...[0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return { x: Math.cos(a) * 9.4, z: Math.sin(a) * 9.4 }; }), ...[1, 2, 3].map((k) => { const a = (k * Math.PI) / 2; return { x: Math.cos(a) * 15.6, z: Math.sin(a) * 15.6 }; })];
const LEDGE = { x: R + 0.4, z: 0, r: 2.7 }, LEDGE_Y = 0.6;
const LEV = { low: -1.35, mid: -0.35, high: 0.42 };
// Per-phase tuning (index = phase 1..3): slams per cycle, slam windup, sweep warning.
const SLAMS = [0, 2, 2, 3], T_SLAM = [0, 1.35, 1.15, 1.0], T_SWEEP = [0, 2.8, 2.5, 2.3];
export const T_LOW = 7.5, T_REVEAL = 4.6, SPOUT_R = 2.5;

export const KEEPER_LINES = {
  sealOpen: [
    'You raise the Tide-Glass to the three burning rings. For a moment nothing — then a thread of warm light finds the glass from above, down the roof-crack:',
    'the Lowtide Lamp. Someone has lit it again, far overhead. The glass gathers the beam and lays it on the seal like a hand.',
    'The four dark rings wake one after another. The seal sighs, and rolls aside into the wall. Below, the water is breathing.',
  ],
  enter: 'The drowned chamber · something vast turns over in the water',
  intro: ['The water heaves. A long ringed neck rises out of the dark, wearing custodian collars like a prisoner wears chains.', 'A lantern-lure swings from its hooded head. Under its chest-plates, a tide-glass heart beats blue. It does not look angry. It looks *on duty*.'],
  phaseUp: ['The Keeper rises higher — the tide quickens', 'The Keeper’s collars blaze — last stand of the old duty'],
  armoured: 'Its chest-plates are shut. Wait for low water, then raise the Tide-Glass.',
  win: (name: string) => [
    'The last blow rings like a bell under water. The Keeper’s collars go dark one by one, and its long neck lowers — not falling, settling, the way a guard sits down at the end of a very long watch.',
    'In the open chest-plates, beside the dimmed heart, a brass lamp-key and a strip of oilcloth, tied with Enna’s knot:',
    `“${name} — I lit the Lamp; that was the seal’s other key. I watched you from the roof-crack. You did not open the door alone.”`,
    '“The Keeper was never the enemy. The custodians bound it here to hold the second seam drowned — and it held, for three hundred years, long after anyone remembered to relieve it. Now it can rest, and the seam is ours to mend.”',
    '“Meet me at the Lamp when the tide turns. Bring the glass. We have a sky to tie shut.” — Enna',
  ],
  again: ['The Keeper sleeps in the shallows, collars dark, breathing slow as a tide. Enna’s note is in your journal: “Meet me at the Lamp.”'],
  recovery: ['The surge throws you up onto the entrance ledge, coughing seawater.', 'Your XP and progress are safe. The Keeper sinks back to its post — it will rise again, full strength, when you step down.'],
  card: { k: 'The Drowned Keeper rests', title: 'The Second Seam', tease: 'The seam below the sea is quiet at last. Enna lit the Lowtide Lamp and is waiting at its foot — one thing is left: the sky above still needs tying shut.' },
};

/** Plated sea-ancient hide: overlapping scales (height → normal), crevice-dark albedo with algae and nacre flecks, wet tops / rough crevices. Built once. */
function hideTextures(seed: number) {
  const N = 256; let sd = seed; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const h = new Float32Array(N * N), tint = new Float32Array(N * N), rows = 9, cols = 7;
  const jit = Array.from({ length: rows * cols * 4 }, () => rnd());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = (y / N) * rows; let best = 0, tb = 0;
    for (let dr = -1; dr <= 1; dr++) { const r = Math.floor(v) + dr; const off = (r & 1) * 0.5; const u = (x / N) * cols - off; for (let dc = -1; dc <= 1; dc++) { const c = Math.floor(u) + dc; const id = (((r % rows) + rows) % rows) * cols + (((c % cols) + cols) % cols);
      const cx = c + 0.5 + (jit[id * 4] - 0.5) * 0.2, cy = r + 0.35 + (jit[id * 4 + 1] - 0.5) * 0.15; const dx = (u - cx) / 0.62, dy = (v - cy) / 0.78; const d = dx * dx + dy * dy; if (d < 1) { const hh = (1 - d) ** 0.6 * (0.75 + 0.25 * jit[id * 4 + 2]) + (dy > 0 ? 0 : 0.1 * dy); if (hh > best) { best = hh; tb = jit[id * 4 + 3]; } } } }
    const nz = 0.06 * Math.sin(x * 0.9 + y * 0.31) * Math.sin(y * 0.7 - x * 0.2) + 0.04 * (rnd() - 0.5); h[y * N + x] = Math.max(0, best) + nz; tint[y * N + x] = tb; }
  const mk = (fn: (i: number, x: number, y: number) => [number, number, number]) => { const c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d')!; const im = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; const [r, g2, b] = fn(i, x, y); im.data[i * 4] = r; im.data[i * 4 + 1] = g2; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; } ctx.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const H = (x: number, y: number) => h[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const map = mk((i, x, y) => { const v = h[i], tb = tint[i]; const crev = Math.max(0, Math.min(1, v * 2.2)); const fleck = (x * 7 + y * 13) % 97 < 2 && v > 0.4 ? 1 : 0;
    const r = (34 + 70 * crev + 26 * tb) * (1 - 0.25 * (1 - crev)) + 60 * fleck, g2 = (44 + 78 * crev + 14 * (1 - tb)) + 66 * fleck, b = (40 + 64 * crev + 10 * tb) + 70 * fleck; return [Math.min(255, r), Math.min(255, g2), Math.min(255, b)]; });
  map.colorSpace = THREE.SRGBColorSpace;
  const nor = mk((_i, x, y) => { const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2, dy = (H(x, y + 1) - H(x, y - 1)) * 3.2; const l = Math.hypot(dx, dy, 1); return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255]; });
  const rough = mk((i) => { const v = Math.max(0, Math.min(1, h[i] * 1.6)); const r = 235 - 165 * v; return [r, r, r]; });
  return { map, nor, rough };
}
/** Worn custodian bronze: patina (verdigris in the pits), polished high spots, and a band of glyphs for the emissive map. */
function bronzeTextures() {
  const W = 256, Hh = 64; const mk = (draw: (x: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d')!; draw(x); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); return t; };
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const map = mk((x) => { x.fillStyle = '#7a5a2e'; x.fillRect(0, 0, W, Hh); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${60 + rnd() * 30},${130 + rnd() * 40},${110 + rnd() * 30},${0.25 + rnd() * 0.5})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * Hh, 3 + rnd() * 14, 2 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = 'rgba(210,160,90,0.5)'; for (let i = 0; i < 40; i++) x.fillRect(rnd() * W, Hh * 0.42 + rnd() * 4, 6 + rnd() * 18, 2); });
  map.colorSpace = THREE.SRGBColorSpace;
  const rough = mk((x) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#5a5a5a'; x.fillRect(0, Hh * 0.38, W, Hh * 0.24); });
  const glyph = mk((x) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#fff'; x.font = '18px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const gl = '◎⁘≈◇△☽✶'; for (let k = 0; k < 8; k++) x.fillText(gl[k % 7], (k + 0.5) * (W / 8), Hh / 2); });
  return { map, rough, glyph };
}

export type KeeperState = 'idle' | 'intro' | 'windup' | 'recover' | 'sweepWarn' | 'ebb' | 'low' | 'dead';
export type KeeperEvent = 'intro' | 'windup' | 'spout' | 'sweepWarn' | 'sweep' | 'low' | 'rise' | 'phase' | 'dead';

export function makeKeeper(high: boolean, t: { rock: GroundTex; bed: GroundTex }, waterNormals: THREE.Texture, env: THREE.Texture | null) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020809');
  scene.fog = new THREE.FogExp2('#03100f', high ? 0.03 : 0.036);
  if (env) { scene.environment = env; scene.environmentIntensity = 0.06; }
  scene.add(new THREE.HemisphereLight('#4f8a90', '#0e0a08', 0.32));
  const g = new THREE.Group(); g.position.set(KEEP_O.x, 0, KEEP_O.z); scene.add(g);
  let seed = 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const L = (x: number, z: number) => ({ x: x + KEEP_O.x, z: z + KEEP_O.z });
  // The Lamp's beam, still pouring through the roof-crack from the seal room: the arena's key light.
  const moon = new THREE.DirectionalLight('#bfe2ff', 0.9); moon.position.set(KEEP_O.x + 8, 40, KEEP_O.z - 6); moon.target.position.set(KEEP_O.x, 0, KEEP_O.z); scene.add(moon, moon.target);
  if (high) { moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 75 }); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.05; }
  const coreLight = new THREE.PointLight('#6fe8ff', 2.0, 16, 1.4); scene.add(coreLight);
  const rock = triplanar(t.rock, 3.0, '#8e8a84', { rough: 0.55, sat: 0.5 }), wet = triplanar(t.rock, 1.4, '#9d958b', { rough: 0.42, sat: 0.55 }), floorM = triplanar(t.bed, 1.5, '#5f5b55', { rough: 0.36, sat: 0.7 });
  // Dome (inward) and basin floor with vertex-colour wet/salt mottling.
  { const d = new THREE.SphereGeometry(1, high ? 72 : 48, high ? 28 : 18, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.6 * Math.sin(x * 6 + z * 2) * Math.cos(y * 5 - x * 2) + 0.3 * Math.sin(z * 12 + y * 8); p.setXYZ(i, x * (R + 3 + n * 1.2), y * DOME_H + n * 0.6 * y - 1.4, z * (R + 3 + n * 1.2)); }
    const ix = d.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; } d.computeVertexNormals();
    const m = new THREE.Mesh(d, rock); m.receiveShadow = true; g.add(m); }
  { const f = new THREE.PlaneGeometry(2 * (R + 4), 2 * (R + 4), high ? 72 : 48, high ? 72 : 48); f.rotateX(-Math.PI / 2); /* a grid, not a fan: the basin slope must be sampled across the floor */ const p = f.attributes.position as THREE.BufferAttribute; const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const y = FLOOR + 0.08 * Math.sin(x * 0.9 + z * 0.4) + 0.06 * Math.sin(z * 1.3 - x * 0.5) + Math.max(0, Math.hypot(x, z) - R) * 0.35; p.setY(i, y);
      const mot = 0.5 + 0.5 * Math.sin(x * 1.1 + Math.sin(z * 0.6) * 2) * Math.sin(z * 0.9 - x * 0.3), rr = Math.hypot(x, z) / R; const k = (0.7 + 0.35 * mot) * (0.75 + 0.35 * Math.min(1, rr)); c[i * 3] = k * 0.92; c[i * 3 + 1] = k; c[i * 3 + 2] = k * 1.06; }
    f.setAttribute('color', new THREE.BufferAttribute(c, 3)); floorM.vertexColors = true; f.computeVertexNormals(); const m = new THREE.Mesh(f, floorM); m.receiveShadow = true; g.add(m); }
  // Raised custodian stones (safe from the sweep), the entrance ledge, rubble, stalactites.
  const stoneGlow = new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.15)'], [0.85, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']], 4, 128, true), color: '#7dffcf', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  { const parts: THREE.BufferGeometry[] = [];
    for (const s of STONES) { const c = new THREE.CylinderGeometry(STONE_R, STONE_R + 0.35, STONE_TOP - FLOOR + 0.6, 9, 2); c.translate(s.x, (STONE_TOP + FLOOR - 0.6) / 2, s.z); parts.push(c);
      const ring = new THREE.Mesh(new THREE.RingGeometry(STONE_R * 0.6, STONE_R * 1.35, 32), stoneGlow); ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, STONE_TOP + 0.03, s.z); ring.layers.set(1); ring.renderOrder = 5; g.add(ring); }
    parts.push(rockBlob(LEDGE.r, rnd, 1.1, 0.5, 1.4, 2).translate(LEDGE.x + 0.6, LEDGE_Y - 0.75, LEDGE.z));
    for (let i = 0; i < (high ? 26 : 16); i++) { const a = rnd() * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue; const r = R + 0.8 + rnd() * 1.5, s = 0.7 + rnd() * 1.6; parts.push(rockBlob(s, rnd, 1, 0.8, 1).translate(Math.cos(a) * r, FLOOR + s * 0.2, Math.sin(a) * r)); }
    const m = new THREE.Mesh(mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const n of Object.keys(q.attributes)) if (n !== 'position' && n !== 'normal') q.deleteAttribute(n); return q; })), wet); m.castShadow = m.receiveShadow = true; g.add(m);
    const st: THREE.BufferGeometry[] = []; for (let i = 0; i < (high ? 50 : 30); i++) { const a = rnd() * Math.PI * 2, r = rnd() * (R + 1); const y = DOME_H * Math.sqrt(Math.max(0.05, 1 - (r / (R + 3)) ** 2)) - 1.8; const h = 0.8 + rnd() * 2.6; const c = new THREE.ConeGeometry(0.15 + rnd() * 0.25, h, 6, 2); c.rotateX(Math.PI); c.translate(Math.cos(a) * r, y - h / 2 + 0.3, Math.sin(a) * r); st.push(c); }
    g.add(new THREE.Mesh(mergeGeometries(st), wet)); }
  // Glow-lichen (static instanced flecks) around the walls.
  { const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: '#3fe6d0' }), high ? 360 : 200); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < im.count; i++) { const a = rnd() * Math.PI * 2, y = FLOOR + 0.4 + rnd() ** 1.5 * 4; const r = (R + 2.6) * Math.sqrt(Math.max(0.05, 1 - ((y + 1.4) / DOME_H) ** 2)); q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)); sc.setScalar(0.6 + rnd() * 1.6); mx.compose(v.set(Math.cos(a) * r, y, Math.sin(a) * r), q, sc); im.setMatrixAt(i, mx); }
    im.frustumCulled = false; g.add(im); }
  // Water: one plane at the fight's tide level, scrolling normals (no rebuilds).
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping; const wn = waterNormals.clone(); wn.repeat.set(5, 5); wn.needsUpdate = true;
  const waterM = new THREE.MeshStandardMaterial({ color: '#0e4a52', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), emissive: '#08343a', depthWrite: false });
  const water = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 48).rotateX(-Math.PI / 2), waterM); water.renderOrder = 2; water.userData.noAO = true; g.add(water);
  // ---- The Keeper: a coiled, plated sea-ancient. Neck is ONE skinned tapered tube on a 7-bone chain (bent by bone rotations only);
  // hide = procedural plate/scale texture set (albedo + normal + roughness, built once); worn bronze custodian collars with verdigris;
  // barnacle clusters (instanced), kelp (merged strips, swayed in the vertex shader), sculpted head with hinged jaw and eye glow.
  const hide = hideTextures(901);
  const hideOpts = { map: hide.map, normalMap: hide.nor, roughnessMap: hide.rough, normalScale: new THREE.Vector2(1.3, 1.3), color: '#ffffff', roughness: 1, metalness: 0.04, emissive: '#06201f', emissiveIntensity: 0.35 };
  const nacre: THREE.MeshStandardMaterial = high ? new THREE.MeshPhysicalMaterial({ ...hideOpts, clearcoat: 0.55, clearcoatRoughness: 0.28 }) : new THREE.MeshStandardMaterial(hideOpts);
  const slate = triplanar(t.rock, 1.1, '#5d625f', { rough: 0.45, sat: 0.4 });
  const bronze = bronzeTextures();
  const collarM = new THREE.MeshStandardMaterial({ map: bronze.map, roughnessMap: bronze.rough, color: '#ffffff', metalness: 0.7, roughness: 1, emissive: '#3fd0ff', emissiveMap: bronze.glyph, emissiveIntensity: 0.6 });
  const eyeM = new THREE.MeshBasicMaterial({ color: '#bff8ff' }), lureM = new THREE.MeshBasicMaterial({ color: '#9ff4ff' }), coreM = new THREE.MeshStandardMaterial({ color: '#1a4a50', emissive: '#7ff0ff', emissiveIntensity: 0.4 });
  const boneM = new THREE.MeshStandardMaterial({ color: '#d8d0bc', roughness: 0.5 });
  // Heart reads as a glowing sphere, not a flat disc: emissive falls off toward the silhouette (view-space normal).
  coreM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 0.18 + 1.1 * pow(max(dot(normalize(vNormal), vec3(0., 0., 1.)), 0.), 1.8);'); };
  const root = new THREE.Group(); g.add(root);
  const M = (geo: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = cast && high; x.receiveShadow = true; return x; };
  const CR = 3.1, CT = 1.05; const bump = (a: number) => 0.35 * Math.sin(a * 3);
  // Coil body: lumpy torus (vertex noise baked at build).
  { const tg = new THREE.TorusGeometry(CR, CT, high ? 24 : 16, high ? 96 : 64); tg.rotateX(Math.PI / 2); const p = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); const rr = Math.hypot(x, z) - CR; const n = 1 + 0.07 * Math.sin(a * 11 + y * 4) + 0.05 * Math.sin(a * 23 - rr * 6); p.setXYZ(i, Math.cos(a) * (CR + rr * n), y * n + bump(a), Math.sin(a) * (CR + rr * n)); }
    tg.computeVertexNormals(); root.add(M(tg, nacre));
    // Dorsal scutes along the coil top (curved slate plates, not cones).
    const sc: THREE.BufferGeometry[] = []; for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; const s = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(0.42, 0.2 + 0.08 * Math.sin(k * 1.7), 0.62); s.rotateZ(0.25); s.rotateY(-a); s.translate(Math.cos(a) * (CR - 0.1), CT * 0.92 + bump(a), Math.sin(a) * (CR - 0.1)); sc.push(s); }
    root.add(M(mergeGeometries(sc), slate)); }
  // Barnacle clusters on the coil (one instanced mesh; volcano-shaped shells).
  { const bg = new THREE.LatheGeometry([new THREE.Vector2(0.12, 0), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0.075, 0.12), new THREE.Vector2(0.045, 0.14), new THREE.Vector2(0.03, 0.09)], 8);
    const n = high ? 260 : 90; /* M15: Lite trimmed (arena/meadow 0.58 after the M14 remodel) */ const im = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 }), n); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), nv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    let c = 0; while (c < n) { const a0 = rnd() * Math.PI * 2, b0 = -0.2 + rnd() * 2.2, m = 4 + Math.floor(rnd() * 7);
      for (let j = 0; j < m && c < n; j++) { const a = a0 + (rnd() - 0.5) * 0.22, b = b0 + (rnd() - 0.5) * 0.5; nv.set(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)); pv.set(Math.cos(a) * (CR + CT * Math.cos(b)), CT * Math.sin(b) + bump(a), Math.sin(a) * (CR + CT * Math.cos(b))).addScaledVector(nv, -0.02);
        q.setFromUnitVectors(up, nv); sv.setScalar(0.6 + rnd() * 1.1); mx.compose(pv, q, sv); im.setMatrixAt(c, mx); im.setColorAt(c, col.setHSL(0.11 + rnd() * 0.05, 0.12 + rnd() * 0.1, 0.55 + rnd() * 0.2)); c++; } }
    im.castShadow = false; im.receiveShadow = true; root.add(im); }
  // Neck: one tapered tube skinned to a 7-bone chain (segs = bones, rotated by the fight animation; nothing rebuilt).
  const segs: THREE.Bone[] = []; const SEG = 0.9, NB = 7, Y0 = 0.2;
  { let parent: THREE.Object3D = root; for (let i = 0; i < NB; i++) { const b = new THREE.Bone(); b.position.y = i === 0 ? Y0 : SEG; parent.add(b); segs.push(b); parent = b; } }
  const neckR = (y: number) => 1.12 - 0.62 * Math.min(1, Math.max(0, (y + 0.6) / 7.0));
  { const H = 7.0, ng = new THREE.CylinderGeometry(1, 1, H, high ? 28 : 20, high ? 56 : 36, true); ng.translate(0, H / 2 - 0.6, 0); const p = ng.attributes.position as THREE.BufferAttribute, uv = ng.attributes.uv as THREE.BufferAttribute;
    const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); const r = neckR(y) * (1 + 0.035 * Math.sin(y * 7 + a * 2) + (Math.sin(a) > 0.6 ? 0 : 0) + 0.06 * Math.max(0, -Math.cos(a - Math.PI / 2)) * 0.5); p.setXYZ(i, x * r, y, z * r * (z < 0 ? 0.92 : 1.04));
      const tt = Math.max(0, (y - Y0) / SEG); const k = Math.min(NB - 1, Math.floor(tt)), f = Math.min(1, tt - k); si[i * 4] = k; si[i * 4 + 1] = Math.min(NB - 1, k + 1); sw[i * 4] = y < Y0 ? 1 : 1 - f; sw[i * 4 + 1] = y < Y0 ? 0 : f; uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 6); }
    ng.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); ng.computeVertexNormals();
    const neck = new THREE.SkinnedMesh(ng, nacre); neck.castShadow = high; neck.receiveShadow = true; neck.frustumCulled = false; root.add(neck); root.updateMatrixWorld(true); neck.bind(new THREE.Skeleton(segs)); }
  // Worn bronze custodian collars (rigid on bones 1, 3, 5), kelp hanging from them and from the coil.
  const kelpU = { uKT: { value: 0 } };
  const kelpM = new THREE.MeshStandardMaterial({ color: '#4a5e2a', roughness: 0.55, side: THREE.DoubleSide, emissive: '#0c1a08', emissiveIntensity: 0.4 });
  kelpM.onBeforeCompile = (sh) => { sh.uniforms.uKT = kelpU.uKT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uKT; attribute vec2 kw;').replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uKT * 1.4 + kw.x * 1.9 + kw.y) * kw.x * 0.09; transformed.z += cos(uKT * 1.1 + kw.x * 1.5 + kw.y) * kw.x * 0.07;'); };
  kelpM.customProgramCacheKey = () => 'kelp';
  const kelp = (anchors: { x: number; y: number; z: number; a: number }[]) => { const parts: THREE.BufferGeometry[] = [];
    for (const an of anchors) { const L2 = 0.8 + rnd() * 1.6, pg = new THREE.PlaneGeometry(0.16 + rnd() * 0.1, L2, 1, 8); pg.translate(0, -L2 / 2, 0); const pp = pg.attributes.position as THREE.BufferAttribute, kw = new Float32Array(pp.count * 2), ph = rnd() * 6;
      for (let i = 0; i < pp.count; i++) { const d = -pp.getY(i); pp.setX(i, pp.getX(i) * (1 - 0.5 * d / L2) + 0.08 * Math.sin(d * 3 + ph)); pp.setZ(i, pp.getZ(i) + 0.06 * d * d); kw[i * 2] = d; kw[i * 2 + 1] = ph; }
      pg.setAttribute('kw', new THREE.BufferAttribute(kw, 2)); pg.deleteAttribute('uv'); pg.rotateY(-an.a + Math.PI / 2); pg.translate(an.x, an.y, an.z); parts.push(pg); }
    const m = new THREE.Mesh(mergeGeometries(parts), kelpM); m.frustumCulled = false; return m; };
  for (const bi of [1, 3, 5]) { const yb = Y0 + bi * SEG, r = neckR(yb) + 0.05; const c = M(new THREE.TorusGeometry(r, 0.15, 8, 40), collarM); c.rotation.x = Math.PI / 2; c.scale.set(1, 1, 1.7); segs[bi].add(c);
    const an: { x: number; y: number; z: number; a: number }[] = []; for (let k = 0; k < (high ? 6 : 4); k++) { const a = rnd() * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.6) continue; an.push({ x: Math.cos(a) * (r + 0.1), y: -0.15, z: Math.sin(a) * (r + 0.1), a }); } segs[bi].add(kelp(an)); }
  { const an: { x: number; y: number; z: number; a: number }[] = []; for (let k = 0; k < (high ? 30 : 12); k++) { const a = rnd() * Math.PI * 2; an.push({ x: Math.cos(a) * (CR + CT * 0.9), y: 0.35 + bump(a), z: Math.sin(a) * (CR + CT * 0.9), a }); } root.add(kelp(an)); }
  // Sculpted head: plated skull with brow ridge and tapering snout, hinged jaw with teeth, glowing eyes in sockets, crest scutes, lantern-lure.
  const head = new THREE.Group(); head.position.y = SEG; segs[NB - 1].add(head); let jaw: THREE.Group;
  { const sk = new THREE.SphereGeometry(1, high ? 36 : 26, high ? 22 : 16); const p = sk.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const fz = Math.max(0, z); const taper = 1 - 0.42 * fz * fz; x *= 0.68 * taper; y = y * 0.5 * taper + 0.16 * Math.exp(-((z - 0.35) ** 2) * 9) * Math.max(0, y + 0.2) * (1 - Math.abs(x) * 0.6); if (y < 0) y *= 0.55; z = z * 1.25 + 0.55; p.setXYZ(i, x, y + 0.05, z); }
    sk.computeVertexNormals(); head.add(M(sk, nacre));
    jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.1); head.add(jaw);
    const jg = new THREE.SphereGeometry(1, high ? 28 : 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); const jp = jg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < jp.count; i++) { const x = jp.getX(i), y = jp.getY(i), z = jp.getZ(i); const fz = Math.max(0, z); jp.setXYZ(i, x * 0.58 * (1 - 0.4 * fz * fz), y * 0.22, z * 1.15 + 0.5); } jg.computeVertexNormals(); jaw.add(M(jg, nacre));
    const th: THREE.BufferGeometry[] = []; for (let k = 0; k < 14; k++) { const s = k / 13, a = -1.25 + 2.5 * s; const zz = 0.5 + Math.cos(a) * 1.05, xx = Math.sin(a) * 0.5 * (1 - 0.35 * Math.max(0, Math.cos(a)) ** 2); const c = new THREE.ConeGeometry(0.045, 0.16 + 0.05 * Math.sin(k * 2.3), 5); c.translate(xx, 0.05, zz); th.push(c); }
    jaw.add(M(mergeGeometries(th), boneM, false));
    const glowTex = gradTex([[0, 'rgba(200,255,255,1)'], [0.35, 'rgba(90,220,255,0.45)'], [1, 'rgba(40,160,255,0)']], 4, 64, true);
    for (const sx of [-1, 1]) { const sock = M(new THREE.SphereGeometry(0.17, 12, 8), slate, false); sock.scale.set(1, 0.7, 1.1); sock.position.set(sx * 0.4, 0.13, 1.0); head.add(sock);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), eyeM); e.position.set(sx * 0.45, 0.13, 1.06); head.add(e);
      const eg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#9ff4ff', opacity: 0.9 })); eg.scale.setScalar(0.7); eg.position.copy(e.position); eg.layers.set(1); head.add(eg); }
    const cr: THREE.BufferGeometry[] = []; for (let k = 0; k < 6; k++) { const s = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(0.1, 0.32 - k * 0.03, 0.34); s.rotateX(-0.5); s.translate(0, 0.4 - k * 0.02, 0.6 - k * 0.32); cr.push(s); }
    head.add(M(mergeGeometries(cr), slate));
    const stalk = M(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 6), slate, false); stalk.position.set(0, 0.85, 1.05); stalk.rotation.x = 0.9; head.add(stalk);
    const lure = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lureM); lure.position.set(0, 1.25, 1.7); head.add(lure); }
  const lureHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gradTex([[0, 'rgba(180,250,255,1)'], [0.4, 'rgba(80,210,255,0.35)'], [1, 'rgba(40,160,255,0)']], 4, 128, true), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); lureHalo.scale.setScalar(2.4); lureHalo.position.set(0, 1.25, 1.7); lureHalo.layers.set(1); head.add(lureHalo);
  // Heart and chest-plates on the front of the neck base.
  const chest = new THREE.Group(); chest.position.set(0, 0.55, 0.92); segs[1].add(chest);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), coreM); chest.add(core);
  const coreHalo = new THREE.Sprite(lureHalo.material.clone()); coreHalo.scale.setScalar(3.2); coreHalo.layers.set(1); (coreHalo.material as THREE.SpriteMaterial).opacity = 0; chest.add(coreHalo);
  const plates = [-1, 1].map((sx) => { const pg = new THREE.Group(); pg.position.set(sx * 0.7, 0, -0.1); chest.add(pg); const pl = M(new THREE.SphereGeometry(0.78, 14, 10, sx < 0 ? Math.PI : 0, Math.PI, 0, Math.PI), slate); pl.scale.set(1, 1.15, 0.7); pl.rotation.y = -Math.PI / 2; pl.position.x = -sx * 0.7; pg.add(pl); return pg; });
  // Telegraphs: spout ring (under Ilka) + geyser column; sweep foam ring.
  const zoneMat = new THREE.MeshBasicMaterial({ color: '#ff5a1f', toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const zoneFill = new THREE.MeshBasicMaterial({ color: '#e0401a', toneMapped: false, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const zone = new THREE.Group(); zone.visible = false; g.add(zone);
  { const r = new THREE.Mesh(new THREE.RingGeometry(SPOUT_R - 0.32, SPOUT_R, 48), zoneMat); r.rotation.x = -Math.PI / 2; zone.add(r); const f = new THREE.Mesh(new THREE.CircleGeometry(SPOUT_R, 40), zoneFill); f.rotation.x = -Math.PI / 2; f.name = 'fill'; zone.add(f); zone.layers.set(1); zone.children.forEach((c) => { c.layers.set(1); c.renderOrder = 5; }); }
  const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#cff6ff', map: gradTex([[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0.1)']]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  geyser.geometry.translate(0, 2.5, 0); geyser.layers.set(1); geyser.renderOrder = 5; g.add(geyser);
  const sweepRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sweepRing.rotation.x = -Math.PI / 2; sweepRing.layers.set(1); sweepRing.renderOrder = 5; g.add(sweepRing);
  // ---- fight state ----
  const f = { hold: false, state: 'idle' as KeeperState, phase: 1, hp: KEEPER_HP, t: 0, slams: 0, revealed: 0, zx: 0, zz: 0, hitsThisWindow: 0, active: false };
  let lev = LEV.mid, levWant = LEV.mid, spoutT = 0, sweepT = 0, deadK = 0, revealK = 0, hitK = 0, impactK = 0;
  const go = (s: KeeperState, t: number) => { f.state = s; f.t = t; };
  const onStone = (lx: number, lz: number) => STONES.some((s) => Math.hypot(lx - s.x, lz - s.z) < STONE_R + 0.15) || Math.hypot(lx - LEDGE.x, lz - LEDGE.z) < LEDGE.r;
  const local = (wx: number, wz: number) => [wx - KEEP_O.x, wz - KEEP_O.z] as const;
  const exV = new THREE.Vector3(), upV = new THREE.Vector3(); let camFr = 1, camUp = 0;
  const api = {
    rig: { root, segs, head, chest }, scene, entry: L(LEDGE.x - 0.4, 0), exit: L(LEDGE.x + 1.0, 0), center: L(0, 0), stones: STONES.map((s) => L(s.x, s.z)), melee: MELEE,
    set hold(v: boolean) { f.hold = v; }, get state() { return f.state; }, get hp() { return f.hp; }, get phase() { return f.phase; }, get revealed() { return f.revealed > 0; }, get level() { return lev; }, get active() { return f.active; }, get zone() { return f.state === 'windup' ? L(f.zx, f.zz) : null; },
    onStone(wx: number, wz: number) { const [x, z] = local(wx, wz); return onStone(x, z); },
    onLedge(wx: number, wz: number) { const [x, z] = local(wx, wz); return Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r && x > R - 2.6; },
    groundY(wx: number, wz: number) { const [x, z] = local(wx, wz); if (Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r) return LEDGE_Y; if (STONES.some((s) => Math.hypot(x - s.x, z - s.z) < STONE_R)) return STONE_TOP; return FLOOR + 0.08 * Math.sin(x * 0.9 + z * 0.4) + 0.06 * Math.sin(z * 1.3 - x * 0.5); },
    constrain(wx: number, wz: number): [number, number] {
      let [x, z] = local(wx, wz); const onL = Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r - 0.2 && x > R - 2.2;
      if (!onL) { const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; } }
      else if (x > LEDGE.x + 1.3) x = LEDGE.x + 1.3;
      const d = Math.hypot(x, z), br = deadK > 0.5 ? 3.6 : BODY_R; if (d < br) { x *= br / Math.max(d, 1e-3); z *= br / Math.max(d, 1e-3); }
      return [x + KEEP_O.x, z + KEEP_O.z];
    },
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const inside = (v: THREE.Vector3) => { const x = v.x - KEEP_O.x, z = v.z - KEEP_O.z; if (v.y < Math.max(FLOOR, lev) + 0.45) return false; return (x * x + z * z) / (R + 1.8) ** 2 + ((v.y + 1.4) / (DOME_H - 1.5)) ** 2 < 1; };
      // M21b · near the arena wall, swing the boom up and over (a crane shot looking down) before shortening it, so the view never ends low and close.
      { let want = 0; if (!inside(cam)) { for (const u of [0.25, 0.45, 0.65, 0.85, 1]) { upV.lerpVectors(target, cam, 1 - u * 0.45); upV.y += u * 5.5; if (inside(upV)) { want = u; break; } want = 1; } }
        camUp = want > camUp ? Math.min(want, camUp + 0.025) : Math.max(want, camUp - 0.012); if (camUp > 0.001) { const u = camUp; cam.lerpVectors(target, cam, 1 - u * 0.45); cam.y += u * 5.5; } }
      let fr = 1; if (!inside(cam)) { let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; exV.lerpVectors(target, cam, m); if (inside(exV)) lo = m; else hi = m; } fr = Math.max(0.15, lo * 0.95); }
      // M20b: pull in at once (never through rock), ease back out (no boom pumping along the wall), and never sit inside the coil.
      camFr = fr < camFr ? fr : Math.min(fr, camFr + 0.025); cam.lerpVectors(target, cam, camFr);
      const cx = cam.x - KEEP_O.x, cz = cam.z - KEEP_O.z, cd = Math.hypot(cx, cz), br = (deadK > 0.5 ? 3.0 : BODY_R) + 0.3; if (cd < br && cam.y < root.position.y + 8.5) { cam.x = KEEP_O.x + cx / Math.max(cd, 1e-3) * br; cam.z = KEEP_O.z + cz / Math.max(cd, 1e-3) * br; }
    },
    /** Full reset to a fresh, waiting Keeper (defeat recovery / re-entry). */
    reset(defeated = false) { Object.assign(f, { state: defeated ? 'dead' : 'idle', phase: 1, hp: defeated ? 0 : KEEPER_HP, t: 0, slams: 0, revealed: 0, hitsThisWindow: 0, active: false }); lev = levWant = defeated ? LEV.low + 0.3 : LEV.mid; deadK = defeated ? 1 : 0; zone.visible = false; },
    /** Tide-Glass at low water: opens the chest-plates for T_REVEAL seconds. */
    reveal(): 'ok' | 'armoured' | 'already' { if (f.state !== 'low') return 'armoured'; if (f.revealed > 0) return 'already'; f.revealed = T_REVEAL; return 'ok'; },
    /** Ilka's strike. Returns what happened. */
    strike(dmg = 1): 'armoured' | 'hit' | 'phase' | 'dead' {
      if (f.state !== 'low' || f.revealed <= 0) return 'armoured';
      f.hp = Math.max(0, +(f.hp - dmg).toFixed(3)); if (f.hp < 0.05) f.hp = 0; hitK = 1; f.hitsThisWindow++;
      if (f.hp === 0) { go('dead', 0); f.revealed = 0; zone.visible = false; levWant = LEV.low + 0.3; return 'dead'; }
      const ph = f.hp <= 2 ? 3 : f.hp <= 4 ? 2 : 1; if (ph !== f.phase) { f.phase = ph; f.revealed = 0; go('intro', 1.6); levWant = LEV.mid; return 'phase'; }
      return 'hit';
    },
    /** One fixed tick of the fight. `ev` collects events; returns whether a pending hit landed on Ilka (spout or sweep). */
    tick(dt: number, wx: number, wz: number, paused: boolean, ev: KeeperEvent[]): boolean {
      if (f.hold) return false; const [px, pz] = local(wx, wz); let hit = false;
      if (f.revealed > 0) f.revealed = Math.max(0, f.revealed - dt);
      if (f.state === 'dead' || paused) { if (f.state !== 'dead' && f.state !== 'idle' && f.state !== 'low') { zone.visible = false; if (f.state === 'windup' || f.state === 'sweepWarn') go('recover', 0.6); } return false; }
      if (f.state === 'idle') { f.active = true; go('intro', 2.4); ev.push('intro'); levWant = LEV.mid; return false; }
      f.t -= dt;
      switch (f.state) {
        case 'intro': if (f.t <= 0) { f.slams = 0; go('recover', 0.4); } break;
        case 'recover': if (f.t <= 0) {
          if (f.slams < SLAMS[f.phase]) { f.slams++; f.zx = px; f.zz = pz; go('windup', T_SLAM[f.phase]); zone.visible = true; ev.push('windup'); }
          else { go('sweepWarn', T_SWEEP[f.phase]); levWant = LEV.high; ev.push('sweepWarn'); } } break;
        case 'windup': if (f.t <= 0) { zone.visible = false; spoutT = 1; impactK = 1; ev.push('spout'); if (Math.hypot(px - f.zx, pz - f.zz) < SPOUT_R) hit = true; go('recover', f.phase === 3 ? 0.75 : 1.0); } break;
        case 'sweepWarn': if (f.t <= 0) { sweepT = 1; ev.push('sweep'); if (!onStone(px, pz)) hit = true; levWant = LEV.low; go('ebb', 1.6); } break;
        case 'ebb': if (f.t <= 0) { go('low', T_LOW); f.hitsThisWindow = 0; ev.push('low'); } break;
        case 'low': if (f.t <= 0 && f.revealed <= 0) { f.slams = 0; levWant = LEV.mid; go('intro', 1.2); ev.push('rise'); } break;
      }
      return hit;
    },
    /** Visuals (cheap transforms/uniforms only). */
    update(time: number, dt: number, player: THREE.Vector3) {
      const k = Math.min(1, dt * 1.6); lev += (levWant - lev) * (f.state === 'sweepWarn' ? Math.min(1, dt * 2.4) : k); water.position.y = lev; wn.offset.set(time * 0.012, time * 0.008);
      const [px, pz] = local(player.x, player.z); const s = f.state;
      // stance: neck bend (x: forward/back), yaw toward Ilka
      const yawT = Math.atan2(px, pz); root.rotation.y += Math.atan2(Math.sin(yawT - root.rotation.y), Math.cos(yawT - root.rotation.y)) * Math.min(1, dt * (s === 'windup' ? 5 : 2.5));
      if (s === 'sweepWarn') root.rotation.y += dt * 2.2; // the coil turns, gathering the tide
      let bend = 0.1 * Math.sin(time * 0.8), rise = 0.0, side = 0;
      if (s === 'windup') { const p = 1 - Math.max(0, f.t) / T_SLAM[f.phase]; bend = -0.55 * p; rise = 0.6 * p; }
      else if (s === 'recover' || s === 'intro') { bend = 0.25 * impactK; }
      else if (s === 'sweepWarn') { bend = -0.2; rise = 0.3; }
      else if (s === 'low' || s === 'ebb') { bend = 0.35; side = 1.5; rise = -0.7; } // slumps sideways: head on the floor to its left, chest (and heart) turned to Ilka
      impactK = Math.max(0, impactK - dt * 2); kelpU.uKT.value = time;
      { const jw = s === 'windup' ? 0.55 * (1 - Math.max(0, f.t) / T_SLAM[f.phase]) : s === 'sweepWarn' ? 0.35 : s === 'dead' ? 0.05 : 0.08 + 0.05 * Math.sin(time * 0.7); jaw.rotation.x += (jw - jaw.rotation.x) * Math.min(1, dt * 8); }
      deadK = s === 'dead' ? Math.min(1, deadK + dt / 3) : 0;
      if (s === 'dead') { bend = 0.3; side = 1.6; rise = -1.2 * deadK; }
      for (let i = 0; i < segs.length; i++) { const sg = segs[i]; const tgt = bend / segs.length * (i < 2 ? 0.4 : 1.3) + 0.04 * Math.sin(time * 1.3 - i * 0.6); sg.rotation.x += (tgt - sg.rotation.x) * Math.min(1, dt * 6); const tz = side / segs.length * (i < 2 ? 0.4 : 1.3) + 0.05 * Math.sin(time * 0.9 - i * 0.5) * (1 - deadK); sg.rotation.z += (tz - sg.rotation.z) * Math.min(1, dt * 4); }
      root.position.y += (rise + (s === 'idle' ? -1.2 : 0) - root.position.y) * Math.min(1, dt * 3);
      revealK += ((f.revealed > 0 || s === 'dead' ? 1 : 0) - revealK) * Math.min(1, dt * 6);
      plates[0].rotation.y = revealK * 1.9; plates[1].rotation.y = -revealK * 1.9;
      hitK = Math.max(0, hitK - dt * 3);
      coreM.emissiveIntensity = (0.4 + revealK * 2.6 + hitK * 4) * (1 - 0.85 * deadK) * (high ? 1 : 0.4); // Lite has no bloom/tonemap headroom: keep the heart shaded, not a flat white disc (coreHalo.material as THREE.SpriteMaterial).opacity = revealK * (0.7 + 0.2 * Math.sin(time * 6)) * (1 - deadK);
      collarM.emissiveIntensity = (0.5 + (f.phase - 1) * 0.6 + (s === 'windup' || s === 'sweepWarn' ? 0.9 + 0.6 * Math.sin(time * 14) : 0)) * (1 - deadK);
      eyeM.color.setRGB(0.75 + (s === 'windup' ? 0.25 : 0), s === 'windup' ? 0.6 : 0.97, s === 'windup' ? 0.45 : 1).multiplyScalar(1 - 0.8 * deadK); lureM.color.copy(eyeM.color);
      (lureHalo.material as THREE.SpriteMaterial).opacity = 0.8 * (1 - deadK);
      chest.getWorldPosition(exV); coreLight.position.copy(exV).add(new THREE.Vector3(0, 0, 0)); coreLight.intensity = (0.6 + revealK * 2.4 + hitK * 4) * (1 - 0.7 * deadK);
      // telegraphs
      if (zone.visible) { const p = 1 - Math.max(0, f.t) / T_SLAM[f.phase]; zone.position.set(f.zx, Math.max(lev, FLOOR + 0.18) + 0.06, f.zz); const fl = zone.getObjectByName('fill')!; fl.scale.setScalar(0.15 + 0.85 * p); zoneMat.opacity = 0.88 + 0.12 * Math.sin(time * 18); }
      spoutT = Math.max(0, spoutT - dt * 1.4); (geyser.material as THREE.MeshBasicMaterial).opacity = spoutT * 0.55; geyser.position.set(f.zx, Math.max(lev, FLOOR), f.zz); geyser.scale.set(1, 0.2 + (1 - spoutT) * 0.8 + spoutT * 0.4, 1);
      const sw = s === 'sweepWarn' ? 1 - Math.max(0, f.t) / T_SWEEP[f.phase] : 0; stoneGlow.opacity = s === 'sweepWarn' ? 0.55 + 0.4 * Math.sin(time * 10) : 0;
      sweepT = Math.max(0, sweepT - dt * 0.9); const sr = s === 'sweepWarn' ? 3 + sw * 3 : 3 + (1 - sweepT) * 21; sweepRing.scale.setScalar(sr); sweepRing.position.y = lev + 0.05; (sweepRing.material as THREE.MeshBasicMaterial).opacity = s === 'sweepWarn' ? 0.35 + 0.3 * sw : sweepT * 0.8;
    },
  };
  api.reset();
  return api;
}
export type Keeper = ReturnType<typeof makeKeeper>;
