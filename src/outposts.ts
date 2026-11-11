import * as THREE from 'three';
import { OUTPOSTS, outpostPad, type Outpost } from './world';
import { triplanar, type BuildTex } from './landmarks';
import { flameTex, makeFlame } from './cave';

/** M20b-2 · standable obstacles: rocks, low walls, ruined steps. Below their top they block like a wall; a hop that clears
 *  the top (or a step of ≤ STEP) lets the feet stand on them. Circles (r) or rotated boxes (hw/hd/ry); `top` is world Y. */
export type Stand = { x: number; z: number; top: number; r?: number; hw?: number; hd?: number; ry?: number; tag?: string };
export const STANDS: Stand[] = [];
export const STEP = 0.4;
const local = (s: Stand, x: number, z: number) => { const dx = x - s.x, dz = z - s.z, c = Math.cos(s.ry ?? 0), sn = Math.sin(s.ry ?? 0); return [dx * c - dz * sn, dx * sn + dz * c]; };
export function inStand(s: Stand, x: number, z: number, pad = 0): boolean {
  if (s.r !== undefined) return Math.hypot(x - s.x, z - s.z) < s.r + pad;
  const [lx, lz] = local(s, x, z); return Math.abs(lx) < s.hw! + pad && Math.abs(lz) < s.hd! + pad;
}
/** Highest stand top under (x,z) the feet at `foot` can reach (≤ foot + STEP), or -Infinity. */
export function standY(x: number, z: number, foot: number): number { let y = -Infinity; for (const s of STANDS) if (s.top <= foot + STEP && s.top > y && inStand(s, x, z)) y = s.top; return y; }
/** Push (nx,nz) out of every stand the feet are too low for. */
export function standPush(nx: number, nz: number, foot: number): [number, number] {
  for (const s of STANDS) {
    if (s.top <= foot + STEP || !inStand(s, nx, nz)) continue;
    if (s.r !== undefined) { const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz) || 1e-6; nx = s.x + dx / d * s.r; nz = s.z + dz / d * s.r; continue; }
    const [lx, lz] = local(s, nx, nz); const px = s.hw! - Math.abs(lx), pz = s.hd! - Math.abs(lz);
    let ax = lx, az = lz; if (px < pz) ax = Math.sign(lx || 1) * s.hw!; else az = Math.sign(lz || 1) * s.hd!;
    const c = Math.cos(s.ry ?? 0), sn = Math.sin(s.ry ?? 0); nx = s.x + ax * c + az * sn; nz = s.z - ax * sn + az * c;
  }
  return [nx, nz];
}

/** Discoverable places (old landmarks too): walking near one names it on the map, with a toast and a little XP. */
export type Loc = { id: string; name: string; x: number; z: number; r: number; xp: number; reveal: number; view?: boolean };
export const O = Object.fromEntries(OUTPOSTS.map((o) => [o.id, o])) as Record<string, Outpost>;
export const TOWER_TOP_R = 3.6, TOWER_H = 4.85;
export type Spot = { id: string; x: number; z: number; y: number; r: number };

