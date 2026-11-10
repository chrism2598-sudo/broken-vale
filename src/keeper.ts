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
const R = 14.2, FLOOR = -0.9, STONE_TOP = 0.8, STONE_R = 1.65, BODY_R = 4.3, MELEE = 5.9;
const STONES = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return { x: Math.cos(a) * 8.6, z: Math.sin(a) * 8.6 }; });
const LEDGE = { x: 14.6, z: 0, r: 2.7 }, LEDGE_Y = 0.6;
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
  card: { k: 'Chapter II complete', title: 'The Second Seam', tease: 'The Drowned Keeper rests at last. Enna lit the Lowtide Lamp and is waiting there — the seam below the sea is quiet, and the sky above still needs tying shut.' },
};

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
  const moon = new THREE.DirectionalLight('#bfe2ff', 0.9); moon.position.set(KEEP_O.x + 6, 30, KEEP_O.z - 5); moon.target.position.set(KEEP_O.x, 0, KEEP_O.z); scene.add(moon, moon.target);
  if (high) { moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 }); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.05; }
  const coreLight = new THREE.PointLight('#6fe8ff', 2.0, 16, 1.4); scene.add(coreLight);
  const rock = triplanar(t.rock, 3.0, '#8e8a84', { rough: 0.55, sat: 0.5 }), wet = triplanar(t.rock, 1.4, '#9d958b', { rough: 0.42, sat: 0.55 }), floorM = triplanar(t.bed, 1.5, '#5f5b55', { rough: 0.36, sat: 0.7 });
  // Dome (inward) and basin floor with vertex-colour wet/salt mottling.
  { const d = new THREE.SphereGeometry(1, high ? 72 : 48, high ? 28 : 18, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.6 * Math.sin(x * 6 + z * 2) * Math.cos(y * 5 - x * 2) + 0.3 * Math.sin(z * 12 + y * 8); p.setXYZ(i, x * (R + 3 + n * 1.2), y * 12 + n * 0.6 * y - 1.4, z * (R + 3 + n * 1.2)); }
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
    const st: THREE.BufferGeometry[] = []; for (let i = 0; i < (high ? 50 : 30); i++) { const a = rnd() * Math.PI * 2, r = rnd() * (R + 1); const y = 12 * Math.sqrt(Math.max(0.05, 1 - (r / (R + 3)) ** 2)) - 1.8; const h = 0.8 + rnd() * 2.6; const c = new THREE.ConeGeometry(0.15 + rnd() * 0.25, h, 6, 2); c.rotateX(Math.PI); c.translate(Math.cos(a) * r, y - h / 2 + 0.3, Math.sin(a) * r); st.push(c); }
    g.add(new THREE.Mesh(mergeGeometries(st), wet)); }
  // Glow-lichen (static instanced flecks) around the walls.
  { const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: '#3fe6d0' }), high ? 360 : 200); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < im.count; i++) { const a = rnd() * Math.PI * 2, y = FLOOR + 0.4 + rnd() ** 1.5 * 4; const r = (R + 2.6) * Math.sqrt(Math.max(0.05, 1 - ((y + 1.4) / 12) ** 2)); q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)); sc.setScalar(0.6 + rnd() * 1.6); mx.compose(v.set(Math.cos(a) * r, y, Math.sin(a) * r), q, sc); im.setMatrixAt(i, mx); }
    im.frustumCulled = false; g.add(im); }
  // Water: one plane at the fight's tide level, scrolling normals (no rebuilds).
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping; const wn = waterNormals.clone(); wn.repeat.set(5, 5); wn.needsUpdate = true;
  const waterM = new THREE.MeshStandardMaterial({ color: '#0e4a52', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), emissive: '#08343a', depthWrite: false });
  const water = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 48).rotateX(-Math.PI / 2), waterM); water.renderOrder = 2; water.userData.noAO = true; g.add(water);
  // ---- The Keeper: coiled body in the water, ringed neck of custodian collars, hooded nacre head with a lantern-lure, tide-glass heart behind two chest-plates.
  const nacre = new THREE.MeshStandardMaterial({ color: '#93a6a0', roughness: 0.3, metalness: 0.12, emissive: '#0d3a3a', emissiveIntensity: 0.22 });
  const slate = triplanar(t.rock, 1.1, '#5d625f', { rough: 0.45, sat: 0.4 });
  const collarM = new THREE.MeshStandardMaterial({ color: '#7a7466', roughness: 0.55, emissive: '#3fd0ff', emissiveIntensity: 0.6 });
  const eyeM = new THREE.MeshBasicMaterial({ color: '#bff8ff' }), lureM = new THREE.MeshBasicMaterial({ color: '#9ff4ff' }), coreM = new THREE.MeshStandardMaterial({ color: '#1a4a50', emissive: '#7ff0ff', emissiveIntensity: 0.4 });
  const root = new THREE.Group(); g.add(root);
  const M = (geo: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = cast && high; x.receiveShadow = true; return x; };
  { const tg = new THREE.TorusGeometry(3.1, 1.05, 14, 56); tg.rotateX(Math.PI / 2); const p = tg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + 0.35 * Math.sin(a * 3)); } tg.computeVertexNormals(); root.add(M(tg, nacre));
    const sp: THREE.BufferGeometry[] = []; for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; const c = new THREE.ConeGeometry(0.22, 0.9, 5); c.translate(0, 0.45, 0); c.rotateZ(-0.35); c.rotateY(-a); c.translate(Math.cos(a) * 3.1, 0.9 + 0.35 * Math.sin(a * 3), Math.sin(a) * 3.1); sp.push(c); } root.add(M(mergeGeometries(sp), slate)); }
  const segs: THREE.Group[] = []; let parent: THREE.Object3D = root; const SEG = 0.9;
  for (let i = 0; i < 7; i++) { const s = new THREE.Group(); s.position.y = i === 0 ? 0.2 : SEG; parent.add(s); segs.push(s); const r = 1.0 - i * 0.06;
    const b = M(new THREE.SphereGeometry(r, 16, 10), nacre); b.scale.set(1, 1.15, 1); s.add(b); if (i % 2 === 1) { const c = M(new THREE.TorusGeometry(r * 1.02, 0.14, 6, 24), collarM); c.rotation.x = Math.PI / 2; s.add(c); } parent = s; }
  const head = new THREE.Group(); head.position.y = SEG; parent.add(head);
  { const hood = M(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), slate); hood.scale.set(1.05, 0.75, 1.6); hood.position.set(0, 0.1, 0.2); head.add(hood);
    const skull = M(new THREE.SphereGeometry(0.75, 18, 12), nacre); skull.scale.set(0.9, 0.6, 1.6); skull.position.set(0, -0.05, 0.75); head.add(skull);
    const jaw = M(new THREE.SphereGeometry(0.55, 14, 8), nacre); jaw.scale.set(0.85, 0.4, 1.5); jaw.position.set(0, -0.38, 0.8); head.add(jaw);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeM); e.position.set(sx * 0.45, 0.08, 1.15); head.add(e); }
    const stalk = M(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), slate, false); stalk.position.set(0, 0.95, 1.1); stalk.rotation.x = 0.9; head.add(stalk);
    const lure = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lureM); lure.position.set(0, 1.35, 1.75); head.add(lure); }
  const lureHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gradTex([[0, 'rgba(180,250,255,1)'], [0.4, 'rgba(80,210,255,0.35)'], [1, 'rgba(40,160,255,0)']], 4, 128, true), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); lureHalo.scale.setScalar(2.4); lureHalo.position.set(0, 1.35, 1.75); lureHalo.layers.set(1); head.add(lureHalo);
  // Heart and chest-plates on the front of the neck base.
  const chest = new THREE.Group(); chest.position.set(0, 0.55, 0.92); segs[1].add(chest);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), coreM); chest.add(core);
  const coreHalo = new THREE.Sprite(lureHalo.material.clone()); coreHalo.scale.setScalar(3.2); coreHalo.layers.set(1); (coreHalo.material as THREE.SpriteMaterial).opacity = 0; chest.add(coreHalo);
  const plates = [-1, 1].map((sx) => { const pg = new THREE.Group(); pg.position.set(sx * 0.7, 0, -0.1); chest.add(pg); const pl = M(new THREE.SphereGeometry(0.78, 14, 10, sx < 0 ? Math.PI : 0, Math.PI, 0, Math.PI), slate); pl.scale.set(1, 1.15, 0.7); pl.rotation.y = -Math.PI / 2; pl.position.x = -sx * 0.7; pg.add(pl); return pg; });
  // Telegraphs: spout ring (under Ilka) + geyser column; sweep foam ring.
  const zoneMat = new THREE.MeshBasicMaterial({ color: '#ff6a2a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const zoneFill = new THREE.MeshBasicMaterial({ color: '#d8401a', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const zone = new THREE.Group(); zone.visible = false; g.add(zone);
  { const r = new THREE.Mesh(new THREE.RingGeometry(SPOUT_R - 0.22, SPOUT_R, 48), zoneMat); r.rotation.x = -Math.PI / 2; zone.add(r); const f = new THREE.Mesh(new THREE.CircleGeometry(SPOUT_R, 40), zoneFill); f.rotation.x = -Math.PI / 2; f.name = 'fill'; zone.add(f); zone.layers.set(1); zone.children.forEach((c) => { c.layers.set(1); c.renderOrder = 5; }); }
  const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#cff6ff', map: gradTex([[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0.1)']]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  geyser.geometry.translate(0, 2.5, 0); geyser.layers.set(1); geyser.renderOrder = 5; g.add(geyser);
  const sweepRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sweepRing.rotation.x = -Math.PI / 2; sweepRing.layers.set(1); sweepRing.renderOrder = 5; g.add(sweepRing);
  // ---- fight state ----
  const f = { hold: false, state: 'idle' as KeeperState, phase: 1, hp: KEEPER_HP, t: 0, slams: 0, revealed: 0, zx: 0, zz: 0, hitsThisWindow: 0, active: false };
  let lev = LEV.mid, levWant = LEV.mid, spoutT = 0, sweepT = 0, deadK = 0, revealK = 0, hitK = 0, impactK = 0;
  const go = (s: KeeperState, t: number) => { f.state = s; f.t = t; };
  const onStone = (lx: number, lz: number) => STONES.some((s) => Math.hypot(lx - s.x, lz - s.z) < STONE_R + 0.15) || Math.hypot(lx - LEDGE.x, lz - LEDGE.z) < LEDGE.r;
  const local = (wx: number, wz: number) => [wx - KEEP_O.x, wz - KEEP_O.z] as const;
  const exV = new THREE.Vector3();
  const api = {
    rig: { root, segs, head, chest }, scene, entry: L(LEDGE.x - 0.4, 0), exit: L(LEDGE.x + 1.0, 0), center: L(0, 0), stones: STONES.map((s) => L(s.x, s.z)), melee: MELEE,
    set hold(v: boolean) { f.hold = v; }, get state() { return f.state; }, get hp() { return f.hp; }, get phase() { return f.phase; }, get revealed() { return f.revealed > 0; }, get level() { return lev; }, get active() { return f.active; }, get zone() { return f.state === 'windup' ? L(f.zx, f.zz) : null; },
    onStone(wx: number, wz: number) { const [x, z] = local(wx, wz); return onStone(x, z); },
    onLedge(wx: number, wz: number) { const [x, z] = local(wx, wz); return Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r && x > 11.6; },
    groundY(wx: number, wz: number) { const [x, z] = local(wx, wz); if (Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r) return LEDGE_Y; if (STONES.some((s) => Math.hypot(x - s.x, z - s.z) < STONE_R)) return STONE_TOP; return FLOOR + 0.08 * Math.sin(x * 0.9 + z * 0.4) + 0.06 * Math.sin(z * 1.3 - x * 0.5); },
    constrain(wx: number, wz: number): [number, number] {
      let [x, z] = local(wx, wz); const onL = Math.hypot(x - LEDGE.x, z - LEDGE.z) < LEDGE.r - 0.2 && x > 12;
      if (!onL) { const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; } }
      else if (x > LEDGE.x + 1.3) x = LEDGE.x + 1.3;
      const d = Math.hypot(x, z), br = deadK > 0.5 ? 3.6 : BODY_R; if (d < br) { x *= br / Math.max(d, 1e-3); z *= br / Math.max(d, 1e-3); }
      return [x + KEEP_O.x, z + KEEP_O.z];
    },
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const inside = (v: THREE.Vector3) => { const x = v.x - KEEP_O.x, z = v.z - KEEP_O.z; if (v.y < Math.max(FLOOR, lev) + 0.45) return false; return (x * x + z * z) / (R + 1.8) ** 2 + ((v.y + 1.4) / 10.5) ** 2 < 1; };
      if (inside(cam)) return; let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; exV.lerpVectors(target, cam, m); if (inside(exV)) lo = m; else hi = m; } cam.lerpVectors(target, cam, Math.max(0.15, lo * 0.95));
    },
    /** Full reset to a fresh, waiting Keeper (defeat recovery / re-entry). */
    reset(defeated = false) { Object.assign(f, { state: defeated ? 'dead' : 'idle', phase: 1, hp: defeated ? 0 : KEEPER_HP, t: 0, slams: 0, revealed: 0, hitsThisWindow: 0, active: false }); lev = levWant = defeated ? LEV.low + 0.3 : LEV.mid; deadK = defeated ? 1 : 0; zone.visible = false; },
    /** Tide-Glass at low water: opens the chest-plates for T_REVEAL seconds. */
    reveal(): 'ok' | 'armoured' | 'already' { if (f.state !== 'low') return 'armoured'; if (f.revealed > 0) return 'already'; f.revealed = T_REVEAL; return 'ok'; },
    /** Ilka's strike. Returns what happened. */
    strike(): 'armoured' | 'hit' | 'phase' | 'dead' {
      if (f.state !== 'low' || f.revealed <= 0) return 'armoured';
      f.hp = Math.max(0, f.hp - 1); hitK = 1; f.hitsThisWindow++;
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
      impactK = Math.max(0, impactK - dt * 2);
      deadK = s === 'dead' ? Math.min(1, deadK + dt / 3) : 0;
      if (s === 'dead') { bend = 0.3; side = 1.6; rise = -1.2 * deadK; }
      for (let i = 0; i < segs.length; i++) { const sg = segs[i]; const tgt = bend / segs.length * (i < 2 ? 0.4 : 1.3) + 0.04 * Math.sin(time * 1.3 - i * 0.6); sg.rotation.x += (tgt - sg.rotation.x) * Math.min(1, dt * 6); const tz = side / segs.length * (i < 2 ? 0.4 : 1.3) + 0.05 * Math.sin(time * 0.9 - i * 0.5) * (1 - deadK); sg.rotation.z += (tz - sg.rotation.z) * Math.min(1, dt * 4); }
      root.position.y += (rise + (s === 'idle' ? -1.2 : 0) - root.position.y) * Math.min(1, dt * 3);
      revealK += ((f.revealed > 0 || s === 'dead' ? 1 : 0) - revealK) * Math.min(1, dt * 6);
      plates[0].rotation.y = revealK * 1.9; plates[1].rotation.y = -revealK * 1.9;
      hitK = Math.max(0, hitK - dt * 3);
      coreM.emissiveIntensity = (0.4 + revealK * 2.6 + hitK * 4) * (1 - 0.85 * deadK); (coreHalo.material as THREE.SpriteMaterial).opacity = revealK * (0.7 + 0.2 * Math.sin(time * 6)) * (1 - deadK);
      collarM.emissiveIntensity = (0.5 + (f.phase - 1) * 0.6 + (s === 'windup' || s === 'sweepWarn' ? 0.9 + 0.6 * Math.sin(time * 14) : 0)) * (1 - deadK);
      eyeM.color.setRGB(0.75 + (s === 'windup' ? 0.25 : 0), s === 'windup' ? 0.6 : 0.97, s === 'windup' ? 0.45 : 1).multiplyScalar(1 - 0.8 * deadK); lureM.color.copy(eyeM.color);
      (lureHalo.material as THREE.SpriteMaterial).opacity = 0.8 * (1 - deadK);
      chest.getWorldPosition(exV); coreLight.position.copy(exV).add(new THREE.Vector3(0, 0, 0)); coreLight.intensity = (0.6 + revealK * 2.4 + hitK * 4) * (1 - 0.7 * deadK);
      // telegraphs
      if (zone.visible) { const p = 1 - Math.max(0, f.t) / T_SLAM[f.phase]; zone.position.set(f.zx, Math.max(lev, FLOOR + 0.18) + 0.06, f.zz); const fl = zone.getObjectByName('fill')!; fl.scale.setScalar(0.15 + 0.85 * p); zoneMat.opacity = 0.6 + 0.4 * Math.sin(time * 18); }
      spoutT = Math.max(0, spoutT - dt * 1.4); (geyser.material as THREE.MeshBasicMaterial).opacity = spoutT * 0.55; geyser.position.set(f.zx, Math.max(lev, FLOOR), f.zz); geyser.scale.set(1, 0.2 + (1 - spoutT) * 0.8 + spoutT * 0.4, 1);
      const sw = s === 'sweepWarn' ? 1 - Math.max(0, f.t) / T_SWEEP[f.phase] : 0; stoneGlow.opacity = s === 'sweepWarn' ? 0.55 + 0.4 * Math.sin(time * 10) : 0;
      sweepT = Math.max(0, sweepT - dt * 0.9); const sr = s === 'sweepWarn' ? 3 + sw * 3 : 3 + (1 - sweepT) * 14; sweepRing.scale.setScalar(sr); sweepRing.position.y = lev + 0.05; (sweepRing.material as THREE.MeshBasicMaterial).opacity = s === 'sweepWarn' ? 0.35 + 0.3 * sw : sweepT * 0.8;
    },
  };
  api.reset();
  return api;
}
export type Keeper = ReturnType<typeof makeKeeper>;
