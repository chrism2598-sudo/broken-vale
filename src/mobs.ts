import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** M20 · Hollow Sentinel: an empty suit of armour that guards keep interiors. Reusable melee mob:
 *  idle → notice → approach → telegraphed swing (raised arm + glowing ring) → recover; heavy/staggering hits interrupt the wind-up. */
export const MOB_HP = 4, MOB_XP = 12;
export type MobHit = 'swing' | null;
/** M20b · overworld variants: 'shade' (night wraith, quick), 'brute' (big night husk, two-HP blows), 'husk' (weak day roamer). */
export type MobLook = 'sentinel' | 'shade' | 'brute' | 'husk' | 'cultist' | 'zealot' | 'barrow' | 'king' | 'drowned';
export type MobOpts = { look?: MobLook; hp?: number; speed?: number; notice?: number; windup?: number; dmg?: number; xp?: number; name?: string; ground?: (x: number, z: number) => number };
const STATS: Record<MobLook, Required<Omit<MobOpts, 'ground' | 'look'>>> = {
  sentinel: { hp: MOB_HP, speed: 2.0, notice: 9, windup: 0.85, dmg: 1, xp: MOB_XP, name: 'Sentinel' },
  shade: { hp: 5, speed: 3.1, notice: 14, windup: 0.7, dmg: 1, xp: 9, name: 'Gloam Shade' },
  brute: { hp: 9, speed: 2.2, notice: 12, windup: 1.15, dmg: 2, xp: 22, name: 'Gloam Brute' },
  husk: { hp: 3, speed: 1.8, notice: 8, windup: 0.95, dmg: 1, xp: 5, name: 'Wayside Husk' },
  // M20b-2 · Ashen Hollow cultists, the barrow dead and their king
  cultist: { hp: 5, speed: 2.7, notice: 13, windup: 0.8, dmg: 1, xp: 12, name: 'Ashen Cultist' },
  zealot: { hp: 12, speed: 2.3, notice: 14, windup: 1.05, dmg: 2, xp: 35, name: 'Ashen Zealot' },
  barrow: { hp: 4, speed: 2.0, notice: 10, windup: 0.9, dmg: 1, xp: 10, name: 'Barrow Dead' },
  king: { hp: 26, speed: 2.1, notice: 16, windup: 1.0, dmg: 2, xp: 90, name: 'Ossric, the Barrow-King' },
  drowned: { hp: 5, speed: 1.9, notice: 10, windup: 0.9, dmg: 1, xp: 14, name: 'Tide-Wight' },
};

/** M52 · shared realism layer for every foe: a tiny procedural wear texture (scratches, pitting, cloth weave) drives roughness + bump on
 *  armour / leather / robes, and one shared onBeforeCompile adds a cool fresnel rim that rises at night so silhouettes read against the dark.
 *  Materials and shaders only: no geometry, draw-call or animation change. */
