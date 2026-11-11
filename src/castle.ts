import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triplanar } from './landmarks';
import { flameTex, makeFlame } from './cave';
import type { GroundTex } from './terrain';

/** M20a · Explorable keep interiors. One generic layout (entry → great hall → side rooms, a ramp up to the gallery,
 *  the solar and a climbable switchback tower shaft), dressed per keep. Walls are inward-facing single-sided planes,
 *  walking is a set of floor regions (flat rects and ramps, each with a height) so overlapping floors work. */
export type KeepId = 'pale' | 'azure';
type Rect = { x0: number; x1: number; z0: number; z1: number };
type Region = Rect & { y: number; ramp?: { ax: 'x' | 'z'; a0: number; a1: number; y0: number; y1: number }; door?: string };
type Room = Rect & { id: string; name: string; y0: number; h: number; floor?: 'wood' | 'stone' };
type Door = { id: string; x: number; z: number; ax: 'x' | 'z'; w: number; h: number; y: number; secret?: boolean };
export type CInteract = { id: string; kind: 'exit' | 'roof' | 'hatch' | 'chest' | 'lore' | 'secret' | 'view' | 'stash'; x: number; z: number; y: number; r: number };
export type MobSpawn = { id: string; x: number; z: number; y: number; face: number };
export type ChestDef = { id: string; xp: number; weapon?: 'knight' | 'halberd'; whet?: boolean; lore?: string; note: string };
export type LoreDef = { id: string; title: string; text: string };

export const CASTLE_O: Record<KeepId, { x: number; z: number }> = { pale: { x: 6000, z: 0 }, azure: { x: 6000, z: 400 } };
export const KEEP_NAME: Record<KeepId, string> = { pale: 'Pale Keep', azure: 'Azure Keep' };
export const LORE: Record<string, LoreDef> = {
  'pale-cellar': { id: 'pale-cellar', title: 'The gaoler’s note (Pale Keep cellar)', text: '“Two of the hollow ones stand down here now. They do not sleep and they do not eat, and they will not let me past the third cell. Whatever the old lord kept there, he kept it from the sky as well as from us.”' },
  'azure-cellar': { id: 'azure-cellar', title: 'A page in the warden’s hand (Azure Keep cells)', text: '“The tide comes up through the cell floors twice a day. The prisoners learned to count it. When the sky broke they counted wrong, and the sea did not come at all.”' },
  'sea-bell': { id: 'sea-bell', title: 'Chalk on the drowned bell (Listening Pools)', text: '“Rang it once at low water to hear how far the cave goes. It answered from three places, and one of them was not stone. — E. M.”' },
  'sea-crystal': { id: 'sea-crystal', title: 'Tide-crystal tablet (Listening Pools)', text: '“The crystals grow only where the tide turns twice in the same breath — once in the pool, once in the stone. I counted seven breaths and the light ran west, into the seal. The Keeper is on the other side of that light. — E. M.”' },
  'pale-ledger': { id: 'pale-ledger', title: 'The Steward’s Ledger (Pale Keep)', text: '“…coal for the great hearth, eleven sacks. The old lord never let it be lit. Said the soot-black stone was not for warming. Press it, and the wall remembers the door.”' },
  'pale-solar': { id: 'pale-solar', title: 'A letter in the solar (Pale Keep)', text: '“The sky cracked over the vale at noon and the custodians rode out. We barred the gate. From the tower you can see where the light went wrong.”' },
  'pale-chapel': { id: 'pale-chapel', title: 'Chapel prayer-card (Pale Keep)', text: '“Keep the hollow ones still. They were set to guard, not to hate. Strike when they lift their arms — they cannot turn quickly.”' },
  'azure-log': { id: 'azure-log', title: 'Tide-warden’s log (Azure Keep)', text: '“The halberd is not for the armoury. I hung it where the lady kept her blue tapestry, and the tapestry over the door. Pull the cord with the silver tassel.”' },
  'azure-solar': { id: 'azure-solar', title: 'Unsent letter (Azure Keep)', text: '“From the lookout I watched the Lowtide Lamp go dark, one night after the sky broke. Marr says the sea is holding something open. I believe him now.”' },
  'azure-chapel': { id: 'azure-chapel', title: 'Armourer’s chalk (Azure Keep)', text: '“Sentinels: four blows, or two with a heavy weapon. Their swing is slow — dodge through it, or block and step in.”' },
};
export const CHESTS: Record<KeepId, ChestDef[]> = {
  pale: [
    { id: 'pale-library', xp: 20, note: 'A purse of old coin and a map-case (+20 XP).' },
    { id: 'pale-chapel', xp: 15, whet: true, lore: 'pale-chapel', note: 'A fine whetstone — every blade bites harder (+15% damage · +15 XP).' },
    { id: 'pale-solar', xp: 25, lore: 'pale-solar', note: 'A sealed letter and a silver clasp (+25 XP).' },
    { id: 'pale-secret', xp: 30, weapon: 'knight', note: 'The Knight’s Longsword, wrapped in oilcloth (+30 XP).' },
    { id: 'pale-cellar', xp: 30, lore: 'pale-cellar', note: 'A strongbox under the dungeon stair: old silver and a gaoler’s note (+30 XP).' },
  ],
  azure: [
    { id: 'azure-library', xp: 20, note: 'A few blue glass beads and a silver tide-coin (+20 XP).' },
    { id: 'azure-chapel', xp: 15, whet: true, lore: 'azure-chapel', note: 'A sea-grey whetstone — every blade bites harder (+15% damage · +15 XP).' },
    { id: 'azure-solar', xp: 25, lore: 'azure-solar', note: 'An unsent letter and a brass spyglass (+25 XP).' },
    { id: 'azure-secret', xp: 30, weapon: 'halberd', note: 'The Azure Halberd, hung in the dark (+30 XP).' },
    { id: 'azure-cellar', xp: 30, lore: 'azure-cellar', note: 'A sea-chest in the cells: salt-stiff coin and a page of the warden’s hand (+30 XP).' },
  ],
};
export const VIEW_XP = 15;
export const LECTERN_LORE: Record<KeepId, string> = { pale: 'pale-ledger', azure: 'azure-log' };

