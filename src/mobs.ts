import * as THREE from 'three';

/** M20 · Hollow Sentinel: an empty suit of armour that guards keep interiors. Reusable melee mob:
 *  idle → notice → approach → telegraphed swing (raised arm + glowing ring) → recover; heavy/staggering hits interrupt the wind-up. */
export const MOB_HP = 4, MOB_XP = 12;
export type MobHit = 'swing' | null;
/** M20b · overworld variants: 'shade' (night wraith, quick), 'brute' (big night husk, two-HP blows), 'husk' (weak day roamer). */
export type MobLook = 'sentinel' | 'shade' | 'brute' | 'husk';
export type MobOpts = { look?: MobLook; hp?: number; speed?: number; notice?: number; windup?: number; dmg?: number; xp?: number; name?: string; ground?: (x: number, z: number) => number };
const STATS: Record<MobLook, Required<Omit<MobOpts, 'ground' | 'look'>>> = {
  sentinel: { hp: MOB_HP, speed: 2.0, notice: 9, windup: 0.85, dmg: 1, xp: MOB_XP, name: 'Sentinel' },
  shade: { hp: 5, speed: 3.1, notice: 14, windup: 0.7, dmg: 1, xp: 9, name: 'Gloam Shade' },
  brute: { hp: 9, speed: 2.2, notice: 12, windup: 1.15, dmg: 2, xp: 22, name: 'Gloam Brute' },
  husk: { hp: 3, speed: 1.8, notice: 8, windup: 0.95, dmg: 1, xp: 5, name: 'Wayside Husk' },
};