export const mobFx = { night: { value: 0 } };
let wearTex: THREE.CanvasTexture | null = null;
function wear() {
  if (wearTex) return wearTex; const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d')!;
  const im = x.createImageData(N, N); let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) { const v = 150 + (r() - 0.5) * 60; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); x.globalAlpha = 0.5;
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI, l = 6 + r() * 26, px = r() * N, py = r() * N; x.strokeStyle = r() < 0.5 ? '#ffffff' : '#3a3a3a'; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.6 ? '#2e2e2e' : '#e0e0e0'; x.beginPath(); x.arc(r() * N, r() * N, 0.6 + r() * 1.6, 0, 7); x.fill(); }
  wearTex = new THREE.CanvasTexture(c); wearTex.wrapS = wearTex.wrapT = THREE.RepeatWrapping; wearTex.repeat.set(3, 3); wearTex.colorSpace = THREE.NoColorSpace; return wearTex;
}
function realize(m: THREE.MeshStandardMaterial, bump: number, rim: string) {
  const t = wear(); m.roughnessMap = t; m.bumpMap = t; m.bumpScale = bump; const rc = new THREE.Color(rim);
  m.onBeforeCompile = (sh) => { sh.uniforms.uMobNight = mobFx.night; sh.uniforms.uRim = { value: rc };
    sh.fragmentShader = 'uniform float uMobNight; uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr = pow(1.0 - clamp(dot(normal, normalize(-vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += uRim * fr * (0.05 + 1.0 * uMobNight); }`); };
  m.customProgramCacheKey = () => 'mobrim'; m.needsUpdate = true; return m;
}
export function makeSentinel(id: string, x: number, z: number, y: number, face: number, tint = '#8d9196', opts: MobOpts = {}) {
  const look = opts.look ?? 'sentinel', S = { ...STATS[look], ...opts }; const HPM = S.hp, WINDUP = S.windup, SPEED = S.speed, NOTICE = S.notice, ground = opts.ground;
  const g = new THREE.Group(); g.position.set(x, ground ? ground(x, z) : y, z); g.rotation.y = face;
  const shade = look === 'shade', drowned = look === 'drowned', robe = shade || look === 'cultist' || look === 'zealot', big = look === 'brute' || look === 'zealot' || look === 'king';
  const plate = new THREE.MeshStandardMaterial({ color: shade ? '#1b1d2a' : drowned ? '#3d5a58' : tint, metalness: robe ? 0 : drowned ? 0.7 : 0.55, roughness: robe ? 0.9 : drowned ? 0.28 : 0.4, transparent: shade, opacity: shade ? 0.92 : 1 }), dark = new THREE.MeshStandardMaterial({ color: shade ? '#0c0d14' : drowned ? '#1a2a28' : '#2b2a2c', metalness: shade ? 0 : 0.6, roughness: drowned ? 0.4 : 0.6 });
  realize(plate, robe ? 0.6 : 0.35, shade ? '#7a6cff' : drowned ? '#5fd6c0' : '#9fb6d8'); realize(dark, 0.5, shade ? '#5a4cc0' : '#7f93b0');
  const EYE = shade ? '#b7a6ff' : drowned ? '#4ee0c8' : look === 'brute' || robe || look === 'king' ? '#ffb15a' : look === 'barrow' ? '#9fe0b0' : '#7fd8ff'; const eyeM = new THREE.MeshBasicMaterial({ color: EYE });
  let homeX = x, homeZ = z;
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number, parent: THREE.Object3D = g) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; parent.add(me); return me; };
  const body = new THREE.Group(); g.add(body);
  if (robe) { // hooded wraith (shade) / ash-robed cultist: a ragged robe cone, deep hood, two violet eyes; floats a hand above the ground
    add(new THREE.ConeGeometry(0.55, 1.7, 9, 3, true), plate, 0, 0.95, 0, body); add(new THREE.SphereGeometry(0.24, 10, 8), dark, 0, 1.82, 0.02, body).scale.set(1, 1.2, 1);
    add(new THREE.ConeGeometry(0.3, 0.55, 9, 1, true), plate, 0, 2.0, -0.04, body).rotation.x = -0.25;
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.045, 6, 4), eyeM, s * 0.08, 1.84, 0.2, body);
  } else {
    add(new THREE.CylinderGeometry(0.34, 0.26, 0.75, 10), plate, 0, 1.3, 0, body); // chest
    add(new THREE.CylinderGeometry(0.27, 0.3, 0.3, 10), dark, 0, 0.85, 0, body); // waist
    add(new THREE.SphereGeometry(0.17, 10, 8), plate, 0, 1.85, 0, body).scale.set(1, 1.15, 1); // helm
    add(new THREE.BoxGeometry(0.22, 0.04, 0.05), eyeM, 0, 1.87, 0.15, body);
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.15, 8, 6), plate, s * 0.4, 1.6, 0, body); add(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 8), plate, s * 0.13, 0.4, 0, body); }
  }
  if (look === 'brute' || look === 'zealot') body.scale.setScalar(1.4); else if (look === 'king') body.scale.setScalar(1.65); else if (look === 'husk' || look === 'barrow') body.scale.set(0.95, 0.9, 0.95);
  if (look === 'king') { const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.12, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide })); crown.position.y = 2.05; body.add(crown); }
  if (look === 'cultist' || look === 'zealot') { const sash = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16), new THREE.MeshStandardMaterial({ color: '#8a2a14', roughness: 0.8 })); sash.rotation.x = Math.PI / 2; sash.position.y = 1.05; body.add(sash); }
  if (drowned) { const kelp = new THREE.MeshStandardMaterial({ color: '#2c3a22', roughness: 0.85 }); const sash = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 6, 14), kelp); sash.rotation.x = Math.PI / 2; sash.position.y = 1.15; body.add(sash); for (const [sx, sy, sz] of [[0.12, 1.92, 0.1], [-0.14, 1.55, 0.16], [0.22, 1.35, -0.05]] as const) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: '#c9bba8', roughness: 0.7 })); b.position.set(sx, sy, sz); body.add(b); } }
  { // M38 · the body's rigid parts merged per material (one draw + one shadow call per material instead of per part); eyes cast no shadow
    const by = new Map<THREE.Material, THREE.BufferGeometry[]>(), parts: THREE.Mesh[] = [];
    for (const o of body.children) { const me = o as THREE.Mesh; if (!me.isMesh || Array.isArray(me.material)) continue; me.updateMatrix(); const gq = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone(); gq.applyMatrix4(me.matrix); const l = by.get(me.material) ?? []; l.push(gq); by.set(me.material, l); parts.push(me); }
    const ok = [...by.values()].every((gs) => !!mergeGeometries(gs));
    if (ok) { for (const me of parts) { body.remove(me); me.geometry.dispose(); }
      for (const [mat, gs] of by) { const me = new THREE.Mesh(mergeGeometries(gs)!, mat); me.castShadow = mat !== eyeM; body.add(me); } } }
  const armL = new THREE.Group(); armL.position.set(-0.42, 1.55, 0); body.add(armL); add(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), plate, 0, -0.35, 0, armL);
  const shield = add(new THREE.BoxGeometry(0.08, 0.7, 0.5), dark, -0.12, -0.55, 0.12, armL); shield.rotation.y = 0.3;
  const armR = new THREE.Group(); armR.position.set(0.42, 1.55, 0); body.add(armR); add(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), plate, 0, -0.35, 0, armR);
  const sword = add(new THREE.BoxGeometry(0.06, 1.1, 0.02), new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.9, roughness: 0.3 }), 0, -1.15, 0.08, armR);
  if (shade) for (const o of [armL, armR]) o.traverse((q) => { (q as THREE.Mesh).castShadow = false; }); // M38 · the translucent night wraith's thin arms, shield and blade skip the shadow pass (body shadow stays)
  const ringM = new THREE.MeshBasicMaterial({ color: '#ff6a3a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const RR = look === 'king' ? 3.0 : big ? 2.6 : 2.1; const ring = new THREE.Mesh(new THREE.RingGeometry(RR - 0.15, RR, 32, 1, -0.9, 1.8), ringM); ring.rotation.x = -Math.PI / 2; ring.rotation.z = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; g.add(ring); // M38: hidden while transparent (no draw call)
  const REACH = RR, RECOVER = look === 'shade' ? 0.8 : 1.1;
  let bob = 0, hp = HPM, state: 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead' = 'idle', t = 0, flash = 0, deadT = 0; void sword;
  let flinch = 0, kbx = 0, kbz = 0, stopT = 0; // M47 · hit reaction: a short lean-back flinch and a knockback slide away from the blow
  const m = {
    id, group: g, look, maxHp: HPM, dmg: S.dmg, xp: S.xp, name: S.name,
    setHome(hx: number, hz: number) { homeX = hx; homeZ = hz; },
    /** Bring a dead (or wandering) mob back fresh at a spot (roaming-group respawn). */
    respawn(rx: number, rz: number) { hp = HPM; state = 'idle'; t = 0; deadT = 0; flash = 0; homeX = rx; homeZ = rz; g.position.set(rx, ground ? ground(rx, rz) : y, rz); g.visible = true; body.rotation.set(0, 0, 0); body.position.y = 0; ringM.opacity = 0; },
    get x() { return g.position.x; }, get z() { return g.position.z; }, get y() { return g.position.y; },
    get hp() { return hp; }, get state() { return state; }, get alive() { return state !== 'dead'; },
    get winding() { return state === 'windup'; },
    reset() { if (state === 'dead') return; hp = HPM; state = 'idle'; t = 0; g.position.set(x, y, z); g.rotation.y = face; ringM.opacity = 0; },
    kill() { hp = 0; state = 'dead'; deadT = 9; g.visible = false; },
    /** dmg already scaled; stagger ≥ 0.8 interrupts a wind-up. Returns true when this blow killed it. */
    hit(dmg: number, stagger: number, fromX?: number, fromZ?: number) {
      if (state === 'dead') return false; hp -= dmg; flash = 0.18;
      if (dmg > 0 && fromX !== undefined && fromZ !== undefined) { const dx = g.position.x - fromX, dz = g.position.z - fromZ, d = Math.hypot(dx, dz) || 1, v = stagger >= 0.8 ? 5.2 : 2.8; kbx = dx / d * v; kbz = dz / d * v; flinch = 1; stopT = stagger >= 0.8 ? 0.09 : 0.055; } // M47 · hit-stop: the struck foe freezes on contact for a beat
      if (hp <= 0) { state = 'dead'; deadT = 0; ringM.opacity = 0; return true; }
      if (stagger >= 0.8 || state !== 'windup') { state = 'stagger'; t = stagger >= 0.8 ? 0.9 : 0.35; }
      return false;
    },
    /** walk(x,z) says whether the mob may stand there. Returns 'swing' on the frame the blow lands (main resolves it). */
    tick(dt: number, px: number, pz: number, py: number, walk: (x: number, z: number) => boolean, playerDown: boolean, canSee = true): MobHit {
      if (stopT > 0 && state !== 'dead') { stopT -= dt; plate.emissive.setRGB(0.72, 0.54, 0.36); return null; }
      flash = Math.max(0, flash - dt); flinch = Math.max(0, flinch - dt * 4.5);
      { const wk = state === 'windup' ? 1 - Math.max(0, t) / WINDUP : 0, tell = state === 'windup' && t < 0.2 ? 0.5 + 0.5 * Math.sin(t * 60) : 0; // M47 · the wind-up glows hotter as it builds, and flickers in the last 0.2 s before the blow
        plate.emissive.setRGB(flash * 4 + wk * 0.35 + tell * 0.5, flash * 3 + wk * 0.1 + tell * 0.18, flash * 2); }
      if (state !== 'dead' && (kbx !== 0 || kbz !== 0)) { const nx = g.position.x + kbx * dt, nz = g.position.z + kbz * dt; if (walk(nx, nz)) { g.position.x = nx; g.position.z = nz; } else { kbx = 0; kbz = 0; } const dec = Math.exp(-dt * 9); kbx *= dec; kbz *= dec; if (Math.hypot(kbx, kbz) < 0.05) { kbx = 0; kbz = 0; } }
      if (state === 'dead') { deadT += dt; body.rotation.x = Math.min(1.4, deadT * 2.5); body.position.y = -Math.min(0.9, deadT * 1.2); if (deadT > 1.2) g.visible = false; return null; }
      const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz), sameFloor = Math.abs(py - g.position.y) < (ground ? 3 : 1.2) && canSee;
      const want = Math.atan2(dx, dz); const turn = (rate: number) => { let a = want - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += Math.max(-rate * dt, Math.min(rate * dt, a)); };
      t -= dt; let out: MobHit = null;
      if (state === 'idle') { if (sameFloor && d < NOTICE && !playerDown) state = 'chase';
        else { const hx = homeX - g.position.x, hz = homeZ - g.position.z, hd = Math.hypot(hx, hz); if (hd > 0.3) { const s = Math.min(SPEED * 0.6 * dt, hd); const nx = g.position.x + hx / hd * s, nz = g.position.z + hz / hd * s; if (walk(nx, nz)) g.position.set(nx, g.position.y, nz); g.rotation.y = Math.atan2(hx, hz); } } }
      else if (state === 'chase') {
        if (!sameFloor || d > NOTICE * 1.6 || playerDown) state = 'idle';
        else { turn(3.2); if (d > REACH * 0.8) { const s = Math.min(SPEED * dt, d - REACH * 0.75); const nx = g.position.x + Math.sin(g.rotation.y) * s, nz = g.position.z + Math.cos(g.rotation.y) * s; if (walk(nx, nz)) g.position.set(nx, g.position.y, nz); else if (walk(nx, g.position.z)) g.position.x = nx; else if (walk(g.position.x, nz)) g.position.z = nz;
          else for (const k of [1.25, -1.25, 2.0, -2.0]) { const sx = g.position.x + Math.sin(g.rotation.y + k) * s, sz = g.position.z + Math.cos(g.rotation.y + k) * s; if (walk(sx, sz)) { g.position.set(sx, g.position.y, sz); break; } } } // M20b-2: edge round tents and fires
          if (d < REACH * 0.95) { state = 'windup'; t = WINDUP; } }
      } else if (state === 'windup') { turn(1.2); if (t <= 0) { state = 'recover'; t = RECOVER; let a = want - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); if (sameFloor && d < REACH + 0.35 && Math.abs(a) < 1.1) out = 'swing'; } }
      else if (state === 'recover' || state === 'stagger') { if (t <= 0) state = 'chase'; }
      // pose
      const k = state === 'windup' ? 1 - Math.max(0, t) / WINDUP : 0;
      armR.rotation.x = state === 'windup' ? -2.4 * Math.min(1, k * 1.6) : state === 'recover' ? THREE.MathUtils.lerp(0.9, 0, 1 - Math.max(0, t) / RECOVER) : 0;
      body.rotation.z = state === 'stagger' ? Math.sin(t * 30) * 0.08 : 0; body.rotation.x = (state === 'stagger' ? -0.15 : state === 'windup' ? 0.2 * Math.min(1, k * 1.4) : 0) - 0.4 * flinch * flinch; // M47: rear back into the wind-up; snap back on a hit
      armL.rotation.x = state === 'chase' || state === 'windup' ? -0.6 : 0;
      ringM.opacity = state === 'windup' ? 0.25 + 0.55 * k : 0; ring.visible = ringM.opacity > 0; eyeM.color.set(state === 'windup' ? '#ff7a4a' : EYE).multiplyScalar(1 + 2.2 * mobFx.night.value + (state === 'windup' ? 1.5 : 0)); // M52: eyes burn brighter at night (bloom picks them up) and flare on the wind-up
      if (ground) g.position.y = ground(g.position.x, g.position.z) + (shade ? 0.14 + 0.07 * Math.sin((bob += dt) * 2.6) : 0); return out;
    },
  };
  return m;
}
export type Mob = ReturnType<typeof makeSentinel>;
