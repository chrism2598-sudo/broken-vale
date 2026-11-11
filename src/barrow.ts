import * as THREE from 'three';
import { triplanar, type BuildTex } from './landmarks';
import { flameTex, makeFlame } from './cave';
import { makeSentinel, type Mob } from './mobs';

/** M20b-2 · The Old Barrow: a three-chamber crypt (antechamber → pillared hall → the Barrow-King's vault), its own scene. */
export const BAR_O = { x: 6000, z: 6000 };
type Room = { x: number; z: number; r: number; h: number };
export const ROOMS: Room[] = [{ x: 0, z: 0, r: 5.5, h: 4.6 }, { x: 0, z: 16.5, r: 7.5, h: 6 }, { x: 0, z: 37, r: 9.5, h: 8 }];
const HALLS = [{ z0: 4.6, z1: 9.6, hw: 1.25, h: 3.2 }, { z0: 23.4, z1: 28.2, hw: 1.25, h: 3.2 }];
export const GATE_Z = 25.8, EXIT = { x: 0, z: -4.3 }, CHEST = { x: 0, z: 44.2 }, PILLARS = [[-4, 13], [4, 13], [-4, 20], [4, 20]] as const;
const inRoom = (x: number, z: number, pad: number) => ROOMS.some((r) => Math.hypot(x - r.x, z - r.z) < r.r - pad);
const inHall = (x: number, z: number, pad: number, gate: boolean) => HALLS.some((h, i) => Math.abs(x) < h.hw - pad && z > h.z0 - 1 && z < h.z1 + 1 && !(i === 1 && gate && z > GATE_Z - 0.4 - pad && z < GATE_Z + 0.4 + pad));
const pillarHit = (x: number, z: number, pad: number) => PILLARS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.7 + pad);
export function barrowWalkable(lx: number, lz: number, gate: boolean, pad = 0.45) { return (inRoom(lx, lz, pad) || inHall(lx, lz, pad * 0.9, gate)) && !pillarHit(lx, lz, pad - 0.1); }
/** Ceiling height over a local point. */
export function barrowCeil(lx: number, lz: number) { for (const r of ROOMS) { const d = Math.hypot(lx - r.x, lz - r.z); if (d < r.r) return 1.2 + (r.h - 1.2) * Math.sqrt(Math.max(0, 1 - (d / r.r) ** 2)); } return HALLS[0].h; }

