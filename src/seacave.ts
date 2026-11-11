import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triplanar } from './landmarks';
import type { GroundTex } from './terrain';

/** The Listening Pools: the sea cave beyond the Tidewrack Coast's cave mouth (Chapter II, part 3). Its own scene at a far origin. */
export const SEA_O = { x: 3000, z: 3000 };
export const SEA_XP = 45;
export const SEA_PERIOD = 22;
const SHELL_Y = -0.42; // a lamp-shell is under water when the chamber's tide is above this
const CX = -13, RX = 19, RZ = 11.5, RY = 8.5; // chamber ellipsoid (centre x, radii)
const POOLS = [{ x: -5.5, z: -4.2 }, { x: -13, z: 4.6 }, { x: -21, z: -3.4 }];
const DOOR = { x: -32.6, z: 0 };
const RXW = RX + 3.6; // the west half of the chamber is longer: the seal stands in a deep apse
const rxOf = (c: number) => (c < 0 ? RXW : RX);
/** M20b · two side grottoes off the Listening Pools. M21b-2 · two more chambers: a flooded grotto (west-north) and a tide-crystal chamber (east-south). */
export type GrottoKind = 'wrack' | 'bell' | 'flood' | 'crystal';
export type GrottoDef = { id: string; x: number; z: number; rx: number; rz: number; ry: number; side: 1 | -1; name: string; kind: GrottoKind; fy?: number; mouth?: number };
export const GROTTOS: GrottoDef[] = [
  { id: 'north', x: -9.5, z: 21.5, rx: 7.2, rz: 6.2, ry: 5.4, side: 1, name: 'Wrack grotto', kind: 'wrack' },
  { id: 'south', x: -20, z: -21, rx: 6.6, rz: 5.8, ry: 5.0, side: -1, name: 'Bell grotto', kind: 'bell' },
  { id: 'flood', x: -26.4, z: 23.8, rx: 7.2, rz: 6.6, ry: 5.2, side: 1, name: 'Flooded grotto', kind: 'flood', fy: -0.52, mouth: 6.0 },
  { id: 'crystal', x: -5.5, z: -23.6, rx: 6.8, rz: 6.5, ry: 5.8, side: -1, name: 'Tide-crystal chamber', kind: 'crystal' },
];
const PASS_W = 1.45, GROT_Y = 0.18;
const fyOf = (g: GrottoDef) => g.fy ?? GROT_Y;
const mouthOf = (g: GrottoDef) => g.mouth ?? (RZ - 3.2);
const inGrotto = (x: number, z: number, pad = 0) => GROTTOS.find((g) => ((x - g.x) / (g.rx - 1.4 - pad)) ** 2 + ((z - g.z) / (g.rz - 1.4 - pad)) ** 2 < 1);
const inPassage = (x: number, z: number, pad = 0) => GROTTOS.find((g) => Math.abs(x - g.x) < PASS_W - pad && g.side * z > mouthOf(g) && g.side * z < Math.abs(g.z) - 2);

export const SEA_LINES = {
  arrive: 'The Listening Pools · the sea breathes in and out of the dark',
  shellCovered: 'A lamp-shell sleeps under the water. The Tide-Glass light cannot reach it through the sea — wait for the ebb.',
  shellLit: (n: number) => `The lamp-shell drinks the Tide-Glass light and answers, blue · ${n}/3`,
  shellAlready: 'This shell already burns. Wake the others before the tide returns.',
  reset: 'The tide comes back over the shells and takes their light with it. Wake all three in one ebb.',
  solved: [
    'The third shell catches. For a breath all three burn together, and their light runs across the wet floor like a tide going the wrong way —',
    '— west, into the great round seal. Three of its seven rings wake and hold. Beside the seal, in a crack above the waterline, something pale: oilcloth.',
  ],
  sealShut: [
    'A round seal of tide-worn stone, taller than the Lowtide Lamp. Seven rings of glyphs, salt-white.',
    'The stone is warm. On the other side, very far down, something is very patient.',
  ],
  sealWoken: ['Three of the seven rings burn blue. The other four stay dark — this door wants a second key.', 'Through the stone you feel a slow turning, like a tide deciding which way to go.'],
  page: (name: string) => [
    'An oilcloth packet, tucked in a crack beside the seal. Enna’s hand — hurried, salt-stained:',
    `“${name} — if the shells let you in, you have the glass and the patience. Good.”`,
    '“The custodians never sealed the second seam. They drowned it, and left a keeper in the water to keep it drowned. It is still keeping.”',
    '“When the shells woke I heard it turn over, the way a tide turns. I am going round by the old lamp-roads to find this seal’s other key. Do not open the door alone.” — E. M.',
  ],
  pageAgain: ['Enna’s page, dry now in your journal. “Do not open the door alone.”'],
  card: { k: 'Chapter II · the sealed chamber', title: 'The Drowned Keeper', tease: 'Behind the round seal, something vast keeps the second seam under water. Enna has gone for the seal’s other key. Find her, and the key.' },
};

const sh = (x: number, z: number) => { // floor height (local), shared with GLSL below
  let h = 0.12 * Math.sin(x * 0.45 + z * 0.3) + 0.08 * Math.sin(z * 0.9 - x * 0.2) + 0.15;
  for (const p of POOLS) { const d = Math.hypot(x - p.x, z - p.z); h -= 1.25 * Math.max(0, 1 - (d / 3.1) ** 2); }
  const w = Math.max(0, (-(x - CX) - 13.5) / 3); h -= 1.6 * Math.min(1, w); // the seal pool at the west end
  return h;
};
const SHG = `float seaH(vec2 p){ float h=.12*sin(p.x*.45+p.y*.3)+.08*sin(p.y*.9-p.x*.2)+.15;
  ${POOLS.map((p) => `{ float d=length(p-vec2(${p.x.toFixed(2)},${p.z.toFixed(2)})); h-=1.25*max(0.,1.-(d/3.1)*(d/3.1)); }`).join('')}
  float w=max(0.,(-(p.x-(${CX.toFixed(1)}))-13.5)/3.); h-=1.6*min(1.,w); return h; }`;

