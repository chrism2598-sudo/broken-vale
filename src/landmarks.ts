import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORCHARD } from './world';
import { LANDMARKS, SPAWN, heightAt, fbm, PALE_ROCK, WATER_Y, RSTAIR, QUARRY, POOL, STREAM, TRACK, lineDist, pathX, creekX, creekHalf, type Landmark, type P2 } from './world';
import { addRimFill } from './shading';
import type { GroundTex } from './terrain';

type Solid = { x: number; z: number; r: number };
export type BuildTex = { brick: GroundTex; roof: GroundTex; sand: GroundTex; metal: GroundTex; rock: GroundTex };

/**
 * World-space triplanar PBR (diffuse + ARM roughness/AO, tangent-free normal perturbation) on a standard
 * material, so any primitive (lathes, boxes, domes) gets correctly scaled texture without UV work.
 */
export function triplanar(set: GroundTex, scale: number, tint: string, o: { metal?: number; rough?: number; emissive?: string; sat?: number; gain?: number; ground?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: o.rough ?? 1, metalness: o.metal ?? 0, emissive: o.emissive ?? '#000000' });
  for (const t of [set.diff, set.nor, set.arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  set.diff.colorSpace = THREE.SRGBColorSpace;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tD = { value: set.diff }; sh.uniforms.uSat = { value: o.sat ?? 1 }; sh.uniforms.uGround = { value: o.ground ?? -1e4 }; sh.uniforms.uGain = { value: o.gain ?? 1 }; sh.uniforms.tN = { value: set.nor }; sh.uniforms.tA = { value: set.arm };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  #ifdef USE_INSTANCING
  mat4 tm = modelMatrix * instanceMatrix;
  #else
  mat4 tm = modelMatrix;
  #endif
  vTW = (tm * vec4(transformed, 1.)).xyz; vTN = normalize(mat3(tm) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tD; uniform float uSat; uniform float uGain; uniform float uGround; uniform sampler2D tN; uniform sampler2D tA; varying vec3 vTW; varying vec3 vTN;
vec3 W3; vec2 UX, UY, UZ;
vec4 tri(sampler2D t){ return texture2D(t,UX)*W3.x + texture2D(t,UY)*W3.y + texture2D(t,UZ)*W3.z; }
float tH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float tVn(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(tH(i),tH(i+vec2(1,0)),u.x),mix(tH(i+vec2(0,1)),tH(i+vec2(1,1)),u.x),u.y); }
float tMac(vec3 w){ vec3 A=pow(abs(normalize(vTN)),vec3(4.)); A/=dot(A,vec3(1.)); return tVn(w.zy*.45)*A.x+tVn(w.xz*.45)*A.y+tVn(w.xy*.45)*A.z; }
float MAC;`)
      .replace('#include <map_fragment>', `
  W3 = pow(abs(normalize(vTN)), vec3(4.)); W3 /= dot(W3, vec3(1.));
  vec3 P = vTW / ${scale.toFixed(2)}; UX = P.zy; UY = P.xz; UZ = P.xy;
  { vec3 td = tri(tD).rgb; diffuseColor.rgb *= mix(vec3(dot(td, vec3(.3, .59, .11))), td, uSat) * uGain;
    // M22 · break the tiling: weathered macro patches (cooler/darker damp, warmer sun-bleached), and deeper mortar.
    MAC = tMac(vTW) * .65 + tMac(vTW * 2.7 + 7.1) * .35;
    diffuseColor.rgb *= mix(vec3(.80, .83, .86), vec3(1.07, 1.03, .96), smoothstep(.2, .8, MAC));
    float tl = dot(td, vec3(.3, .59, .11)); diffuseColor.rgb *= mix(.72, 1.04, smoothstep(.06, .42, tl));
    float hb = vTW.y - uGround; float streak = .5 + .5 * sin(vTW.x * 2.1 + sin(vTW.z * 1.3) * 2.) * sin(vTW.z * 1.7 + vTW.x * .4);
    diffuseColor.rgb *= mix(vec3(.55, .58, .45), vec3(1.), smoothstep(0., 2.6, hb + streak * 1.4)); }`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness; { vec3 a = tri(tA).rgb; roughnessFactor *= a.g; roughnessFactor *= mix(.82, 1.06, MAC); diffuseColor.rgb *= mix(1., a.r * a.r, .85); }`)
      .replace('#include <normal_fragment_maps>', `{ vec3 tn = tri(tN).xyz * 2. - 1.; vec3 wn = normalize(vTN);
  vec3 pert = normalize(wn + (vec3(tn.x, 0., tn.y) * W3.y + vec3(0., tn.y, tn.x) * W3.x + vec3(tn.x, tn.y, 0.) * W3.z) * .85);
  normal = normalize((viewMatrix * vec4(pert, 0.)).xyz); }`);
  };
  m.customProgramCacheKey = () => 'tri' + scale;
  addRimFill(m, { fill: 0.22, rim: 0.22, rimColor: '#e9e2cf' });
  return m;
}

/** M20b · raised walk-surfaces on landmarks (world coords): discs and rotated boxes whose top the feet stand on. */
type Walk = { x: number; z: number; y: number; r?: number; hw?: number; hd?: number; ry?: number; cam?: boolean };
export const WALK: Walk[] = [];
/** Highest walk-surface top under (x,z) or -Infinity. */
export function walkY(x: number, z: number, camOnly = false): number {
  let y = -Infinity;
  for (const w of WALK) { if (camOnly && !w.cam) continue;
    const dx = x - w.x, dz = z - w.z;
    if (w.r !== undefined) { if (dx * dx + dz * dz < w.r * w.r && w.y > y) y = w.y; continue; }
    const c = Math.cos(w.ry ?? 0), s = Math.sin(w.ry ?? 0), lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < w.hw! && Math.abs(lz) < w.hd! && w.y > y) y = w.y;
  }
  return y;
}
class Builder {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>(); extra: THREE.Object3D[] = [];
  add(mat: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0) {
    g = g.index ? g.toNonIndexed() : g; // uniform attributes for merging
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.rotateY(ry); g.translate(x, y, z);
    (this.parts.get(mat) ?? this.parts.set(mat, []).get(mat)!).push(g);
  }
  build(): THREE.Group {
    const grp = new THREE.Group();
    for (const [mat, gs] of this.parts) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = !mat.userData.noCast; /* M25: thin frost and ivy skip the shadow pass */ m.receiveShadow = true; grp.add(m); }
    return grp;
  }
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, seg = 20) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h / 2, 0);
const cone = (r: number, h: number, seg = 20) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
const lathe = (pts: [number, number][], seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.01, r), y)), seg);

/** Crenellated round tower with a conical slate roof. */
const SLIT = new THREE.MeshBasicMaterial({ color: '#0e0b09' }), KEEP_IRON = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.5, metalness: 0.65 });
function tower(b: Builder, st: THREE.Material, roof: THREE.Material, x: number, y: number, z: number, r: number, h: number, roofH: number, slim = false) {
  b.add(st, cyl(r * 1.08, r, h), x, y, z);
  // M23 · a battered plinth, arrow slits staggered up the drum, corbelled machicolations under the parapet, an iron finial
  b.add(st, cyl(r * 1.22, r * 1.1, Math.min(2.2, h * 0.2)), x, y, z);
  for (let lv = 0; lv < 3; lv++) { const yy = y + h * (0.25 + lv * 0.24); if (yy > y + h - 1.6) break; for (let i = 0; i < 4; i++) { const a = (i + lv * 0.5) / 4 * Math.PI * 2 + 0.4; b.add(SLIT, box(0.14, 1.1, 0.12), x + Math.cos(a) * r * 1.035, yy, z + Math.sin(a) * r * 1.035, -a); b.add(st, box(0.42, 0.14, 0.2), x + Math.cos(a) * r * 1.05, yy - 0.12, z + Math.sin(a) * r * 1.05, -a); } }
  { const n = Math.round(r * 5); for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; const c = new THREE.BoxGeometry(0.34, 0.75, 0.4); c.translate(0, -0.37, 0); b.add(st, c, x + Math.cos(a) * r * 1.12, y + h, z + Math.sin(a) * r * 1.12, -a + Math.PI / 2); } }
  b.add(KEEP_IRON, cyl(0.05, 0.05, 1.3, 6), x, y + h + 1.2 + roofH - 0.2, z); b.add(KEEP_IRON, new THREE.SphereGeometry(0.17, 8, 6), x, y + h + 1.2 + roofH + 0.55, z);
  b.add(st, cyl(r * 1.18, r * 1.18, 1.2), x, y + h, z);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.add(st, box(0.9, 1.1, 0.7), x + Math.cos(a) * r * 1.1, y + h + 1.2, z + Math.sin(a) * r * 1.1, -a); }
  b.add(roof, cone(r * (slim ? 1.16 : 1.25), roofH, 24), x, y + h + 1.2, z); // M24: Pale Keep's cones are slimmer and taller
}