export function makeBarrow(t: BuildTex, high: boolean) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#050405'); scene.fog = new THREE.FogExp2('#08070a', 0.045);
  const g = new THREE.Group(); g.position.set(BAR_O.x, 0, BAR_O.z); scene.add(g);
  const wall = triplanar(t.rock, 2.2, '#6a6258', { sat: 0.4 }), stone = triplanar(t.brick, 2.0, '#7d7468', { sat: 0.35 }), floorM = triplanar(t.brick, 1.6, '#5e574e', { sat: 0.3 });
  wall.side = THREE.BackSide; const hallM = triplanar(t.brick, 2.0, '#7d7468', { sat: 0.35 }); hallM.side = THREE.DoubleSide;
  { // doorways: the domes are cut where the two passages meet them
    const prev = wall.onBeforeCompile.bind(wall); wall.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', `void main() {\n { vec2 q = vTW.xz - vec2(${BAR_O.x.toFixed(1)}, ${BAR_O.z.toFixed(1)}); if (abs(q.x) < 1.3 && vTW.y < 3.25 && ((q.y > 3.6 && q.y < 10.6) || (q.y > 22.4 && q.y < 29.2))) discard; }`); };
    wall.customProgramCacheKey = () => 'barrowcut'; }
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.receiveShadow = true; g.add(o); return o; };
  for (const r of ROOMS) {
    add(new THREE.CircleGeometry(r.r + 0.3, 36).rotateX(-Math.PI / 2), floorM, r.x, 0, r.z);
    const dome = add(new THREE.SphereGeometry(r.r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), wall, r.x, 0, r.z); dome.scale.y = r.h / r.r;
  }
  for (const h of HALLS) {
    const len = h.z1 - h.z0 + 2, zc = (h.z0 + h.z1) / 2;
    add(new THREE.PlaneGeometry(h.hw * 2 + 0.2, len).rotateX(-Math.PI / 2), floorM, 0, 0.01, zc);
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(len, h.h).rotateY(-s * Math.PI / 2), hallM, s * h.hw, h.h / 2, zc);
    add(new THREE.PlaneGeometry(h.hw * 2, len).rotateX(Math.PI / 2), stone, 0, h.h, zc);
  }
  for (const [px, pz] of PILLARS) { const p = add(new THREE.CylinderGeometry(0.55, 0.65, 6, 10).translate(0, 3, 0), stone, px, 0, pz); p.castShadow = high; }
  // the gate (an iron grate) between the hall and the vault
  const grate = new THREE.Group(); grate.position.set(0, 0, GATE_Z); g.add(grate); const iron = new THREE.MeshStandardMaterial({ color: '#3a3836', metalness: 0.85, roughness: 0.5 });
  for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.1, 6), iron); b.position.set(i * 0.36, 1.55, 0); grate.add(b); }
  for (const y of [0.5, 2.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), iron); b.position.y = y; grate.add(b); }
  // sarcophagi, bones, the vault's chest
  const lidM = new THREE.MeshStandardMaterial({ color: '#8a8276', roughness: 0.9 });
  for (const [x, z, ry] of [[-5.5, 16.5, 0], [5.5, 16.5, 0], [-6.5, 37, 0.3], [6.5, 37, -0.3]] as const) { const s = add(new THREE.BoxGeometry(1.1, 0.8, 2.3).translate(0, 0.4, 0), lidM, x, 0, z); s.rotation.y = ry; }
  const chest = new THREE.Group(); chest.position.set(CHEST.x, 0, CHEST.z); g.add(chest);
  { const wood = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.8 }), brass = new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.8, roughness: 0.4 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7).translate(0, 0.3, 0), wood); chest.add(b); const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.74), brass); band.position.y = 0.45; chest.add(band); }
  const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.35); chest.add(lid); { const l = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.16, 0.72), lidM); l.position.set(0, 0.08, 0.35); lid.add(l); }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff9a4a' })); glow.position.set(0, 0.5, 0); glow.visible = false; chest.add(glow);
  // light: a dim blue-grey fill, torches by the doors, a warm light carried with the player
  scene.add(new THREE.HemisphereLight('#6f7f9a', '#1a1410', 0.55));
  const ft = flameTex(); const torches: THREE.Object3D[] = [];
  const torchAt: [number, number][] = high ? [[2.6, 4.4], [-2.6, 4.4], [6.6, 16.5], [-6.6, 16.5], [3, 29.6], [-3, 29.6]] : [[2.6, 4.4], [6.6, 16.5], [3, 29.6]];
  for (const [x, z] of torchAt) { const f = makeFlame(ft, 0.7); f.position.set(BAR_O.x + x, 2.2, BAR_O.z + z); scene.add(f); torches.push(f); }
  const lights = (high ? [[0, 3, 16.5, 10, 16], [0, 4, 37, 12, 22], [0, 3, 1, 6, 10]] : [[0, 3, 16.5, 9, 16], [0, 4, 37, 10, 22]]).map(([x, y, z, i, d]) => { const l = new THREE.PointLight('#ffb070', i, d, 1.6); l.position.set(BAR_O.x + x, y, BAR_O.z + z); scene.add(l); return l; });
  const carry = new THREE.PointLight('#ffc78a', 6, 11, 1.5); scene.add(carry);
  // the dead and their king
  const ground = () => 0;
  const hallMobs: Mob[] = [[-2.5, 15], [2.5, 18], [0, 20.5]].map(([x, z], i) => makeSentinel(`barrow-${i}`, BAR_O.x + x, BAR_O.z + z, 0, Math.PI, '#6d675a', { look: 'barrow', ground }));
  const king = makeSentinel('barrow-king', BAR_O.x, BAR_O.z + 39.5, 0, Math.PI, '#3c3a34', { look: 'king', ground });
  const risen: Mob[] = [[-4, 35], [4, 35]].map(([x, z], i) => makeSentinel(`barrow-r${i}`, BAR_O.x + x, BAR_O.z + z, 0, Math.PI, '#6d675a', { look: 'barrow', ground }));
  for (const m of [...hallMobs, king, ...risen]) scene.add(m.group); for (const m of risen) m.kill();
  let gateOpen = false, gateY = 0, chestOpen = false;
  const W = (x: number, z: number) => [x - BAR_O.x, z - BAR_O.z] as const;
  return {
    scene, hallMobs, king, risen, entry: { x: BAR_O.x + 0, z: BAR_O.z - 2.6 }, exit: { x: BAR_O.x + EXIT.x, z: BAR_O.z + EXIT.z }, chest: { x: BAR_O.x + CHEST.x, z: BAR_O.z + CHEST.z - 1.2 },
    get gateOpen() { return gateOpen; },
    setGate(open: boolean, instant = false) { gateOpen = open; if (instant) gateY = open ? 3 : 0; },
    openChest(instant = false) { chestOpen = true; glow.visible = false; if (instant) lid.rotation.x = -1.9; },
    showGlow(on: boolean) { glow.visible = on && !chestOpen; },
    walkable(x: number, z: number, pad = 0.45) { const [lx, lz] = W(x, z); return barrowWalkable(lx, lz, !gateOpen, pad); },
    ceil(x: number, z: number) { const [lx, lz] = W(x, z); return barrowCeil(lx, lz); },
    constrain(ox: number, oz: number, nx: number, nz: number): [number, number] {
      const ok = (x: number, z: number) => barrowWalkable(x - BAR_O.x, z - BAR_O.z, !gateOpen);
      if (ok(nx, nz)) return [nx, nz]; if (ok(nx, oz)) return [nx, oz]; if (ok(ox, nz)) return [ox, nz]; return [ox, oz];
    },
    /** Keep the camera inside the crypt: walk it in along the player→camera line until it is inside and under the vault. */
    clampCam(cam: THREE.Vector3, target: THREE.Vector3) {
      const inside = (p: THREE.Vector3) => { const [lx, lz] = W(p.x, p.z); return barrowWalkable(lx, lz, false, 0.25) && p.y < barrowCeil(lx, lz) - 0.35; };
      if (inside(cam)) return; const a = target.clone(), b = cam.clone(), m = new THREE.Vector3();
      for (let i = 0; i < 10; i++) { m.lerpVectors(a, b, 0.5); if (inside(m)) a.copy(m); else b.copy(m); }
      cam.copy(a);
    },
    update(time: number, dt: number, px: number, pz: number) {
      gateY += ((gateOpen ? 3 : 0) - gateY) * Math.min(1, dt * 1.5); grate.position.y = gateY;
      if (chestOpen && lid.rotation.x > -1.9) lid.rotation.x = Math.max(-1.9, lid.rotation.x - dt * 4);
      for (let i = 0; i < torches.length; i++) torches[i].scale.setScalar(0.7 * (0.85 + 0.15 * Math.sin(time * 9 + i * 1.7)));
      carry.position.set(px, 2.6, pz); for (let i = 0; i < lights.length; i++) lights[i].intensity *= 1; glow.scale.setScalar(1 + 0.15 * Math.sin(time * 4));
    },
  };
}
export type Barrow = ReturnType<typeof makeBarrow>;