export function makeSentinel(id: string, x: number, z: number, y: number, face: number, tint = '#8d9196', opts: MobOpts = {}) {
  const look = opts.look ?? 'sentinel', S = { ...STATS[look], ...opts }; const HPM = S.hp, WINDUP = S.windup, SPEED = S.speed, NOTICE = S.notice, ground = opts.ground;
  const g = new THREE.Group(); g.position.set(x, ground ? ground(x, z) : y, z); g.rotation.y = face;
  const shade = look === 'shade';
  const plate = new THREE.MeshStandardMaterial({ color: shade ? '#1b1d2a' : tint, metalness: shade ? 0 : 0.55, roughness: shade ? 0.9 : 0.4, transparent: shade, opacity: shade ? 0.92 : 1 }), dark = new THREE.MeshStandardMaterial({ color: shade ? '#0c0d14' : '#2b2a2c', metalness: shade ? 0 : 0.6, roughness: 0.6 });
  const eyeM = new THREE.MeshBasicMaterial({ color: shade ? '#b7a6ff' : look === 'brute' ? '#ffb15a' : '#7fd8ff' });
  let homeX = x, homeZ = z;
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number, parent: THREE.Object3D = g) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; parent.add(me); return me; };
  const body = new THREE.Group(); g.add(body);
  if (shade) { // hooded wraith: a ragged robe cone, deep hood, two violet eyes; floats a hand above the ground
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
  if (look === 'brute') body.scale.setScalar(1.4); else if (look === 'husk') body.scale.set(0.95, 0.9, 0.95);
  const armL = new THREE.Group(); armL.position.set(-0.42, 1.55, 0); body.add(armL); add(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), plate, 0, -0.35, 0, armL);
  const shield = add(new THREE.BoxGeometry(0.08, 0.7, 0.5), dark, -0.12, -0.55, 0.12, armL); shield.rotation.y = 0.3;
  const armR = new THREE.Group(); armR.position.set(0.42, 1.55, 0); body.add(armR); add(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), plate, 0, -0.35, 0, armR);
  const sword = add(new THREE.BoxGeometry(0.06, 1.1, 0.02), new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 0.9, roughness: 0.3 }), 0, -1.15, 0.08, armR);
  const ringM = new THREE.MeshBasicMaterial({ color: '#ff6a3a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry((look === 'brute' ? 2.6 : 2.1) - 0.15, look === 'brute' ? 2.6 : 2.1, 32, 1, -0.9, 1.8), ringM); ring.rotation.x = -Math.PI / 2; ring.rotation.z = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const REACH = look === 'brute' ? 2.6 : 2.1, RECOVER = look === 'shade' ? 0.8 : 1.1;
  let bob = 0, hp = HPM, state: 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead' = 'idle', t = 0, flash = 0, deadT = 0; void sword;
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
    hit(dmg: number, stagger: number) {
      if (state === 'dead') return false; hp -= dmg; flash = 0.18;
      if (hp <= 0) { state = 'dead'; deadT = 0; ringM.opacity = 0; return true; }
      if (stagger >= 0.8 || state !== 'windup') { state = 'stagger'; t = stagger >= 0.8 ? 0.9 : 0.35; }
      return false;
    },
    /** walk(x,z) says whether the mob may stand there. Returns 'swing' on the frame the blow lands (main resolves it). */
    tick(dt: number, px: number, pz: number, py: number, walk: (x: number, z: number) => boolean, playerDown: boolean, canSee = true): MobHit {
      flash = Math.max(0, flash - dt); plate.emissive.setRGB(flash * 4, flash * 3, flash * 2);
      if (state === 'dead') { deadT += dt; body.rotation.x = Math.min(1.4, deadT * 2.5); body.position.y = -Math.min(0.9, deadT * 1.2); if (deadT > 1.2) g.visible = false; return null; }
      const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz), sameFloor = Math.abs(py - g.position.y) < (ground ? 3 : 1.2) && canSee;
      const want = Math.atan2(dx, dz); const turn = (rate: number) => { let a = want - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += Math.max(-rate * dt, Math.min(rate * dt, a)); };
      t -= dt; let out: MobHit = null;
      if (state === 'idle') { if (sameFloor && d < NOTICE && !playerDown) state = 'chase';
        else { const hx = homeX - g.position.x, hz = homeZ - g.position.z, hd = Math.hypot(hx, hz); if (hd > 0.3) { const s = Math.min(SPEED * 0.6 * dt, hd); const nx = g.position.x + hx / hd * s, nz = g.position.z + hz / hd * s; if (walk(nx, nz)) g.position.set(nx, g.position.y, nz); g.rotation.y = Math.atan2(hx, hz); } } }
      else if (state === 'chase') {
        if (!sameFloor || d > NOTICE * 1.6 || playerDown) state = 'idle';
        else { turn(3.2); if (d > REACH * 0.8) { const s = Math.min(SPEED * dt, d - REACH * 0.75); const nx = g.position.x + Math.sin(g.rotation.y) * s, nz = g.position.z + Math.cos(g.rotation.y) * s; if (walk(nx, nz)) g.position.set(nx, g.position.y, nz); else if (walk(nx, g.position.z)) g.position.x = nx; else if (walk(g.position.x, nz)) g.position.z = nz; }
          if (d < REACH * 0.95) { state = 'windup'; t = WINDUP; } }
      } else if (state === 'windup') { turn(1.2); if (t <= 0) { state = 'recover'; t = RECOVER; let a = want - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); if (sameFloor && d < REACH + 0.35 && Math.abs(a) < 1.1) out = 'swing'; } }
      else if (state === 'recover' || state === 'stagger') { if (t <= 0) state = 'chase'; }
      // pose
      const k = state === 'windup' ? 1 - Math.max(0, t) / WINDUP : 0;
      armR.rotation.x = state === 'windup' ? -2.4 * Math.min(1, k * 1.6) : state === 'recover' ? THREE.MathUtils.lerp(0.9, 0, 1 - Math.max(0, t) / RECOVER) : 0;
      body.rotation.z = state === 'stagger' ? Math.sin(t * 30) * 0.08 : 0; body.rotation.x = state === 'stagger' ? -0.15 : 0;
      armL.rotation.x = state === 'chase' || state === 'windup' ? -0.6 : 0;
      ringM.opacity = state === 'windup' ? 0.25 + 0.55 * k : 0; eyeM.color.set(state === 'windup' ? '#ff7a4a' : '#7fd8ff');
      if (ground) g.position.y = ground(g.position.x, g.position.z) + (shade ? 0.14 + 0.07 * Math.sin((bob += dt) * 2.6) : 0); return out;
    },
  };
  return m;
}
export type Mob = ReturnType<typeof makeSentinel>;
