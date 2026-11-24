// M64E · three new ruins away from the canon sites (Azure, Sunspire, Iron Dome, Veilfall and Pale stay where they are).
// Each holds a fracture — a seam the sky-break left in the stone. A Kindling spark mends it (save 'mended'), the sealed alcove opens,
// and the relic inside is taken with a lore page (save 'disc'). Rewards are relics and lore, not XP.
// All geometry is procedural (no new assets): one merged stone mesh, one fracture glow, one door slab and one relic glint per ruin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, rng } from './world';

export type RuinDef = { id: string; name: string; x: number; z: number; face: number; relic: string; kind: 'kiln' | 'shrine' | 'cairn'; tint: string;
  lore: { title: string; text: string }; hint: string };
export const RUINS: RuinDef[] = [
  { id: 'hearth', name: 'The Hearth Ruin', x: 122, z: 32, face: -1.9, relic: 'emberstone', kind: 'kiln', tint: '#ff9a4a',
    lore: { title: 'Soot on the kiln lintel (Hearth Ruin)', text: '“We fired the seal-clay here before the custodians took it to the Dome. When the sky split, the kiln split with it — and the fire inside would not go out, only sleep.”' },
    hint: 'A seam of sleeping fire runs through the kiln door.' },
  { id: 'reed', name: 'The Reed Shrine', x: -65, z: 150, face: 1.4, relic: 'tidepearl', kind: 'shrine', tint: '#7fd6e8',
    lore: { title: 'Prayer carved on the reed-stone (Reed Shrine)', text: '“Water remembers the shape it was poured into. Guard the stream and the stream will guard you; a blow turned aside is a breath given back.”' },
    hint: 'A cold seam glows behind the shrine stone, like water under ice.' },
  { id: 'rise', name: 'Shepherd’s Rise', x: 155, z: -110, face: 0.9, relic: 'oathring', kind: 'cairn', tint: '#ffe9a8',
    lore: { title: 'Words cut round the cairn (Shepherd’s Rise)', text: '“Here the shepherds swore to the custodians: we keep the flocks, you keep the sky. The ring is our half of the oath. Whoever mends the stone may wear it.”' },
    hint: 'The capstone is split by a seam of pale light.' },
];
export const RUIN_IDS = RUINS.map((r) => r.id);
export type RuinSite = { def: RuinDef; root: THREE.Group; crack: THREE.Mesh; door: THREE.Mesh; glint: THREE.Sprite; fracture: { x: number; z: number }; alcove: { x: number; z: number }; doorT: number };

function stone(w: number, h: number, d: number, r: () => number, round = false): THREE.BufferGeometry {
  const g = round ? new THREE.DodecahedronGeometry(1, 0) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  g.scale(w, h, d); const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.86 + 0.28 * r()), p.getY(i) * (0.9 + 0.2 * r()), p.getZ(i) * (0.86 + 0.28 * r()));
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); g.dispose(); return ng;
}
const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); g.translate(x, y, z); return g; };