/** A keep after the Page's Pale/Azure Keep: curtain wall with corner towers, a gatehouse facing spawn, a tall crown keep. */
export const KEEP_LOOK_PILLAR = 3.8, KEEP_W = 15, KEEP_D = 14;
/** M20a · shared keep frame for main.ts: gate direction, central keep centre (world), base height. */
export function keepFrame(l: Landmark) { const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z); return { face, kx: l.x - Math.sin(face) * 3, kz: l.z - Math.cos(face) * 3, y0: l.pad - 0.3, roofY: l.pad - 0.3 + 18, lookY: l.pad - 0.3 + 31.2 }; }
const KEEP_DOOR = new THREE.MeshStandardMaterial({ color: '#6e4c2e', roughness: 0.82, emissive: '#2a1a0c', emissiveIntensity: 0.4 }), KEEP_LAMP = new THREE.MeshBasicMaterial({ color: '#ffc27a' });
const WIN_GLASS = new THREE.MeshStandardMaterial({ color: '#1c2430', roughness: 0.25, metalness: 0.4, emissive: '#3a2a12', emissiveIntensity: 0.35 });
function makeKeep(l: Landmark, t: BuildTex, roofTint: string, wallTint: string, pennant: string, solids: Solid[]): THREE.Group {
  const b = new Builder(); const roofDoors: THREE.Mesh[] = [];
  const pale = l.id === 'pale'; // M24 · Pale Keep follows the book: tall, narrow, cream-to-pale stone, dark-green scale cones, a crown of stone points
  const st = pale ? triplanar(t.sand, 2.8, wallTint, { sat: 0.45, gain: 2.25, emissive: '#2a2216' }) : triplanar(t.brick, 3.2, wallTint, { sat: 0.35, gain: 1.5 });
  const trim = triplanar(t.sand, 1.6, pale ? '#f2e4c6' : '#cfc5b2', { sat: 0.3, gain: pale ? 2.0 : 1.3, emissive: pale ? '#2a2318' : '#000000' }); /* M23: dressed ashlar for quoins, portal and mullions */
  const roof = pale ? triplanar(t.roof, 1.1, roofTint, { rough: 0.5, sat: 0, gain: 2.3, emissive: '#06140a' }) : triplanar(t.roof, 2.2, roofTint, { rough: 0.85 });
  const y0 = l.pad - 0.3; const R = 19, W = 8.5;
  const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z); // gate looks toward the meadow
  const corners = 6;
  for (let i = 0; i < corners; i++) {
    const a0 = face + Math.PI / corners + i / corners * Math.PI * 2, a1 = a0 + Math.PI * 2 / corners;
    const p0 = new THREE.Vector2(Math.sin(a0) * R, Math.cos(a0) * R), p1 = new THREE.Vector2(Math.sin(a1) * R, Math.cos(a1) * R);
    const mid = p0.clone().add(p1).multiplyScalar(0.5), len = p0.distanceTo(p1), ux = (p1.x - p0.x) / len, uz = (p1.y - p0.y) / len, ang = Math.atan2(-uz, ux);
    const isGate = i === corners - 1; // segment centred on `face`
    if (isGate) {
      // Gatehouse: two flanking piers and a lintel with an arch-dark portal.
      for (const sgn of [-1, 1]) { const o = sgn * (len / 2 - len * 0.32); b.add(st, box(len * 0.36, W + 1.5, 2.6), mid.x + ux * o, y0, mid.y + uz * o, ang); }
      b.add(st, box(len * 0.34, 3.2, 2.8), mid.x, y0 + W - 1.7, mid.y, ang);
    } else {
      b.add(st, box(len, W, 2.2), mid.x, y0, mid.y, ang);
      for (let k = 0; k < 9; k++) { const u = (k + 0.5) / 9 - 0.5; b.add(st, box(len / 9 * 0.55, 1.2, 2.4), mid.x + ux * u * len, y0 + W, mid.y + uz * u * len, ang); }
      for (let k = 0; k <= 6; k++) { const u = k / 6; solids.push({ x: l.x + p0.x + (p1.x - p0.x) * u, z: l.z + p0.y + (p1.y - p0.y) * u, r: 1.9 }); }
    }
    tower(b, st, roof, p0.x, y0, p0.y, 3.1, W + (pale ? 7 : 5), pale ? 9.5 : 6.5, pale);
    solids.push({ x: l.x + p0.x, z: l.z + p0.y, r: 3.6 });
  }
  // Central keep: square hall, a taller crown tower with a slim spire, and two slender turrets.
  const kx = -Math.sin(face) * 3, kz = -Math.cos(face) * 3;
  b.add(st, box(KEEP_W, 18, KEEP_D), kx, y0, kz, face);
  { const cs = Math.cos(face), sn = Math.sin(face), P = (u: number, v: number) => [kx + cs * u + sn * v, kz - sn * u + cs * v] as const;
    for (let k = 0; k < 8; k++) for (const sgn of [-1, 1]) { const u = ((k + 0.5) / 8 - 0.5) * KEEP_W; const [x, z] = P(u, sgn * (KEEP_D / 2 - 0.4)); b.add(st, box(1.0, 1.2, 0.8), x, y0 + 18, z, face); }
    for (let k = 0; k < 7; k++) for (const sgn of [-1, 1]) { const v = ((k + 0.5) / 7 - 0.5) * KEEP_D; if (Math.abs(v) < 2.4) continue; const [x, z] = P(sgn * (KEEP_W / 2 - 0.4), v); b.add(st, box(0.8, 1.2, 1.0), x, y0 + 18, z, face); }
    for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const [x, z] = P(u * (KEEP_W / 2 - 1), v * (KEEP_D / 2 - 1)); solids.push({ x: l.x + x, z: l.z + z, r: 2.2 }); }
    // M21a · architectural detail: string courses, stepped buttresses, tall arched windows (dark glass, stone sills and hoods).
    for (const hy of [7.6, 13.4]) b.add(st, box(KEEP_W + 0.5, 0.32, KEEP_D + 0.5), kx, y0 + hy, kz, face);
    for (const sgn of [-1, 1]) for (const v of [-KEEP_D * 0.33, 0, KEEP_D * 0.33]) { const [x, z] = P(sgn * (KEEP_W / 2 + 0.55), v); b.add(st, box(1.1, 9, 1.4), x, y0, z, face); const [x2, z2] = P(sgn * (KEEP_W / 2 + 0.3), v); b.add(st, box(0.6, 5, 1.1), x2, y0 + 9, z2, face); }
    { const arch = new THREE.Shape(); arch.moveTo(-0.55, 0); arch.lineTo(0.55, 0); arch.lineTo(0.55, 1.9); arch.absarc(0, 1.9, 0.55, 0, Math.PI, false); arch.lineTo(-0.55, 0);
      const glass = new THREE.ExtrudeGeometry(arch, { depth: 0.1, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.05);
      const hood = new THREE.ExtrudeGeometry((() => { const h = new THREE.Shape(); h.absarc(0, 1.9, 0.78, 0, Math.PI, false); h.lineTo(-0.58, 1.9); h.absarc(0, 1.9, 0.58, Math.PI, 0, true); h.lineTo(0.78, 1.9); return h; })(), { depth: 0.28, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.14);
      for (const sgn of [-1, 1]) for (const lvl of [8.4, 14.2]) for (let k = 0; k < 5; k++) { const u = ((k + 0.5) / 5 - 0.5) * (KEEP_W - 3); if (lvl < 9 && Math.abs(u) < 2) continue;
        const [x, z] = P(u, sgn * (KEEP_D / 2 + 0.02)); const ry = face + (sgn < 0 ? Math.PI : 0);
        b.add(WIN_GLASS, glass, x, y0 + lvl, z, ry); b.add(st, hood, x, y0 + lvl, z, ry); b.add(st, box(1.4, 0.18, 0.4), x, y0 + lvl - 0.18, z, ry);
        b.add(trim, box(0.1, 2.35, 0.16), x, y0 + lvl, z, ry); b.add(trim, box(1.1, 0.09, 0.16), x, y0 + lvl + 1.35, z, ry); } } // M23: stone mullion + transom
    // M23 · quoins at every corner (alternating long/short dressed blocks) and a battered plinth broken for the door
    for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let k = 0; k < 20; k++) { const lng = k % 2 === 0, a = lng ? 1.1 : 0.6, c = lng ? 0.6 : 1.1; const [x, z] = P(su * (KEEP_W / 2 - a / 2 + 0.07), sv * (KEEP_D / 2 - c / 2 + 0.07)); b.add(trim, box(a, 0.4, c), x, y0 + 1.3 + k * 0.84, z, face); }
    { const T = 0.55; for (const [u, v, w, d] of [[0, -(KEEP_D / 2 + T / 2), KEEP_W + 2 * T, T], [KEEP_W / 2 + T / 2, 0, T, KEEP_D], [-(KEEP_W / 2 + T / 2), 0, T, KEEP_D], [-(KEEP_W / 4 + 1.25), KEEP_D / 2 + T / 2, KEEP_W / 2 - 2.5 + 2 * T, T], [KEEP_W / 4 + 1.25, KEEP_D / 2 + T / 2, KEEP_W / 2 - 2.5 + 2 * T, T]]) {
      const [x, z] = P(u, v); b.add(st, box(w, 1.1, d), x, y0, z, face); const [x2, z2] = P(u * 0.985, v * 0.985); b.add(st, box(Math.max(0.2, w - 0.3), 0.22, Math.max(0.2, d - 0.3)), x2, y0 + 1.1, z2, face); } }
    // the tower door out onto the roof
    const [tx, tz] = P(0, 4.66); const td = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ color: '#6a4a2e', roughness: 0.8, emissive: '#2a1a0c', emissiveIntensity: 0.6 })); td.position.set(l.x + tx, y0 + 18 + 1.2, l.z + tz); td.rotation.y = face; roofDoors.push(td); }
  // M20a · the crown tower is an open lookout: parapet floor at y0+31.2, six pillars, the cone raised on top.
  const spireH = pale ? 18 : 13;
  { const r = 4.4, h = 30, top = y0 + h + 1.2, ph = KEEP_LOOK_PILLAR;
    b.add(st, cyl(r * 1.08, r, h), kx, y0, kz); b.add(st, cyl(r * 1.18, r * 1.18, 1.2), kx, y0 + h, kz);
    for (let i = 0; i < 14; i++) { if (i % 7 === 0) continue; const a = face + Math.PI / 2 + i / 14 * Math.PI * 2; b.add(st, box(0.9, 0.7, 0.5), kx + Math.cos(a) * r * 1.13, top + 0.8, kz + Math.sin(a) * r * 1.13, -a + Math.PI / 2); }
    for (let i = 0; i < 6; i++) { const a = face + (i + 0.5) / 6 * Math.PI * 2; b.add(st, cyl(0.32, 0.32, ph), kx + Math.sin(a) * r * 1.1, top, kz + Math.cos(a) * r * 1.1); }
    b.add(st, cyl(r * 1.3, r * 1.3, 0.5), kx, top + ph, kz); b.add(roof, cone(r * (pale ? 1.18 : 1.25), spireH, 24), kx, top + ph + 0.5, kz);
    // M24 · the crown: a ring of thin stone points round the spire's foot and a smaller ring a third of the way up
    if (pale) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.add(trim, cyl(0.2, 0.16, 0.5, 6), kx + Math.sin(a) * r * 1.24, top + ph + 0.5, kz + Math.cos(a) * r * 1.24); b.add(trim, cone(0.16, 2.4, 6), kx + Math.sin(a) * r * 1.24, top + ph + 1.0, kz + Math.cos(a) * r * 1.24); }
      const yr = top + ph + 0.5 + spireH * 0.34, rr = r * 1.18 * 0.66 + 0.12; b.add(trim, cyl(rr + 0.12, rr + 0.12, 0.3, 24), kx, yr - 0.3, kz);
      for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2; b.add(trim, cone(0.12, 1.5, 6), kx + Math.sin(a) * (rr + 0.05), yr, kz + Math.cos(a) * (rr + 0.05)); } }
    b.add(st, box(1.3, 0.12, 1.3), kx, top - 0.05, kz, face);
    b.add(st, new THREE.LatheGeometry([new THREE.Vector2(r * 1.06, 0), new THREE.Vector2(r * 1.2, 0), new THREE.Vector2(r * 1.2, 0.8), new THREE.Vector2(r * 1.06, 0.8), new THREE.Vector2(r * 1.06, 0)], 28), kx, top, kz); }
  // M20a · the keep's front door (enterable): stone arch surround, dark wood leaves, two wall lanterns.
  { const dx = kx + Math.sin(face) * (KEEP_D / 2 + 0.0), dz = kz + Math.cos(face) * (KEEP_D / 2 + 0.0), cs = Math.cos(face), sn = Math.sin(face);
    b.add(st, box(4.0, 4.6, 0.6), dx, y0, dz, face); void cs; void sn;
    // M23 · a real portal: projecting jamb piers, a ring of dressed voussoirs with a keystone, a recessed plank door with
    //       iron straps and a ring, two worn steps, and caged iron lanterns on brackets (was a flat plane + half disc + two cubes).
    const F = (m: THREE.Material, gq: THREE.BufferGeometry, u: number, y: number, v: number) => { gq.translate(u, y, v); b.add(m, gq, kx, y0, kz, face); };
    const FV = KEEP_D / 2, doorM = KEEP_DOOR;
    for (const s2 of [-1, 1]) { F(trim, new THREE.BoxGeometry(0.8, 3.6, 0.8), s2 * 1.6, 1.8, FV + 0.45); F(trim, new THREE.BoxGeometry(0.95, 0.22, 0.9), s2 * 1.6, 3.55, FV + 0.45); }
    for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI, key = i === 6; const vg = new THREE.BoxGeometry(key ? 0.62 : 0.52, key ? 1.0 : 0.8, key ? 0.95 : 0.85); vg.rotateZ(a - Math.PI / 2); F(trim, vg, Math.cos(a) * 1.6, 3.6 + Math.sin(a) * 1.6, FV + 0.45); }
    for (let i = 0; i < 7; i++) { const u = -1.2 + (i + 0.5) * (2.4 / 7), top = 3.6 + Math.sqrt(Math.max(0, 1.44 - u * u)) - 0.05; F(doorM, new THREE.BoxGeometry(2.4 / 7 - 0.025, top, 0.12 + (i % 3) * 0.02), u, top / 2, FV + 0.38); }
    for (const yy of [0.7, 1.9, 3.1]) F(KEEP_IRON, new THREE.BoxGeometry(2.3, 0.1, 0.05), 0, yy, FV + 0.47); F(KEEP_IRON, new THREE.TorusGeometry(0.16, 0.03, 6, 14), 0.55, 1.5, FV + 0.5);
    for (let k = 0; k < 2; k++) F(st, new THREE.BoxGeometry(4.6 - k * 0.6, 0.2, 0.8), 0, 0.2 + k * 0.2, FV + 1.4 - k * 0.5);
    for (const s2 of [-1, 1]) { const u = s2 * 2.45; F(KEEP_IRON, new THREE.BoxGeometry(0.06, 0.06, 0.5), u, 3.35, FV + 0.5); F(KEEP_IRON, new THREE.ConeGeometry(0.24, 0.26, 4), u, 3.35, FV + 0.75); F(KEEP_LAMP, new THREE.BoxGeometry(0.24, 0.34, 0.24), u, 3.05, FV + 0.75);
      for (const [cu, cv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F(KEEP_IRON, new THREE.BoxGeometry(0.035, 0.4, 0.035), u + cu * 0.13, 3.05, FV + 0.75 + cv * 0.13); F(KEEP_IRON, new THREE.BoxGeometry(0.3, 0.05, 0.3), u, 2.86, FV + 0.75); } }
  tower(b, st, roof, kx + Math.cos(face) * KEEP_W / 2, y0 + 18, kz - Math.sin(face) * KEEP_W / 2, 1.6, 7, pale ? 6.5 : 4.5, pale);
  tower(b, st, roof, kx - Math.cos(face) * KEEP_W / 2, y0 + 18, kz + Math.sin(face) * KEEP_W / 2, 1.6, 6, pale ? 6 : 4, pale);
  const extra = pale ? paleKeepYard(b, l, t, st, trim, roof, face, kx, kz, y0, R, solids) : [];
  solids.push({ x: l.x + kx, z: l.z + kz, r: 8.5 });
  const g = b.build();
  // Portal darkness + pennant on the crown spire.
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.4), new THREE.MeshBasicMaterial({ color: '#120e0c' }));
  portal.position.set(Math.sin(face) * (R * 0.866 + 1.45), y0 + 2.7, Math.cos(face) * (R * 0.866 + 1.45)); portal.rotation.y = face; g.add(portal);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.6, 8, 1), new THREE.MeshStandardMaterial({ color: pennant, side: THREE.DoubleSide, roughness: 0.8, emissive: pennant, emissiveIntensity: 0.15 }));
  flag.position.set(kx + 2.3, y0 + 30 + 1.2 + KEEP_LOOK_PILLAR + 0.5 + spireH - 1.2, kz); flag.userData.flag = true; g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4), new THREE.MeshStandardMaterial({ color: '#4a3b2a' })); pole.position.set(kx, y0 + 30 + 1.2 + KEEP_LOOK_PILLAR + 0.5 + spireH + 0.5, kz); g.add(pole);
  for (const d of roofDoors) { d.position.x -= l.x; d.position.z -= l.z; g.add(d); }
  for (const m of extra) g.add(m);
  g.position.set(l.x, 0, l.z); g.name = l.id;
  return g;
}


/** M24 · Pale Keep's yard (Pale only): a cluster of taller round towers under green cones, frost on the courtyard flags, a low fan
 *  stair at the door (raised WALK discs), planted terraces in the east yard, a frozen stable trough in the west yard, a battered
 *  glacis round the curtain wall, and ivy climbing the stone. Placements stay clear of the walkable roof, the door and the gate. */