export const PLATE = { x: -6.0, z: -3.2, r: 0.5 };
// ---------- the template layout (local metres; entry door at +z, north/back at −z; upper floor at y 4.5) ----------
const UP = 4.5;
function layout(id: KeepId) {
  const rooms: Room[] = [
    { id: 'entry', name: 'Entry hall', x0: -4, x1: 4, z0: 4, z1: 10, y0: 0, h: 5 },
    { id: 'hall', name: 'Great hall', x0: -9, x1: 9, z0: -10, z1: 4, y0: 0, h: 9.5 },
    { id: 'library', name: 'Library', x0: 4, x1: 11, z0: 4, z1: 10, y0: 0, h: 4.6, floor: 'wood' },
    { id: 'chapel', name: 'Chapel', x0: -11, x1: -4, z0: 4, z1: 10, y0: 0, h: 5.2 },
    { id: 'solar', name: 'Solar', x0: -9, x1: -1, z0: -17, z1: -10, y0: UP, h: 4.4, floor: 'wood' },
    { id: 'shaft', name: 'Tower', x0: 2, x1: 9, z0: -17, z1: -10, y0: UP, h: 12.2 },
  ];
  const doors: Door[] = [
    { id: 'entry-hall', x: 0, z: 4, ax: 'x', w: 3.2, h: 3.8, y: 0 },
    { id: 'entry-lib', x: 4, z: 7, ax: 'z', w: 2, h: 2.8, y: 0 },
    { id: 'entry-chapel', x: -4, z: 7, ax: 'z', w: 2, h: 2.8, y: 0 },
    { id: 'gal-solar', x: -5, z: -10, ax: 'x', w: 2, h: 2.8, y: UP },
    { id: 'gal-shaft', x: 5.2, z: -10, ax: 'x', w: 1.9, h: 2.8, y: UP },
  ];
  if (id === 'pale') { rooms.push({ id: 'secret', name: 'Hidden room', x0: -15, x1: -9, z0: -2, z1: 4, y0: 0, h: 3.6 }); doors.push({ id: 'secret', x: -9, z: 1.0, ax: 'z', w: 1.6, h: 2.4, y: 0, secret: true }); }
  else { rooms.push({ id: 'secret', name: 'Hidden room', x0: -15, x1: -9, z0: -17, z1: -11, y0: UP, h: 3.4 }); doors.push({ id: 'secret', x: -9, z: -12.2, ax: 'z', w: 1.6, h: 2.4, y: UP, secret: true }); }
  // M21b · more of the keep: kitchen (west) and armoury (east) off the hall, a cellar/dungeon under the kitchen by a stone stair, and (Pale) a bedchamber off the solar.
  rooms.push({ id: 'kitchen', name: 'Kitchen', x0: -15, x1: -9, z0: -10, z1: -4, y0: 0, h: 4 }, { id: 'armory', name: 'Armoury', x0: 9, x1: 15, z0: -10, z1: -4, y0: 0, h: 4 },
    { id: 'cellar', name: 'Cellar', x0: -15, x1: -5, z0: -18, z1: -10, y0: CELLAR_Y, h: 3.6 - CELLAR_Y });
  doors.push({ id: 'hall-kitchen', x: -9, z: -8.6, ax: 'z', w: 1.6, h: 2.6, y: 0 }, { id: 'hall-armory', x: 9, z: -8.6, ax: 'z', w: 1.6, h: 2.6, y: 0 }, { id: 'kitchen-cellar', x: -13, z: -10, ax: 'x', w: 1.6, h: 2.6, y: 0 });
  if (id === 'pale') { rooms.push({ id: 'bed', name: 'Bedchamber', x0: -15, x1: -9, z0: -17, z1: -10.6, y0: UP, h: 3.6, floor: 'wood' }); doors.push({ id: 'solar-bed', x: -9, z: -12.4, ax: 'z', w: 1.6, h: 2.6, y: UP }); }
  return { rooms, doors };
}
export const CELLAR_Y = -4;
/** M21b · small hidden caches (loose stones, levers): one-off XP + a line of story. */
export const STASH: Record<string, { label: string; note: string; xp: number }> = {
  'pale-stone': { label: 'A loose stone in the armoury wall', note: 'Behind the loose stone: a soldier’s purse and a tin badge (+15 XP).', xp: 15 },
  'pale-lever': { label: 'An iron ring behind the bed-hangings', note: 'The ring is a lever · a panel in the wainscot drops open: a silver ring with a moth engraved on it (+20 XP).', xp: 20 },
  'pale-cell': { label: 'Scratches on the cell wall', note: 'Tally marks, and under them, a hidden key-hole · a little drawer holds a waxed map of the cave (+15 XP).', xp: 15 },
  'azure-stone': { label: 'A loose stone in the armoury wall', note: 'Behind the loose stone: a coil of blue cord and three tide-coins (+15 XP).', xp: 15 },
  'azure-cell': { label: 'Scratches on the cell wall', note: 'A prisoner’s calendar of tides · tucked in a crack, a brass whistle shaped like a gull (+15 XP).', xp: 15 },
};

