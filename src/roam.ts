import * as THREE from 'three';
import { makeSentinel, type Mob, type MobLook } from './mobs';
import { flameTex, makeFlame } from './cave';
import { heightAt, WATER_Y } from './world';

/** M20b · open-world threats and safe rests.
 *  Roaming groups patrol roads and woods; night groups (Gloam Shades / Brutes) rise at dusk and thin out at dawn.
 *  Respawn rule: a cleared group is recorded with the day it fell (save.rk) and returns on a later day; resting clears every record.
 *  Rest spots: campfires and the Wayfinder's camp. Roamers never walk into a rest spot's ring. */
export type Fire = { id: string; name: string; x: number; z: number; village?: boolean };
export const FIRES: Fire[] = [
  { id: 'camp', name: 'Wayfinder’s camp', x: 6.5, z: 3.5, village: true },
  { id: 'pale-road', name: 'Pale road fire', x: -62, z: -98 },
  { id: 'azure-road', name: 'Azure road fire', x: 44, z: -98 },
  { id: 'sunspire', name: 'Sunspire camp', x: -60, z: 60 },
  { id: 'dome', name: 'Dome-side camp', x: 20, z: 64 },
];
export const SAFE_R = 13, VILLAGE = { x: 3, z: 1, r: 27 };
type GroupDef = { id: string; night: boolean; x: number; z: number; mobs: MobLook[]; r: number };
export const GROUPS: GroupDef[] = [
  { id: 'n-road', night: true, x: -12, z: -32, mobs: ['shade', 'shade'], r: 14 },
  { id: 'n-shrine', night: true, x: -60, z: -38, mobs: ['shade', 'brute', 'shade'], r: 14 },
  { id: 'n-pale', night: true, x: -82, z: -104, mobs: ['shade', 'shade', 'shade'], r: 12 },
  { id: 'n-azure', night: true, x: 62, z: -76, mobs: ['shade', 'brute', 'shade'], r: 14 },
  { id: 'n-sun', night: true, x: -44, z: 52, mobs: ['shade', 'shade'], r: 14 },
  { id: 'n-dome', night: true, x: 72, z: 68, mobs: ['brute', 'shade'], r: 12 },
  { id: 'n-east', night: true, x: 86, z: -12, mobs: ['shade', 'shade'], r: 14 },
  { id: 'd-veil', night: false, x: -96, z: -58, mobs: ['husk', 'husk'], r: 10 },
  { id: 'd-south', night: false, x: 4, z: 96, mobs: ['husk', 'husk'], r: 10 },
];
const ACTIVE_R = 85;
export const inSafe = (x: number, z: number, pad = 0) => Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + pad || FIRES.some((f) => Math.hypot(x - f.x, z - f.z) < SAFE_R + pad);

function fireMesh(ft: THREE.Texture, high: boolean) {
  const g = new THREE.Group(); const stone = new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.9 }), wood = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.85 }), ash = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 1, emissive: '#ff5a1a', emissiveIntensity: 0.6 });
  const sg = new THREE.DodecahedronGeometry(0.22, 0); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, m = new THREE.Mesh(sg, stone); m.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); m.rotation.set(i, i * 2, 0); m.scale.set(1, 0.7, 1); m.castShadow = high; g.add(m); }
  const lg = new THREE.CylinderGeometry(0.07, 0.08, 0.95, 6); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(lg, wood); m.rotation.z = Math.PI / 2 - 0.35; m.rotation.y = (i / 4) * Math.PI * 2; m.position.y = 0.2; g.add(m); }
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), ash); bed.position.y = 0.04; g.add(bed);
  const fl = makeFlame(ft, 1.15); fl.position.y = 0.75; g.add(fl); const fl2 = makeFlame(ft, 1.0); fl2.position.set(0.12, 0.6, -0.1); g.add(fl2);
  // bedrolls / log seats so it reads as a camp from afar
  const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.2, 4, 8), new THREE.MeshStandardMaterial({ color: '#6b4b3a', roughness: 0.9 })); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.22, 1.8); roll.castShadow = high; g.add(roll);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 1.6, 8), wood); seat.rotation.z = Math.PI / 2; seat.rotation.y = 1.2; seat.position.set(-1.6, 0.25, -0.6); seat.castShadow = high; g.add(seat);
  return { g, flames: [fl, fl2], ash };
}