/** Builds the ruins. `solids` gets collision circles (stones the player can't walk through). */
export function makeRuins(scene: THREE.Scene, stoneMat: THREE.Material, solids: { x: number; z: number; r: number }[], mended: readonly string[], taken: readonly string[]) {
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const crackTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d')!; x.strokeStyle = '#fff'; x.lineCap = 'round';
    let px = 32, py = 4; x.lineWidth = 5; x.beginPath(); x.moveTo(px, py); const r = rng(71); while (py < 124) { px = Math.max(10, Math.min(54, px + (r() - 0.5) * 22)); py += 8 + r() * 10; x.lineTo(px, py); } x.stroke();
    x.globalAlpha = 0.5; x.lineWidth = 12; x.stroke(); return new THREE.CanvasTexture(c); })();
  const sites: RuinSite[] = [];
  for (const def of RUINS) {
    const r = rng(def.id.length * 977 + Math.round(def.x)), gs: THREE.BufferGeometry[] = [], root = new THREE.Group();
    const y0 = heightAt(def.x, def.z); root.position.set(def.x, y0, def.z); root.rotation.y = def.face; const cf = Math.cos(def.face), sf = Math.sin(def.face);
    const toW = (lx: number, lz: number) => ({ x: def.x + lx * cf + lz * sf, z: def.z - lx * sf + lz * cf });
    const solid = (lx: number, lz: number, rad: number) => { const w = toW(lx, lz); solids.push({ x: w.x, z: w.z, r: rad }); };
    let doorG: THREE.BufferGeometry, crackAt: THREE.Vector3, alc: { x: number; z: number };
    if (def.kind === 'kiln') {
      // a broken ring wall round a squat kiln dome; the kiln mouth (door) faces +z
      for (let i = 0; i < 11; i++) { const a = (i / 14) * Math.PI * 2 + 0.6, R = 6.2, h = 0.6 + r() * 1.5; gs.push(put(stone(1.6, h, 0.8, r), Math.sin(a) * R, h / 2 - 0.1, Math.cos(a) * R, a)); solid(Math.sin(a) * R, Math.cos(a) * R, 0.8); }
      const dome = new THREE.SphereGeometry(2.3, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); dome.computeVertexNormals(); gs.push(put(dome, 0, -0.1, -1));
      gs.push(put(stone(2.6, 0.5, 0.7, r), 0, 1.95, 1.05)); solid(0, -1, 2.2);
      for (let i = 0; i < 5; i++) gs.push(put(stone(0.6 + r() * 0.5, 0.35, 0.5 + r() * 0.4, r, true), (r() - 0.5) * 7, 0.1, 2.5 + r() * 2.5, r() * 3));
      doorG = put(stone(1.5, 1.7, 0.32, r), 0, 0.85, 1.25); crackAt = new THREE.Vector3(0, 0.95, 1.43); alc = toW(0, 0.2);
    } else if (def.kind === 'shrine') {
      // a plinth, four broken pillars and a fallen lintel; the shrine stone (door) stands at the back of the plinth
      gs.push(put(stone(5.2, 0.5, 4.2, r), 0, 0.15, 0)); solid(0, 0, 2.3);
      for (const [px, pz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) { const h = 1.4 + r() * 1.8; gs.push(put(new THREE.CylinderGeometry(0.34, 0.4, h, 8).toNonIndexed(), px, 0.4 + h / 2, pz)); }
      gs.push(put(stone(4.6, 0.45, 0.6, r), 0.4, 0.35, 3.0, 0.3, 0, 0.12));
      doorG = put(stone(1.8, 2.2, 0.4, r), 0, 1.5, -1.65); crackAt = new THREE.Vector3(0, 1.55, -1.43); alc = toW(0, -1.2);
    } else {
      // a ring of six standing stones round a cairn; the capstone (door) sits on the cairn's face
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, R = 5, h = 1.8 + r() * 1.4; gs.push(put(stone(0.9, h, 0.6, r), Math.sin(a) * R, h / 2 - 0.15, Math.cos(a) * R, a, (r() - 0.5) * 0.15)); solid(Math.sin(a) * R, Math.cos(a) * R, 0.6); }
      for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = r() * 1.3; gs.push(put(stone(0.6 + r() * 0.4, 0.5 + r() * 0.3, 0.6 + r() * 0.4, r, true), Math.sin(a) * d, 0.2 + r() * 1.1, -0.4 + Math.cos(a) * d * 0.8)); }
      solid(0, -0.4, 1.7);
      doorG = put(stone(1.4, 1.2, 0.35, r), 0, 0.75, 1.15); crackAt = new THREE.Vector3(0, 0.8, 1.34); alc = toW(0, 0.5);
    }
    const mesh = new THREE.Mesh(mergeGeometries(gs)!, stoneMat); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); for (const g of gs) g.dispose();
    const door = new THREE.Mesh(doorG, stoneMat); door.castShadow = true; root.add(door);
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshBasicMaterial({ map: crackTex, color: def.tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    crack.position.copy(crackAt); if (def.kind === 'shrine') crack.rotation.y = Math.PI; crack.renderOrder = 5; crack.layers.set(1); root.add(crack);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: def.tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glint.scale.setScalar(0.7); glint.position.set(0, 0.7, def.kind === 'shrine' ? -1.2 : def.kind === 'kiln' ? 0.2 : 0.5); glint.layers.set(1); root.add(glint);
    const fr = toW(crackAt.x, def.kind === 'shrine' ? crackAt.z - 0.6 : crackAt.z + 0.8);
    const s: RuinSite = { def, root, crack, door, glint, fracture: fr, alcove: alc, doorT: mended.includes(def.id) ? 1 : 0 };
    scene.add(root); sites.push(s); setSite(s, mended.includes(def.id), taken.includes(def.id));
  }
  function setSite(s: RuinSite, isMended: boolean, isTaken: boolean) { s.crack.visible = !isMended; s.glint.visible = isMended && !isTaken; if (isMended && s.doorT >= 1) s.door.position.y = -1.9; }
  let t = 0;
  return {
    sites,
    /** Fracture glow pulses; a mended door sinks; the relic glint bobs. Far ruins are hidden (draw budget). */
    tick(dt: number, px: number, pz: number, mended: readonly string[], taken: readonly string[]) { t += dt;
      for (const s of sites) { const d = Math.hypot(px - s.def.x, pz - s.def.z); s.root.visible = d < 150; if (!s.root.visible) continue;
        const m = mended.includes(s.def.id); if (m && s.doorT < 1) { s.doorT = Math.min(1, s.doorT + dt / 1.4); s.door.position.y = -1.9 * s.doorT * s.doorT; }
        (s.crack.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(t * 2.4 + s.def.x); s.crack.visible = !m;
        s.glint.visible = m && s.doorT > 0.6 && !taken.includes(s.def.id); if (s.glint.visible) { s.glint.position.y = 0.75 + 0.08 * Math.sin(t * 3); (s.glint.material as THREE.SpriteMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 5); } } },
    near(px: number, pz: number, range = 2.8) { for (const s of sites) { if (Math.hypot(px - s.fracture.x, pz - s.fracture.z) < range || Math.hypot(px - s.alcove.x, pz - s.alcove.z) < range - 0.6) return s; } return null; },
  };
}