const mat = (color: string, rough = 0.85, metal = 0, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeCastle(id: KeepId, high: boolean, t: { brick: GroundTex; sand: GroundTex; blocks: GroundTex; wood?: GroundTex }, env: THREE.Texture | null) {
  const O = CASTLE_O[id]; const az = id === 'azure';
  const scene = new THREE.Scene(); scene.background = new THREE.Color(az ? '#0b0f16' : '#0f0c0a');
  if (env) { scene.environment = env; scene.environmentIntensity = 0.3; }
  scene.add(new THREE.HemisphereLight(az ? '#a9bcd6' : '#d6c3a6', '#3a2c20', 1.05));
  const g = new THREE.Group(); g.position.set(O.x, 0, O.z); scene.add(g);
  const { rooms, doors } = layout(id);
  // Materials (merged per material below).
  const wallM = triplanar(t.brick, 2.6, az ? '#9aa4b0' : '#b8ab98', { sat: 0.4, gain: 1.35 });
  const floorM = triplanar(t.blocks, 2.4, az ? '#7f8894' : '#9a8f80', { sat: 0.5, gain: 1.2 });
  const woodFloorM = t.wood ? triplanar(t.wood, 2.4, '#b08a62', { sat: 0.9, gain: 1.15 }) : mat('#6a4a30', 0.75); const ceilM = mat(az ? '#3a3f48' : '#3f342a', 0.9);
  const beamM = mat('#4a3322', 0.8), woodM = t.wood ? triplanar(t.wood, 1.2, '#b08a62', { sat: 0.9, gain: 1.1 }) : mat('#7a5634', 0.7), darkWoodM = t.wood ? triplanar(t.wood, 1.2, '#6a4a34', { sat: 0.8, gain: 0.9 }) : mat('#4b3424', 0.75), ironM = mat('#2e2a27', 0.55, 0.7), stoneM = triplanar(t.sand, 2.0, az ? '#a4abb4' : '#b8b0a2', { sat: 0.25, gain: 1.2 }); // M21a: trim/stairs/frames were flat untextured grey
  const clothM = mat(az ? '#2e5a94' : '#8a2f2a', 0.95), cloth2M = mat(az ? '#c9b26a' : '#c9a24a', 0.9), rugM = mat(az ? '#24406a' : '#6d2a22', 1);
  const books = canvasTex(256, 128, (x) => { const cols = ['#6b2a22', '#2f4a6a', '#5a4a2a', '#3c5a34', '#7a6a4a', '#4a2a4a']; for (let r = 0; r < 4; r++) { let px = 0; while (px < 256) { const w = 6 + ((px * 7 + r * 13) % 11); x.fillStyle = cols[(px + r * 3) % cols.length]; x.fillRect(px, r * 32 + 4 + ((px * 3) % 5), w - 1, 28 - ((px * 3) % 5)); px += w; } x.fillStyle = '#3a281a'; x.fillRect(0, r * 32 + 30, 256, 2); } });
  const bookM = mat('#ffffff', 0.9, 0, { map: books });
  const geos = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (m: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => { if (ry) geo.rotateY(ry); geo.translate(x, y, z); const k = geo.index ? geo.toNonIndexed() : geo; for (const a of Object.keys(k.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') k.deleteAttribute(a); if (!k.attributes.uv) k.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(k.attributes.position.count * 2), 2)); (geos.get(m) ?? geos.set(m, []).get(m)!).push(k); };
  const box = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => put(m, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry);
  const cyl = (m: THREE.Material, r: number, h: number, x: number, y: number, z: number, seg = 10) => put(m, new THREE.CylinderGeometry(r, r, h, seg), x, y + h / 2, z);
  const regions: Region[] = []; const blockers: (Rect & { y: number })[] = [];
  const block = (x0: number, x1: number, z0: number, z1: number, y: number) => blockers.push({ x0, x1, z0, z1, y });
  const inter: CInteract[] = []; const mobs: MobSpawn[] = [];

  // ---- rooms: floor, ceiling, walls with door gaps + lintels ----
  const doorsOn = (r: Room, ax: 'x' | 'z', c: number) => doors.filter((d) => d.ax === ax && Math.abs((ax === 'x' ? d.z : d.x) - c) < 0.01 && d.y >= r.y0 - 0.01 && d.y < r.y0 + r.h && (ax === 'x' ? d.x > r.x0 && d.x < r.x1 : d.z > r.z0 && d.z < r.z1));
  const wallPlane = (a0: number, a1: number, yb: number, yt: number, ax: 'x' | 'z', c: number, inward: number) => {
    if (a1 - a0 < 0.01 || yt - yb < 0.01) return; const p = new THREE.PlaneGeometry(a1 - a0, yt - yb); const m = (a0 + a1) / 2, ym = (yb + yt) / 2;
    if (ax === 'x') put(wallM, p, m, ym, c, inward > 0 ? 0 : Math.PI); else put(wallM, p, c, ym, m, inward > 0 ? Math.PI / 2 : -Math.PI / 2);
  };
  for (const r of rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, top = r.y0 + r.h;
    const fl = new THREE.PlaneGeometry(w, d); fl.rotateX(-Math.PI / 2); put(r.floor === 'wood' ? woodFloorM : floorM, fl, cx, r.y0, cz);
    const ce = new THREE.PlaneGeometry(w, d); ce.rotateX(Math.PI / 2); put(ceilM, ce, cx, top, cz);
    for (let k = 1; k * 2.4 < d; k++) box(beamM, w, 0.3, 0.26, cx, top - 0.3, r.z0 + k * 2.4); // ceiling beams
    for (const [ax, c, inward, a0, a1] of [['x', r.z0, 1, r.x0, r.x1], ['x', r.z1, -1, r.x0, r.x1], ['z', r.x0, 1, r.z0, r.z1], ['z', r.x1, -1, r.z0, r.z1]] as const) {
      const ds = doorsOn(r, ax, c).sort((p, q) => (ax === 'x' ? p.x - q.x : p.z - q.z)); let a = a0;
      for (const dd of ds) { const m = ax === 'x' ? dd.x : dd.z; wallPlane(a, m - dd.w / 2, r.y0, top, ax, c, inward); wallPlane(m - dd.w / 2, m + dd.w / 2, dd.y + dd.h, top, ax, c, inward); if (dd.y > r.y0 + 0.01) wallPlane(m - dd.w / 2, m + dd.w / 2, r.y0, dd.y, ax, c, inward); a = m + dd.w / 2; }
      wallPlane(a, a1, r.y0, top, ax, c, inward);
      // skirting
      if (r.h < 9) { const len = a1 - a0; if (ax === 'x') box(stoneM, len, 0.22, 0.12, (a0 + a1) / 2, r.y0, c + inward * 0.06); else box(stoneM, 0.12, 0.22, len, c + inward * 0.06, r.y0, (a0 + a1) / 2); }
    }
    regions.push({ x0: r.x0 + 0.38, x1: r.x1 - 0.38, z0: r.z0 + 0.38, z1: r.z1 - 0.38, y: r.y0 });
  }
  // Door frames (jambs + lintel, 0.6 thick) and the walk-through strip.
  const secretSlab: { mesh: THREE.Mesh | null; open: number; want: number } = { mesh: null, open: 0, want: 0 };
  // M21a · the Pale secret door is a bookshelf (faces the hall, +x) that slides into the wall; a worn flagstone before it is a pressure plate.
  const bookMs = ['#6b2a22', '#2d4a3a', '#3a3358', '#7a5a2a', '#4a3a2c'].map((c) => mat(c, 0.75));
  function bookshelf(w: number, h: number): THREE.Group {
    const sg = new THREE.Group(); const lists: THREE.BufferGeometry[][] = bookMs.map(() => []); const frame: THREE.BufferGeometry[] = []; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    frame.push(new THREE.BoxGeometry(0.4, 0.1, w).translate(0.3, h / 2 - 0.05, 0), new THREE.BoxGeometry(0.4, h, 0.08).translate(0.3, 0, w / 2 - 0.04), new THREE.BoxGeometry(0.4, h, 0.08).translate(0.3, 0, -w / 2 + 0.04));
    for (let k = 0; k < 4; k++) { const sy = -h / 2 + 0.1 + k * (h - 0.2) / 4; frame.push(new THREE.BoxGeometry(0.4, 0.06, w).translate(0.3, sy, 0));
      for (let zz = -w / 2 + 0.12; zz < w / 2 - 0.16;) { const bw = 0.06 + rnd() * 0.07, bh = 0.32 + rnd() * 0.18; if (rnd() > 0.92) { zz += 0.12; continue; } lists[Math.floor(rnd() * bookMs.length)].push(new THREE.BoxGeometry(0.28, bh, bw).translate(0.32, sy + 0.03 + bh / 2, zz + bw / 2)); zz += bw + 0.012; } }
    const fm = new THREE.Mesh(mergeGeometries(frame, false), woodM); sg.add(fm);
    lists.forEach((l, i) => { if (l.length) sg.add(new THREE.Mesh(mergeGeometries(l, false), bookMs[i])); });
    return sg;
  }
  let plate: THREE.Mesh | null = null;
  if (id === 'pale') { plate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.95), mat('#5a554c', 0.95)); plate.position.set(PLATE.x, 0.035, PLATE.z); plate.receiveShadow = true; g.add(plate); }
  for (const d of doors) {
    const along = d.ax === 'x'; const T = 0.6;
    for (const s of [-1, 1]) { const off = s * (d.w / 2 + 0.14); if (along) box(stoneM, 0.28, d.h, T, d.x + off, d.y, d.z); else box(stoneM, T, d.h, 0.28, d.x, d.y, d.z + off); }
    if (along) box(stoneM, d.w + 0.56, 0.34, T, d.x, d.y + d.h, d.z); else box(stoneM, T, 0.34, d.w + 0.56, d.x, d.y + d.h, d.z);
    // reveal (underside + inner faces so the thickness reads)
    if (along) box(floorM, d.w, 0.04, T, d.x, d.y, d.z); else box(floorM, T, 0.04, d.w, d.x, d.y, d.z);
    const hw = d.w / 2 - 0.12; regions.push(along ? { x0: d.x - hw, x1: d.x + hw, z0: d.z - 0.9, z1: d.z + 0.9, y: d.y, door: d.secret ? 'secret' : undefined } : { x0: d.x - 0.9, x1: d.x + 0.9, z0: d.z - hw, z1: d.z + hw, y: d.y, door: d.secret ? 'secret' : undefined });
    if (d.secret) { const sl = new THREE.Mesh(new THREE.BoxGeometry(along ? d.w + 0.1 : 0.5, d.h, along ? 0.5 : d.w + 0.1), id === 'pale' ? darkWoodM : clothM); sl.position.set(d.x, d.y + d.h / 2, d.z); g.add(sl); secretSlab.mesh = sl;
      if (id === 'pale') sl.add(bookshelf(d.w + 0.1, d.h)); }
  }

  // ---- great hall: pillars, long table, hearth, banners, rugs ----
  for (const px of [-5.6, 5.6]) for (const pz of [-8, -4, 0]) { if (px > 0 && pz > -7) continue; cyl(stoneM, 0.42, UP, px, 0, pz, 12); box(stoneM, 1.0, 0.3, 1.0, px, 0, pz); block(px - 0.6, px + 0.6, pz - 0.6, pz + 0.6, 0); }
  box(darkWoodM, 2.2, 0.12, 8.5, 0, 0.82, -3); for (const lz of [-6.8, 0.8]) for (const lx of [-0.9, 0.9]) box(darkWoodM, 0.14, 0.82, 0.14, lx, 0, lz - 3 + 3);
  for (const s of [-1, 1]) box(woodM, 0.45, 0.45, 8, s * 1.75, 0, -3); block(-2.1, 2.1, -7.4, 1.4, 0);
  for (let k = 0; k < 5; k++) { cyl(cloth2M, 0.05, 0.16, -0.5 + (k % 2), 0.94, -6 + k * 1.5, 8); box(ironM, 0.3, 0.02, 0.3, 0.5 - (k % 2), 0.94, -5.5 + k * 1.5); }
  const rug = new THREE.PlaneGeometry(3.6, 11); rug.rotateX(-Math.PI / 2); put(rugM, rug, 0, 0.02, -2.5);
  // Hearth on the west wall (the secret door is just south of it in Pale Keep).
  box(stoneM, 0.9, 3.0, 3.0, -8.55, 0, -3); box(stoneM, 1.1, 0.35, 3.4, -8.45, 3.0, -3); box(stoneM, 0.7, 4.0, 2.2, -8.75, 3.35, -3);
  box(mat('#0b0806', 1), 0.1, 1.5, 1.8, -8.08, 0.2, -3); block(-9, -7.9, -4.6, -1.4, 0);
  const sootM = mat('#141010', 0.95); box(sootM, 0.12, 0.45, 0.6, -8.0, 2.2, -2.2);
  for (const bz of [-7, 1.5]) { const b = new THREE.PlaneGeometry(1.4, 3.2); b.rotateY(Math.PI / 2); put(clothM, b, -8.97, 5.6, bz); const b2 = b.clone(); b2.rotateY(Math.PI); put(clothM, b2, 8.97, 5.8, bz + 3); }
  // Gallery slab over the back of the hall + rail, and the east ramp (stepped) up to it.
  box(darkWoodM, 18, 0.3, 3.5, 0, UP - 0.3, -8.25); for (let x = -8.5; x <= 6.4; x += 1.5) box(darkWoodM, 0.1, 1.0, 0.1, x, UP, -6.55); box(darkWoodM, 15.2, 0.1, 0.14, -0.9, UP + 1.0, -6.55);
  for (const x of [-7.5, -2.5, 2.5]) { cyl(darkWoodM, 0.16, UP - 0.3, x, 0, -6.65, 8); block(x - 0.3, x + 0.3, -6.95, -6.35, 0); }
  regions.push({ x0: -8.62, x1: 8.62, z0: -9.62, z1: -6.55, y: UP });
  { const z0 = 1.2, z1 = -6.5, n = 15; for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * (i / n), zb = z0 + (z1 - z0) * ((i + 1) / n), y = UP * (i + 1) / n; box(stoneM, 2.2, y, Math.abs(zb - za), 7.7, 0, (za + zb) / 2); }
    box(darkWoodM, 0.1, 0.9, 7.8, 6.55, UP / 2 + 0.6, -2.6); regions.push({ x0: 6.75, x1: 8.6, z0: z1, z1: z0, y: 0, ramp: { ax: 'z', a0: z0, a1: z1, y0: 0, y1: UP } }); block(6.5, 9, z1, z0 - 0.35, 0); }
  // Windows high on the east/west walls with light shafts.
  const winM = new THREE.MeshBasicMaterial({ color: az ? '#cfe2ff' : '#ffe9c4' });
  const shaftTex = canvasTex(64, 256, (x) => { const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.25, 'rgba(0,0,0,0)'); h.addColorStop(0.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256); });
  const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex, color: az ? '#9fc4ff' : '#ffd9a0', transparent: true, opacity: high ? 0.32 : 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = new THREE.Group(); g.add(shafts);
  for (const [wx, wz, dir] of [[8.98, -4, -1], [8.98, 0.5, -1], [-8.98, -7.5, 1]] as const) {
    const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), winM); wn.position.set(wx, 6.6, wz); wn.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(wn);
    box(stoneM, 0.3, 0.2, 1.4, wx, 5.4, wz); 
    for (const k of [0, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 9), shaftM); p.position.set(wx + dir * 3.3, 3.6, wz); p.rotation.set(0, k ? 0 : Math.PI / 2, 0); p.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), dir * -0.62); shafts.add(p); }
  }

  // ---- entry hall ----
  box(darkWoodM, 2.6, 3.4, 0.16, 0, 0, 9.9); for (const s of [-1, 1]) box(ironM, 0.08, 3.2, 0.06, s * 0.6, 0.1, 9.8); box(ironM, 0.1, 0.1, 0.2, 0.25, 1.6, 9.75);
  inter.push({ id: 'exit', kind: 'exit', x: 0, z: 8.8, y: 0, r: 2.4 });
  for (const s of [-1, 1]) { box(darkWoodM, 0.6, 1.0, 0.6, s * 3.0, 0, 8.9); cyl(woodM, 0.32, 0.9, s * 3.2, 0, 5.2, 10); block(s * 3 - 0.4, s * 3 + 0.4, 8.5, 9.3, 0); block(s * 3.2 - 0.42, s * 3.2 + 0.42, 4.78, 5.62, 0); } // M21a: was one 5 m slab that sealed the library/chapel doors
  { const r = new THREE.PlaneGeometry(2.4, 5); r.rotateX(-Math.PI / 2); put(rugM, r, 0, 0.02, 7); }

  // ---- library (east): shelves, lectern, chest ----
  for (const lx of [5, 6.6, 8.2, 9.8]) { box(darkWoodM, 1.5, 3.0, 0.45, lx + 0.3, 0, 9.55); put(bookM, new THREE.PlaneGeometry(1.36, 2.7), lx + 0.3, 1.5, 9.3); }
  for (const lz of [5.2, 6.8]) { box(darkWoodM, 0.45, 3.0, 1.5, 10.55, 0, lz + 0.2); const p = new THREE.PlaneGeometry(1.36, 2.7); p.rotateY(-Math.PI / 2); put(bookM, p, 10.3, 1.5, lz + 0.2); }
  block(4.4, 11, 9.1, 10, 0); block(10.1, 11, 4.4, 8, 0);
  box(darkWoodM, 0.5, 1.0, 0.5, 7.2, 0, 6.2); box(woodM, 0.7, 0.06, 0.55, 7.2, 1.0, 6.2, 0.3); block(6.8, 7.6, 5.8, 6.6, 0);
  { const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), mat('#efe3c4', 0.9)); pg.rotation.x = -Math.PI / 2 + 0.3; pg.position.set(7.2, 1.1, 6.2); g.add(pg); }
  inter.push({ id: id + '-library-lectern', kind: 'lore', x: 7.2, z: 6.9, y: 0, r: 1.7 });
  // ---- chapel (west): altar, pews, stained window ----
  box(stoneM, 2.4, 1.0, 0.9, -10.2, 0, 7, Math.PI / 2); box(cloth2M, 0.5, 0.02, 2.0, -10.2, 1.0, 7); block(-11, -9.6, 5.6, 8.4, 0);
  for (const pz of [5.2, 8.8]) for (const px of [-7.6, -5.8]) { box(darkWoodM, 1.4, 0.45, 0.5, px, 0, pz); box(darkWoodM, 1.4, 0.6, 0.08, px, 0.45, pz + (pz > 7 ? 0.22 : -0.22)); block(px - 0.75, px + 0.75, pz - 0.35, pz + 0.35, 0); }
  { const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (x) => { const c = az ? ['#2f6fd0', '#79b4ff', '#d8c46a'] : ['#c03a2a', '#e0a040', '#3a6ad0']; for (let i = 0; i < 24; i++) { x.fillStyle = c[i % 3]; x.fillRect((i % 4) * 16, Math.floor(i / 4) * 21, 15, 20); } x.strokeStyle = '#111'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 128); x.stroke(); } }) })); sw.position.set(-10.97, 3.2, 7); sw.rotation.y = Math.PI / 2; g.add(sw); }
  // ---- solar (upper west): bed, table, tapestry ----
  box(darkWoodM, 2.2, 0.5, 3.0, -7.6, UP, -15.3); box(mat('#d8ccb4', 0.95), 2.0, 0.22, 2.4, -7.6, UP + 0.5, -15.0); box(clothM, 2.05, 0.1, 1.6, -7.6, UP + 0.66, -14.5); box(darkWoodM, 2.2, 1.4, 0.15, -7.6, UP, -16.85);
  block(-9, -6.4, -17, -13.6, UP);
  box(woodM, 1.4, 0.08, 0.9, -3.6, UP + 0.78, -15.6); for (const [lx, lz] of [[-4.2, -15.9], [-3, -15.9], [-4.2, -15.3], [-3, -15.3]]) box(woodM, 0.08, 0.78, 0.08, lx, UP, lz); block(-4.5, -2.7, -16.2, -15, UP);
  { const r = new THREE.PlaneGeometry(3.2, 2.4); r.rotateX(-Math.PI / 2); put(rugM, r, -5, UP + 0.02, -13.2); }
  if (!az) { const tp = new THREE.PlaneGeometry(2.2, 2.6); tp.rotateY(Math.PI / 2); put(clothM, tp, -8.96, UP + 2.2, -15.6); }
  // ---- battlements door at the gallery's west end ----
  box(darkWoodM, 0.16, 2.6, 1.6, -8.9, UP, -8.25); for (const s of [-1, 1]) box(ironM, 0.06, 2.4, 0.08, -8.82, UP + 0.1, -8.25 + s * 0.45);
  inter.push({ id: 'roof', kind: 'roof', x: -7.8, z: -8.25, y: UP, r: 1.8 });
  // ---- tower shaft: six flights round the walls to a hatch ----
  { const X0 = 2, X1 = 9, Z0 = -17, Z1 = -10, W = 1.7, rise = 1.6; let y = UP;
    const flights: [number, number, number, number, 'x' | 'z', number, number][] = []; // x0,x1,z0,z1, axis, from, to
    const legs = [[X1 - W, X1, Z1 - W, Z0 + W, 'z'], [X0 + W, X1 - W, Z0, Z0 + W, 'x-'], [X0, X0 + W, Z0 + W, Z1 - W, 'z+'], [X0 + W, X1 - W, Z1 - W, Z1, 'x+']] as const;
    const corners = [[X1 - W, X1, Z0, Z0 + W], [X0, X0 + W, Z0, Z0 + W], [X0, X0 + W, Z1 - W, Z1], [X1 - W, X1, Z1 - W, Z1]] as const;
    for (let f = 0; f < 6; f++) {
      const L = legs[f % 4]; const [x0, x1, z0, z1] = L; const dir = L[4];
      const ax: 'x' | 'z' = dir.startsWith('x') ? 'x' : 'z'; const a0 = dir === 'z' ? z0 : dir === 'x-' ? x1 : dir === 'z+' ? z0 : x0, a1 = dir === 'z' ? z1 : dir === 'x-' ? x0 : dir === 'z+' ? z1 : x1;
      const aa0 = dir === 'z' ? Z1 - W : a0, aa1 = dir === 'z' ? Z0 + W : a1; // east flights run north (−z)
      flights.push([x0, x1, Math.min(z0, z1), Math.max(z0, z1), ax, aa0, aa1]);
      regions.push({ x0: x0 + (ax === 'z' ? 0.12 : -0.25), x1: x1 - (ax === 'z' ? 0.12 : -0.25), z0: Math.min(z0, z1) + (ax === 'x' ? 0.12 : -0.25), z1: Math.max(z0, z1) - (ax === 'x' ? 0.12 : -0.25), y: y, ramp: { ax, a0: aa0, a1: aa1, y0: y, y1: y + rise } });
      const n = 8; for (let i = 0; i < n; i++) { const u0 = aa0 + (aa1 - aa0) * i / n, u1 = aa0 + (aa1 - aa0) * (i + 1) / n, sy = y + rise * (i + 1) / n; const th = Math.min(sy - UP, 0.5 + rise * (i + 1) / n);
        if (ax === 'z') box(stoneM, W, th, Math.abs(u1 - u0), (x0 + x1) / 2, sy - th, (u0 + u1) / 2); else box(stoneM, Math.abs(u1 - u0), th, W, (u0 + u1) / 2, sy - th, (z0 + z1) / 2); }
      y += rise; const C = corners[f % 4]; regions.push({ x0: C[0] + 0.12, x1: C[1] - 0.12, z0: C[2] + 0.12, z1: C[3] - 0.12, y }); box(stoneM, W, 0.5, W, (C[0] + C[1]) / 2, y - 0.5, (C[2] + C[3]) / 2);
      // inner rail along the flight
      if (ax === 'z') box(ironM, 0.06, 0.9, Math.abs(aa1 - aa0), x0 + 0.03, y - rise / 2, (aa0 + aa1) / 2); else box(ironM, Math.abs(aa1 - aa0), 0.9, 0.06, (aa0 + aa1) / 2, y - rise / 2, z0 === Z0 ? z1 - 0.03 : z0 + 0.03);
    }
    // the top landing is the NW corner (f=5 → corners[1]); the hatch is above it
    const top = y; box(darkWoodM, 1.2, 0.08, 1.2, X0 + W / 2, Z0 + W / 2 > 0 ? 0 : top + 3.4, Z0 + W / 2);
    box(woodM, 0.12, 3.4, 0.12, X0 + 0.25, top, Z0 + W - 0.3); for (let k = 0; k < 7; k++) box(woodM, 0.7, 0.06, 0.06, X0 + 0.55, top + 0.4 + k * 0.45, Z0 + W - 0.3);
    inter.push({ id: 'hatch', kind: 'hatch', x: X0 + W / 2, z: Z0 + W / 2, y: top, r: 1.6 });
    void flights;
  }
  // ---- secret rooms ----
  if (!az) { box(darkWoodM, 1.8, 0.9, 0.8, -12, 0, -1.4); box(ironM, 0.2, 2.0, 1.4, -14.8, 0, 2); for (let k = 0; k < 3; k++) box(stoneM, 0.5, 0.5, 0.5, -14.4, 0, -1.4 + k * 0.6); block(-13, -11, -2, -0.9, 0); }
  else { box(darkWoodM, 1.8, 0.9, 0.8, -12, UP, -16.5); block(-13, -11, -17, -16, UP); }
  inter.push(az ? { id: 'secret', kind: 'secret', x: -8.0, z: -12.2, y: UP, r: 1.9 } : { id: 'secret', kind: 'secret', x: -8.0, z: 0.4, y: 0, r: 2.0 });

  // ---- M21b · kitchen: a great cook-hearth, work table, pots, barrels, a hanging rack ----
  { const C = mat('#2a2622', 0.6, 0.5);
    // Surround + open mouth (the old solid 0.9×2.6×3.2 block hid the fire behind a stone face).
    box(stoneM, 0.28, 2.6, 3.2, -14.82, 0, -7);
    box(stoneM, 0.72, 2.6, 0.5, -14.48, 0, -8.35); box(stoneM, 0.72, 2.6, 0.5, -14.48, 0, -5.65);
    box(stoneM, 0.72, 0.55, 2.3, -14.48, 2.05, -7); box(stoneM, 1.1, 0.4, 3.6, -14.4, 2.6, -7);
    box(stoneM, 0.5, 0.14, 2.4, -14.05, 0, -7); block(-15, -13.6, -8.8, -5.2, 0);
    box(sootM, 0.06, 1.85, 2.15, -14.66, 0.14, -7); box(sootM, 0.55, 1.85, 0.06, -14.4, 0.14, -8.08); box(sootM, 0.55, 1.85, 0.06, -14.4, 0.14, -5.92);
    const coal = mat('#c45a12', 0.7, 0, { emissive: '#c24a10', emissiveIntensity: 1.15 });
    const bed = new THREE.PlaneGeometry(0.55, 1.5); bed.rotateX(-Math.PI / 2); put(coal, bed, -14.35, 0.16, -7);
    for (const [z, ry] of [[-7.3, 0.28], [-6.8, -0.4], [-7.05, 0.08]] as const) { const log = new THREE.CylinderGeometry(0.07, 0.08, 0.62, 8); log.rotateZ(Math.PI / 2); log.rotateY(ry); put(woodM, log, -14.28, 0.24, z); }
    const emb = makeFlame(flameTex(), 1.6); emb.position.set(-14.15, 0.3, -7); g.add(emb);
    box(woodM, 2.6, 0.12, 1.1, -11.6, 0.82, -6.4); for (const [dx, dz] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]]) box(darkWoodM, 0.1, 0.82, 0.1, -11.6 + dx, 0, -6.4 + dz); block(-13.1, -10.1, -7.1, -5.7, 0);
    for (const [x, z] of [[-11.9, -6.3], [-11.2, -6.6]]) cyl(C, 0.22, 0.28, x, 0.94, z, 10);
    for (const [x, z] of [[-9.8, -4.8], [-10.6, -4.7]]) { cyl(woodM, 0.4, 0.95, x, 0, z, 12); for (const y of [0.15, 0.75]) cyl(ironM, 0.41, 0.05, x, y, z, 12); } block(-11.1, -9.3, -5.3, -4.3, 0);
    box(darkWoodM, 3.0, 0.08, 0.08, -11.6, 3.1, -6.4); for (let k = 0; k < 5; k++) { box(ironM, 0.02, 0.4, 0.02, -12.8 + k * 0.6, 2.7, -6.4); cyl(C, 0.12, 0.1, -12.8 + k * 0.6, 2.6, -6.4, 8); }
    const sk = new THREE.PlaneGeometry(1.1, 1.1); sk.rotateX(-Math.PI / 2); put(rugM, sk, -11.6, 0.02, -8.6); }
  // ---- armoury: weapon racks, armour stands, shields, a loose stone ----
  { const steel = mat('#9aa0a6', 0.35, 0.85);
    for (const z of [-9.2, -4.8]) { box(darkWoodM, 4.2, 0.1, 0.3, 12.2, 0.9, z); box(darkWoodM, 4.2, 0.1, 0.3, 12.2, 1.9, z); for (let k = 0; k < 7; k++) { box(steel, 0.05, 1.9, 0.05, 10.5 + k * 0.58, 0.2, z); box(darkWoodM, 0.07, 0.5, 0.07, 10.5 + k * 0.58, 0, z); } block(10, 14.4, z - 0.35, z + 0.35, 0); }
    for (const z of [-7.8, -6.2]) { cyl(darkWoodM, 0.06, 1.4, 14.2, 0, z, 6); box(steel, 0.5, 0.65, 0.3, 14.2, 1.0, z); const hm = new THREE.SphereGeometry(0.17, 10, 8); put(steel, hm, 14.2, 1.85, z); box(steel, 0.75, 0.12, 0.2, 14.2, 1.55, z); } block(13.7, 15, -8.3, -5.7, 0);
    for (const [y, z] of [[2.6, -8], [2.6, -6], [2.9, -7]]) { const sh = new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16); sh.rotateZ(Math.PI / 2); put(clothM, sh, 14.93, y, z); const b2 = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10); b2.rotateZ(Math.PI / 2); put(steel, b2, 14.9, y, z); }
    box(stoneM, 0.06, 0.32, 0.5, 14.95, 0.5, -5.4); inter.push({ id: id + '-stone', kind: 'stash', x: 14.0, z: -5.4, y: 0, r: 1.3 }); }
  // ---- cellar / dungeon: a stone stair down from the kitchen, iron-barred cells, barrels, two sentinels ----
  { const Y = CELLAR_Y, S0 = -12.0, S1 = -6.4, zA = -12.1, zB = -10.35, n = 12;
    box(stoneM, 3.0, -Y, zB - zA, -13.5, Y, (zA + zB) / 2); regions.push({ x0: -14.62, x1: S0, z0: zA + 0.1, z1: -10.3, y: 0 });
    for (let i = 0; i < n; i++) { const xa = S0 + (S1 - S0) * i / n, xb = S0 + (S1 - S0) * (i + 1) / n, top = -Y * (1 - (i + 1) / n); box(stoneM, Math.abs(xb - xa), Math.max(0.05, top), zB - zA, (xa + xb) / 2, Y, (zA + zB) / 2); }
    regions.push({ x0: S0, x1: S1, z0: zA + 0.1, z1: zB - 0.05, y: 0, ramp: { ax: 'x', a0: S0, a1: S1, y0: 0, y1: Y } }); block(-15, S1 - 0.8, zA - 0.25, -10, Y);
    for (let k = 0; k <= 8; k++) { const x = S0 + (S1 - S0) * k / 8, yy = -Y * (1 - k / 8) + Y; box(ironM, 0.05, 0.95, 0.05, x, yy + (k === 8 ? 0 : 0), zA + 0.04); }
    { const len = Math.hypot(S1 - S0, Y), rl = new THREE.BoxGeometry(len, 0.06, 0.08); rl.rotateZ(Math.atan2(Y, S1 - S0)); put(ironM, rl, (S0 + S1) / 2, Y / 2 + 0.95, zA + 0.04); }
    // cells along the north wall: bars, cots, a hidden drawer
    for (let c = 0; c < 3; c++) { const x0 = -14.8 + c * 2.6; for (let k = 0; k < 9; k++) box(ironM, 0.05, 2.6, 0.05, x0 + 0.15 + k * 0.28, Y, -15.6); box(ironM, 2.5, 0.08, 0.08, x0 + 1.25, Y + 2.55, -15.6); box(darkWoodM, 0.8, 0.35, 1.7, x0 + 0.6, Y, -17.0); }
    block(-15, -7, -18, -15.4, Y); inter.push({ id: id + '-cell', kind: 'stash', x: -9.2, z: -14.8, y: Y, r: 1.3 }); box(stoneM, 0.5, 0.4, 0.06, -9.2, Y + 1.0, -15.5);
    for (const [x, z] of [[-14.4, -13.4], [-14.4, -14.3], [-13.6, -13.6]]) { cyl(woodM, 0.4, 0.95, x, Y, z, 12); for (const y of [0.15, 0.75]) cyl(ironM, 0.41, 0.05, x, Y + y, z, 12); } block(-15, -13.1, -14.8, -12.9, Y);
    for (let k = 1; k < 4; k++) cyl(stoneM, 0.28, -Y + 3.6, -5 - k * 2.5 - 0.0, Y, -13.2, 10); // squat pillars hold the kitchen floor
    for (let k = 1; k < 4; k++) block(-5 - k * 2.5 - 0.4, -5 - k * 2.5 + 0.4, -13.6, -12.8, Y);
    // Floor grate (slats, not a solid black plate).
    box(ironM, 1.64, 0.05, 0.08, -11.2, Y, -14.3 - 0.78); box(ironM, 1.64, 0.05, 0.08, -11.2, Y, -14.3 + 0.78);
    box(ironM, 0.08, 0.05, 1.64, -11.2 - 0.78, Y, -14.3); box(ironM, 0.08, 0.05, 1.64, -11.2 + 0.78, Y, -14.3);
    for (let k = 0; k < 6; k++) box(ironM, 0.05, 0.04, 1.5, -11.2 - 0.65 + k * 0.26, Y + 0.02, -14.3);
    mobs.push({ id: id + '-cellar1', x: -9.2, z: -14.0, y: Y, face: 0 }, { id: id + '-cellar2', x: -6.6, z: -15.2, y: Y, face: -Math.PI / 2 }); }
  // ---- Pale bedchamber: four-poster bed, wardrobe, rug, a lever behind the hangings ----
  if (!az) { const Y = UP;
    box(darkWoodM, 2.0, 0.5, 2.6, -13.4, Y, -15.4); box(cloth2M, 1.9, 0.18, 2.4, -13.4, Y + 0.5, -15.4); box(clothM, 1.9, 0.2, 0.7, -13.4, Y + 0.55, -16.3);
    for (const [dx, dz] of [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]]) box(darkWoodM, 0.12, 2.5, 0.12, -13.4 + dx, Y, -15.4 + dz);
    box(clothM, 2.0, 0.08, 2.6, -13.4, Y + 2.5, -15.4); for (const s2 of [-1, 1]) box(clothM, 0.04, 1.9, 2.5, -13.4 + s2 * 1.0, Y + 0.6, -15.4); block(-14.5, -12.3, -16.9, -14.0, Y);
    box(darkWoodM, 1.4, 2.2, 0.6, -10.4, Y, -16.6); box(ironM, 0.05, 0.2, 0.05, -10.5, Y + 1.1, -16.28); box(ironM, 0.05, 0.2, 0.05, -10.3, Y + 1.1, -16.28); block(-11.2, -9.6, -17, -16.2, Y);
    const rg = new THREE.PlaneGeometry(2.4, 1.6); rg.rotateX(-Math.PI / 2); put(rugM, rg, -12.6, Y + 0.02, -12.6);
    const ring = new THREE.TorusGeometry(0.09, 0.02, 6, 12); put(ironM, ring, -14.93, Y + 1.3, -13.6, Math.PI / 2); inter.push({ id: 'pale-lever', kind: 'stash', x: -14.0, z: -13.6, y: Y, r: 1.3 }); }
  const ft = flameTex();
  // ---- chests ----
  const chestDefs = CHESTS[id]; const chestPos: Record<string, [number, number, number, number]> = {
    [id + '-library']: [9.6, 0, 5.0, -Math.PI / 2], [id + '-chapel']: [-10.3, 0, 9.3, Math.PI], [id + '-solar']: [-1.9, UP, -16.3, 0], [id + '-secret']: az ? [-14.2, UP, -13.5, Math.PI / 2] : [-14.2, 0, 0.8, Math.PI / 2], [id + '-cellar']: [-6.3, CELLAR_Y, -17.0, 0] };
  const lidM = mat('#6b4a2c', 0.7), bandM = mat('#8c7a50', 0.45, 0.8);
  const chests = chestDefs.map((c) => {
    const [x, y, z, ry] = chestPos[c.id]; const cg = new THREE.Group(); cg.position.set(x, y, z); cg.rotation.y = ry; g.add(cg);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), lidM); body.position.y = 0.28; cg.add(body);
    for (const s of [-0.38, 0.38]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.57, 0.72), bandM); b.position.set(s, 0.28, 0); cg.add(b); }
    const hinge = new THREE.Group(); hinge.position.set(0, 0.55, -0.35); cg.add(hinge);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 10, 1, false, 0, Math.PI), lidM); lid.rotation.z = Math.PI / 2; lid.scale.set(0.5, 1, 1); lid.position.set(0, 0, 0.35); hinge.add(lid);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.05), bandM); lock.position.set(0, 0.5, 0.36); cg.add(lock);
    const glow = makeFlame(ft, 1.6); glow.material.color.set('#ffe6a0'); glow.position.set(0, 0.45, 0); glow.visible = false; cg.add(glow);
    block(x - 0.75, x + 0.75, z - 0.75, z + 0.75, y);
    const dx = Math.sin(ry) * 0.95, dz = Math.cos(ry) * 0.95; inter.push({ id: c.id, kind: 'chest', x: x + dx, z: z + dz, y, r: 1.6 });
    return { def: c, group: cg, hinge, glow, open: 0, want: 0 };
  });

  // ---- torches (flame sprites everywhere, a handful of real lights) ----
  const flames: { f: THREE.Sprite; l: THREE.PointLight | null; ph: number }[] = [];
  const torchAt = (x: number, y: number, z: number, nx: number, nz: number, light: boolean) => {
    box(ironM, 0.1, 0.36, 0.1, x - nx * 0.08, y - 0.3, z - nz * 0.08); const cup = new THREE.CylinderGeometry(0.11, 0.05, 0.18, 8, 1, true); put(ironM, cup, x, y, z);
    const f = makeFlame(ft, 0.85); f.position.set(x, y + 0.06, z); g.add(f);
    let l: THREE.PointLight | null = null; if (light) { l = new THREE.PointLight('#ff9f52', 11, 18, 1.3); l.position.set(x + nx * 0.4, y + 0.4, z + nz * 0.4); g.add(l); }
    flames.push({ f, l, ph: flames.length * 1.37 });
  };
  const T: [number, number, number, number, number, boolean, boolean][] = [ // x,y,z,nx,nz, light(High), light(Lite)
    [-2.2, 2.6, 9.85, 0, -1, true, true], [2.2, 2.6, 9.85, 0, -1, false, false],
    [-8.85, 3.0, -0.2, 1, 0, true, true], [8.85, 3.4, -7.2, -1, 0, true, true], [-3.5, 3.0, 3.85, 0, -1, false, false], [3.5, 3.0, 3.85, 0, -1, false, false],
    [10.85, 2.4, 8.6, -1, 0, true, true], [-10.85, 2.6, 5.2, 1, 0, true, true],
    [-1.2, UP + 2.3, -16.85, 0, 1, true, true], [8.85, UP + 2.4, -13.5, -1, 0, false, false], [2.15, UP + 8.6, -13.5, 1, 0, true, true],
    [-0.5, UP + 2.4, -9.85, 0, 1, false, false], [-14.85, 2.4, -5.2, 1, 0, true, false], [14.85, 2.4, -7, -1, 0, true, true], [-5.15, CELLAR_Y + 2.4, -15.5, -1, 0, true, true], [-14.85, CELLAR_Y + 2.4, -13, 1, 0, false, false], [-12, (az ? UP : 0) + 2.2, az ? -11.15 : 3.85, 0, -1, true, false],
  ];
  for (const [x, y, z, nx, nz, hi, lo] of T) torchAt(x, y, z, nx, nz, high ? hi : lo);
  const hearthL = new THREE.PointLight('#ff7a32', az ? 0 : 0, 8, 1.8); hearthL.position.set(-7.6, 1.0, -3); g.add(hearthL);

  // ---- enemies ----
  mobs.push({ id: id + '-hall', x: -3.4, z: -7.8, y: 0, face: 0 });
  mobs.push(az ? { id: id + '-gallery', x: -3, z: -8.2, y: UP, face: Math.PI / 2 } : { id: id + '-chapel', x: -7.2, z: 7, y: 0, face: Math.PI / 2 });

  // ---- merge static geometry ----
  for (const [m, list] of geos) { const merged = mergeGeometries(list, false); const mesh = new THREE.Mesh(merged, m); mesh.receiveShadow = true; mesh.castShadow = false; g.add(mesh); }

  // ---- walking ----
  let secretOpen = false; let cur: Region | null = null; let y = 0;
  const hAt = (r: Region, x: number, z: number) => { if (!r.ramp) return r.y; const a = r.ramp.ax === 'x' ? x : z; const k = Math.min(1, Math.max(0, (a - r.ramp.a0) / (r.ramp.a1 - r.ramp.a0))); return r.ramp.y0 + (r.ramp.y1 - r.ramp.y0) * k; };
  const inR = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  function pick(lx: number, lz: number, fromY: number, prev: Region | null): { r: Region; h: number } | null {
    let best: { r: Region; h: number } | null = null, bestD = 1e9, ramp: { r: Region; h: number } | null = null, keep: { r: Region; h: number } | null = null;
    for (const r of regions) { if (r.door === 'secret' && !secretOpen) continue; if (!inR(r, lx, lz)) continue; const h = hAt(r, lx, lz), d = Math.abs(h - fromY); if (d > 0.7) continue;
      if (r === prev) keep = { r, h }; if (r.ramp && d < 0.35 && (!ramp || d < Math.abs(ramp.h - fromY))) ramp = { r, h }; if (d < bestD) { bestD = d; best = { r, h }; } }
    if (keep && prev?.ramp) return keep; if (ramp) return ramp; return keep ?? best;
  }
  const blocked = (lx: number, lz: number, h: number) => blockers.some((b) => Math.abs(b.y - h) < 1 && lx > b.x0 - 0.3 && lx < b.x1 + 0.3 && lz > b.z0 - 0.3 && lz < b.z1 + 0.3);
  const tryAt = (lx: number, lz: number) => { const p = pick(lx, lz, y, cur); if (!p || (!p.r.ramp && blocked(lx, lz, p.h))) return null; return p; };
  // Camera: the union of room boxes the player can see from; pull the boom in until the camera sits inside the player's room (or doorway).
  const camBoxes = rooms.map((r) => ({ ...r, y1: r.y0 + r.h }));
  const roomOf = (lx: number, lz: number, ly: number) => camBoxes.find((r) => inR(r, lx, lz) && ly >= r.y0 - 0.3 && ly <= r.y1);
  const inside = (lx: number, ly: number, lz: number, r: (typeof camBoxes)[number]) => lx > r.x0 + 0.25 && lx < r.x1 - 0.25 && lz > r.z0 + 0.25 && lz < r.z1 - 0.25 && ly > r.y0 + 0.2 && ly < r.y1 - 0.25;
  const tv = new THREE.Vector3(), cv = new THREE.Vector3(), cv2 = new THREE.Vector3();

  return {
    id, scene, O, rooms, interact: inter, mobs, chests,
    get y() { return y; },
    get secretOpen() { return secretOpen; },
    /** M20b · ceiling height over the floor at (wx,wz,wy) — a hop never lifts the head through it. */
    ceilAt(wx: number, wz: number, wy: number) { return roomOf(wx - O.x, wz - O.z, wy + 0.5)?.y1 ?? Infinity; },
    roomAt(wx: number, wz: number, wy: number) { return roomOf(wx - O.x, wz - O.z, wy + 0.5)?.id ?? ''; },
    roomName(wx: number, wz: number) { return roomOf(wx - O.x, wz - O.z, y + 0.5)?.name ?? ''; },
    /** Place the player (world coords) at a known spot; height is taken from the best region there. */
    place(wx: number, wz: number, wy: number) { y = wy; const p = pick(wx - O.x, wz - O.z, wy, null); cur = p?.r ?? null; if (p) y = p.h; },
    constrain(ox: number, oz: number, nx: number, nz: number): [number, number] {
      const lx = nx - O.x, lz = nz - O.z, lox = ox - O.x, loz = oz - O.z;
      let p = tryAt(lx, lz); let rx = lx, rz = lz;
      // M21a · doorway funnel: pushing into the wall beside a door eases you sideways into the opening (touch steering is never exact).
      if (!p) for (const d of doors) { if (d.secret && !secretOpen) continue; if (Math.abs(d.y - y) > 0.3) continue; const isX = d.ax === 'x', perp = isX ? lz - d.z : lx - d.x, lat = isX ? lx - d.x : lz - d.z, mv = isX ? lz - loz : lx - lox, hw = d.w / 2 - 0.12;
        if (Math.abs(perp) > 1.4 || Math.abs(lat) > hw + 0.9 || Math.abs(lat) <= hw || mv * perp > 0) continue; const step = Math.max(0.04, Math.hypot(lx - lox, lz - loz)); const nl = lat - Math.sign(lat) * Math.min(step, Math.abs(lat) - hw + 0.02);
        const q = isX ? tryAt(d.x + nl, lz) : tryAt(lx, d.z + nl); if (q) { p = q; rx = isX ? d.x + nl : lx; rz = isX ? lz : d.z + nl; break; }
        const q2 = isX ? tryAt(d.x + nl, loz) : tryAt(lox, d.z + nl); if (q2) { p = q2; rx = isX ? d.x + nl : lox; rz = isX ? loz : d.z + nl; break; } }
      if (!p) { p = tryAt(lx, loz); rx = lx; rz = loz; }
      if (!p) { p = tryAt(lox, lz); rx = lox; rz = lz; }
      if (!p) return [ox, oz];
      cur = p.r; y = p.h; return [rx + O.x, rz + O.z];
    },
    /** Can a mob stand at (world x,z) on height y? */
    walkable(wx: number, wz: number, wy: number) { const lx = wx - O.x, lz = wz - O.z; for (const r of regions) { if (r.door === 'secret' && !secretOpen) continue; if (r.ramp || !inR(r, lx, lz) || Math.abs(r.y - wy) > 0.2) continue; return !blocked(lx, lz, r.y); } return false; },
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const r = roomOf(target.x - O.x, target.z - O.z, target.y - 1) ?? roomOf(target.x - O.x, target.z - O.z, target.y); if (!r) return;
      const lx = (v: THREE.Vector3) => [v.x - O.x, v.y, v.z - O.z] as const;
      const [tx, ty, tz] = lx(target), [cx, cy, cz] = lx(cam); if (inside(cx, cy, cz, r)) return;
      // A boom that leaves through a doorway may sit in the next room (you look through the door frame).
      let other: (typeof camBoxes)[number] | undefined;
      for (const d of doors) { if (d.secret && !secretOpen) continue; const isX = d.ax === 'x', c = isX ? d.z : d.x, a0 = isX ? tz : tx, a1 = isX ? cz : cx; if ((a0 - c) * (a1 - c) >= 0) continue;
        const k = (c - a0) / (a1 - a0), u = isX ? tx + (cx - tx) * k : tz + (cz - tz) * k, yy = ty + (cy - ty) * k; if (Math.abs(u - (isX ? d.x : d.z)) > d.w / 2 - 0.25 || yy < d.y + 0.2 || yy > d.y + d.h - 0.25) continue;
        const px = isX ? u : c + Math.sign(a1 - c) * 0.6, pz = isX ? c + Math.sign(a1 - c) * 0.6 : u; other = camBoxes.find((b) => b !== r && inR(b, px, pz) && yy >= b.y0 && yy <= b.y1); if (other) break; }
      const noRoom = (a: number, b: number, c: number) => !camBoxes.some((q) => a > q.x0 - 0.15 && a < q.x1 + 0.15 && c > q.z0 - 0.15 && c < q.z1 + 0.15 && b > q.y0 - 0.4 && b < q.y1 + 0.4);
      // the narrow tower shaft is framed dollhouse-style: the boom may leave through a wall into the empty dark outside (single-sided walls vanish)
      const ok = (a: number, b: number, c: number) => inside(a, b, c, r) || (!!other && inside(a, b, c, other)) || (r.id === 'shaft' && b > r.y0 + 0.3 && b < r.y1 - 0.3 && noRoom(a, b, c));
      if (ok(cx, cy, cz)) return;
      const fit = (c: THREE.Vector3) => { let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; tv.lerpVectors(target, c, m); const [a, b, cc] = lx(tv); if (ok(a, b, cc)) lo = m; else hi = m; } return lo; };
      // Tight rooms: rather than shoving the camera into the hero's back, crane the boom up (look down from higher) until it fits.
      let best = fit(cam), bestC = cv.copy(cam); const L = cam.distanceTo(target);
      // M21b · tall rooms (great hall + its stair) crane earlier and higher so the stair never ends in a tight over-the-back view.
      const tall = r.h > 6, TH = tall ? 4.8 : 3.2;
      if (best * L < TH) { const vx = cam.x - target.x, vy = cam.y - target.y, vz = cam.z - target.z, h = Math.hypot(vx, vz) || 1e-6, a0 = Math.atan2(vy, h);
        const k = (tall ? 1.1 : 0.9) * Math.min(1, (TH - best * L) / 2.4), a = Math.min(tall ? 1.3 : 1.15, a0 + k); // continuous in the clamp depth → no camera pops
        cv2.set(target.x + vx / h * L * Math.cos(a), target.y + L * Math.sin(a), target.z + vz / h * L * Math.cos(a)); best = fit(cv2); bestC = cv.copy(cv2); }
      cam.lerpVectors(target, bestC, Math.max(0.12, best));
    },
    openSecret(instant = false) { secretOpen = true; secretSlab.want = 1; if (instant) secretSlab.open = 1; },
    openChest(cid: string, instant = false) { const c = chests.find((k) => k.def.id === cid); if (c) { c.want = 1; if (instant) c.open = 1; } },
    update(dt: number, time: number) {
      for (const k of flames) { const f = 0.82 + 0.18 * Math.sin(time * 15 + k.ph) * Math.sin(time * 6.1 + k.ph * 2); k.f.scale.set(0.36 * f, 0.68 * (0.92 + 0.16 * f), 1); if (k.l) k.l.intensity = 11 * f; }
      if (secretSlab.mesh) { secretSlab.open += (secretSlab.want - secretSlab.open) * Math.min(1, dt * 1.6); const m = secretSlab.mesh; m.visible = secretSlab.open < 0.98; if (id === 'pale') { m.visible = true; m.position.z = doors.find((d) => d.secret)!.z + secretSlab.open * 1.75; if (plate) plate.position.y = 0.035 - secretSlab.open * 0.03; } else m.scale.y = 1 - secretSlab.open * 0.92, m.position.y = UP + 2.4 * (1 - (1 - secretSlab.open * 0.92) / 2); }
      for (const c of chests) { c.open += (c.want - c.open) * Math.min(1, dt * 4); c.hinge.rotation.x = -c.open * 1.9; c.glow.visible = c.open > 0.05 && c.open < 0.97; c.glow.material.opacity = 1 - c.open; }
      shafts.children.forEach((s, i) => { ((s as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (high ? 0.32 : 0.26) * (0.85 + 0.15 * Math.sin(time * 0.4 + i)); });
    },
  };
}
export type Castle = ReturnType<typeof makeCastle>;