export function makeRoam(scene: THREE.Scene, high: boolean) {
  const ft = flameTex(); const fires = FIRES.map((f) => { const m = fireMesh(ft, high); let y = heightAt(f.x, f.z); if (y < WATER_Y) y = WATER_Y; m.g.position.set(f.x, y, f.z); scene.add(m.g); return { def: f, ...m }; });
  const ground = (x: number, z: number) => Math.max(heightAt(x, z), WATER_Y - 0.3);
  let seed = 1234; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const groups = GROUPS.map((d) => {
    const mobs = d.mobs.map((look, i) => { const a = (i / d.mobs.length) * Math.PI * 2, x = d.x + Math.cos(a) * 2.5, z = d.z + Math.sin(a) * 2.5;
      const m = makeSentinel(`${d.id}-${i}`, x, z, 0, a, look === 'husk' ? '#8a7a66' : look === 'brute' ? '#3a3540' : '#8d9196', { look, ground }); m.kill(); scene.add(m.group); return m; });
    return { def: d, mobs, present: false, wpT: 0, wx: d.x, wz: d.z, near: false };
  });
  const byMob = new Map<Mob, (typeof groups)[number]>(); for (const g of groups) for (const m of g.mobs) byMob.set(m, g);
  function spawn(g: (typeof groups)[number]) { g.present = true; g.wx = g.def.x; g.wz = g.def.z; g.mobs.forEach((m, i) => { const a = (i / g.mobs.length) * Math.PI * 2 + rnd(); m.respawn(g.def.x + Math.cos(a) * 2.5, g.def.z + Math.sin(a) * 2.5); m.group.visible = g.near; }); }
  function despawn(g: (typeof groups)[number]) { g.present = false; for (const m of g.mobs) if (m.alive) m.kill(); }
  return {
    fires, groups,
    groupOf: (m: Mob) => byMob.get(m)!,
    /** Living, nearby, present mobs (for targeting and hits). */
    live(): Mob[] { const out: Mob[] = []; for (const g of groups) if (g.present && g.near) for (const m of g.mobs) if (m.alive) out.push(m); return out; },
    nearestFire(x: number, z: number) { let b = fires[0], bd = 1e9; for (const f of fires) { const d = Math.hypot(f.def.x - x, f.def.z - z); if (d < bd) { bd = d; b = f; } } return { fire: b, d: bd }; },
    /** Bring every group back to its rest state (after resting or a reload): night groups only appear at night. */
    resetAll() { for (const g of groups) despawn(g); },
    engaged(): boolean { for (const g of groups) if (g.present && g.near) for (const m of g.mobs) if (m.alive && m.state !== 'idle') return true; return false; },
    /** One fixed tick. `cleared(day)` decides whether a group is down for today. Returns mobs whose blow lands this tick. */
    tick(dt: number, t: number, px: number, pz: number, py: number, night: number, outside: boolean, playerDown: boolean, clearedToday: (id: string) => boolean): Mob[] {
      const hits: Mob[] = [];
      for (const f of fires) { const k = 0.85 + 0.15 * Math.sin(t * 9 + f.def.x) * Math.sin(t * 5.3); f.flames[0].scale.setScalar(1.15 * k); f.flames[1].scale.setScalar(1.0 * (1.9 - k)); f.ash.emissiveIntensity = 0.45 + 0.25 * k; }
      for (const g of groups) {
        const dP = Math.hypot(px - g.def.x, pz - g.def.z); const near = outside && dP < ACTIVE_R;
        const want = !clearedToday(g.def.id) && (g.def.night ? night > 0.6 || (g.present && night > 0.25) : true);
        if (want && !g.present) spawn(g); else if (!want && g.present && !(g.near && g.mobs.some((m) => m.alive && m.state !== 'idle'))) despawn(g);
        if (near !== g.near) { g.near = near; for (const m of g.mobs) m.group.visible = near && g.present && m.alive; }
        if (!g.present || !near) continue;
        g.wpT -= dt; if (g.wpT <= 0) { g.wpT = 6 + rnd() * 5; for (let k = 0; k < 6; k++) { const a = rnd() * Math.PI * 2, r = rnd() * g.def.r; const x = g.def.x + Math.cos(a) * r, z = g.def.z + Math.sin(a) * r; if (!inSafe(x, z, 2)) { g.wx = x; g.wz = z; break; } } }
        g.mobs.forEach((m, i) => { if (!m.alive && !m.group.visible) return; const a = i * 2.1; m.setHome(g.wx + Math.cos(a) * 1.8, g.wz + Math.sin(a) * 1.8);
          const sees = !inSafe(px, pz) && !playerDown;
          if (m.tick(dt, px, pz, py, (x, z) => !inSafe(x, z) && Math.hypot(x - g.def.x, z - g.def.z) < g.def.r + 26 && heightAt(x, z) > WATER_Y - 0.4, playerDown, sees) === 'swing') hits.push(m); });
      }
      return hits;
    },
    allDead: (g: (typeof groups)[number]) => g.mobs.every((m) => !m.alive),
  };
}
export type Roam = ReturnType<typeof makeRoam>;