const ICE = new THREE.MeshStandardMaterial({ color: '#d4e6ef', roughness: 0.12, metalness: 0.05, emissive: '#1a2a33', emissiveIntensity: 0.25 });
const YARD_WOOD = new THREE.MeshStandardMaterial({ color: '#5e4430', roughness: 0.85 });
const GOLD = new THREE.MeshStandardMaterial({ color: '#c9a043', roughness: 0.34, metalness: 0.9 }), BRONZE = new THREE.MeshStandardMaterial({ color: '#8f5f30', roughness: 0.4, metalness: 0.85 });
const WHITE_STONE = new THREE.MeshStandardMaterial({ color: '#f8f5ef', roughness: 0.34, emissive: '#57524a', emissiveIntensity: 1 }); // pale marble: lifted so it stays white in shade
const FROST_CAP = new THREE.MeshStandardMaterial({ color: '#eef4f7', roughness: 0.55 }), HEART = new THREE.MeshStandardMaterial({ color: '#b3122a', roughness: 0.12, metalness: 0.1, emissive: '#7a0614', emissiveIntensity: 0.55 });
function paleKeepYard(b: Builder, l: Landmark, t: BuildTex, st: THREE.Material, trim: THREE.Material, roof: THREE.Material, face: number, kx: number, kz: number, y0: number, R: number, solids: Solid[]): THREE.Object3D[] {
  const cs = Math.cos(face), sn = Math.sin(face), K = (u: number, v: number) => [kx + cs * u + sn * v, kz - sn * u + cs * v] as const;
  const pad = y0 + 0.3; let sd = 24; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const leaf = triplanar(t.rock, 0.9, '#62873e', { sat: 0.3, gain: 1.4, rough: 0.95 }), ivy = triplanar(t.rock, 0.7, '#5a8a3a', { sat: 0.25, gain: 1.35, rough: 0.95 });
  const frost = triplanar(t.brick, 2.2, '#e6edf2', { sat: 0.12, gain: 2.1, rough: 0.5 }); frost.userData.noCast = true; ivy.userData.noCast = true;
  const clump = (m: THREE.Material, s: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, ry = 0) => b.add(m, new THREE.IcosahedronGeometry(s, m === ivy ? 0 : 1).scale(sx, sy, sz), x, y, z, ry);
  // taller clustered towers: two at the back corners, two lower at the front corners (clear of the roof walk and the door)
  for (const [u, v, r, h, rh] of [[8.6, -8.6, 2.1, 27, 9.5], [-8.6, -8.6, 2.3, 24, 9], [9.3, 5.4, 1.7, 20, 7.5], [-9.3, 5.4, 1.9, 17, 7.5]]) {
    const [x, z] = K(u, v); tower(b, st, roof, x, y0, z, r, h, rh, true); solids.push({ x: l.x + x, z: l.z + z, r: r * 1.22 + 0.2 }); }
  // frost on the courtyard flags (a hex floor under the curtain wall)
  b.add(frost, new THREE.CylinderGeometry(18.6, 18.6, 0.08, 6, 1, false, face + Math.PI / 6), 0, pad - 0.01, 0);
  // fan stair at the door: three low half-round steps (the back halves sit inside the keep); feet stand on them
  { const [x, z] = K(0, KEEP_D / 2 + 0.4); for (const [r, h] of [[4.0, 0.16], [3.2, 0.32], [2.4, 0.48]]) { b.add(trim, cyl(r, r, h + 0.3, 40), x, y0, z); b.add(frost, cyl(r - 0.12, r - 0.12, 0.012, 40), x, pad + h, z); WALK.push({ x: l.x + x, z: l.z + z, r: r - 0.05, y: pad + h }); } }
  // planted terraces in the east yard: two stepped beds with dressed coping, low hedge and rounded shrubs, a clipped cone at each end
  for (const [u0, u1, v0, v1, h] of [[9.0, 12.0, -3.5, 3.0, 0.6], [12.0, 14.4, -3.0, 1.2, 1.2]]) {
    const [x, z] = K((u0 + u1) / 2, (v0 + v1) / 2), w = u1 - u0, d = v1 - v0;
    b.add(trim, box(w, h + 0.3, d), x, y0, z, face); b.add(trim, box(w + 0.2, 0.14, d + 0.2), x, pad + h, z, face);
    b.add(leaf, box(w - 0.6, 0.3, d - 0.6), x, pad + h + 0.1, z, face);
    for (let vv = v0 + 0.8; vv < v1 - 0.5; vv += 1.05) for (let uu = u0 + 0.75; uu < u1 - 0.4; uu += 1.0) { const [cx, cz] = K(uu + (rnd() - 0.5) * 0.2, vv + (rnd() - 0.5) * 0.2); clump(leaf, 0.5 + rnd() * 0.12, 1, 0.75 + rnd() * 0.3, 1, cx, pad + h + 0.42, cz, rnd() * 6); }
    for (const vv of [v0 + 0.5, v1 - 0.5]) { const [cx, cz] = K(u1 - 0.5, vv); b.add(leaf, cone(0.42, 1.8, 10), cx, pad + h + 0.15, cz); }
    for (let vv = v0 + 1.4; vv <= v1 - 1.4 + 1e-3; vv += Math.max(0.6, (d - 2.8) / 2)) { const [cx, cz] = K((u0 + u1) / 2, vv); solids.push({ x: l.x + cx, z: l.z + cz, r: w / 2 + 0.15 }); }
  }
  // frozen stable trough in the west yard: a stone trough skinned with ice, a hitching rail and a bucket
  { const u = -10.6, v = -0.5, [x, z] = K(u, v);
    b.add(trim, box(1.1, 0.75, 2.8), x, pad - 0.05, z, face); b.add(ICE, box(0.84, 0.05, 2.54), x, pad + 0.62, z, face); b.add(frost, box(1.16, 0.03, 2.86), x, pad + 0.7, z, face);
    for (const vv of [-1.4, 1.4]) { const [px, pz] = K(u - 1.2, v + vv); b.add(YARD_WOOD, box(0.18, 1.15, 0.18), px, pad - 0.05, pz, face); }
    { const [rx, rz] = K(u - 1.2, v); b.add(YARD_WOOD, box(0.12, 0.12, 3.0), rx, pad + 0.95, rz, face); }
    { const [bx, bz] = K(u + 0.2, v + 1.9); b.add(YARD_WOOD, cyl(0.24, 0.3, 0.42, 10), bx, pad, bz); b.add(ICE, cyl(0.22, 0.22, 0.02, 10), bx, pad + 0.38, bz); }
    solids.push({ x: l.x + x, z: l.z + z, r: 1.7 }); }
  // a climbing plant on the keep's front wall (two vines either side of the door) and ivy up its west face
  for (const [u0, top, ph] of [[-6.2, 14.5, 0.3], [6.1, 9.5, 2.0]]) for (let y = 0.3; y < top; y += 0.3) {
    const u = u0 + Math.sin(y * 0.45 + ph) * 0.55, spread = 0.6 + 0.5 * Math.sin(y * 0.8 + ph) ** 2, [x, z] = K(u + (rnd() - 0.5) * spread, KEEP_D / 2 + 0.18);
    clump(ivy, 0.3 + rnd() * 0.2, 1.3, 0.9, 0.42, x, y0 + y, z, face); }
  for (let k = 0; k < 26; k++) { const vv = -6 + rnd() * 11, yy = 0.4 + rnd() * rnd() * 9, [x, z] = K(-(KEEP_W / 2 + 0.2), vv); clump(ivy, 0.45 + rnd() * 0.3, 0.42, 0.9, 1.3, x, y0 + yy, z, face); }
  // battered glacis round the curtain wall (not the gate segment), with ivy spilling down it and up three towers
  const shp = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0.06, 3.4), new THREE.Vector2(0, 3.4)]);
  for (let i = 0; i < 5; i++) {
    const a0 = face + Math.PI / 6 + i * Math.PI / 3, a1 = a0 + Math.PI / 3, p0x = Math.sin(a0) * R, p0z = Math.cos(a0) * R, p1x = Math.sin(a1) * R, p1z = Math.cos(a1) * R;
    const len = Math.hypot(p1x - p0x, p1z - p0z), ux = (p1x - p0x) / len, uz = (p1z - p0z) / len, nx = -uz, nz = ux, ang = Math.atan2(-uz, ux), mx = (p0x + p1x) / 2, mz = (p0z + p1z) / 2;
    b.add(st, new THREE.ExtrudeGeometry(shp, { depth: len, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(len / 2, -0.3, 0), mx + nx * 1.1, y0, mz + nz * 1.1, ang);
    for (let k = 0; k <= 6; k++) { const f = k / 6; solids.push({ x: l.x + p0x + (p1x - p0x) * f + nx * 1.6, z: l.z + p0z + (p1z - p0z) * f + nz * 1.6, r: 1.2 }); }
    for (let c = 0; c < 5; c++) { const f = 0.12 + rnd() * 0.76, hTop = 2 + rnd() * 6.5;
      for (let y = 0.2; y < hTop; y += 0.55) for (let q = 0; q < 2; q++) { const off = y < 3.1 ? 1.15 + 1.3 * (1 - y / 3.4) : 1.16, jit = (rnd() - 0.5) * (1.6 + y * 0.25) * (1.1 - y / (hTop + 2));
        clump(ivy, 0.3 + rnd() * 0.35, 1.5, 0.7 + rnd() * 0.5, 0.35, mx + ux * ((f - 0.5) * len + jit) + nx * off, y0 + y + rnd() * 0.3, mz + uz * ((f - 0.5) * len + jit) + nz * off, ang); } }
    if (i % 2 === 0) { const tx = p0x / R, tz = p0z / R, hT = 5 + rnd() * 5; for (let y = 0.3; y < hT; y += 0.5) for (let q = 0; q < 2; q++) { const a = Math.atan2(tx, tz) + Math.sin(y * 0.6) * 0.2 + (rnd() - 0.5) * 0.7 * (1.1 - y / (hT + 1)), rr = 3.1 * 1.12;
      clump(ivy, 0.3 + rnd() * 0.3, 1.4, 0.7 + rnd() * 0.5, 0.35, p0x + Math.sin(a) * rr, y0 + y + rnd() * 0.3, p0z + Math.cos(a) * rr, a); } }
  }
  const gold = GOLD, frostCap = FROST_CAP;
  // the heart-crystal under a crown on the keep wall above the door (scenery only, not interactive)
  // M25 · brought down to just over the door arch and enlarged by a third, on a moulded corbel with a dressed
  //       backing roundel, so it reads from the courtyard (was 10.6 m up, out of frame from the yard)
  { const [x, z] = K(0, KEEP_D / 2 + 0.5), Y = y0 + 7.3, S = 1.35, [rx, rz] = K(0, KEEP_D / 2 + 0.12);
    b.add(trim, new THREE.CylinderGeometry(1.25, 1.25, 0.2, 28).rotateX(Math.PI / 2), rx, Y + 0.25, rz, face); b.add(gold, new THREE.TorusGeometry(1.2, 0.06, 6, 28), rx, Y + 0.25, rz + 0, face);
    b.add(trim, box(1.5 * S, 0.35, 1.0), x, Y - 1.45 * S, z, face); b.add(trim, cone(0.55 * S, 0.7 * S, 4).rotateX(Math.PI), x, Y - 1.1 * S, z, face);
    b.add(HEART, new THREE.OctahedronGeometry(0.62 * S, 0).scale(0.8, 1.25, 0.55), x, Y, z, face);
    b.add(gold, cyl(0.5 * S, 0.56 * S, 0.32 * S, 16), x, Y + 0.9 * S, z); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.add(gold, cone(0.09 * S, 0.42 * S, 5), x + Math.sin(a) * 0.5 * S, Y + 1.22 * S, z + Math.cos(a) * 0.5 * S); b.add(gold, new THREE.SphereGeometry(0.06 * S, 6, 4), x + Math.sin(a) * 0.5 * S, Y + 1.66 * S, z + Math.cos(a) * 0.5 * S); }
    b.add(frostCap, cyl(0.5 * S, 0.5 * S, 0.03, 16), x, Y + 1.22 * S, z); }
  // the gold crown fountain in the upper courtyard, frozen solid: stone basin, ice, a crown iced over with icicles
  { const [x, z] = K(-6.6, 10.2);
    b.add(trim, lathe([[0, 0], [1.45, 0], [1.5, 0.2], [1.4, 0.75], [1.55, 0.82], [1.55, 0.9], [1.25, 0.9], [1.2, 0.3], [0, 0.3]], 32), x, pad - 0.05, z);
    b.add(ICE, cyl(1.24, 1.24, 0.06, 32), x, pad + 0.66, z); b.add(trim, cyl(0.32, 0.42, 1.1, 14), x, pad + 0.3, z);
    const Y = pad + 1.4; b.add(gold, cyl(0.55, 0.62, 0.42, 20), x, Y, z); b.add(ICE, cyl(0.5, 0.5, 0.36, 20), x, Y + 0.03, z);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add(gold, cone(0.11, 0.55, 5), x + Math.sin(a) * 0.58, Y + 0.42, z + Math.cos(a) * 0.58); b.add(frostCap, new THREE.SphereGeometry(0.07, 6, 4), x + Math.sin(a) * 0.58, Y + 0.98, z + Math.cos(a) * 0.58);
      b.add(ICE, cone(0.05 + (i % 3) * 0.02, 0.35 + (i % 3) * 0.2, 5).rotateX(Math.PI), x + Math.sin(a + 0.4) * 0.6, Y + 0.02, z + Math.cos(a + 0.4) * 0.6); }
    b.add(ICE, lathe([[0, 0], [0.45, 0], [0.3, 0.5], [0.12, 0.8], [0, 0.85]], 10), x, pad + 0.7, z); // the frozen spill down the pedestal
    solids.push({ x: l.x + x, z: l.z + z, r: 1.7 }); }
  // ---- the Wing Gate: the outer gate at the foot of the rock, on the road from the meadow, facing it ----
  const D = PALE_ROCK.gate, G = (u: number, v: number) => [Math.sin(face) * D + cs * u + sn * v, Math.cos(face) * D - sn * u + cs * v] as const;
  const hy = (u: number, v: number) => { const [x, z] = G(u, v); return heightAt(l.x + x, l.z + z); };
  const gy = Math.min(hy(0, 0), hy(-4.4, 0), hy(4.4, 0)) - 0.05;
  const red = triplanar(t.sand, 2.0, '#b8402f', { sat: 0.6, gain: 1.75, rough: 0.75, emissive: '#2a0a06' }), white = WHITE_STONE;
  // the drum towers: white plinth, red drum, gold band and gold crenellated top, frost on the merlons
  for (const s of [-1, 1]) { const [x, z] = G(s * 4.4, 0), r = 2.1, H = 11;
    b.add(white, cyl(r * 1.16, r * 1.1, 1.3, 24), x, gy - 0.6, z); b.add(red, cyl(r * 1.02, r, H, 24), x, gy, z);
    for (const yy of [3.6, 7.2]) for (let i = 0; i < 3; i++) { const a = face + (i - 1) * 0.7 + (s > 0 ? 0.3 : -0.3); b.add(SLIT, box(0.16, 1.1, 0.12), x + Math.sin(a) * r * 1.02, gy + yy, z + Math.cos(a) * r * 1.02, a + Math.PI / 2 - Math.PI / 2); }
    b.add(gold, cyl(r * 1.06, r * 1.06, 0.36, 24), x, gy + H - 1.2, z); b.add(gold, cyl(r * 1.14, r * 1.1, 0.7, 24), x, gy + H, z);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.add(gold, box(0.72, 0.75, 0.42), x + Math.sin(a) * r * 1.1, gy + H + 0.7, z + Math.cos(a) * r * 1.1, a); b.add(frostCap, box(0.74, 0.07, 0.44), x + Math.sin(a) * r * 1.1, gy + H + 1.45, z + Math.cos(a) * r * 1.1, a); }
    b.add(frostCap, cyl(r * 1.0, r * 1.0, 0.05, 24), x, gy + H + 0.7, z);
    solids.push({ x: l.x + x, z: l.z + z, r: r * 1.12 + 0.15 }); }
  // the pale stone arch between them (a pierced wall), voussoirs, a parapet with frosted merlons
  { const sh = new THREE.Shape(); sh.moveTo(-2.7, 0); sh.lineTo(-2.1, 0); sh.lineTo(-2.1, 4.9); sh.absarc(0, 4.9, 2.1, Math.PI, 0, true); sh.lineTo(2.1, 0); sh.lineTo(2.7, 0); sh.lineTo(2.7, 10); sh.lineTo(-2.7, 10); sh.lineTo(-2.7, 0); // a U contour (a hole touching the edge triangulated badly)

    const [x, z] = G(0, 0); b.add(trim, new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false, curveSegments: 14 }).translate(0, -0.6, -1.3), x, gy, z, face);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI, vg = new THREE.BoxGeometry(i === 5 ? 0.62 : 0.5, i === 5 ? 0.95 : 0.75, 0.3); vg.rotateZ(a - Math.PI / 2); vg.translate(Math.cos(a) * 2.4, 4.3 + Math.sin(a) * 2.4, 1.38); b.add(white, vg, x, gy, z, face); }
    for (let i = 0; i < 5; i++) { const u = -2.2 + i * 1.1, [mx, mz] = G(u, 0); b.add(trim, box(0.6, 0.8, 2.6), mx, gy + 9.4, mz, face); b.add(frostCap, box(0.62, 0.07, 2.62), mx, gy + 10.2, mz, face); }
    // the bronze compass rose on the arch's road face (eight points, ring and boss) — the gate's story hook
    const star = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 4 === 0 ? 1.15 : i % 2 === 0 ? 0.72 : 0.26; const px = Math.sin(a) * rr, py = Math.cos(a) * rr; if (i) star.lineTo(px, py); else star.moveTo(px, py); }
    const C = (gq: THREE.BufferGeometry, m: THREE.Material) => { gq.scale(1.13, 1.13, 1); gq.translate(0, 8.45, 1.32); b.add(m, gq, x, gy, z, face); };
    C(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 32).rotateX(Math.PI / 2), white); C(new THREE.TorusGeometry(0.92, 0.07, 6, 32), BRONZE); C(new THREE.TorusGeometry(0.62, 0.035, 6, 28), BRONZE);
    C(new THREE.ExtrudeGeometry(star, { depth: 0.1, bevelEnabled: false }), BRONZE); C(new THREE.SphereGeometry(0.13, 10, 6), BRONZE);
    // two small gold lanterns on posts either side of the arch
    for (const s of [-1, 1]) { const [px, pz] = G(s * 2.95, 2.3); b.add(gold, cyl(0.07, 0.06, 2.4, 8), px, gy, pz); b.add(gold, box(0.42, 0.06, 0.42), px, gy + 2.4, pz, face); b.add(KEEP_LAMP, box(0.3, 0.42, 0.3), px, gy + 2.46, pz, face); b.add(gold, cone(0.3, 0.32, 4), px, gy + 2.88, pz, face + Math.PI / 4); b.add(frostCap, cone(0.16, 0.12, 4), px, gy + 3.1, pz, face + Math.PI / 4); solids.push({ x: l.x + px, z: l.z + pz, r: 0.35 }); } }
  // dark side arches: a short wing wall beyond each tower with a blind dark arch on the road face
  for (const s of [-1, 1]) { const [x, z] = G(s * 7.9, -0.2); b.add(trim, box(3.4, 5.4, 1.6), x, gy - 0.6, z, face); b.add(frostCap, box(3.42, 0.06, 1.62), x, gy + 4.8, z, face);
    const ar = new THREE.Shape(); ar.moveTo(-0.85, 0); ar.lineTo(0.85, 0); ar.lineTo(0.85, 2.3); ar.absarc(0, 2.3, 0.85, 0, Math.PI, false); ar.lineTo(-0.85, 0);
    const [ax, az] = G(s * 7.9, 0.62); b.add(SLIT, new THREE.ShapeGeometry(ar, 10), ax, gy, az, face);
    for (let k = 0; k < 4; k++) { const [cx, cz] = G(s * 7.9, -0.2 + 0); solids.push({ x: l.x + cx + cs * s * (k - 1.5) * 0.9, z: l.z + cz - sn * s * (k - 1.5) * 0.9, r: 0.95 }); } }
  // the forecourt: the gilded winged figure on a white plinth facing the road, two gold obelisks on white bases
  { const [x, z] = G(0, 6.2), py = hy(0, 6.2);
    b.add(white, box(1.7, 1.5, 1.7), x, py - 0.3, z, face); b.add(white, box(2.0, 0.22, 2.0), x, py - 0.3, z, face); b.add(white, box(1.9, 0.2, 1.9), x, py + 1.2, z, face);
    const Y = py + 1.4; figure(b, gold, FROST_CAP, x, Y, z, face);
    solids.push({ x: l.x + x, z: l.z + z, r: 1.4 });
    for (const s of [-1, 1]) { const [ox, oz] = G(s * 5.6, 3.2), oy = hy(s * 5.6, 3.2); // M25: tucked in (the Dawn seal plinth stands just beyond)
      b.add(white, box(1.4, 1.1, 1.4), ox, oy - 0.3, oz, face); b.add(white, box(1.6, 0.2, 1.6), ox, oy - 0.3, oz, face);
      b.add(gold, cyl(0.46, 0.3, 5.0, 4), ox, oy + 0.8, oz, face + Math.PI / 4); b.add(gold, cone(0.32, 0.6, 4), ox, oy + 5.8, oz, face + Math.PI / 4); b.add(frostCap, cone(0.15, 0.28, 4), ox, oy + 6.12, oz, face + Math.PI / 4);
      solids.push({ x: l.x + ox, z: l.z + oz, r: 1.05 }); } }
  // gold-painted plaza with swirl and wing inlays (one decal mesh laid on the ground)
  const [px, pz] = G(0, 5.2); const plaza = new THREE.RingGeometry(0.05, 7.2, 64, 10); plaza.rotateX(-Math.PI / 2); plaza.rotateY(face);
  { const pp = plaza.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, heightAt(l.x + px + pp.getX(i), l.z + pz + pp.getZ(i)) + 0.035); plaza.computeVertexNormals(); }
  const pm = new THREE.Mesh(plaza, new THREE.MeshStandardMaterial({ map: plazaTex(), color: '#ffffff', metalness: 0.45, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  pm.position.set(px, 0, pz); pm.receiveShadow = true;
  paleRock(b, l, t, st, trim, frost, ivy, leaf, face, gy, solids, rnd);
  return [pm];
}

/** M25 · Pale Keep's castle rock and the grand stair. The keep's pad is 4.4 m above the meadow (world.ts PALE_ROCK): a craggy
 *  rock skirt rings the plateau (a gap where the stair is cut in), a frosted terrace parapet runs along its rim, and a wide
 *  two-flight stair climbs from just inside the Wing Gate to a top landing before the gatehouse: dressed treads with frosted
 *  ends, tall retaining walls where it is cut into the rock, a balustrade on the lower flight, newels with lanterns at the
 *  landings, ivy, and planted terraces either side of the stair foot. Feet use WALK boxes (camera-floor too); solids keep the
 *  player on the stair and off the cliff. */
function paleRock(b: Builder, l: Landmark, t: BuildTex, st: THREE.Material, trim: THREE.Material, frost: THREE.Material, ivy: THREE.Material, leaf: THREE.Material, face: number, gy: number, solids: Solid[], rnd: () => number) {
  const cs = Math.cos(face), sn = Math.sin(face), G = (u: number, v: number) => [cs * u + sn * v, -sn * u + cs * v] as const;
  const base = l.base!, top = l.pad, RI = PALE_ROCK.in, HALF = 2.5;
  const rock = triplanar(t.rock, 2.6, '#c4b9a3', { sat: 0.35, gain: 1.95, rough: 0.92, emissive: '#151210' });
  // M32 · the castle rock weathers: bedding strata (alternating tone, thin dark partings), moss and damp in the cracks and partings,
  // lichen blots on the faces, and darker, damper stone toward the foot. Per pixel (no extra geometry).
  { const prev = rock.onBeforeCompile; rock.onBeforeCompile = (sh, r) => { prev.call(rock, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 n = normalize(vTN); float side = 1. - smoothstep(.55, .85, n.y); float yy = vTW.y + .35 * tVn(vTW.xz * .35);
    float band = .5 + .5 * sin(yy * 4.2 + tVn(vTW.xz * .5) * 2.); float part = 1. - smoothstep(.0, .06, abs(fract(yy * .72) - .5) - .44);
    float crack = smoothstep(.62, .7, tVn(vec2((vTW.x - vTW.z) * 1.9, yy * .8))) * smoothstep(.45, .6, tVn(vTW.xz * 2.7 + yy));
    float foot = 1. - smoothstep(${(base + 0.1).toFixed(2)}, ${(base + 1.6).toFixed(2)}, vTW.y);
    float lich = side * smoothstep(.78, .84, tVn(vTW.xy * 4.1 + vTW.zy * 3.7));
    diffuseColor.rgb *= mix(.8, 1.14, band) * (1. - .5 * part * side);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24, .31, .13), clamp((part * .5 + crack) * side * (.55 + .45 * tVn(vTW.xz * 6.)) + (1. - side) * .25, 0., .8));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.76, .74, .58), lich * .5);
    diffuseColor.rgb *= (1. - .16 * foot) * 1.1; roughnessFactor = mix(roughnessFactor, .45, foot * .6); }`); }; }
  // ---- the rock skirt: a lathe from the meadow to the rim, pushed outward by two octaves of noise (crags and ledges) ----
  { const prof: [number, number][] = [[25.45, base - 0.8], [25.3, base + 0.15], [24.95, base + 0.9], [24.55, base + 1.7], [24.15, base + 2.4], [23.65, base + 3.1], [23.15, base + 3.75], [22.8, top - 0.12], [22.5, top + 0.1], [21.9, top + 0.1]];
    const gap = 0.14, seg = 104, gq = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, face + gap, Math.PI * 2 - gap * 2);
    const p = gq.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(x, z), arc = a * 24;
      const w = THREE.MathUtils.smoothstep(y, base - 0.4, base + 0.6) * (1 - THREE.MathUtils.smoothstep(y, top - 0.6, top + 0.05) * 0.75);
      const n = (0.5 + 0.5 * fbm(arc * 0.16, y * 0.32)) * 0.75 + 0.3 * fbm(arc * 0.55 + 5, y * 0.9) + 0.12 * Math.sin(y * 3.1 + fbm(arc * 0.3, 2) * 4); // + strata
      const rr = Math.min(25.45, r + n * w); p.setX(i, Math.sin(a) * rr); p.setZ(i, Math.cos(a) * rr); }
    gq.computeVertexNormals(); b.add(rock, gq);
    // frost/snow lying on the rim, and ivy cascading down the rock in a dozen curtains
    b.add(frost, new THREE.RingGeometry(21.95, 22.95, seg, 1, face + gap, Math.PI * 2 - gap * 2).rotateX(-Math.PI / 2), 0, top + 0.13, 0);
    for (let c = 0; c < 12; c++) { const a0 = face + 0.3 + c / 12 * (Math.PI * 2 - 0.6) + (rnd() - 0.5) * 0.15, hT = 1.6 + rnd() * 2.8;
      for (let k = 0; k < 9; k++) { const y = top - 0.1 - rnd() * hT, f = (top - y) / 4.4, rr = 22.75 + f * 2.3 + 0.55, a = a0 + (rnd() - 0.5) * 0.09 * (1 + f);
        b.add(ivy, new THREE.IcosahedronGeometry(0.42 + rnd() * 0.3, 0).scale(1.4, 0.8 + rnd() * 0.4, 0.4), Math.sin(a) * rr, y, Math.cos(a) * rr, a); } }
    // M32 · scree and fallen blocks round the foot (low, so feet pass over), heaviest by the stair and the gate; ivy and moss where the stair is cut into the rock
    for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, da = Math.atan2(Math.sin(a - face - 0.78), Math.cos(a - face - 0.78)); if (Math.abs(da) < 0.35) continue;
      const rr = 25.2 + rnd() * rnd() * 2.2, x = Math.sin(a) * rr, z = Math.cos(a) * rr, u = x * cs - z * sn, v = x * sn + z * cs; if (v > 0 && Math.abs(u) < 4.2) continue;
      const near = Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face))) < 0.6, sz = (near ? 0.14 : 0.1) + rnd() * (near ? 0.42 : 0.3);
      b.add(rock, new THREE.DodecahedronGeometry(sz, 0).scale(1.3, Math.min(0.62, 0.42 / sz), 1.1), l.x * 0 + x, heightAt(l.x + x, l.z + z) - sz * 0.12, z, rnd() * 6); }
    // the cliff stops walkers (a ring of solids round the foot, open where the stair is)
    //  (wider than the rock so feet never meet the coarse terrain mesh over the cliff; tighter by Enna's collapsed stair)
    for (let i = 0; i < 140; i++) { const a = i / 140 * Math.PI * 2, da = Math.atan2(Math.sin(a - face - 0.78), Math.cos(a - face - 0.78)), near = Math.abs(da) < 0.3;
      const rc = near ? 24.0 : 24.6, r = near ? 1.45 : 2.0, x = Math.sin(a) * rc, z = Math.cos(a) * rc, u = x * cs - z * sn, v = x * sn + z * cs;
      if (v > 0 && Math.abs(u) < 3.25 + r) continue; solids.push({ x: l.x + x, z: l.z + z, r }); } }
  // ---- the terrace parapet along the rim (inside the frost), broken for the stair ----
  { const n = 48, R = 23.2; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2, x = Math.sin(am) * R, z = Math.cos(am) * R, u = x * cs - z * sn, v = x * sn + z * cs;
    if (v > 0 && Math.abs(u) < 3.3) continue; const len = R * (a1 - a0) + 0.02;
    b.add(st, box(len, 1.8, 0.5), x, top - 1.23, z, am); b.add(trim, box(len + 0.04, 0.12, 0.62), x, top + 0.57, z, am); b.add(frost, box(len + 0.05, 0.03, 0.6), x, top + 0.69, z, am); } }
  // ---- the grand stair ----
  const v0 = PALE_ROCK.cut + 0.2, v1 = PALE_ROCK.gate - 1.4, LG = 1.8, N = 14, T = (v1 - v0 - LG) / N, rise = (top - (gy + 0.05)) / (N + 2);
  const foot = gy - 0.7, rockH = (s: number, v: number) => { const [x, z] = G(s * 3.9, v); return heightAt(l.x + x, l.z + z); };
  type Seg = { a: number; b: number; y: number; land?: boolean };
  const segs: Seg[] = [{ a: PALE_ROCK.cut - 2.4, b: v0, y: top, land: true }];
  for (let k = 0; k < 7; k++) segs.push({ a: v0 + k * T, b: v0 + (k + 1) * T, y: top - (k + 1) * rise });
  segs.push({ a: v0 + 7 * T, b: v0 + 7 * T + LG, y: top - 8 * rise, land: true });
  for (let k = 0; k < 7; k++) segs.push({ a: v0 + 7 * T + LG + k * T, b: v0 + 7 * T + LG + (k + 1) * T, y: top - (9 + k) * rise });
  const lantern = (u: number, v: number, y: number) => { const [x, z] = G(u, v);
    b.add(KEEP_IRON, cyl(0.05, 0.05, 0.5, 6), x, y, z); b.add(KEEP_IRON, box(0.36, 0.05, 0.36), x, y + 0.5, z, face); b.add(KEEP_LAMP, box(0.26, 0.38, 0.26), x, y + 0.55, z, face); b.add(KEEP_IRON, cone(0.27, 0.3, 4), x, y + 0.93, z, face + Math.PI / 4); b.add(FROST_CAP, cone(0.14, 0.1, 4), x, y + 1.13, z, face + Math.PI / 4); };
  const newel = (s: number, v: number, y: number, lamp: boolean) => { const [x, z] = G(s * (HALF + 0.38), v), h = 1.35;
    b.add(trim, box(0.95, y + h - foot, 0.95), x, foot, z, face); b.add(trim, box(1.12, 0.16, 1.12), x, y + h, z, face); b.add(FROST_CAP, box(1.13, 0.03, 1.13), x, y + h + 0.16, z, face);
    if (lamp) lantern(s * (HALF + 0.38), v, y + h + 0.16); else { b.add(trim, new THREE.SphereGeometry(0.3, 10, 6), x, y + h + 0.45, z); b.add(FROST_CAP, new THREE.SphereGeometry(0.31, 10, 4, 0, Math.PI * 2, 0, 1.0), x, y + h + 0.47, z); } };
  const vase = lathe([[0.12, 0], [0.065, 0.12], [0.06, 0.3], [0.13, 0.48], [0.07, 0.68], [0.1, 0.76]], 6);
  for (const sg of segs) { const vc = (sg.a + sg.b) / 2, d = sg.b - sg.a, [x, z] = G(0, vc);
    // tread block from below the meadow to the tread, a dressed nosing, frost in the corners against the walls
    if (!sg.land || sg.y < top - 0.01) b.add(trim, box(HALF * 2, sg.y - foot, d + 0.01), x, foot, z, face);
    else b.add(trim, box(HALF * 2, 0.3, d), x, sg.y - 0.3, z, face);
    if (!sg.land) { const [nx, nz] = G(0, sg.b - 0.05); b.add(st, box(HALF * 2, 0.08, 0.14), nx, sg.y - 0.06, nz, face); }
    for (const s of [-1, 1]) { const [fx, fz] = G(s * (HALF - 0.3), vc); b.add(frost, box(0.6, 0.015, d - 0.04), fx, sg.y, fz, face); }
    WALK.push({ x: l.x + x, z: l.z + z, y: sg.y, hw: HALF + 0.05, hd: d / 2 + 0.02, ry: face, cam: true });
    // the side walls: retaining walls cut into the rock up top, a balustrade on plinths below
    for (const s of [-1, 1]) { const [wx, wz] = G(s * (HALF + 0.35), vc), rh = Math.max(rockH(s, sg.a), rockH(s, sg.b)), cut = rh > sg.y + 0.4;
      if (cut) { const wt = Math.max(sg.y + 1.0, rh + 0.35); b.add(st, box(0.7, wt - foot, d + 0.01), wx, foot, wz, face); b.add(trim, box(0.86, 0.14, d + 0.02), wx, wt, wz, face); b.add(frost, box(0.88, 0.03, d + 0.03), wx, wt + 0.14, wz, face);
        // M32 · where the stair is cut into the rock: ivy spilling over the wall tops and down the inner faces, moss where wall meets tread
        for (let q = 0; q < 2; q++) if (rnd() < 0.7) { const vq = sg.a + rnd() * d, n = 2 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) { const [ix, iz] = G(s * (HALF + 0.02), vq + (rnd() - 0.5) * 0.25), yy = wt + 0.05 - k * 0.42 - rnd() * 0.12; if (yy < sg.y + 0.25) break;
          b.add(rnd() < 0.75 ? ivy : leaf, new THREE.IcosahedronGeometry(0.3 + rnd() * 0.16 - k * 0.04, 0).scale(0.28, 1.3, 1.1), ix, yy, iz, face); } }
        { const [mx, mz] = G(s * (HALF - 0.06), sg.a + rnd() * d); b.add(leaf, new THREE.IcosahedronGeometry(0.2 + rnd() * 0.1, 0).scale(0.7, 0.28, 1.6), mx, sg.y + 0.02, mz, face); } }
      else { b.add(st, box(0.7, sg.y + 0.22 - foot, d + 0.01), wx, foot, wz, face); b.add(trim, box(0.78, 0.1, d + 0.02), wx, sg.y + 0.22, wz, face);
        for (let q = 0; q < Math.max(1, Math.round(d / 0.34)); q++) { const [bx, bz] = G(s * (HALF + 0.35), sg.a + (q + 0.5) * d / Math.max(1, Math.round(d / 0.34))); b.add(trim, vase, bx, sg.y + 0.32, bz); }
        b.add(trim, box(0.5, 0.14, d + 0.02), wx, sg.y + 1.08, wz, face); b.add(frost, box(0.52, 0.03, d + 0.03), wx, sg.y + 1.22, wz, face); }
      // ivy over the outer face of the stair walls
      for (let q = 0; q < 2; q++) if (rnd() < 0.55) { const [ix, iz] = G(s * (HALF + 0.78), sg.a + rnd() * d); b.add(ivy, new THREE.IcosahedronGeometry(0.38 + rnd() * 0.25, 0).scale(0.45, 1.3, 1.2), ix, foot + 0.9 + rnd() * (sg.y - foot - 0.4), iz, face); } }
  }
  for (let v = PALE_ROCK.cut - 2.2; v <= v1 + 0.05; v += 0.45) for (const s of [-1, 1]) { const [x, z] = G(s * (HALF + 0.72), v); solids.push({ x: l.x + x, z: l.z + z, r: 0.72 }); } // thick and dense: no slipping between
  // newels: lanterns at the top landing and the stair foot, ball finials at the mid landing
  for (const s of [-1, 1]) { newel(s, v0 - 0.45, top, true); newel(s, v0 + 7 * T + 0.45, top - 8 * rise, false); newel(s, v0 + 7 * T + LG - 0.45, top - 8 * rise, false); newel(s, v1 - 0.45, gy + 0.05 + rise, true); }
  // planted terraces either side of the stair foot: two stepped beds with coping, hedge and frosted shrubs
  for (const s of [-1, 1]) for (const [u0, u1, va, vb, h] of [[3.4, 7.6, 25.7, 30.4, 0.75], [3.4, 5.6, 25.7, 28.2, 1.5]]) {
    const um = s * (u0 + u1) / 2, vm = (va + vb) / 2, [x, z] = G(um, vm), w = u1 - u0, dd = vb - va, hy0 = gy - 0.4;
    b.add(st, box(w, gy + h - hy0, dd), x, hy0, z, face); b.add(trim, box(w + 0.16, 0.12, dd + 0.16), x, gy + h, z, face); b.add(leaf, box(w - 0.5, 0.25, dd - 0.5), x, gy + h + 0.02, z, face);
    for (let k = 0; k < Math.round(w * dd / 4.4); k++) { const [cx, cz] = G(s * (u0 + 0.6 + rnd() * (w - 1.2)), va + 0.6 + rnd() * (dd - 1.2)); const g2 = new THREE.IcosahedronGeometry(0.45 + rnd() * 0.15, 1).scale(1, 0.8, 1); b.add(leaf, g2, cx, gy + h + 0.35, cz); b.add(FROST_CAP, new THREE.SphereGeometry(0.3, 6, 2, 0, Math.PI * 2, 0, 0.9), cx, gy + h + 0.55, cz); }
    for (let k = 0; k <= 3; k++) { const [cx, cz] = G(um, va + 0.3 + k * (dd - 0.6) / 3); solids.push({ x: l.x + cx, z: l.z + cz, r: w / 2 + 0.2 }); } }
}

/** M24 · the Wing Gate's gilded figure: a robed body with folds, shoulders, head, raised arms and feathered wings
 *  (three overlapping layers of tapered feathers along a curved span), frost along each wing's leading edge. */
function figure(b: Builder, gold: THREE.Material, frost: THREE.Material, x: number, Y: number, z: number, face: number) {
  const P = (g: THREE.BufferGeometry) => b.add(gold, g, x, Y, z, face), Fz = (g: THREE.BufferGeometry) => b.add(frost, g, x, Y, z, face);
  const robe = new THREE.LatheGeometry([[0.5, 0], [0.47, 0.25], [0.41, 0.7], [0.34, 1.15], [0.27, 1.45], [0.24, 1.6], [0.0, 1.62]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  { const p = robe.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), a = Math.atan2(pz, px), k = 1 + 0.075 * Math.sin(a * 7 + py * 1.3) * (1 - py / 1.7); p.setX(i, px * k); p.setZ(i, pz * k); } robe.computeVertexNormals(); }
  P(robe); P(new THREE.CylinderGeometry(0.2, 0.5, 0.12, 20).translate(0, 0.06, 0)); // hem
  P(new THREE.SphereGeometry(0.3, 14, 8).scale(1.25, 0.5, 0.75).translate(0, 1.66, 0)); P(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 8).translate(0, 1.86, 0));
  P(new THREE.SphereGeometry(0.15, 14, 10).scale(0.9, 1.1, 0.95).translate(0, 2.05, 0.01));
  const limb = (a: THREE.Vector3, c: THREE.Vector3, r0: number, r1: number) => { const d = c.clone().sub(a), g = new THREE.CylinderGeometry(r1, r0, d.length(), 7); g.translate(0, d.length() / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); P(g); };
  for (const s of [-1, 1]) { const sh = new THREE.Vector3(s * 0.33, 1.68, 0.02), el = new THREE.Vector3(s * 0.52, 2.08, 0.12), ha = new THREE.Vector3(s * 0.46, 2.52, 0.16);
    limb(sh, el, 0.075, 0.06); limb(el, ha, 0.06, 0.045); P(new THREE.SphereGeometry(0.06, 8, 6).translate(ha.x, ha.y + 0.03, ha.z));
    // wing: feathers hang from a curved arm, fanning outward toward the tip; three layers, longest at the back
    const arm = (t: number) => new THREE.Vector3(s * (0.18 + 1.55 * t), 1.72 + 0.95 * t - 0.3 * t * t, -0.18 - 0.38 * t);
    const feather = (L: number, W: number) => { const f = new THREE.Shape(); f.moveTo(-W * 0.5, 0); f.quadraticCurveTo(-W * 0.62, -L * 0.55, 0, -L); f.quadraticCurveTo(W * 0.62, -L * 0.55, W * 0.5, 0); f.lineTo(-W * 0.5, 0); return new THREE.ExtrudeGeometry(f, { depth: 0.025, bevelEnabled: false, curveSegments: 3 }); };
    for (const [n, t0, t1, l0, l1, w, dz] of [[9, 0.0, 1.0, 0.65, 1.45, 0.2, 0], [8, 0.0, 0.95, 0.42, 0.75, 0.2, 0.03], [7, 0.0, 0.9, 0.22, 0.36, 0.17, 0.06]] as const) for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * i / (n - 1), L = l0 + (l1 - l0) * Math.pow(t, 1.3), q = arm(t), g = feather(L, w);
      g.rotateZ(s * (0.08 + 1.05 * t * t)); g.rotateY(s * 0.42); g.translate(q.x, q.y + 0.02, q.z + dz); P(g); }
    for (let i = 0; i < 10; i++) { const t = i / 9, q = arm(t); Fz(new THREE.SphereGeometry(0.045, 6, 4).scale(2.2, 0.7, 1.2).translate(q.x, q.y + 0.05, q.z + 0.04)); } // frost on the leading edge
    for (let i = 5; i < 9; i++) { const t = i / 8, q = arm(t), L = 0.65 + 0.8 * Math.pow(t, 1.3), a = s * (0.08 + 1.05 * t * t); Fz(new THREE.SphereGeometry(0.04, 5, 4).translate(q.x + Math.sin(a) * L * 0.92, q.y - Math.cos(a) * L * 0.92, q.z + 0.03)); } // and on the long tips
  }
}
let _plaza: THREE.Texture | null = null;
/** M24 · the Wing Gate forecourt: gold paint over pale flags, swirl inlays, a pair of wings and rings, a little frost. */
function plazaTex(): THREE.Texture {
  if (_plaza) return _plaza; const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d')!;
  let sd = 9; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#cdbf9c'; x.fillRect(0, 0, N, N);
  for (let gy = 0; gy < N; gy += 64) for (let gx = 0; gx < N; gx += 64) { const o = (gy / 64) % 2 ? 32 : 0; x.fillStyle = `hsl(42, ${30 + r() * 15}%, ${62 + r() * 10}%)`; x.fillRect(gx + o + 2, gy + 2, 60, 60); }
  const C = N / 2; x.lineCap = 'round';
  const gold = (w: number, a = 1) => { x.strokeStyle = `rgba(196,150,58,${a})`; x.lineWidth = w; };
  gold(26); x.beginPath(); x.arc(C, C, N * 0.47, 0, Math.PI * 2); x.stroke(); gold(10); x.beginPath(); x.arc(C, C, N * 0.42, 0, Math.PI * 2); x.stroke();
  for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2; gold(14); x.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, a = a0 + t * 1.6, rr = N * (0.12 + t * 0.28); const px = C + Math.cos(a) * rr, py = C + Math.sin(a) * rr; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
  for (const s of [-1, 1]) for (let f = 0; f < 6; f++) { gold(18 - f * 2); x.beginPath(); x.moveTo(C, C + 30); x.quadraticCurveTo(C + s * (90 + f * 30), C - 40 - f * 18, C + s * (150 + f * 34), C - 120 - f * 22 + f * f * 6); x.stroke(); }
  x.fillStyle = 'rgba(196,150,58,1)'; x.beginPath(); x.arc(C, C, 70, 0, Math.PI * 2); x.fill(); x.fillStyle = '#cdbf9c'; x.beginPath(); x.arc(C, C, 40, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(240,246,250,${0.05 + r() * 0.18})`; const s = 2 + r() * 9; x.fillRect(r() * N, r() * N, s, s * (0.4 + r())); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; _plaza = tx; return tx;
}