export function makeOutposts(t: BuildTex, high: boolean) {
  const g = new THREE.Group(); g.name = 'outposts';
  const stone = triplanar(t.brick, 2.4, '#a49a8a', { sat: 0.35, gain: 1.05 }), rough = triplanar(t.rock, 2.0, '#8c8478');
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.85 }), dark = new THREE.MeshBasicMaterial({ color: '#050403' });
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = high; o.receiveShadow = true; g.add(o); return o; };
  let seed = 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spots: Spot[] = []; const flames: THREE.Object3D[] = []; const ft = flameTex();
  // ---- Greyhold Watchtower: a ruined drum you climb by jumping its fallen stair ----
  { const o = O.tower, y0 = outpostPad(o);
    mesh(new THREE.CylinderGeometry(TOWER_TOP_R, TOWER_TOP_R + 0.35, TOWER_H, 18).translate(0, TOWER_H / 2, 0), stone, o.x, y0, o.z);
    STANDS.push({ x: o.x, z: o.z, r: TOWER_TOP_R + 0.2, top: y0 + TOWER_H, tag: 'tower-top' });
    mesh(new THREE.CylinderGeometry(TOWER_TOP_R - 0.05, TOWER_TOP_R - 0.05, 0.12, 18), rough, o.x, y0 + TOWER_H + 0.02, o.z);
    // broken parapet: low merlons with a gap where the stair arrives, and a tall jagged shard on the far side
    const a0 = Math.PI; // stair starts on the west (toward the vale)
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - (a0 + 3.1)), Math.cos(a - (a0 + 3.1)))) < 0.45) continue; const h = 0.5 + rnd() * 0.6; mesh(new THREE.BoxGeometry(1.2, h, 0.6).translate(0, h / 2, 0), stone, o.x + Math.sin(a) * (TOWER_TOP_R - 0.25), y0 + TOWER_H, o.z + Math.cos(a) * (TOWER_TOP_R - 0.25), a);
      STANDS.push({ x: o.x + Math.sin(a) * (TOWER_TOP_R - 0.25), z: o.z + Math.cos(a) * (TOWER_TOP_R - 0.25), hw: 0.6, hd: 0.3, ry: a, top: y0 + TOWER_H + h, tag: 'merlon' }); }
    mesh(new THREE.BoxGeometry(2.2, 6.5, 1.0).translate(0, 3.25, 0), stone, o.x + Math.sin(a0 + 1.3) * (TOWER_TOP_R - 0.4), y0 + TOWER_H, o.z + Math.cos(a0 + 1.3) * (TOWER_TOP_R - 0.4), a0 + 1.3);
    mesh(new THREE.PlaneGeometry(1.6, 2.6), dark, o.x + Math.sin(a0 - 1.2) * (TOWER_TOP_R + 0.38), y0 + 1.3, o.z + Math.cos(a0 - 1.2) * (TOWER_TOP_R + 0.38), a0 - 1.2); // sealed doorway
    for (let i = 0; i < 9; i++) { const a = a0 + i * 0.36, top = 0.35 + i * 0.5, x = o.x + Math.sin(a) * 4.65, z = o.z + Math.cos(a) * 4.65;
      mesh(new THREE.BoxGeometry(1.5, top + 0.6, 1.5).translate(0, (top + 0.6) / 2 - 0.6, 0), i % 3 === 1 ? rough : stone, x, y0, z, a + (rnd() - 0.5) * 0.2);
      STANDS.push({ x, z, r: 0.85, top: y0 + top, tag: 'tower-step' }); }
    for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, r = 5.6 + rnd() * 3, s = 0.3 + rnd() * 0.4; mesh(new THREE.DodecahedronGeometry(s, 0), rough, o.x + Math.sin(a) * r, y0 + s * 0.4, o.z + Math.cos(a) * r); }
    spots.push({ id: 'tower-top', x: o.x, z: o.z, y: y0 + TOWER_H, r: 3.2 }, { id: 'tower-satchel', x: o.x + Math.sin(a0 + 2.6) * 2.4, z: o.z + Math.cos(a0 + 2.6) * 2.4, y: y0 + TOWER_H, r: 1.4 });
    const sat = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 0.9 }), spots[1].x, y0 + TOWER_H + 0.2, spots[1].z, 0.6); sat.name = 'satchel'; }
  // ---- Ashen Hollow: a cultist camp behind a broken ring of low walls ----
  const camp = O.camp, cy = outpostPad(camp); let chestLid: THREE.Object3D;
  { const cloth = new THREE.MeshStandardMaterial({ color: '#5a2a1e', roughness: 0.95, side: THREE.DoubleSide }), ash = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 1, emissive: '#ff5a1a', emissiveIntensity: 0.7 });
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; if (i === 3 || i === 10) continue; const R = 11, x = camp.x + Math.sin(a) * R, z = camp.z + Math.cos(a) * R, h = 0.55 + (i % 4 === 0 ? 0.25 : 0);
      mesh(new THREE.BoxGeometry(4.2, h, 0.8).translate(0, h / 2 - 0.15, 0), i % 2 ? stone : rough, x, cy, z, a + Math.PI / 2);
      STANDS.push({ x, z, hw: 2.1, hd: 0.4, ry: a + Math.PI / 2, top: cy + h - 0.15, tag: 'camp-wall' }); }
    for (const [dx, dz, s] of [[-5, 3, 1], [4.5, 5, 1.15], [1, -6, 0.95]] as const) { mesh(new THREE.ConeGeometry(1.9 * s, 2.5 * s, 7, 1, true).translate(0, 1.25 * s, 0), cloth, camp.x + dx, cy, camp.z + dz, rnd() * 6); STANDS.push({ x: camp.x + dx, z: camp.z + dz, r: 1.7 * s, top: cy + 9, tag: 'tent' }); }
    mesh(new THREE.CircleGeometry(1.2, 14).rotateX(-Math.PI / 2), ash, camp.x, cy + 0.04, camp.z);
    for (let i = 0; i < 3; i++) { const f = makeFlame(ft, 1.5 - i * 0.25); f.position.set(camp.x + (i - 1) * 0.3, cy + 0.9, camp.z + (i % 2) * 0.2); g.add(f); flames.push(f); }
    STANDS.push({ x: camp.x, z: camp.z, r: 1.1, top: cy + 9, tag: 'bonfire' });
    // the effigy: a pole wearing an iron sun with its rays bent down
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 7).translate(0, 2.75, 0), wood, camp.x - 3, cy, camp.z - 2);
    const sun = mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 16), new THREE.MeshStandardMaterial({ color: '#3a3330', metalness: 0.8, roughness: 0.5, emissive: '#7a1e08', emissiveIntensity: 0.5 }), camp.x - 3, cy + 5.1, camp.z - 2); sun.rotation.y = 0.6;
    STANDS.push({ x: camp.x - 3, z: camp.z - 2, r: 0.5, top: cy + 9, tag: 'effigy' });
    // the strongbox in the zealot's tent mouth
    const cx = camp.x + 4.5, cz = camp.z + 2.6; const box = mesh(new THREE.BoxGeometry(1.0, 0.55, 0.65).translate(0, 0.275, 0), wood, cx, cy, cz, 0.4);
    chestLid = new THREE.Group(); chestLid.position.set(0, 0.55, -0.32); box.add(chestLid); const lid = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 0.67), new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.8 })); lid.position.set(0, 0.07, 0.32); chestLid.add(lid);
    STANDS.push({ x: cx, z: cz, r: 0.6, top: cy + 0.55, tag: 'chest' });
    spots.push({ id: 'camp-chest', x: cx - Math.sin(0.4) * 1.1, z: cz - Math.cos(0.4) * 1.1, y: cy, r: 1.5 }, { id: 'camp-orders', x: camp.x - 3 + 0.9, z: camp.z - 2 + 0.6, y: cy, r: 1.6 }); }
  // ---- The Old Barrow: a grass mound with a stone door ----
  { const o = O.barrow, y0 = outpostPad(o), face = Math.atan2(0 - o.x, 0 - o.z);
    const mound = mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), triplanar(t.rock, 3, '#6f7a5a', { sat: 0.5 }), o.x - Math.sin(face) * 4, y0 - 0.4, o.z - Math.cos(face) * 4); mound.scale.set(1, 0.55, 1);
    STANDS.push({ x: o.x - Math.sin(face) * 4, z: o.z - Math.cos(face) * 4, r: 6.2, top: y0 + 9, tag: 'mound' });
    const dx = o.x + Math.sin(face) * 1.8, dz = o.z + Math.cos(face) * 1.8;
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.7, 2.6, 0.8).translate(0, 1.3, 0), stone, dx + Math.cos(face) * s * 1.25, y0, dz - Math.sin(face) * s * 1.25, face);
    mesh(new THREE.BoxGeometry(3.3, 0.6, 0.9).translate(0, 0.3, 0), stone, dx, y0 + 2.6, dz, face);
    mesh(new THREE.PlaneGeometry(1.8, 2.6), dark, dx + Math.sin(face) * 0.05, y0 + 1.3, dz + Math.cos(face) * 0.05, face);
    for (let i = 0; i < 3; i++) { const a = face + (i - 1) * 0.9, r = 6.5, h = 1.8 + rnd() * 1.2; const sx = o.x + Math.sin(a) * r, sz = o.z + Math.cos(a) * r; mesh(new THREE.BoxGeometry(0.6, h, 0.35).translate(0, h / 2, 0), rough, sx, y0, sz, a); STANDS.push({ x: sx, z: sz, r: 0.45, top: y0 + h, tag: 'stone' }); }
    spots.push({ id: 'barrow-door', x: dx + Math.sin(face) * 1.4, z: dz + Math.cos(face) * 1.4, y: y0, r: 1.8 }); }
  // ---- viewpoints: a stacked cairn with a carved marker ----
  for (const id of ['bluff', 'cairn']) { const o = O[id], y0 = outpostPad(o);
    for (let k = 0; k < 4; k++) { const s = 0.8 - k * 0.15; mesh(new THREE.DodecahedronGeometry(s, 0), rough, o.x + (rnd() - 0.5) * 0.2, y0 + 0.3 + k * 0.42, o.z + (rnd() - 0.5) * 0.2, rnd() * 6); }
    STANDS.push({ x: o.x, z: o.z, r: 0.75, top: y0 + 1.0, tag: 'cairn' });
    mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25).translate(0, 0.7, 0), wood, o.x + 1.4, y0, o.z + 0.6);
    spots.push({ id: `view-${id}`, x: o.x, z: o.z, y: y0, r: 3.2 }); }
  let open = false;
  return {
    group: g, spots,
    openChest(instant = false) { open = true; if (instant) chestLid.rotation.x = -1.9; },
    update(time: number, dt: number) { for (let i = 0; i < flames.length; i++) flames[i].scale.setScalar((1.5 - i * 0.25) * (0.85 + 0.15 * Math.sin(time * 9 + i * 2))); if (open && chestLid.rotation.x > -1.9) chestLid.rotation.x = Math.max(-1.9, chestLid.rotation.x - dt * 4); },
  };
}
export type Outposts = ReturnType<typeof makeOutposts>;