/** Drop every triangle that has a vertex where cut(x,y,z) is true (openings for passages). */
function cutHoles(geo: THREE.BufferGeometry, cut: (x: number, y: number, z: number) => boolean) {
  const p = geo.attributes.position as THREE.BufferAttribute, ix = geo.index!.array, keep: number[] = [];
  for (let i = 0; i < ix.length; i += 3) { let c = false; for (let k = 0; k < 3 && !c; k++) { const v = ix[i + k]; c = cut(p.getX(v), p.getY(v), p.getZ(v)); } if (!c) keep.push(ix[i], ix[i + 1], ix[i + 2]); }
  geo.setIndex(keep);
}
export function rockBlob(r: number, rnd: () => number, sx = 1, sy = 1, sz = 1, detail = 2) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv')); const p = g.attributes.position as THREE.BufferAttribute; const o = rnd() * 10;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.18 * Math.sin(x * 1.3 + o) * Math.sin(y * 1.7 - o) + 0.07 * Math.sin(z * 3.1 + y * 2.3); p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz); }
  g.computeVertexNormals(); return g;
}
/** A short hexagonal prism with a pointed cap — reads as a crystal, not a party-hat cone. */
function crystalGeo(h: number, r: number, lean = 0) {
  const shaft = new THREE.CylinderGeometry(r * 0.55, r, h * 0.68, 6).toNonIndexed(); shaft.translate(0, h * 0.34, 0);
  const cap = new THREE.ConeGeometry(r * 0.55, h * 0.36, 6).toNonIndexed(); cap.translate(0, h * 0.68 + h * 0.18, 0);
  const g = mergeGeometries([shaft, cap])!; if (lean) g.rotateZ(lean); return g;
}
/** Boxed body, rounded lid, iron bands and a hasp — a chest, not a slab on a crate. */
function seaChest(scale = 1) {
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a30', roughness: 0.7, metalness: 0.03, emissive: '#4a2a14', emissiveIntensity: 0.16 });
  const band = new THREE.MeshStandardMaterial({ color: '#9a8458', roughness: 0.4, metalness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a2818', roughness: 0.82 });
  const cg = new THREE.Group();
  const foot = 0.07 * scale;
  const bodyH = 0.5 * scale, bodyW = 1.12 * scale, bodyD = 0.7 * scale;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), wood);
  body.position.y = foot + bodyH / 2; cg.add(body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, foot, 0.12 * scale), dark);
    f.position.set(sx * (bodyW / 2 - 0.12 * scale), foot / 2, sz * (bodyD / 2 - 0.12 * scale)); cg.add(f);
  }
  for (const ox of [-0.4, 0, 0.4]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, bodyH + 0.02 * scale, bodyD + 0.04 * scale), band);
    b.position.set(ox * scale, foot + bodyH / 2, 0); cg.add(b);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, bodyW, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.scale.set(0.5, 1, 1); lid.position.set(0, foot + bodyH, 0); cg.add(lid);
  for (const ox of [-0.4, 0, 0.4]) {
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, 0.16 * scale, bodyD + 0.04 * scale), band);
    lb.position.set(ox * scale, foot + bodyH + 0.12 * scale, 0); cg.add(lb);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.18 * scale, 0.08 * scale), band);
  lock.position.set(0, foot + bodyH - 0.02 * scale, bodyD / 2 + 0.01 * scale); cg.add(lock);
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, 0.14 * scale, 0.05 * scale), band);
  hasp.position.set(0, foot + bodyH + 0.1 * scale, bodyD / 2 + 0.01 * scale); cg.add(hasp);
  cg.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  return cg;
}
/** Incised tide-runes on pale stone; paired color + bump canvases. */
function runeTabletTex() {
  const w = 512, h = 768; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.fillStyle = '#c9c0ae'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) { x.fillStyle = `rgba(70,60,45,${0.03 + Math.random() * 0.07})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 3); }
  x.strokeStyle = '#4a4032'; x.lineWidth = 12; x.strokeRect(26, 30, w - 52, h - 60);
  x.strokeStyle = '#8a7e6a'; x.lineWidth = 3; x.strokeRect(42, 46, w - 84, h - 92);
  x.fillStyle = '#2a2218'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '78px serif'; x.fillText('≈', 256, 112);
  x.font = '46px serif';
  const rows = ['◎  ⁘  ◇  △  ☽', '✶  ⊢  ◎  ⁘  ≈', '△  ☽  ✶  ◇  ⊢', '◎  ≈  ⁘  ☽  △', '✶  ⊢  ◇  ◎  ≈'];
  rows.forEach((ln, i) => x.fillText(ln, 256, 220 + i * 86));
  x.strokeStyle = '#2a2218'; x.lineWidth = 7; x.beginPath(); x.moveTo(110, 690); x.lineTo(400, 690); x.stroke();
  x.beginPath(); x.moveTo(110, 690); x.lineTo(150, 668); x.moveTo(110, 690); x.lineTo(150, 712); x.stroke();
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const b = document.createElement('canvas'); b.width = w; b.height = h; const bx = b.getContext('2d')!;
  bx.fillStyle = '#888'; bx.fillRect(0, 0, w, h);
  bx.drawImage(c, 0, 0);
  const id = bx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const lum = 0.3 * d[i] + 0.5 * d[i + 1] + 0.2 * d[i + 2]; const v = lum < 120 ? 40 : 200; d[i] = d[i + 1] = d[i + 2] = v; }
  bx.putImageData(id, 0, 0);
  const bump = new THREE.CanvasTexture(b); bump.anisotropy = 8;
  return { map, bump };
}
export const gradTex = (stops: [number, string][], w = 4, h = 128, radial = false) => { const c = document.createElement('canvas'); c.width = radial ? 128 : w; c.height = h; const x = c.getContext('2d')!;
  const gr = radial ? x.createRadialGradient(64, 64, 0, 64, 64, 64) : x.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) gr.addColorStop(o, col); x.fillStyle = gr; x.fillRect(0, 0, c.width, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function makeSeaCave(high: boolean, t: { rock: GroundTex; bed: GroundTex; blocks: GroundTex }, waterNormals: THREE.Texture, env: THREE.Texture | null) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020607');
  scene.fog = new THREE.FogExp2('#04100f', high ? 0.034 : 0.04);
  if (env) { scene.environment = env; scene.environmentIntensity = 0.1; }
  scene.add(new THREE.HemisphereLight('#6a8a8e', '#1a1410', 0.34));
  const g = new THREE.Group(); g.position.set(SEA_O.x, 0, SEA_O.z); scene.add(g);
  let seed = 41; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const L = (x: number, z: number) => ({ x: x + SEA_O.x, z: z + SEA_O.z });
  // Cold daylight through cracks in the roof (shadows on High only).
  const moon = new THREE.DirectionalLight('#a9d4ff', 0.75); moon.position.set(SEA_O.x - 6, 30, SEA_O.z + 4); moon.target.position.set(SEA_O.x - 12, 0, SEA_O.z); scene.add(moon, moon.target);
  if (high) { moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, near: 1, far: 60 }); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.05; }
  const glassLight = new THREE.PointLight('#7fd2ff', 1.3, 9, 1.6); scene.add(glassLight); // Ilka's Tide-Glass glow, follows her
  const rock = triplanar(t.rock, 3.0, '#8e8a84', { rough: 0.52, sat: 0.5 }), wetRock = triplanar(t.rock, 1.3, '#a39a90', { rough: 0.5, sat: 0.55 }), floorM = triplanar(t.bed, 1.4, '#5e5b55', { rough: 0.34, sat: 0.7 });
  // Dome: noise-displaced half-ellipsoid seen from inside (winding flipped so the triplanar normals face in).
  { const d = new THREE.SphereGeometry(1, high ? 80 : 56, high ? 32 : 22, 0, Math.PI * 2, 0, Math.PI / 2 + 0.16); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.6 * Math.sin(x * 5.1 + z * 2.3) * Math.cos(y * 4.7 - x * 1.9) + 0.3 * Math.sin(z * 11 + y * 9) + 0.15 * Math.sin(x * 23 + y * 17); p.setXYZ(i, CX + x * (rxOf(x) + n * 1.3), y * RY + n * 0.7 * y - 0.6, z * (RZ + n * 1.1)); }
    const ix = d.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; }
    cutHoles(d, (x, y, z) => GROTTOS.some((gr) => Math.abs(x - gr.x) < PASS_W + 0.9 && gr.side * z > mouthOf(gr) - 1.2 && y < 3.9)); d.computeVertexNormals();
    const m = new THREE.Mesh(d, rock); m.receiveShadow = true; g.add(m); }
  const lichenMats = [new THREE.MeshBasicMaterial({ color: '#2fe0c8', fog: true }), new THREE.MeshBasicMaterial({ color: '#4aa8ff', fog: true })];
  const vaultM = triplanar(t.rock, 2.2, '#5a5752', { rough: 0.6, sat: 0.45 }), bronzeM = new THREE.MeshStandardMaterial({ color: '#7a5a2e', metalness: 0.75, roughness: 0.45, emissive: '#0c2a26', emissiveIntensity: 0.4, side: THREE.DoubleSide }), kelpM = new THREE.MeshStandardMaterial({ color: '#2c3a22', roughness: 0.8 }), crateM = new THREE.MeshStandardMaterial({ color: '#5a4026', roughness: 0.85 });
  // M20b · the grottoes: a passage vault + floor, a domed side cave with its own lichen glow and a small cold light.
  // M21b-2 · flood/crystal chambers share this shell and dress themselves below.
  for (const gr of GROTTOS) {
    const fy = fyOf(gr), z0 = gr.side * mouthOf(gr), z1 = gr.z - gr.side * (gr.rz - 1.2), len = Math.abs(z1 - z0), zm = (z0 + z1) / 2;
    const vault = new THREE.CylinderGeometry(PASS_W + 0.6, PASS_W + 0.6, len + 1.6, 14, 6, true, -Math.PI / 2, Math.PI); vault.rotateX(-Math.PI / 2);
    { const p = vault.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.25 * Math.sin(z * 2.1 + y * 3) + 0.15 * Math.sin(x * 4 + z); const yy = y < 0 ? fy - 0.15 + (y + 0.01) * 0.2 : y * 1.55 + fy + Math.max(0, GROT_Y - fy) + n * 0.3 - 0.05; p.setXYZ(i, x * (1 + n * 0.3), yy, z); } }
    vault.translate(gr.x, 0, zm); const vix = vault.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < vix.length; i += 3) { const t0 = vix[i + 1]; vix[i + 1] = vix[i + 2]; vix[i + 2] = t0; } vault.computeVertexNormals();
    const vm = new THREE.Mesh(vault, vaultM); vm.receiveShadow = true; g.add(vm);
    const d = new THREE.SphereGeometry(1, high ? 44 : 30, high ? 18 : 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.5 * Math.sin(x * 5.3 + z * 2.1) * Math.cos(y * 4.1 - x * 2.2) + 0.25 * Math.sin(z * 10 + y * 8); p.setXYZ(i, gr.x + x * (gr.rx + n), y * gr.ry + n * 0.5 * y - 0.4, gr.z + z * (gr.rz + n * 0.9)); }
    const gix = d.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < gix.length; i += 3) { const t0 = gix[i + 1]; gix[i + 1] = gix[i + 2]; gix[i + 2] = t0; }
    cutHoles(d, (x, y, z) => Math.abs(x - gr.x) < PASS_W + 0.9 && gr.side * (z - gr.z) < -gr.rz * 0.55 && y < 3.6); d.computeVertexNormals();
    const dm = new THREE.Mesh(d, rock); dm.receiveShadow = true; g.add(dm);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), floorM); fl.scale.set(gr.rx + 0.6, 1, gr.rz + 0.6); fl.position.set(gr.x, fy, gr.z); fl.receiveShadow = true; g.add(fl);
    { const pf = new THREE.Mesh(new THREE.PlaneGeometry(PASS_W * 2 + 0.8, len + 2.4, 1, 8).rotateX(-Math.PI / 2), floorM);
      if (fy < GROT_Y - 0.05) { const p = pf.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const zw = p.getZ(i) + zm; const u = Math.max(0, Math.min(1, ((zw - z0) / (z1 - z0)) * gr.side)); p.setY(i, (GROT_Y - 0.01) + u * (fy - GROT_Y)); } pf.geometry.computeVertexNormals(); pf.position.set(gr.x, 0, zm); }
      else pf.position.set(gr.x, fy - 0.01, zm);
      pf.receiveShadow = true; g.add(pf); }
    const parts: THREE.BufferGeometry[] = []; for (let i = 0; i < (high ? 14 : 9); i++) { const a = rnd() * Math.PI * 2; const r = 0.5 + rnd() * 1.1; const x = gr.x + Math.cos(a) * (gr.rx - 0.8), z = gr.z + Math.sin(a) * (gr.rz - 0.8); if (gr.side * (z - gr.z) < -gr.rz * 0.5 && Math.abs(x - gr.x) < 3) continue; parts.push(rockBlob(r, rnd, 1, 0.7, 1).translate(x, fy + r * 0.2, z)); }
    for (const sx of [-1, 1]) parts.push(rockBlob(1.1, rnd, 0.8, 1.6, 1).translate(gr.x + sx * (PASS_W + 0.7), fy + 0.8 + Math.max(0, GROT_Y - fy), z0)); // jambs hide the seam
    const rb = new THREE.Mesh(mergeGeometries(parts.map((q) => { const k = q.index ? q.toNonIndexed() : q; for (const n of Object.keys(k.attributes)) if (n !== 'position' && n !== 'normal') k.deleteAttribute(n); return k; })), wetRock); rb.castShadow = rb.receiveShadow = true; g.add(rb);
    const glCol = gr.kind === 'flood' ? '#2fe0c8' : gr.kind === 'crystal' ? '#f0b45a' : gr.side > 0 ? '#3fe6c8' : '#6aa8ff';
    const gl = new THREE.PointLight(glCol, gr.kind === 'crystal' ? 9 : 7, gr.kind === 'crystal' ? 16 : 14, 1.4); gl.position.set(gr.x, fy + 3.2, gr.z); g.add(gl);
    const bounce = new THREE.PointLight('#c8bba8', 3.4, 15, 2); bounce.position.set(gr.x, fy + 4.6, gr.z); g.add(bounce);
    const px = gr.x, pz = gr.z + gr.side * 0.4; // the prop sits just past the interact spot
    if (gr.kind === 'wrack') { // a heap of storm-wrack with a split sea-chest in it
      for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rnd() * 0.35, 8, 6), kelpM); k.scale.set(1.3, 0.35, 1); k.position.set(px + (rnd() - 0.5) * 2.2, fy + 0.12, pz + (rnd() - 0.5) * 1.6); k.rotation.y = rnd() * 3; g.add(k); }
      const cr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.65), crateM); cr.position.set(px + 0.3, fy + 0.3, pz); cr.rotation.set(0.12, 0.5, -0.18); cr.castShadow = high; g.add(cr);
    } else if (gr.kind === 'bell') { // a drowned bronze bell, half sunk, chalk on its lip
      const pts: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(0.35 + 0.75 * u * u + 0.12 * Math.sin(u * 3), 1.5 * (1 - u))); }
      const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), bronzeM); bell.position.set(px, fy - 0.15, pz); bell.rotation.set(0.5, 0.4, 0.35); bell.castShadow = high; g.add(bell);
    } else if (gr.kind === 'flood') {
      // a dished basin that holds a pool even at mid-tide, and a proper chest seated on a low dry shelf.
      { const dish = fl.geometry.clone(); const p = dish.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i) * (gr.rx + 0.6), z = p.getZ(i) * (gr.rz + 0.6); const u = Math.max(0, 1 - (x * x) / 18 - (z * z) / 14); p.setY(i, p.getY(i) - 0.48 * u * u); }
        dish.computeVertexNormals(); fl.geometry.dispose(); fl.geometry = dish; }
      // a quay-like stone ledge: thick face down into the basin, back butted into the wall, flat walkable top.
      const platTop = 0.2, platH = 1.55, platW = 3.6, platD = 3.0;
      const platZ = gr.z + gr.side * 4.35;
      const plat = new THREE.Mesh(new THREE.BoxGeometry(platW, platH, platD), wetRock);
      plat.position.set(gr.x + 0.15, platTop - platH / 2, platZ); plat.receiveShadow = plat.castShadow = true; g.add(plat);
      const face = new THREE.Mesh(new THREE.BoxGeometry(platW + 0.1, platH, 0.38), wetRock);
      face.position.set(gr.x + 0.15, platTop - platH / 2, platZ - gr.side * (platD / 2 - 0.05)); face.receiveShadow = face.castShadow = true; g.add(face);
      // one corner boulder in the water (same rnd count as the old boulder); kept below the walkable top.
      const lip = new THREE.Mesh(rockBlob(0.7, rnd, 1.0, 0.7, 0.9, 2), wetRock);
      lip.position.set(gr.x + 1.45, -0.55, platZ - gr.side * (platD / 2 + 0.15)); lip.receiveShadow = lip.castShadow = true; g.add(lip);
      const chest = seaChest(0.92); chest.position.set(gr.x + 0.4, platTop, platZ - gr.side * 0.35); chest.rotation.y = -0.45; g.add(chest);
      gl.intensity = 11; gl.distance = 16; gl.position.set(gr.x, fy + 2.6, gr.z);
      const gl2 = new THREE.PointLight('#7ec8b8', 4.2, 11, 1.6); gl2.position.set(gr.x - 1.4, 1.8, gr.z + gr.side * 1.2); g.add(gl2);
      const warm = new THREE.PointLight('#ffd7a0', 4.4, 7, 1.8); warm.position.set(gr.x + 0.4, 1.55, gr.z + gr.side * 3.2); g.add(warm);
    } else if (gr.kind === 'crystal') {
      // opaque amber / teal clusters (pointed hexagonal shafts, not cones) and a standing carved tablet.
      const am = new THREE.MeshStandardMaterial({ color: '#e8a84a', roughness: 0.22, metalness: 0.15, emissive: '#a86410', emissiveIntensity: 0.7 }), tm = new THREE.MeshStandardMaterial({ color: '#5ad4cc', roughness: 0.18, metalness: 0.2, emissive: '#146a66', emissiveIntensity: 0.85 });
      const amber: THREE.BufferGeometry[] = [], teal: THREE.BufferGeometry[] = [];
      const tabX = gr.x + 0.15, tabZ = gr.z + gr.side * 0.6;
      const plant = (list: THREE.BufferGeometry[], x: number, z: number, h: number, r: number) => { const c = crystalGeo(h, r, (rnd() - 0.5) * 0.22); c.rotateY(rnd() * 6); c.translate(x, fy, z); list.push(c); };
      for (let i = 0; i < (high ? 16 : 11); i++) {
        const a = rnd() * Math.PI * 2, rr = 2.0 + rnd() * (gr.rx - 2.8), h = 0.45 + rnd() * 0.7;
        const x = gr.x + Math.cos(a) * rr, z = gr.z + Math.sin(a) * (gr.rz - 1.6) * (0.5 + rnd() * 0.5);
        if (Math.hypot(x - tabX, z - tabZ) < 2.0) continue;
        if (Math.abs(x - gr.x) < 1.8 && gr.side * (z - gr.z) < 0.6) continue; // keep the way in clear
        plant(i % 3 === 0 ? teal : amber, x, z, h, 0.14 + rnd() * 0.1);
        if (rnd() < 0.4) plant(i % 3 === 0 ? teal : amber, x + (rnd() - 0.5) * 0.3, z + (rnd() - 0.5) * 0.3, h * (0.45 + rnd() * 0.3), 0.09 + rnd() * 0.06);
      }
      // a dense cluster at the back wall, behind the tablet
      for (let i = 0; i < 7; i++) { const h = 0.8 + rnd() * 1.15; plant(i < 3 ? teal : amber, gr.x + (rnd() - 0.5) * 1.6, gr.z + gr.side * 2.8 + (rnd() - 0.5) * 0.8, h, 0.15 + rnd() * 0.08); }
      for (const [list, mat] of [[amber, am], [teal, tm]] as const) if (list.length) { const xm = new THREE.Mesh(mergeGeometries(list), mat); xm.castShadow = xm.receiveShadow = true; g.add(xm); }
      const tabG = new THREE.Group(); tabG.position.set(tabX, fy, tabZ); tabG.rotation.set(-0.04, gr.side * 0.2, 0.02); g.add(tabG);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.44), wetRock); plinth.position.y = 0.11; plinth.castShadow = plinth.receiveShadow = true; tabG.add(plinth);
      const plinthCap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.07, 0.5), wetRock); plinthCap.position.y = 0.235; plinthCap.receiveShadow = true; tabG.add(plinthCap);
      const rune = runeTabletTex();
      const slabM = new THREE.MeshStandardMaterial({ color: '#c9c0ae', roughness: 0.62, metalness: 0.04, emissive: '#2a3834', emissiveIntensity: 0.18 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.16, 0.12), slabM); slab.position.y = 0.27 + 0.58; slab.castShadow = high; tabG.add(slab);
      const faceM = new THREE.MeshStandardMaterial({ map: rune.map, bumpMap: rune.bump, bumpScale: 0.035, roughness: 0.58, metalness: 0.04, emissive: '#1c2a26', emissiveIntensity: 0.22 });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.08), faceM); face.position.set(0, slab.position.y, 0.062); tabG.add(face);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.08), faceM); back.position.set(0, slab.position.y, -0.062); back.rotation.y = Math.PI; tabG.add(back);
      const cr = seaChest(0.68); cr.position.set(gr.x + 2.2, fy, gr.z + gr.side * 0.4); cr.rotation.y = 0.55; g.add(cr);
      gl.intensity = 10; gl.distance = 16;
      const gl2 = new THREE.PointLight('#3fe0d4', 6, 12, 1.4); gl2.position.set(gr.x - 1.6, fy + 2.0, gr.z - gr.side * 1.6); g.add(gl2);
      const tabFill = new THREE.PointLight('#ffe8c0', 2.8, 6, 1.8); tabFill.position.set(tabX, fy + 1.4, tabZ + 0.9); g.add(tabFill);
    }
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), lichenMats[gr.kind === 'crystal' ? 1 : 0], high ? 160 : 90); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    // sit flecks in the wall (e > 1 buries them when the shell bulges out); same rnd-call count as before.
    for (let i = 0; i < im.count; i++) { const a = rnd() * Math.PI * 2, y = fy + 0.25 + rnd() ** 1.5 * 2.4; const e = Math.sqrt(Math.max(0.05, 1 - ((y + 0.4) / gr.ry) ** 2)) * 1.16; q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)); sc.setScalar(0.2 + rnd() * 0.35); const lx = gr.x + Math.cos(a) * gr.rx * e, lz = gr.z + Math.sin(a) * gr.rz * e; if (Math.abs(lx - gr.x) < PASS_W + 0.9 && gr.side * (lz - gr.z) < -gr.rz * 0.5) sc.setScalar(0.001); mx.compose(v.set(lx, y, lz), q, sc); im.setMatrixAt(i, mx); }
    im.frustumCulled = false; g.add(im);
  }
  // Floor with three pools and the seal pool.
  { const f = new THREE.PlaneGeometry(RX + RXW + 4, 2 * RZ + 4, high ? 156 : 100, high ? 90 : 56); f.rotateX(-Math.PI / 2); f.translate(CX - (RXW - RX) / 2, 0, 0); const p = f.attributes.position as THREE.BufferAttribute;
    const fc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = sh(x, z); p.setY(i, y);
      const wet = Math.max(0, Math.min(1, (0.05 - y) / 0.9)), mot = 0.5 + 0.5 * Math.sin(x * 1.3 + Math.sin(z * 0.7) * 2) * Math.sin(z * 1.1 - x * 0.4), ridge = Math.max(0, Math.min(1, (y - 0.18) / 0.12));
      const k = (0.82 + 0.3 * mot) * (1 - 0.5 * wet) + 0.18 * ridge; fc[i * 3] = k * (1 - 0.12 * wet); fc[i * 3 + 1] = k; fc[i * 3 + 2] = k * (1 + 0.1 * wet); }
    f.setAttribute('color', new THREE.BufferAttribute(fc, 3)); floorM.vertexColors = true; f.computeVertexNormals(); const m = new THREE.Mesh(f, floorM); m.receiveShadow = true; g.add(m); }
  // Boulders, pool rims, shell pedestals, stalactites.
  const solids: { x: number; z: number; r: number }[] = [];
  { const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (high ? 46 : 30); i++) { const a = rnd() * Math.PI * 2, e = 0.82 + rnd() * 0.15; const x = CX + Math.cos(a) * rxOf(Math.cos(a)) * e, z = Math.sin(a) * RZ * e; if (x > 2) continue; if (GROTTOS.some((gr) => Math.abs(x - gr.x) < PASS_W + 2.2 && gr.side * z > mouthOf(gr) - 3)) continue; const r = 0.6 + rnd() * 1.6; parts.push(rockBlob(r, rnd, 1, 0.7, 1).translate(x, sh(x, z) + r * 0.2, z)); }
    for (const pl of POOLS) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + rnd(), x = pl.x + Math.cos(a) * 3.3, z = pl.z + Math.sin(a) * 3.3; parts.push(rockBlob(0.35 + rnd() * 0.35, rnd, 1, 0.55, 1, 1).translate(x, sh(x, z) + 0.05, z)); }
    for (const pl of POOLS) { parts.push(rockBlob(0.75, rnd, 1.1, 0.45, 1, 2).translate(pl.x, SHELL_Y - 0.25, pl.z)); }
    const m = new THREE.Mesh(mergeGeometries(parts), wetRock); m.castShadow = m.receiveShadow = true; g.add(m);
    const st: THREE.BufferGeometry[] = []; for (let i = 0; i < (high ? 70 : 40); i++) { const x = CX + (rnd() - 0.5) * RX * 1.6, z = (rnd() - 0.5) * RZ * 1.5; const e = ((x - CX) / RX) ** 2 + (z / RZ) ** 2; if (e > 0.8) continue; const y = RY * Math.sqrt(Math.max(0.05, 1 - e)) - 0.9; const h = 0.6 + rnd() * 2.2; const c = new THREE.ConeGeometry(0.12 + rnd() * 0.22, h, 6, 3); c.rotateX(Math.PI); c.translate(x, y - h / 2 + 0.3, z); st.push(c); }
    const sm = new THREE.Mesh(mergeGeometries(st), wetRock); g.add(sm); }
  // Glow-lichen: bioluminescent flecks on the lower walls, two pulsing sets.
  { const blob = new THREE.IcosahedronGeometry(0.06, 0); blob.scale(1, 0.5, 1); const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    for (let set = 0; set < 2; set++) { const n = high ? 420 : 240; const im = new THREE.InstancedMesh(blob, lichenMats[set], n); let c = 0;
      for (let i = 0; i < n * 3 && c < n; i++) { const a = rnd() * Math.PI * 2, y = 0.1 + rnd() ** 1.6 * 3.2; const e = Math.sqrt(Math.max(0.02, 1 - ((y + 0.6) / RY) ** 2)) * 1.14; const x = CX + Math.cos(a) * rxOf(Math.cos(a)) * e, z = Math.sin(a) * RZ * e; if (x > 1) continue; if (GROTTOS.some((gr) => Math.abs(x - gr.x) < PASS_W + 1.8 && gr.side * z > mouthOf(gr) - 2.2)) continue; // no flecks floating in the passage mouths
        const near = POOLS.some((p) => Math.hypot(p.x - x, p.z - z) < 9) || x < -26; if (!near && rnd() < 0.6) continue;
        q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)); s.setScalar(0.5 + rnd() * 1.6); mtx.compose(v.set(x, y, z), q, s); im.setMatrixAt(c++, mtx); }
      im.count = c; im.frustumCulled = false; g.add(im); } }
  // Light shafts from roof cracks (additive, kept out of the AO pass on layer 1) and their pools of light on the floor.
  const spotTex = gradTex([[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']], 4, 128, true);
  const shafts: THREE.Mesh[] = [];
  // Soft volumetric look: brightness falls off toward the silhouette (view-facing normals) and toward both ends.
  const shaftMat = new THREE.ShaderMaterial({ uniforms: { uOp: { value: 0.16 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uOp; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float e = smoothstep(0.,.35,vY) * smoothstep(1.,.6,vY); gl_FragColor = vec4(vec3(.62,.82,1.) * f * e * uOp * 0.85, 1.); }' });
  for (const [x, z, r] of [[-8.5, 1.5, 1.4], [-17, -1.2, 1.9], [-24, 3.4, 1.2]] as const) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r, 9.5, 20, 1, true), shaftMat);
    c.position.set(x, 4.2, z); c.rotation.z = 0.12; c.layers.set(1); c.renderOrder = 3; g.add(c); shafts.push(c);
    const sp = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 24), new THREE.MeshBasicMaterial({ color: '#bfe6ff', map: spotTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.rotation.x = -Math.PI / 2; sp.position.set(x - 0.6, sh(x, z) + 0.04, z); sp.layers.set(1); g.add(sp); }
  // Lamp-shells: ridged fan shells on wet pedestals in each pool.
  const shellMats = POOLS.map(() => { const m = new THREE.MeshStandardMaterial({ color: '#d9e4e0', roughness: 0.35, metalness: 0.1, emissive: '#39d6ff', emissiveIntensity: 0.04 }); return m; });
  const haloTex = gradTex([[0, 'rgba(160,240,255,1)'], [0.35, 'rgba(70,200,255,0.35)'], [1, 'rgba(40,160,255,0)']], 4, 128, true);
  const halos: THREE.Sprite[] = [];
  POOLS.forEach((pl, i) => { const sg = new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); const p = sg.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const a = Math.atan2(z, x); const rib = 1 + 0.08 * Math.cos(a * 9); p.setXYZ(k, x * rib, y * 0.9, z * rib * 1.2); } sg.computeVertexNormals();
    const m = new THREE.Mesh(sg, shellMats[i]); m.position.set(pl.x, SHELL_Y + 0.02, pl.z); m.rotation.set(-0.5, i * 1.3, 0); m.castShadow = true; g.add(m);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#7fe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); h.scale.setScalar(2.6); h.position.set(pl.x, SHELL_Y + 0.5, pl.z); h.layers.set(1); g.add(h); halos.push(h); });
  // The round seal (Chapter II arena door) set into the west wall, with seven glyph rings.
  const ringsTex = (from: number, to: number, centre: boolean) => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d')!; x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const glyphs = '◎⁘≈◇△☽✶'; for (let r = from; r < to; r++) { const R = 34 + r * 30; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, R, 0, Math.PI * 2); x.stroke(); x.font = `${15 + r}px serif`; const n = 6 + r * 3; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + r * 0.4; x.fillText(glyphs[(k + r) % 7], 256 + Math.cos(a) * (R + 14), 256 + Math.sin(a) * (R + 14)); } }
    if (centre) { x.font = '64px serif'; x.fillText('≈', 256, 258); } const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace; return t2; };
  const sealMat = triplanar(t.blocks, 2.4, '#b5ad9e', { sat: 0.4 });
  // Glyph rings are separate circle overlays on the seal's face (circle UVs map the canvas exactly): salt-white base, inner three (shells), outer four (the second key).
  const ringBase = new THREE.MeshBasicMaterial({ map: ringsTex(0, 7, true), color: '#d8d2c4', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const ringIn = new THREE.MeshBasicMaterial({ map: ringsTex(0, 3, true), color: '#5fe0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const ringOut = new THREE.MeshBasicMaterial({ map: ringsTex(3, 7, false), color: '#9ff0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const sealY = 4.1;
  const sealG = new THREE.Group(); sealG.position.set(DOOR.x - 0.2, sealY, DOOR.z); g.add(sealG);
  { const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.9, 64), sealMat); disc.rotation.z = Math.PI / 2;
    disc.castShadow = disc.receiveShadow = true; sealG.add(disc);
    for (const m of [ringBase, ringIn, ringOut]) { const o = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), m); o.rotation.y = Math.PI / 2; o.position.x = 0.47; o.renderOrder = 2; sealG.add(o); }
    const fr = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.55, 10, 48), wetRock); fr.rotation.y = Math.PI / 2; fr.position.copy(sealG.position).add(new THREE.Vector3(0.25, 0, 0)); fr.castShadow = true; g.add(fr);
    const mass = new THREE.Mesh(rockBlob(7.5, rnd, 0.7, 1.15, 1.2, 3), rock); mass.position.set(DOOR.x - 4.2, 4, DOOR.z); g.add(mass);
    // ledge across the seal pool to the door
    const ledge = new THREE.Mesh(rockBlob(1.6, rnd, 2.2, 0.35, 1.0, 2), wetRock); ledge.position.set(DOOR.x + 3.0, -0.2, 1.4); ledge.receiveShadow = true; g.add(ledge); }
  const sealPulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#3fb8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sealPulse.scale.setScalar(5); sealPulse.position.set(DOOR.x + 0.35, sealY, DOOR.z); sealPulse.layers.set(1); g.add(sealPulse);
  // Enna's packet: oilcloth bundle + a small lamp, on a dry shelf beside the seal (appears once the shells answer).
  const PAGE = { x: DOOR.x + 2.3, z: 2.9 };
  const packet = new THREE.Group(); packet.position.set(PAGE.x, 0.55, PAGE.z); g.add(packet);
  { const shelf = new THREE.Mesh(rockBlob(0.8, rnd, 1.2, 0.5, 1, 2), wetRock); shelf.position.set(0, -0.35, 0); packet.add(shelf);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#c8b48a', roughness: 0.8 })); cloth.position.set(0, 0.1, 0); cloth.rotation.y = 0.4; packet.add(cloth);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: '#2a3a3a', emissive: '#7fe8ff', emissiveIntensity: 1.6 })); lamp.position.set(0.32, 0.16, -0.1); packet.add(lamp); }
  packet.visible = false;
  // The way back: a pale glow at the east entrance.
  const EXIT = { x: 1.2, z: 0 };
  { const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 5), new THREE.MeshBasicMaterial({ color: '#cfe6ee', map: gradTex([[0, 'rgba(255,255,255,0.15)'], [0.6, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0.9)']]), transparent: true, fog: false })); glow.rotation.y = -Math.PI / 2; glow.position.set(CX + RX - 0.3, 1.8, 0); g.add(glow); }
  // Chamber water: one level for the whole cave, breathing with the sea; depth-aware colour, alpha and bioluminescence that stirs near Ilka and the lit shells.
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const uLev = { value: -0.5 }, uTime = { value: 0 }, uPl = { value: new THREE.Vector3() }, uLit = { value: new THREE.Vector3() };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(RX + RXW, 2 * RZ, 1, 1).rotateX(-Math.PI / 2).translate(CX - (RXW - RX) / 2, 0, 0), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uLev, uTime, uPl, uLit, uNor: { value: waterNormals } },
    vertexShader: 'uniform float uLev; varying vec3 vW; varying vec2 vL; void main(){ vec3 p=position; p.y=uLev; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; vL=p.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uLev,uTime; uniform vec3 uPl,uLit; uniform sampler2D uNor; varying vec3 vW; varying vec2 vL;
${SHG}
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){ float depth=uLev-seaH(vL); if(depth<0.) discard;
  vec3 n1=texture2D(uNor,vL*.18+vec2(uTime*.02,uTime*.013)).xyz*2.-1., n2=texture2D(uNor,vL*.43-vec2(uTime*.017,-uTime*.01)).xyz*2.-1.; vec3 n=normalize(vec3(0,1,0)+vec3(n1.x+n2.x,0.,n1.y+n2.y)*.22);
  vec3 v=normalize(cameraPosition-vW); float fres=.03+.97*pow(1.-max(dot(n,v),0.),5.);
  vec3 body=mix(vec3(.04,.16,.15),vec3(.006,.03,.04),smoothstep(.05,1.4,depth));
  vec3 refl=mix(vec3(.02,.05,.06),vec3(.25,.42,.48),smoothstep(.0,.6,reflect(-v,n).y))*.6;
  vec3 col=mix(body,refl,fres);
  // bioluminescent motes: sparse cells that brighten near Ilka (wading stirs them) and around lit shells
  vec2 cell=floor(vL*6.); float h=hash(cell); vec2 f=fract(vL*6.)-.5; float dot1=smoothstep(.12,.0,length(f-vec2(hash(cell+3.)-.5,hash(cell+7.)-.5)*.6));
  float stir=1.-smoothstep(0.,3.2,length(vW.xz-uPl.xz)); float tw=.5+.5*sin(uTime*2.+h*30.);
  float glow=dot1*step(.82,h)*(.12+stir*1.6+uLit.x)*tw;
  col+=vec3(.2,.95,1.)*glow; col+=vec3(.02,.12,.14)*uLit.x*smoothstep(1.5,0.,depth);
  float a=clamp(smoothstep(0.,.25,depth)*.85+fres*.3,0.,.96); float edge=1.-smoothstep(0.,.08,depth); col=mix(col,vec3(.55,.7,.72),edge*.5);
  gl_FragColor=vec4(col,max(a,edge*.6));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` }));
  water.position.set(0, 0, 0); water.renderOrder = 2; water.userData.noAO = true; g.add(water);
  // M21b-2 · a second tide surface in the flooded grotto (same level; the dry ledge stays above high water).
  for (const gr of GROTTOS) if (gr.kind === 'flood') {
    const fw = fyOf(gr) - 0.48; // dish center: mid-tide still leaves a readable pool
    const floodMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
      uniforms: { uLev, uTime, uPl, uLit, uNor: { value: waterNormals }, uFloor: { value: fw } },
      vertexShader: 'uniform float uLev; varying vec3 vW; varying vec2 vL; void main(){ vec3 p=position; p.y=uLev; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; vL=p.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uLev,uTime,uFloor; uniform vec3 uPl,uLit; uniform sampler2D uNor; varying vec3 vW; varying vec2 vL;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){ float depth=uLev-uFloor; if(depth<0.) discard;
  vec3 n1=texture2D(uNor,vL*.18+vec2(uTime*.02,uTime*.013)).xyz*2.-1., n2=texture2D(uNor,vL*.43-vec2(uTime*.017,-uTime*.01)).xyz*2.-1.; vec3 n=normalize(vec3(0,1,0)+vec3(n1.x+n2.x,0.,n1.y+n2.y)*.22);
  vec3 v=normalize(cameraPosition-vW); float fres=.03+.97*pow(1.-max(dot(n,v),0.),5.);
  vec3 body=mix(vec3(.03,.18,.16),vec3(.004,.04,.05),smoothstep(.05,1.1,depth));
  vec3 refl=mix(vec3(.02,.06,.07),vec3(.2,.5,.48),smoothstep(.0,.6,reflect(-v,n).y))*.55;
  vec3 col=mix(body,refl,fres);
  vec2 cell=floor(vL*5.); float h=hash(cell); vec2 f=fract(vL*5.)-.5; float dot1=smoothstep(.14,.0,length(f-vec2(hash(cell+3.)-.5,hash(cell+7.)-.5)*.6));
  float stir=1.-smoothstep(0.,2.6,length(vW.xz-uPl.xz)); float tw=.5+.5*sin(uTime*2.+h*30.);
  col+=vec3(.15,1.,0.85)*dot1*step(.78,h)*(.2+stir*1.8)*tw;
  float a=clamp(smoothstep(0.,.2,depth)*.88+fres*.3,0.,.96); float edge=1.-smoothstep(0.,.08,depth); col=mix(col,vec3(.4,.75,.7),edge*.45);
  gl_FragColor=vec4(col,max(a,edge*.55));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` });
    const flood = new THREE.Mesh(new THREE.CircleGeometry(gr.rx - 1.6, 40).rotateX(-Math.PI / 2), floodMat);
    flood.position.set(gr.x, 0, gr.z); flood.renderOrder = 2; flood.userData.noAO = true; flood.scale.set(1, 1, (gr.rz - 1.8) / Math.max(0.4, gr.rx - 1.6)); g.add(flood);
  }
  // ---------- state ----------
  let tideT = 5, lev = -0.5; const lit = [false, false, false]; let litK = [0, 0, 0], solvedK = 0, solved = false, opened = false, openK = 0;
  const level = (tt: number) => -0.55 + 0.55 * Math.cos((2 * Math.PI * tt) / SEA_PERIOD);
  const ellipse = (x: number, z: number, sh2 = 0) => ((x - CX) / (rxOf(x - CX) - 2.2 - sh2)) ** 2 + (z / (RZ - 2.0 - sh2)) ** 2;
  const W = (x: number, z: number) => new THREE.Vector3(x + SEA_O.x, 0, z + SEA_O.z);
  const exV = new THREE.Vector3();
  return {
    grottos: GROTTOS.map((gr) => ({ id: gr.id, name: gr.name, kind: gr.kind, ...L(gr.x, gr.z - gr.side * 1.2) })),
    loot: [
      { id: 'sea-flood', name: 'drowned chest', ...L(-26.4 + 0.4, 23.8 + 4.0) },
      { id: 'sea-crystal-chest', name: 'crystal-shelf chest', ...L(-5.5 + 2.1, -23.6 - 0.2) },
    ],
    loreFinds: [
      { id: 'sea-crystal', name: 'tide-crystal tablet', ...L(-5.5 + 0.15, -23.6 - 0.6) },
    ],
    mobSpawns: [
      { id: 'sea-flood-a', ...L(-26.4 - 2.4, 23.8 + 0.4), face: 0.9, y: -0.52 },
      { id: 'sea-flood-b', ...L(-26.4 + 2.2, 23.8 - 1.6), face: -1.1, y: -0.52 },
      { id: 'sea-crystal-a', ...L(-5.5 - 1.8, -23.6 + 2.2), face: Math.PI, y: 0.22 },
    ],
    scene, entry: L(EXIT.x - 2.2, 0), exit: L(EXIT.x, EXIT.z), shells: POOLS.map((p) => L(p.x, p.z)), door: L(DOOR.x + 1.6, DOOR.z), page: L(PAGE.x, PAGE.z),
    get level() { return lev; }, get tidePhase() { const d = -Math.sin((2 * Math.PI * tideT) / SEA_PERIOD); return lev < SHELL_Y ? (d > 0 ? 'ebbing' : 'turning') : d > 0 ? 'falling' : 'rising'; },
    isLow() { return lev < SHELL_Y; }, get lit() { return lit.slice(); }, get solved() { return solved; },
    /** Wake shell i with the Tide-Glass. */
    light(i: number): 'covered' | 'already' | 'lit' | 'solved' { if (solved) return 'already'; if (lev >= SHELL_Y) return 'covered'; if (lit[i]) return 'already'; lit[i] = true; if (lit.every(Boolean)) { solved = true; return 'solved'; } return 'lit'; },
    setSolved(on: boolean, instant = false) { solved = on; for (let i = 0; i < 3; i++) lit[i] = on; if (instant) { solvedK = on ? 1 : 0; litK = lit.map((l) => (l ? 1 : 0)); } },
    setPacket(on: boolean) { packet.visible = on; },
    /** The second key: all seven rings wake and the seal rolls aside (into the south wall) to the drowned chamber. */
    setOpen(on: boolean, instant = false) { opened = on; if (instant) openK = on ? 1 : 0; }, get opened() { return opened; }, get openK() { return openK; },
    sealPos: L(DOOR.x - 0.2, DOOR.z),
    groundY(wx: number, wz: number) {
      const x = wx - SEA_O.x, z = wz - SEA_O.z;
      const pass = inPassage(x, z, -0.6);
      if (pass) { const z0 = pass.side * mouthOf(pass), z1 = pass.z - pass.side * (pass.rz - 1.2); const u = Math.max(0, Math.min(1, ((z - z0) / (z1 - z0)) * pass.side)); const y0 = Math.max(GROT_Y, sh(x, z)); return y0 + u * (fyOf(pass) - y0); }
      const gro = inGrotto(x, z, -1.4);
      if (gro) { if (gro.kind === 'flood' && gro.side * (z - gro.z) > 2.4) { const dx = x - (gro.x + 0.15), dz = z - (gro.z + gro.side * 4.35); if (Math.abs(dx) < 1.85 && Math.abs(dz) < 1.55) return 0.2; return 0.18; } if (gro.kind === 'flood') { const u = Math.max(0, 1 - ((x - gro.x) ** 2) / 18 - ((z - gro.z) ** 2) / 14); return fyOf(gro) - 0.48 * u * u; } return fyOf(gro); }
      return Math.max(sh(x, z), Math.hypot(x - (DOOR.x + 3), z - 1.4) < 3.05 ? 0.25 : -9);
    },
    inTight(wx: number, wz: number) { const x = wx - SEA_O.x, z = wz - SEA_O.z; return !!(inPassage(x, z, -0.2) || inGrotto(x, z, -0.5)); },
    chamber(wx: number, wz: number) { const x = wx - SEA_O.x, z = wz - SEA_O.z; return inGrotto(x, z, -1.4)?.id ?? inPassage(x, z, -0.6)?.id ?? 'pools'; },
    constrain(wx: number, wz: number): [number, number] {
      let x = wx - SEA_O.x, z = wz - SEA_O.z;
      if (inGrotto(x, z) || inPassage(x, z)) return [wx, wz];
      { const e = Math.sqrt(ellipse(x, z)); if (e > 1) { // outside the main chamber: snap to the nearest walkable region (chamber rim, a passage, or a grotto)
        const mx = CX + (x - CX) / e, mz = z / e; let bx = mx, bz = mz, bd = Math.hypot(x - mx, z - mz);
        for (const gr of GROTTOS) { const zA = gr.side * mouthOf(gr), zB = gr.side * (Math.abs(gr.z) - 2); const px = Math.max(gr.x - PASS_W + 0.01, Math.min(gr.x + PASS_W - 0.01, x)), pz = Math.max(Math.min(zA, zB), Math.min(Math.max(zA, zB), z)); const dp = Math.hypot(x - px, z - pz); if (dp < bd) { bd = dp; bx = px; bz = pz; }
          const ge = Math.sqrt(((x - gr.x) / (gr.rx - 1.4)) ** 2 + ((z - gr.z) / (gr.rz - 1.4)) ** 2); const gx = gr.x + (x - gr.x) / ge * 0.999, gz = gr.z + (z - gr.z) / ge * 0.999; const dg = Math.hypot(x - gx, z - gz); if (dg < bd) { bd = dg; bx = gx; bz = gz; } }
        x = bx; z = bz; if (inGrotto(x, z) || inPassage(x, z)) return [x + SEA_O.x, z + SEA_O.z]; } }
      x = Math.min(x, EXIT.x + 0.4); if (x < DOOR.x + 1.4) x = DOOR.x + 1.4;
      { const lx = DOOR.x + 3, lz = 1.4, d = Math.hypot(x - lx, z - lz); // past x = −27 the seal pool is deep: only the ledge crosses it
        if (x < -27 && d > 3.0) { const toLine = -27 - x, toLedge = d - 3.0; if (toLine <= toLedge) x = -27; else { x = lx + (x - lx) / d * 3.0; z = lz + (z - lz) / d * 3.0; } } }
      return [x + SEA_O.x, z + SEA_O.z];
    },
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const inside = (v: THREE.Vector3) => { const x = v.x - SEA_O.x, z = v.z - SEA_O.z; if (v.y < Math.max(sh(x, z), lev) + 0.4) return false; if (GROTTOS.some((gr) => (Math.abs(x - gr.x) < PASS_W + 0.2 && gr.side * z > mouthOf(gr) - 1.4 && gr.side * z < Math.abs(gr.z) && v.y < fyOf(gr) + 3.05 + Math.max(0, GROT_Y - fyOf(gr))) || ((x - gr.x) / (gr.rx - 0.9)) ** 2 + ((v.y + 0.4) / (gr.ry - 0.8)) ** 2 + ((z - gr.z) / (gr.rz - 0.9)) ** 2 < 1)) return true;
      return ((x - CX) / (rxOf(x - CX) - 1.4)) ** 2 + ((v.y + 0.6) / (RY - 1.2)) ** 2 + (z / (RZ - 1.4)) ** 2 < 1 && x > DOOR.x + 0.8; };
      if (inside(cam)) return; let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; exV.lerpVectors(target, cam, m); if (inside(exV)) lo = m; else hi = m; } cam.lerpVectors(target, cam, Math.max(0.15, lo * 0.95));
    },
    /** Advance the chamber tide and effects. Returns 'reset' when the tide drowns a partial set of lit shells. */
    update(time: number, dt: number, player: THREE.Vector3): 'reset' | null {
      tideT += dt; lev = level(tideT); uLev.value = lev; uTime.value = time; uPl.value.copy(player).sub(g.position);
      glassLight.position.set(player.x, player.y + 1.5, player.z);
      let ev: 'reset' | null = null;
      if (!solved && lit.some(Boolean) && lev > SHELL_Y + 0.02) { for (let i = 0; i < 3; i++) lit[i] = false; ev = 'reset'; }
      for (let i = 0; i < 3; i++) { litK[i] += ((lit[i] ? 1 : 0) - litK[i]) * Math.min(1, dt * (lit[i] ? 3 : 1.5)); shellMats[i].emissiveIntensity = 0.04 + litK[i] * 2.4 + (solved ? 0.25 * Math.sin(time * 1.3 + i) : 0); (halos[i].material as THREE.SpriteMaterial).opacity = litK[i] * (0.75 + 0.15 * Math.sin(time * 2 + i)); }
      solvedK += ((solved ? 1 : 0) - solvedK) * Math.min(1, dt * 0.8); openK = opened ? Math.min(1, openK + dt / 3.2) : 0;
      const pulse = 0.85 + 0.15 * Math.sin(time * 0.6); ringIn.opacity = solvedK * pulse; ringOut.opacity = Math.min(1, openK * 3) * pulse;
      const roll = Math.max(0, Math.min(1, (openK - 0.3) / 0.7)); const e2 = roll * roll * (3 - 2 * roll); sealG.position.z = DOOR.z - e2 * 8.6; sealG.rotation.x = e2 * 2.0; // rolls aside like a millstone
      (sealPulse.material as THREE.SpriteMaterial).opacity = solvedK * 0.25 * (0.5 + 0.5 * Math.sin(time * 0.45)); uLit.value.x = (litK[0] + litK[1] + litK[2]) / 3 * 0.6;
      lichenMats[0].color.setRGB(0.12, 0.62 + 0.25 * Math.sin(time * 0.9), 0.52 + 0.2 * Math.sin(time * 0.9)); lichenMats[1].color.setRGB(0.18, 0.42 + 0.2 * Math.sin(time * 0.7 + 2), 0.85);
      shaftMat.uniforms.uOp.value = 0.14 + 0.03 * Math.sin(time * 0.5);
      return ev;
    },
    W,
  };
}
export type SeaCave = ReturnType<typeof makeSeaCave>;