/** Sunspire: sandstone causeway ring, slender lathe tower (Page profile), gilded crown + needle, amber crystal ring. */
function makeSunspire(l: Landmark, t: BuildTex, solids: Solid[], opts: LOpts): THREE.Group {
  const b = new Builder();
  const sand = triplanar(t.sand, 3, '#e7c98a', { ground: l.pad + 0.8 }), gold = new THREE.MeshStandardMaterial({ color: '#d9b24c', metalness: 0.9, roughness: 0.3 });
  addRimFill(gold, { fill: 0.15, rim: 0.4, rimColor: '#ffe3a0' });
  const y0 = l.pad;
  b.add(sand, cyl(24, 23, 1.6, 48), 0, y0 - 0.8, 0); WALK.push({ x: l.x, z: l.z, r: 23.4, y: y0 + 0.8 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add(sand, box(3.2, 0.9, 16), Math.sin(a) * 30, y0 - 0.6, Math.cos(a) * 30, a); WALK.push({ x: l.x + Math.sin(a) * 30, z: l.z + Math.cos(a) * 30, hw: 1.6, hd: 8, ry: a, y: y0 + 0.3 }); }
  const prof: [number, number][] = [[11, 4], [9.6, 8], [7.4, 14], [6.1, 22], [5.5, 34], [5.1, 46], [4.7, 56], [6.3, 60], [6.7, 63], [5.3, 66], [3.1, 70], [1.7, 78], [0.25, 88]];
  const sc = 0.62;
  b.add(sand, lathe([[12, 0], ...prof.slice(0, 8).map(([r, y]) => [r * 0.62, y * sc] as [number, number])], 32), 0, y0, 0);
  b.add(gold, lathe(prof.slice(7).map(([r, y]) => [r * 0.62, y * sc] as [number, number]), 32), 0, y0, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.add(sand, cyl(0.55, 0.45, 7.5, 8), Math.sin(a) * 8.6, y0 + 1, Math.cos(a) * 8.6); }
  b.add(gold, new THREE.TorusGeometry(9.2, 0.45, 8, 48).rotateX(Math.PI / 2), 0, y0 + 9, 0);
  // Pierced sunwheel on the crown.
  b.add(gold, new THREE.TorusGeometry(3.4, 0.28, 8, 40), 0, y0 + 60 * sc + 4, 0);
  // Detail pass: string courses, gilded window frames, a stair and arched door toward the meadow.
  const faceS = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z), rAt = (y: number) => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const [r0, y0p] = prof[i - 1], [r1, y1p] = prof[i]; return (r0 + (r1 - r0) * (y - y0p) / (y1p - y0p)) * 0.62; } return 1; };
  for (const yy of [14, 26, 40, 52]) b.add(sand, new THREE.TorusGeometry(rAt(yy) + 0.15, 0.32, 6, 40).rotateX(Math.PI / 2), 0, y0 + yy * sc, 0);
  for (let i = 0; i < 4; i++) { const sx = Math.sin(faceS), sz = Math.cos(faceS); b.add(sand, box(6.5, 0.45, 1.6), sx * (24.6 + i * 1.5), y0 - 0.8 - i * 0.45 + 0.35, sz * (24.6 + i * 1.5), faceS); WALK.push({ x: l.x + sx * (24.6 + i * 1.5), z: l.z + sz * (24.6 + i * 1.5), hw: 3.25, hd: 0.8, ry: faceS, y: y0 - i * 0.45 }); }
  const doorR = rAt(6) + 0.2; b.add(gold, new THREE.TorusGeometry(1.7, 0.22, 6, 20, Math.PI), Math.sin(faceS) * doorR, y0 + 3.2, Math.cos(faceS) * doorR, faceS);
  solids.push({ x: l.x, z: l.z, r: 10.5 });
  const g = b.build();
  const winMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: '#ffb35c', emissiveIntensity: 1.1, roughness: 0.6 });
  const wg: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 18; k++) {
    const yy = 10 + k * 2.55, a = k * 2.4 + faceS, r = rAt(yy) + 0.05;
    const w = new THREE.PlaneGeometry(0.7, 1.7); w.rotateY(a); w.translate(Math.sin(a) * r, y0 + yy * sc, Math.cos(a) * r); wg.push(w);
  }
  const dr = new THREE.PlaneGeometry(3.0, 3.2); dr.rotateY(faceS); dr.translate(Math.sin(faceS) * (doorR + 0.05), y0 + 1.6, Math.cos(faceS) * (doorR + 0.05)); wg.push(dr);
  g.add(new THREE.Mesh(mergeGeometries(wg), winMat));
  // Braziers and hanging banners on the colonnade.
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb04a', toneMapped: false });
  const bronze = new THREE.MeshStandardMaterial({ color: '#6b4a2a', metalness: 0.7, roughness: 0.45 });
  for (let i = 0; i < 4; i++) {
    const a = faceS + (i - 1.5) * 0.5 + (i > 1 ? Math.PI * 0.6 : -Math.PI * 0.6) * 0, rr = 20;
    const bx = Math.sin(faceS + (i - 1.5) * 0.42) * rr, bz = Math.cos(faceS + (i - 1.5) * 0.42) * rr; void a;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.2, 8), bronze); stand.position.set(bx, y0 + 1.1, bz);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.6, 12), bronze); bowl.position.set(bx, y0 + 2.4, bz);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), flameMat); fl.position.set(bx, y0 + 3.3, bz); fl.userData.flicker = Math.random() * 6;
    g.add(stand, bowl, fl); solids.push({ x: l.x + bx, z: l.z + bz, r: 0.9 });
  }
  const cloth = new THREE.MeshStandardMaterial({ color: '#b5562a', side: THREE.DoubleSide, roughness: 0.85, emissive: '#5a1f08', emissiveIntensity: 0.25 });
  // M20b: banners hang on the outer face of every other column from a gilded rod (they used to float between columns and read edge-on as a red line in the sky).
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.6), cloth); bn.position.set(Math.sin(a) * 9.18, y0 + 6.3, Math.cos(a) * 9.18); bn.rotation.y = a; g.add(bn);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6).rotateZ(Math.PI / 2).rotateY(a), gold); rod.position.set(Math.sin(a) * 9.22, y0 + 8.15, Math.cos(a) * 9.22); g.add(rod); }
  if (opts.lights) { const pl = new THREE.PointLight('#ffb35c', 40, 26, 2); pl.position.set(Math.sin(faceS) * (doorR + 3), y0 + 3, Math.cos(faceS) * (doorR + 3)); g.add(pl); }
  const amber = new THREE.MeshStandardMaterial({ color: '#c7832c', emissive: '#6e3206', emissiveIntensity: 0.4, roughness: 0.22, metalness: 0.15, flatShading: true }); // M20b: faceted, opaque — read as crystal, not as a glowing VFX cone
  const cg: THREE.BufferGeometry[] = [], rocks: THREE.BufferGeometry[] = [];
  const ring = [[0, 38, 18, 26], [0.8, 42, 14, 32], [1.6, 36, 16, 22], [2.4, 44, 15, 28], [3.2, 40, 17, 24], [4.0, 38, 13, 30], [4.8, 42, 15, 20], [5.6, 36, 14, 27]];
  for (const [a, r, s, h] of ring) {
    for (let k = 0; k < 3; k++) {
      const H = h * 0.11 * (1 - k * 0.25); const o = new THREE.OctahedronGeometry(1, 0); o.scale(s * 0.068, H * 0.9, s * 0.068); o.rotateZ((k - 1) * 0.3);
      o.translate(Math.sin(a) * r * 0.5 + (k - 1) * 0.75, y0 + H * 0.55, Math.cos(a) * r * 0.5); cg.push(o);
    }
    solids.push({ x: l.x + Math.sin(a) * r * 0.5, z: l.z + Math.cos(a) * r * 0.5, r: 1.3 });
    const rk = new THREE.DodecahedronGeometry(1.25, 0); rk.scale(1.2, 0.55, 1); rk.translate(Math.sin(a) * r * 0.5, y0 + 0.15, Math.cos(a) * r * 0.5); rocks.push(rk); // rock socket the cluster grows from
  }
  { const rm = new THREE.Mesh(mergeGeometries(rocks), new THREE.MeshStandardMaterial({ color: '#6d5a44', roughness: 0.95, flatShading: true })); rm.receiveShadow = true; g.add(rm); }
  const crystals = new THREE.Mesh(mergeGeometries(cg), amber); crystals.castShadow = true; g.add(crystals);
  g.position.set(l.x, 0, l.z); g.name = l.id;
  return g;
}

/** Iron Dome (the foundry): stone drum, riveted rust-iron dome with ribs, lantern oculus, chimneys and a glowing forge mouth. */
function makeIronDome(l: Landmark, t: BuildTex, solids: Solid[], opts: LOpts): THREE.Group {
  const b = new Builder();
  const stone = triplanar(t.sand, 2.6, '#a59a88', { ground: l.pad }), iron = triplanar(t.metal, 2.4, '#b9a89a', { metal: 0.65, rough: 0.9 });
  const y0 = l.pad, R = 15;
  b.add(stone, cyl(R + 1.2, R + 0.8, 7, 40), 0, y0, 0);
  b.add(iron, new THREE.SphereGeometry(R, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), 0, y0 + 7, 0);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) { const p = k / 12 * Math.PI / 2 * 0.93; pts.push(new THREE.Vector3(Math.sin(a) * Math.cos(p) * (R + 0.25), Math.sin(p) * (R + 0.25), Math.cos(a) * Math.cos(p) * (R + 0.25))); }
    b.add(iron, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.32, 6), 0, y0 + 7, 0);
  }
  b.add(stone, cyl(3.4, 3.0, 3.2, 16), 0, y0 + 7 + R - 0.6, 0);
  b.add(iron, cone(4.0, 2.4, 16), 0, y0 + 7 + R + 2.6, 0);
  for (const [cx, cz, h] of [[-9, 6, 30], [8, 8, 26]]) { b.add(stone, cyl(1.7, 1.4, h, 12), cx, y0, cz); b.add(iron, cyl(1.9, 1.9, 1, 12), cx, y0 + h, cz); }
  const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z);
  // Detail pass: riveted iron bands, buttresses, a stone arch around the forge mouth, a pipe to the chimney.
  b.add(iron, new THREE.TorusGeometry(R + 0.95, 0.4, 6, 48).rotateX(Math.PI / 2), 0, y0 + 7, 0);
  b.add(iron, new THREE.TorusGeometry(R + 1.3, 0.3, 6, 48).rotateX(Math.PI / 2), 0, y0 + 0.6, 0);
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face))) < 0.4) continue; b.add(stone, box(1.6, 6.2, 2.2), Math.sin(a) * (R + 1.6), y0, Math.cos(a) * (R + 1.6), a); }
  b.add(stone, new THREE.TorusGeometry(3.3, 0.7, 8, 20, Math.PI).scale(1, 1.45, 1), Math.sin(face) * (R + 1.5), y0, Math.cos(face) * (R + 1.5), face);
  b.add(iron, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-5, 4.5, 3.4), new THREE.Vector3(-7.5, 8, 5), new THREE.Vector3(-9, 9, 6)]), 12, 0.5, 8), 0, y0 + 7, 0);
  solids.push({ x: l.x, z: l.z, r: R + 2.4 });
  const g = b.build();
  // Glowing arched windows around the drum.
  const winMat = new THREE.MeshStandardMaterial({ color: '#2a140a', emissive: '#ff8a3a', emissiveIntensity: 1.25, roughness: 0.7 });
  const wg: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face))) < 0.3) continue; const w = new THREE.CircleGeometry(0.9, 12, 0, Math.PI); w.scale(1, 1.9, 1); const q = new THREE.PlaneGeometry(1.8, 1.4); q.translate(0, -0.7, 0); const wm = mergeGeometries([w.toNonIndexed().deleteAttribute('uv') as THREE.BufferGeometry, q.toNonIndexed().deleteAttribute('uv') as THREE.BufferGeometry]); wm.rotateY(a); wm.translate(Math.sin(a) * (R + 1.25), y0 + 4, Math.cos(a) * (R + 1.25)); wg.push(wm); }
  g.add(new THREE.Mesh(mergeGeometries(wg), winMat));
  // Yard props: anvil, barrels, crates, coal heap, ore cart.
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2e', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#2f2a28', metalness: 0.6, roughness: 0.55 }), coal = new THREE.MeshStandardMaterial({ color: '#1d1b1a', roughness: 1 });
  const fx = Math.sin(face), fz = Math.cos(face), sx = Math.cos(face), sz = -Math.sin(face);
  const at = (f: number, s2: number) => [fx * f + sx * s2, fz * f + sz * s2] as const;
  const add = (m: THREE.Mesh, f: number, s2: number, y: number) => { const [x, z] = at(f, s2); m.position.set(x, y0 + y, z); m.castShadow = true; g.add(m); solids.push({ x: l.x + x, z: l.z + z, r: 0.9 }); return m; };
  add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.7), dark), R + 5, 4, 0.45); add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.6), dark), R + 5, 4, 1.05);
  for (const [f, s2] of [[R + 3, -5], [R + 3.6, -6.2], [R + 2.3, -6.3]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.2, 12), wood), f, s2, 0.6); }
  for (const [f, s2, k] of [[R + 2.5, 6.5, 1], [R + 2.5, 7.8, 0.8]]) { const c = add(new THREE.Mesh(new THREE.BoxGeometry(1.1 * k, 1.1 * k, 1.1 * k), wood), f, s2, 0.55 * k); c.rotation.y = f * 0.3; }
  const heap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 10), coal); add(heap, R + 2.2, -8.6, 0.55);
  // Chimney smoke + door light.
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTex(), color: '#8d8a86', transparent: true, depthWrite: false, opacity: 0.5 });
  const puffs: THREE.Sprite[] = [];
  for (const [cx, cz, h] of [[-9, 6, 30], [8, 8, 26]]) for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(smokeMat.clone()); sp.userData = { cx, cz, h, k }; puffs.push(sp); g.add(sp); }
  if (opts.lights) { const pl = new THREE.PointLight('#ff9a4a', 60, 28, 2); pl.position.set(fx * (R + 4), y0 + 2.5, fz * (R + 4)); g.add(pl); }
  g.userData.tick = (time: number) => { for (const sp of puffs) { const { cx, cz, h, k } = sp.userData; const f = ((time * 0.18 + k / 5) % 1); sp.position.set(cx + f * 3, y0 + h + 1.5 + f * 12, cz + f * 1.5); sp.scale.setScalar(2 + f * 7); (sp.material as THREE.SpriteMaterial).opacity = 0.45 * Math.sin(f * Math.PI); } };
  const ember = new THREE.MeshBasicMaterial({ color: '#ffb066', toneMapped: false });
  const door = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24, 0, Math.PI), ember); door.scale.set(1, 1.6, 1);
  door.position.set(Math.sin(face) * (R + 1.25), y0, Math.cos(face) * (R + 1.25)); door.rotation.y = face; g.add(door);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcf80', toneMapped: false }));
  glow.position.y = y0 + 7 + R + 0.4; g.add(glow);
  for (const [cx, cz, h] of [[-9, 6, 30], [8, 8, 26]]) { const e = new THREE.Mesh(new THREE.CircleGeometry(1.35, 12).rotateX(-Math.PI / 2), ember); e.position.set(cx, y0 + h + 1.02, cz); g.add(e); }
  g.position.set(l.x, 0, l.z); g.name = l.id;
  return g;
}

/** Veilfall: weathered rock bluff with an overhanging lip, a domed rotunda on top, and a falls ribbon into a pool. */
function makeVeilfall(l: Landmark, t: BuildTex, solids: Solid[], opts: LOpts): { group: THREE.Group; update: (time: number) => void } {
  const b = new Builder();
  const rock = triplanar(t.rock, 4, '#b8ab96', { ground: l.pad }), sand = triplanar(t.sand, 2.2, '#e2d2b0');
  const teal = new THREE.MeshStandardMaterial({ color: '#5f9a88', metalness: 0.5, roughness: 0.45 }); addRimFill(teal, { fill: 0.15, rim: 0.35 });
  const y0 = l.pad;
  const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z);
  const blobs: [number, number, number, number, number, number][] = [[0, 9, -2, 15, 11, 13], [-4, 18, -4, 11, 9, 10], [5, 14, -6, 10, 10, 9], [9, 6, 4, 8, 7, 7], [-10, 6, 3, 9, 7, 8], [2, 24, -3, 9, 5, 8], [-6, 3, -12, 10, 6, 9]];
  for (const [x, y, z, sx, sy, sz] of blobs) {
    const gm = new THREE.IcosahedronGeometry(1, 4); const p = gm.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + 0.18 * Math.sin(v.x * 5 + v.y * 3) * Math.sin(v.z * 4 + 1) + 0.08 * Math.sin(v.y * 11); p.setXYZ(i, v.x * sx * n, v.y * sy * n, v.z * sz * n); }
    const sm = mergeVertices(gm.deleteAttribute('normal').deleteAttribute('uv')); sm.computeVertexNormals(); b.add(rock, sm, x, y0 + y, z); // welded → smooth shading (no facets)
  }
  const top = y0 + 29;
  b.add(sand, cyl(7.5, 7.2, 1.4, 32), 0, top - 1, -3);
  const prof: [number, number][] = [[11.6, 37], [11.8, 38.6], [10.2, 39.6], [10.2, 49.6], [11.3, 50.4], [11.3, 52], [9.6, 53], [8.2, 57], [6, 60.2], [3.2, 62.2], [0.05, 62.8]];
  const sc = 0.5;
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; b.add(sand, cyl(0.45, 0.4, (49.6 - 38.8) * sc, 10), Math.cos(a) * 11.2 * sc, top + (38.8 - 37) * sc, -3 + Math.sin(a) * 11.2 * sc); }
  b.add(sand, lathe(prof.slice(0, 3).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  b.add(sand, lathe(prof.slice(4, 6).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  b.add(teal, lathe(prof.slice(5).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  // Detail pass: entablature + base steps on the rotunda, a carved stair up the bluff's flank, boulders ringing the pool.
  b.add(sand, new THREE.TorusGeometry(10.6 * sc, 0.28, 6, 40).rotateX(Math.PI / 2), 0, top + (49.6 - 37) * sc + 0.2, -3);
  for (let i = 0; i < 3; i++) b.add(sand, cyl(7.9 + i * 0.7, 7.9 + i * 0.7, 0.4, 32), 0, top - 1.4 - i * 0.4, -3);
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.09) * (i % 2 ? 1 : -1), rr = 7.2 + (i % 3) * 0.6; const gm = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv')); gm.computeVertexNormals(); gm.scale(1.2 + (i % 3) * 0.4, 0.8 + (i % 2) * 0.4, 1.1); b.add(rock, gm, Math.sin(a) * rr, y0 + 0.2, 15 + Math.cos(a) * rr); }
  solids.push({ x: l.x, z: l.z - 2, r: 14 });
  const g = b.build(); g.rotation.y = face;
  // Lantern posts at the pool and a teal glow inside the rotunda.
  const post = new THREE.MeshStandardMaterial({ color: '#3b3128', roughness: 0.8 }), lamp = new THREE.MeshBasicMaterial({ color: '#bff3e6', toneMapped: false });
  for (const sx of [-8.5, 8.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 8), post); p.position.set(sx, y0 + 1.6, 19); const lp = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), lamp); lp.position.set(sx, y0 + 3.4, 19); g.add(p, lp); }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: '#8ff0d8', toneMapped: false })); orb.position.set(0, top + 2.4, -3); g.add(orb);
  if (opts.lights) { const pl = new THREE.PointLight('#8ff0d8', 30, 22, 2); pl.position.set(0, top + 3, -3); g.add(pl); }
  // Mist where the falls hit the pool.
  const mistMat = new THREE.SpriteMaterial({ map: smokeTex(), color: '#eaf7ff', transparent: true, depthWrite: false, opacity: 0.35 });
  const mist: THREE.Sprite[] = []; for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(mistMat.clone()); sp.userData.k = k; mist.push(sp); g.add(sp); }
  // Falls: from the lip (front face toward spawn) down into a pool.
  const fallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){float s=n(vec2(vUv.x*12.,vUv.y*4.+uTime*2.6))*.6+n(vec2(vUv.x*26.,vUv.y*8.+uTime*3.4))*.4;
        float edge=smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x);
        gl_FragColor=vec4(mix(vec3(.62,.84,.92),vec3(1.),s),edge*(.5+.5*s)*.9);}`,
  });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6, 24, 1, 8), fallMat);
  // Slight outward curve of the sheet.
  const fp = fall.geometry.attributes.position; for (let i = 0; i < fp.count; i++) { const yy = fp.getY(i); fp.setZ(i, Math.pow((12 - yy) / 24, 2) * 3); } fall.geometry.computeVertexNormals();
  fall.position.set(0, y0 + 13.5, 10.5); g.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2b5a62', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }));
  pool.position.set(0, y0 + 0.25, 15); g.add(pool);
  const foam = new THREE.Mesh(new THREE.RingGeometry(1.5, 4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2fbff', map: brokenFoamTex(), transparent: true, opacity: 0.8, depthWrite: false }));
  foam.position.set(0, y0 + 0.3, 12.5); g.add(foam);
  g.position.set(l.x, 0, l.z); g.name = l.id;
  return { group: g, update: (time) => { fallMat.uniforms.uTime.value = time; foam.scale.setScalar(1 + Math.sin(time * 3) * 0.05); foam.rotation.y = time * 0.05; orb.scale.setScalar(1 + Math.sin(time * 1.7) * 0.08);
    for (const sp of mist) { const k = sp.userData.k as number, f = (time * 0.25 + k / 6) % 1; sp.position.set(Math.sin(k * 2.1) * 2.5, y0 + 0.8 + f * 4, 12.5 + Math.cos(k * 1.7) * 1.5); sp.scale.setScalar(3 + f * 4); (sp.material as THREE.SpriteMaterial).opacity = 0.32 * Math.sin(f * Math.PI); } } };
}

export type LOpts = { lights: boolean };
let _smoke: THREE.Texture | null = null;
/** Soft round puff, drawn on a canvas (procedural, no asset). */
function smokeTex(): THREE.Texture {
  if (_smoke) return _smoke;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); _smoke = new THREE.CanvasTexture(c); return _smoke;
}

export function makeLandmarks(t: BuildTex, solids: Solid[], opts: LOpts = { lights: true }): { group: THREE.Group; update: (time: number) => void } {
  const grp = new THREE.Group(); const updates: ((time: number) => void)[] = [];
  const by = (id: string) => LANDMARKS.find((l) => l.id === id)!;
  grp.add(makeKeep(by('pale'), t, '#3a8f48', '#f6e2b4', '#e9e4d4', solids)); // M24: dark-green scale roofs, cream-to-pale stone
  grp.add(makeKeep(by('azure'), t, '#3f78b5', '#d9dde0', '#4fa3e0', solids));
  const sun = makeSunspire(by('sunspire'), t, solids, opts); grp.add(sun);
  const dome = makeIronDome(by('dome'), t, solids, opts); grp.add(dome); updates.push(dome.userData.tick);
  const flames: THREE.Object3D[] = []; sun.traverse((o) => { if (o.userData.flicker !== undefined) flames.push(o); });
  updates.push((time) => { for (const f of flames) f.scale.set(1, 0.85 + 0.25 * Math.sin(time * 9 + f.userData.flicker) * Math.sin(time * 5.3 + f.userData.flicker * 2), 1); });
  const vf = makeVeilfall(by('veilfall'), t, solids, opts); grp.add(vf.group); updates.push(vf.update);
  const op = makeOpening(t, solids); grp.add(op.group); updates.push(op.update); // M26 · the opening path: ridge stair, water-cut falls, quarry track, the three-pier bridge
  const flags: THREE.Mesh[] = []; grp.traverse((o) => { if (o.userData.flag) flags.push(o as THREE.Mesh); });
  for (const f of flags) { const p = f.geometry.attributes.position; f.userData.base = Float32Array.from(p.array as Float32Array); }
  updates.push((time) => {
    for (const f of flags) { const p = f.geometry.attributes.position, base = f.userData.base as Float32Array; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 1.4 - time * 4) * 0.25 * (x + 2.25) / 4.5); } p.needsUpdate = true; }
  });
  return { group: grp, update: (time) => { for (const u of updates) u(time); } };
}

/** G3: churned, broken foam for the basin ring: soft blobs and streaks, dense at the fall and thinning outward with gaps. */
function brokenFoamTex(): THREE.Texture {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d')!;
  let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  x.clearRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) {
    const rr = 0.36 + Math.pow(r(), 1.6) * 0.62, a = r() * Math.PI * 2; // in ring radius fraction (inner 1.5/4.2 = .36)
    const gap = Math.sin(a * 5 + rr * 9) * 0.5 + Math.sin(a * 11 - rr * 4) * 0.3; if (gap > 0.35 && r() < 0.8) continue; // open water lanes
    const px = N / 2 + Math.cos(a) * rr * N / 2, py = N / 2 + Math.sin(a) * rr * N / 2, sz = (2 + r() * 9) * (1.25 - rr * 0.7);
    const al = (0.12 + r() * 0.35) * (1.15 - rr);
    const gr = x.createRadialGradient(px, py, 0, px, py, sz); gr.addColorStop(0, `rgba(255,255,255,${al.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, sz * (1.3 + r()), sz, a + Math.PI / 2, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}


/** M26 · the opening path, per the Author's map. South of the meadow: the ridge stair (rough-hewn treads in a shallow trench
 *  with cheek stones), the quarry cut into the ridge's north face as three stepped benches of sawn stone with the water-cut
 *  falls stepping down them into a pool, stepping stones where the quarry track crosses the stream, hazel along the track
 *  and a small wandering orchard. On the road north-west: a narrow three-pier stone bridge over the creek. */
/** M28 · fern spots at the quarry (filled by makeOpening; main.ts plants the fern asset). */
export const FERN_SPOTS: { x: number; y: number; z: number; s: number; ry: number }[] = [];
function makeOpening(t: BuildTex, solids: Solid[]): { group: THREE.Group; update: (time: number) => void } {
  const b = new Builder(); let sd = 77; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const hewn = triplanar(t.rock, 2.2, '#b5ab9a', { sat: 0.35, gain: 1.7, rough: 0.92 });
  const fruitR = new THREE.MeshStandardMaterial({ color: '#b8352a', roughness: 0.5 }), fruitY = new THREE.MeshStandardMaterial({ color: '#d4b23c', roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6a5139', roughness: 0.9 });
  const nose = triplanar(t.rock, 1.8, '#e6dece', { sat: 0.3, gain: 1.85, rough: 0.85, emissive: '#1a1813' }), drill = new THREE.MeshStandardMaterial({ color: '#4a4436', roughness: 1 });
  const update: ((time: number) => void)[] = [];
  // ---- the ridge stair: up the north face of the ridge (south out of the meadow) ----
  { const x = RSTAIR.x, yb = heightAt(x, RSTAIR.z0 - 0.3), yt = heightAt(x, RSTAIR.z1 + 0.3), N = Math.max(8, Math.round((yt - yb) / 0.27)), T = (RSTAIR.z1 - RSTAIR.z0) / N, foot = yb - 0.6;
    for (let k = 0; k < N; k++) { const z0 = RSTAIR.z0 + k * T, z1 = z0 + T, ground = Math.max(heightAt(x, z1), heightAt(x - 1.1, z1), heightAt(x + 1.1, z1));
      const top = Math.max(yb + (k + 1) * (yt - yb) / N, ground + 0.04), w = RSTAIR.half * 2 - 0.1 + (rnd() - 0.5) * 0.25;
      b.add(hewn, box(w, top - foot, T + 0.06), x + (rnd() - 0.5) * 0.12, foot, (z0 + z1) / 2, (rnd() - 0.5) * 0.04);
      WALK.push({ x, z: (z0 + z1) / 2, y: top, hw: RSTAIR.half, hd: T / 2 + 0.01, ry: 0, cam: true });
      b.add(nose, box(w - 0.08, 0.06, 0.16), x, top - 0.035, z0 + 0.08); b.add(drill, box(w - 0.1, Math.min(0.2, top - foot - 0.1), 0.03), x, top - 0.26, z0 - 0.025); // M27: a pale worn nosing over a shadowed riser line
      if (k % 2 === 0) for (const s of [-1, 1]) { const gx = x + s * (RSTAIR.half + 0.35); b.add(hewn, new THREE.DodecahedronGeometry(0.42 + rnd() * 0.18, 0).scale(1, 0.75, 1.2), gx, heightAt(gx, z0) + 0.12, z0 + rnd() * T, rnd() * 3); } }
    // M27 · a waymark cairn at the stair head, readable from the meadow
    { const cx = x - RSTAIR.half - 1.3, cz = RSTAIR.z1 + 0.6; let cy = heightAt(cx, cz) - 0.05; for (let k = 0; k < 7; k++) { const r = 0.55 - k * 0.06, hh = 0.26 - k * 0.012; b.add(nose, new THREE.DodecahedronGeometry(r, 0).scale(1, hh / r, 1.1), cx + (rnd() - 0.5) * 0.1, cy + hh * 0.8, cz + (rnd() - 0.5) * 0.1, rnd() * 3); cy += hh * 1.5; } solids.push({ x: cx, z: cz, r: 0.6 }); }
    // a waymark post at the foot and the top
    for (const [zz, yy] of [[RSTAIR.z0 - 1.0, yb], [RSTAIR.z1 + 0.9, yt]]) { b.add(wood, box(0.22, 1.5, 0.22), x + RSTAIR.half + 0.5, yy - 0.1, zz); b.add(wood, box(0.7, 0.18, 0.08), x + RSTAIR.half + 0.62, yy + 1.15, zz, 0.15); } }
  // ---- the quarry: three benches of sawn stone stepping back into the ridge face, the water-cut falls down a notch ----
  const yf = heightAt(POOL.x, POOL.z + POOL.r + 0.6), QX = (QUARRY.x0 + QUARRY.x1) / 2, QW = QUARRY.x1 - QUARRY.x0, BENCH = 3;
  const benchTop: number[] = [], benchFront: number[] = [];
  // M27 · weathered quarry stone: moss on the tops and creeping down the joints, lichen blots, rain streaks, chisel striations,
  // and damp darkening (glossier) close to the water-cut and the pool. Per pixel, so no extra geometry.
  const weather = (m: THREE.MeshStandardMaterial, wetX: number): THREE.MeshStandardMaterial => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 n = normalize(vTN); float up = smoothstep(.5, .88, n.y), side = 1. - up;
    float mn = tVn(vTW.xz * 1.6) * .6 + tVn(vTW.xz * 5.1) * .4;
    float moss = up * smoothstep(.4, .64, mn) + side * smoothstep(.66, .82, tVn(vec2(vTW.x + vTW.z, vTW.y) * 2.4)) * .7;
    float lich = side * smoothstep(.8, .86, tVn(vTW.xy * 6.3 + vTW.zy * 5.7));
    float streak = side * smoothstep(.45, .85, tVn(vec2((vTW.x + vTW.z) * 5.5, vTW.y * .35)));
    float chis = side * (.5 + .5 * sin((vTW.x + vTW.z) * 31. + vTW.y * 23. + tVn(vTW.xy * 3.) * 4.)) * smoothstep(.35, .7, tVn(vTW.zy * 1.3 + vTW.xy * 1.1));
    float wet = max(1. - smoothstep(.7, 2.6, abs(vTW.x - (${wetX.toFixed(2)}))), 1. - smoothstep(.0, 1.3, vTW.y - (${(WATER_Y).toFixed(2)})));
    wet = clamp(wet * (.7 + .5 * smoothstep(.35, .75, tVn(vec2(vTW.x * 7., vTW.y * .45)))) + side * (1. - smoothstep(.75, 1.9, abs(vTW.x - (${wetX.toFixed(2)})))) * .35, 0., 1.); // M28: water-stained runs under the lips
    vec3 mc = mix(vec3(.2, .3, .1), vec3(.36, .42, .16), tVn(vTW.xz * 9.));
    diffuseColor.rgb *= 1. - .18 * streak - .1 * chis;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.74, .73, .52), lich * .55);
    diffuseColor.rgb = mix(diffuseColor.rgb, mc, clamp(moss * (1. + .6 * wet), 0., 1.));
    diffuseColor.rgb *= 1. - .48 * wet; roughnessFactor = mix(roughnessFactor, .22, wet * .85); }`); }; return m; };
  const qstone = weather(triplanar(t.rock, 2.4, '#c4b8a0', { sat: 0.4, gain: 1.65, rough: 0.9, emissive: '#16140f' }), QX);
  for (let k = 0; k < BENCH; k++) { const zf = POOL.z + POOL.r + 0.5 + k * 2.1, yTop = yf + 0.6 + (k + 1) * 1.75; benchTop.push(yTop); benchFront.push(zf);
    const notch = 1.4; // the water-cut: a notch down the middle of each bench
    for (const side of [-1, 1]) { const w = QW / 2 - notch / 2 - k * 0.6, x0 = QX + side * notch / 2, x1 = QX + side * (notch / 2 + w), back = k + 1 < BENCH ? POOL.z + POOL.r + 0.5 + (k + 1) * 2.1 + 0.3 : 64;
      b.add(qstone, box(w, yTop - 0.25 - (yf - 1.2), 64 - zf - 0.9), (x0 + x1) / 2, yf - 1.2, (zf + 0.9 + 64) / 2); // the core behind the face blocks
      // the face: courses of sawn blocks of varied length and height, a little proud or sunk, one or two pulled out
      let yc = yf - 1.2; const courses: number[] = []; while (yc < yTop - 0.3) { const hh = Math.min(0.5 + rnd() * 0.45, yTop - yc); courses.push(hh); yc += hh; } courses[courses.length - 1] += yTop - yc;
      yc = yf - 1.2; courses.forEach((hh, ci) => { let xc = Math.min(x0, x1); const xe = Math.max(x0, x1); while (xc < xe - 0.05) { const L = Math.min(0.7 + rnd() * 1.3, xe - xc); const out = (rnd() - 0.5) * 0.12, gone = ci === courses.length - 1 && rnd() < 0.18;
          if (!gone) { const top = ci === courses.length - 1 ? hh - 0.04 - rnd() * 0.12 : hh - 0.025; b.add(qstone, box(L - 0.035, top, 1.0 + rnd() * 0.25), xc + L / 2, yc, zf + 0.5 - out + 0.02, (rnd() - 0.5) * 0.03); }
          else b.add(qstone, new THREE.DodecahedronGeometry(0.28, 0).scale(1.3, 0.7, 1), xc + L / 2, yc + 0.12, zf + 0.25, rnd() * 3);
          if (rnd() < 0.3 && L > 0.9) for (let d = 0.2; d < L - 0.1; d += 0.24) b.add(drill, cyl(0.028, 0.028, Math.min(0.75, hh), 5), xc + d, yc + Math.max(0, hh - 0.75), zf - out + 0.02); // half-drill (plug-and-feather) marks
          xc += L; } yc += hh; });
      void back; }
    b.add(qstone, box(notch + 0.1, yTop - 0.35 - (yf - 1.2), 64 - zf), QX, yf - 1.2, (zf + 64) / 2); // the notch floor, worn lower
    for (let i = 0; i < 5; i++) { const s2 = 0.35 + rnd() * 0.75; b.add(qstone, box(s2 * (1.2 + rnd()), s2 * 0.8, s2 * (1 + rnd() * 0.5)), QUARRY.x0 + 0.8 + rnd() * (QW - 1.6), yTop - 0.08, zf + 0.6 + rnd() * 1.0, rnd()); } }
  // loose cut blocks and a timber hoist on the quarry floor
  for (let i = 0; i < 6; i++) { const bx = QUARRY.x0 - 1.5 + rnd() * (QW + 3), bz = POOL.z - 3 - rnd() * 3; if (Math.hypot(bx - POOL.x, bz - POOL.z) < POOL.r + 1.8) continue; b.add(qstone, box(1.0 + rnd() * 0.7, 0.55 + rnd() * 0.5, 0.8 + rnd() * 0.5), bx, heightAt(bx, bz) - 0.1, bz, rnd() * 3); solids.push({ x: bx, z: bz, r: 0.75 }); }
  { const hx = QUARRY.x1 - 1.2, hz = POOL.z + 1.8, hy = heightAt(hx, hz); for (const dx of [-0.9, 0.9]) b.add(wood, box(0.22, 4.2, 0.22), hx + dx, hy - 0.2, hz); b.add(wood, box(2.4, 0.22, 0.22), hx, hy + 3.9, hz); b.add(wood, box(0.22, 0.22, 2.6), hx, hy + 3.7, hz - 1.0);
    b.add(KEEP_IRON, cyl(0.02, 0.02, 2.2, 4), hx, hy + 1.5, hz - 2.2); solids.push({ x: hx - 0.9, z: hz, r: 0.35 }, { x: hx + 0.9, z: hz, r: 0.35 }); }
  { const topAt = (z: number, notch: boolean) => { let y = -9; for (let k = 0; k < BENCH; k++) if (z >= benchFront[k]) y = Math.max(y, benchTop[k] - (notch ? 0.35 : 0)); return y; };
    for (let x = QUARRY.x0 - 0.2; x <= QUARRY.x1 + 0.2; x += 0.8) for (let z = benchFront[0] + 0.4; z < 64; z += 0.8) { if (topAt(z, Math.abs(x - QX) < 0.75) - heightAt(x, z) > 0.3) solids.push({ x, z, r: 0.6 }); } } // the sawn benches stand proud of the ridge: keep feet out of them
  for (let k = 0; k < 18; k++) { const x = QUARRY.x0 - 0.4 + k * (QW + 0.8) / 17; solids.push({ x, z: POOL.z + POOL.r + 0.9, r: 0.8 }); } // the bench face
  // M28 · the falls as one continuous water-cut: a ribbon that runs down the notch floor of each bench, curls over the lip,
  // drops down the face onto the next ledge (white water at every landing) and on into the pool. Width wanders a little.
  const fallMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: 'attribute float aW;attribute float aF;varying vec2 vUv;varying float vW;varying float vF;void main(){vUv=uv;vW=aW;vF=aF;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;varying float vW;varying float vF;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){float sp=mix(1.4,3.6,vF),u=vUv.x,v=vUv.y;
        float s1=n(vec2(u*8.,v*2.5-uTime*sp)),s2=n(vec2(u*19.,v*6.-uTime*sp*1.6)),st=n(vec2(u*30.,v*1.1-uTime*sp*1.3));
        float rag=.1+.12*n(vec2(v*3.-uTime*sp,1.7));float edge=smoothstep(0.,rag,u)*smoothstep(1.,1.-rag,u);
        float white=clamp(vW+vF*(.3+.45*st)+(s2-.5)*.35,0.,1.);
        vec3 base=mix(vec3(.3,.44,.45),vec3(.62,.78,.82),vF);
        vec3 c=mix(base,vec3(.97,.99,1.),white*(.6+.4*s1));
        gl_FragColor=vec4(c,clamp(edge*(mix(.5,.78,vF)+.2*s1+.3*white),0.,.95));}` });
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f4fbff', map: brokenFoamTex(), transparent: true, opacity: 0.75, depthWrite: false });
  { const pts: { z: number; y: number; w: number; f: number }[] = []; const wid = (s2: number, extra = 0) => Math.min(1.32, 1.05 + 0.18 * Math.sin(s2 * 2.1) + 0.08 * Math.sin(s2 * 5.3) + extra);
    let zs = benchFront[BENCH - 1] + 3.0, acc = 0; const impacts: number[] = [];
    for (let k = BENCH - 1; k >= 0; k--) { const yk = benchTop[k] - 0.35 + 0.035, zf = benchFront[k];
      for (let z = zs; z > zf + 0.02; z -= 0.3) pts.push({ z, y: yk, w: wid(acc += 0.3), f: 0 });
      pts.push({ z: zf - 0.02, y: yk - 0.01, w: wid(acc, 0.05), f: 0.6 });
      const yb = k > 0 ? benchTop[k - 1] - 0.35 + 0.035 : WATER_Y + 0.03, drop = yk - yb, land = k > 0 ? 0.5 : 0.75;
      for (let i = 1; i <= 7; i++) { const t = i / 7; pts.push({ z: zf - 0.06 - land * t, y: yk - drop * t * t, w: wid(acc, 0.1 + 0.3 * t) + (k === 0 ? 0.25 * t : 0), f: 1 }); }
      impacts.push(pts.length - 1); zs = zf - 0.06 - land - 0.3; }
    const M = pts.length, pos = new Float32Array(M * 6), uv = new Float32Array(M * 4), aW = new Float32Array(M * 2), aF = new Float32Array(M * 2), idx: number[] = []; let v = 0;
    for (let i = 0; i < M; i++) { const p = pts[i]; if (i) v += Math.hypot(p.z - pts[i - 1].z, p.y - pts[i - 1].y);
      const near = impacts.reduce((m, j) => Math.min(m, Math.abs(i - j) * (i < j ? 0.5 : 1)), 99), wv = Math.max(0, 1 - near / 3) + (p.f > 0.5 && p.f < 1 ? 0.3 : 0);
      for (const sd2 of [0, 1]) { const o = (i * 2 + sd2); pos[o * 3] = QX + (sd2 ? 1 : -1) * p.w / 2; pos[o * 3 + 1] = p.y; pos[o * 3 + 2] = p.z; uv[o * 2] = sd2; uv[o * 2 + 1] = v; aW[o] = Math.min(1, wv); aF[o] = p.f; }
      if (i) { const q = (i - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aW', new THREE.BufferAttribute(aW, 1)); g.setAttribute('aF', new THREE.BufferAttribute(aF, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, fallMat); m.renderOrder = 2; m.frustumCulled = false; b.extra.push(m);
    impacts.forEach((j, i) => { const p = pts[j], last = i === impacts.length - 1; const f = new THREE.Mesh(new THREE.CircleGeometry(last ? 1.5 : 0.7, 16).rotateX(-Math.PI / 2), foamMat); f.position.set(QX, p.y + 0.02, p.z - (last ? 0.2 : 0.05)); f.renderOrder = 3; b.extra.push(f); }); }
  // M27 · spray and mist at the pool, wet rocks, ferns in the damp, rubble at the bench feet
  { const mistTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const fz = benchFront[0] - 0.9, mists: { s: THREE.Sprite; a: number; r: number; y0: number }[] = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: '#eef6f8', transparent: true, opacity: 0.32, depthWrite: false })); const a = rnd() * 6.28, r = 0.4 + rnd() * 1.2, y0 = WATER_Y + 0.35 + rnd() * 0.8; m.position.set(QX + Math.sin(a) * r, y0, fz + Math.cos(a) * r * 0.7); m.scale.setScalar(1.6 + rnd() * 1.4); m.renderOrder = 3; b.extra.push(m); mists.push({ s: m, a, r, y0 }); }
    const N = 70, sp = new Float32Array(N * 3), seed = new Float32Array(N); for (let i = 0; i < N; i++) seed[i] = rnd();
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const spray = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#f6fbff', size: 0.09, transparent: true, opacity: 0.8, depthWrite: false })); spray.frustumCulled = false; b.extra.push(spray);
    update.push((time) => { for (let i = 0; i < N; i++) { const ph = (time * 0.9 + seed[i] * 7) % 1, a = seed[i] * 40; sp[i * 3] = QX + Math.sin(a) * (0.3 + ph * 1.1); sp[i * 3 + 1] = WATER_Y + 0.1 + Math.sin(ph * Math.PI) * (0.5 + seed[i] * 0.6); sp[i * 3 + 2] = fz + Math.cos(a) * (0.2 + ph * 0.8); } sg.attributes.position.needsUpdate = true;
      for (const m of mists) { m.s.position.y = m.y0 + Math.sin(time * 0.5 + m.a) * 0.15; m.s.position.x = QX + Math.sin(m.a + time * 0.12) * m.r; (m.s.material as THREE.SpriteMaterial).opacity = 0.22 + 0.12 * Math.sin(time * 0.7 + m.a * 3); } });
    const wetRock = new THREE.MeshStandardMaterial({ color: '#77705f', roughness: 0.34, metalness: 0 }); // M28: lighter so they read as wet stone, not black balls
    for (let i = 0; i < 13; i++) { const a = rnd() * 6.28, r = POOL.r - 0.3 + rnd() * 1.1, x = POOL.x + Math.sin(a) * r, z = POOL.z + Math.cos(a) * r; if (z > benchFront[0] - 0.2) continue; const sz = 0.25 + rnd() * 0.45; b.add(wetRock, new THREE.DodecahedronGeometry(sz, 1).scale(1.2, 0.6 + rnd() * 0.3, 1), x, Math.max(heightAt(x, z), WATER_Y - 0.1), z, rnd() * 3); }
    for (let i = 0; i < 4; i++) { const x = QX + (rnd() - 0.5) * 1.2, z = benchFront[0] - 0.4 - rnd() * 0.6; b.add(wetRock, new THREE.DodecahedronGeometry(0.3 + rnd() * 0.25, 1).scale(1.1, 0.55, 1), x, WATER_Y - 0.05, z, rnd() * 3); }
    // M28 · ferns: spots only; main.ts plants the scanned fern asset there (merged into one mesh per material)
    const fernAt: [number, number][] = []; for (let i = 0; i < 40 && fernAt.length < 16; i++) { const x = QUARRY.x0 - 1.2 + rnd() * (QW + 2.4), z = POOL.z - 3.5 + rnd() * 4.2; if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.2 || lineDist(STREAM, x, z) < 1.2 || lineDist(TRACK, x, z) < 1.3) continue; fernAt.push([x, z]); }
    for (let k = 0; k < BENCH; k++) for (const sd2 of [-1, 1]) fernAt.push([QX + sd2 * (1.1 + rnd() * 0.5), benchFront[k] + 0.3]);
    fernAt.forEach(([x, z], i) => { const y = z > benchFront[0] ? benchTop[benchFront.findIndex((f, k) => z < (benchFront[k + 1] ?? 99) && z >= f)] - 0.04 : heightAt(x, z) - 0.04; FERN_SPOTS.push({ x, y, z, s: 0.55 + (i % 4) * 0.12, ry: rnd() * 6.28 }); });
    for (let i = 0; i < 22; i++) { const x = QUARRY.x0 - 1 + rnd() * (QW + 2), z = POOL.z - 1 - rnd() * 5.5; if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.3 || lineDist(TRACK, x, z) < 1.1) continue; const s2 = 0.12 + rnd() * 0.22; b.add(qstone, new THREE.DodecahedronGeometry(s2, 0).scale(1.3, 0.6, 1), x, heightAt(x, z) + s2 * 0.2, z, rnd() * 3); } }
  // the runnel on the ridge top that feeds the falls
  { const zt = benchFront[BENCH - 1] + 0.3; for (let k = 0; k < 7; k++) { const z = zt + k * 1.4, x = QX + Math.sin(k * 0.9) * 0.6; b.add(hewn, new THREE.DodecahedronGeometry(0.35, 0).scale(1.2, 0.5, 1), x - 0.9, heightAt(x - 0.9, z) + 0.05, z, k); b.add(hewn, new THREE.DodecahedronGeometry(0.35, 0).scale(1.2, 0.5, 1), x + 0.9, heightAt(x + 0.9, z) + 0.05, z, k + 1); } }
  update.push((time) => { fallMat.uniforms.uTime.value = time; });
  // ---- stepping stones where the track crosses the stream ----
  { let best = { x: 0, z: 0, d: 1e9 }; for (let i = 1; i < TRACK.length; i++) for (let k = 0; k <= 40; k++) { const u = k / 40, x = TRACK[i - 1].x + (TRACK[i].x - TRACK[i - 1].x) * u, z = TRACK[i - 1].z + (TRACK[i].z - TRACK[i - 1].z) * u, d = lineDist(STREAM, x, z); if (d < best.d) best = { x, z, d }; }
    const e = 0.08; const dz = lineDist(TRACK, best.x, best.z + e); void dz;
    // along the track direction near the crossing
    let ti = 1; for (let i = 1; i < TRACK.length; i++) if (lineDist([TRACK[i - 1], TRACK[i]], best.x, best.z) < 0.05) ti = i;
    const a = TRACK[ti - 1], c = TRACK[ti], L = Math.hypot(c.x - a.x, c.z - a.z), ux = (c.x - a.x) / L, uz = (c.z - a.z) / L;
    for (let k = -3; k <= 3; k++) { const x = best.x + ux * k * 0.72 + (rnd() - 0.5) * 0.15, z = best.z + uz * k * 0.72 + (rnd() - 0.5) * 0.15, y = Math.max(WATER_Y + 0.22, heightAt(x, z) + 0.08);
      b.add(hewn, new THREE.CylinderGeometry(0.42, 0.5, y - (WATER_Y - 1.2), 7).translate(0, (y - (WATER_Y - 1.2)) / 2, 0), x, WATER_Y - 1.2, z, rnd() * 3);
      WALK.push({ x, z, y, r: 0.55 }); } }
  // ---- under the orchard trees (planted in main.ts): windfall apples in the grass, a basket or two, a ladder against one trunk ----
  ORCHARD.forEach((o, i) => { const y = heightAt(o.x, o.z); for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, r = 0.6 + rnd() * 1.6, fx = o.x + Math.sin(a) * r, fz = o.z + Math.cos(a) * r; b.add(rnd() < 0.75 ? fruitR : fruitY, new THREE.SphereGeometry(0.075, 6, 4), fx, heightAt(fx, fz) + 0.05, fz); }
    if (i % 5 === 1) { const bx = o.x + 1.3, bz = o.z - 0.6, by = heightAt(bx, bz); b.add(wood, cyl(0.26, 0.3, 0.36, 10), bx, by - 0.02, bz); for (let k = 0; k < 5; k++) b.add(rnd() < 0.6 ? fruitR : fruitY, new THREE.SphereGeometry(0.08, 6, 4), bx + (rnd() - 0.5) * 0.3, by + 0.36, bz + (rnd() - 0.5) * 0.3); }
    if (i === 4) { for (const dx of [-0.25, 0.25]) b.add(wood, new THREE.BoxGeometry(0.06, 3.0, 0.06).translate(0, 1.5, 0).rotateX(-0.32), o.x + dx, y - 0.05, o.z + 1.1); for (let k = 0; k < 7; k++) b.add(wood, box(0.5, 0.04, 0.04), o.x, y + 0.3 + k * 0.4, o.z + 1.1 - (0.3 + k * 0.4) * Math.tan(0.32)); } });
  // ---- M30 · edge stones along the Pale road from the bridge to the Wing Gate (some sunk, some missing), merged with the quarry stone ----
  for (let z = -63.5; z > -98; z -= 1.25) { const sl = pathX(z + 0.5) - pathX(z - 0.5), L = Math.hypot(sl, 1), nx = 1 / L, nz = -sl / L;
    for (const sd2 of [-1, 1]) { if (rnd() < 0.3) continue; const off = 1.75 + rnd() * 0.35, x = pathX(z) + nx * off * sd2, zz = z + nz * off * sd2, sz = 0.22 + rnd() * 0.16;
      b.add(qstone, new THREE.DodecahedronGeometry(sz, 0).scale(1.5, 0.5, 1.1), x, heightAt(x, zz) - sz * 0.15, zz, Math.atan2(sl, 1) + (rnd() - 0.5) * 0.4); } }
  // ---- the bridge: narrow, three piers in the creek, four segmental arches, low parapets, on the road north-west ----
  { let zc = -59.6; for (let i = 0; i < 40; i++) { const f = pathX(zc) - creekX(zc), df = (pathX(zc + 0.01) - creekX(zc + 0.01) - f) / 0.01; zc -= f / df; }
    const xc = pathX(zc), dx = pathX(zc - 0.5) - pathX(zc + 0.5), dz = -1, L0 = Math.hypot(dx, dz), ax = dx / L0, az = dz / L0, th = Math.atan2(-az, ax);
    const span = 3.9, HL = span * 2 + 0.9, W = 2.3, P = (s: number, c: number) => [xc + ax * s - az * c, zc + az * s + ax * c] as const; // c across (left of travel)
    const yA = heightAt(...P(-HL, 0)) + 0.05, yB = heightAt(...P(HL, 0)) + 0.05, crown = Math.max(yA, yB) + 1.15;
    const deckY = (s: number) => { const u = Math.max(-1, Math.min(1, s / HL)); const base = yA + (yB - yA) * (u + 1) / 2; return base + (crown - Math.max(yA, yB)) * (1 - u * u) + (Math.max(yA, yB) - base) * (1 - u * u); };
    const bed = WATER_Y - 1.1, stone = weather(triplanar(t.rock, 2.0, '#bdb3a0', { sat: 0.4, gain: 1.6, rough: 0.92, emissive: '#100e0a' }), 1e4), arch = weather(triplanar(t.brick, 1.6, '#c8bfae', { sat: 0.3, gain: 1.5 }), 1e4); // M30: weathered (moss, lichen, streaks, damp at the waterline)
    const deck = [triplanar(t.rock, 1.3, '#a99f8b', { sat: 0.35, gain: 1.55, rough: 0.97 }), triplanar(t.rock, 1.3, '#9a917f', { sat: 0.3, gain: 1.5, rough: 0.9 })]; // M30: worn flags, two tones
    const g = new THREE.Group(); g.position.set(xc, 0, zc); g.rotation.y = th; const lb = new Builder();
    // spandrels per span: shape from pier to pier under the deck line, intrados a segmental arch; extruded across the deck
    for (let k = 0; k < 4; k++) { const s0 = -2 * span + k * span, s1 = s0 + span, spring = Math.min(deckY(s0), deckY(s1)) - 1.15, rise = 0.95, sh = new THREE.Shape();
      sh.moveTo(s0, spring); for (let i = 1; i <= 10; i++) { const u = i / 10, s = s0 + (s1 - s0) * u; sh.lineTo(s, spring + rise * Math.sin(Math.PI * u)); }
      for (let i = 10; i >= 0; i--) { const s = s0 + (s1 - s0) * i / 10; sh.lineTo(s, deckY(s) - 0.12); }
      lb.add(stone, new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -W / 2));
      for (let i = 0; i <= 8; i++) { const u = i / 8, s = s0 + (s1 - s0) * u, y = spring + rise * Math.sin(Math.PI * u), a = Math.atan2(rise * Math.PI * Math.cos(Math.PI * u) / span, 1); for (const c of [-W / 2 - 0.02, W / 2 + 0.02]) { const vg = new THREE.BoxGeometry(0.34, 0.42, 0.06); vg.rotateZ(a); vg.translate(s, y + 0.2, c); lb.add(arch, vg); } } }
    // piers with pointed cutwaters (upstream and down) and abutments into the banks
    for (const s of [-span, 0, span]) { const top = Math.min(deckY(s - span), deckY(s + span), deckY(s)) - 1.1; lb.add(stone, box(0.9, top - bed, W).translate(s, bed, 0) as THREE.BufferGeometry);
      for (const c of [-1, 1]) { const cw = new THREE.CylinderGeometry(0.64, 0.64, top - bed - 0.4, 4).rotateY(Math.PI / 4).scale(0.7, 1, 1).translate(s, bed + (top - bed - 0.4) / 2, c * W / 2); lb.add(stone, cw); lb.add(stone, new THREE.ConeGeometry(0.46, 0.5, 4).rotateY(Math.PI / 4).scale(0.7, 1, 1).translate(s, top - 0.15, c * W / 2)); }
      solids.push({ x: P(s, 0)[0], z: P(s, 0)[1], r: 0.1 }); }
    for (const s of [-2 * span - 0.45, 2 * span + 0.45]) lb.add(stone, box(1.2, deckY(s) - bed, W + 0.6).translate(s, bed, 0) as THREE.BufferGeometry);
    // deck: flags following the hump; low parapets with a coping; walk boxes and side solids
    const n = 34; for (let i = 0; i < n; i++) { const sa = -HL + i * 2 * HL / n, sb = sa + 2 * HL / n, sm = (sa + sb) / 2, y = deckY(sm), a = Math.atan2(deckY(sb) - deckY(sa), sb - sa);
      const dg = new THREE.BoxGeometry(sb - sa + 0.03, 0.14, W); dg.rotateZ(a + (i % 3 - 1) * 0.006); dg.translate(sm, y - 0.07 - (i % 4 === 1 ? 0.012 : 0), 0); lb.add(deck[(i * 7) % 3 === 0 ? 1 : 0], dg);
      for (const c of [-1, 1]) { const pg = new THREE.BoxGeometry(sb - sa + 0.03, 0.62, 0.32); pg.rotateZ(a); pg.translate(sm, y + 0.31, c * (W / 2 - 0.16)); lb.add(stone, pg); const cg = new THREE.BoxGeometry(sb - sa + 0.04, 0.1, 0.42); cg.rotateZ(a); cg.translate(sm, y + 0.67, c * (W / 2 - 0.16)); lb.add(arch, cg);
        if (i % 2 === 0) { const [wx, wz] = P(sm, c * (W / 2 + 0.25)); solids.push({ x: wx, z: wz, r: 0.55 }); } }
      const [wx, wz] = P(sm, 0); WALK.push({ x: wx, z: wz, y, hw: (sb - sa) / 2 + 0.02, hd: W / 2 - 0.3, ry: th, cam: true }); }
    // end posts at the four corners
    for (const s of [-HL, HL]) for (const c of [-1, 1]) lb.add(arch, box(0.5, 1.0, 0.5).translate(s, deckY(s) - 0.05, c * (W / 2 - 0.16)) as THREE.BufferGeometry);
    const bg = lb.build(); g.add(bg); b.extra.push(g); }
  const grp = b.build(); for (const m of b.extra) grp.add(m); grp.name = 'opening';
  return { group: grp, update: (time) => { for (const u of update) u(time); } };
}
