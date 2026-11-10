import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS, SPAWN, heightAt, type Landmark } from './world';
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
vec4 tri(sampler2D t){ return texture2D(t,UX)*W3.x + texture2D(t,UY)*W3.y + texture2D(t,UZ)*W3.z; }`)
      .replace('#include <map_fragment>', `
  W3 = pow(abs(normalize(vTN)), vec3(4.)); W3 /= dot(W3, vec3(1.));
  vec3 P = vTW / ${scale.toFixed(2)}; UX = P.zy; UY = P.xz; UZ = P.xy;
  { vec3 td = tri(tD).rgb; diffuseColor.rgb *= mix(vec3(dot(td, vec3(.3, .59, .11))), td, uSat) * uGain;
    float hb = vTW.y - uGround; float streak = .5 + .5 * sin(vTW.x * 2.1 + sin(vTW.z * 1.3) * 2.) * sin(vTW.z * 1.7 + vTW.x * .4);
    diffuseColor.rgb *= mix(vec3(.55, .58, .45), vec3(1.), smoothstep(0., 2.6, hb + streak * 1.4)); }`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness; { vec3 a = tri(tA).rgb; roughnessFactor *= a.g; diffuseColor.rgb *= mix(1., a.r, .8); }`)
      .replace('#include <normal_fragment_maps>', `{ vec3 tn = tri(tN).xyz * 2. - 1.; vec3 wn = normalize(vTN);
  vec3 pert = normalize(wn + (vec3(tn.x, 0., tn.y) * W3.y + vec3(0., tn.y, tn.x) * W3.x + vec3(tn.x, tn.y, 0.) * W3.z) * .6);
  normal = normalize((viewMatrix * vec4(pert, 0.)).xyz); }`);
  };
  m.customProgramCacheKey = () => 'tri' + scale;
  addRimFill(m, { fill: 0.22, rim: 0.22, rimColor: '#e9e2cf' });
  return m;
}

class Builder {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0) {
    g = g.index ? g.toNonIndexed() : g; // uniform attributes for merging
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.rotateY(ry); g.translate(x, y, z);
    (this.parts.get(mat) ?? this.parts.set(mat, []).get(mat)!).push(g);
  }
  build(): THREE.Group {
    const grp = new THREE.Group();
    for (const [mat, gs] of this.parts) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    return grp;
  }
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, seg = 20) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h / 2, 0);
const cone = (r: number, h: number, seg = 20) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
const lathe = (pts: [number, number][], seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.01, r), y)), seg);

/** Crenellated round tower with a conical slate roof. */
function tower(b: Builder, st: THREE.Material, roof: THREE.Material, x: number, y: number, z: number, r: number, h: number, roofH: number) {
  b.add(st, cyl(r * 1.08, r, h), x, y, z);
  b.add(st, cyl(r * 1.18, r * 1.18, 1.2), x, y + h, z);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.add(st, box(0.9, 1.1, 0.7), x + Math.cos(a) * r * 1.1, y + h + 1.2, z + Math.sin(a) * r * 1.1, -a); }
  b.add(roof, cone(r * 1.25, roofH, 24), x, y + h + 1.2, z);
}

/** A keep after the Page's Pale/Azure Keep: curtain wall with corner towers, a gatehouse facing spawn, a tall crown keep. */
function makeKeep(l: Landmark, t: BuildTex, roofTint: string, wallTint: string, pennant: string, solids: Solid[]): THREE.Group {
  const b = new Builder();
  const st = triplanar(t.brick, 3.2, wallTint, { sat: 0.35, gain: 1.5 }); const roof = triplanar(t.roof, 2.2, roofTint, { rough: 0.85 });
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
    tower(b, st, roof, p0.x, y0, p0.y, 3.1, W + 5, 6.5);
    solids.push({ x: l.x + p0.x, z: l.z + p0.y, r: 3.6 });
  }
  // Central keep: square hall, a taller crown tower with a slim spire, and two slender turrets.
  const kx = -Math.sin(face) * 3, kz = -Math.cos(face) * 3;
  b.add(st, box(13, 18, 12), kx, y0, kz, face);
  for (let k = 0; k < 7; k++) for (const sgn of [-1, 1]) { const u = (k + 0.5) / 7 - 0.5; b.add(st, box(1.0, 1.2, 0.8), kx + Math.cos(face) * u * 13 + Math.sin(face) * sgn * 6, y0 + 18, kz - Math.sin(face) * u * 13 + Math.cos(face) * sgn * 6, face); }
  tower(b, st, roof, kx, y0, kz, 4.4, 30, 13);
  tower(b, st, roof, kx + Math.cos(face) * 6.5, y0 + 18, kz - Math.sin(face) * 6.5, 1.6, 7, 4.5);
  tower(b, st, roof, kx - Math.cos(face) * 6.5, y0 + 18, kz + Math.sin(face) * 6.5, 1.6, 6, 4);
  solids.push({ x: l.x + kx, z: l.z + kz, r: 8.5 });
  const g = b.build();
  // Portal darkness + pennant on the crown spire.
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.4), new THREE.MeshBasicMaterial({ color: '#120e0c' }));
  portal.position.set(Math.sin(face) * (R * 0.866 + 1.45), y0 + 2.7, Math.cos(face) * (R * 0.866 + 1.45)); portal.rotation.y = face; g.add(portal);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.6, 8, 1), new THREE.MeshStandardMaterial({ color: pennant, side: THREE.DoubleSide, roughness: 0.8, emissive: pennant, emissiveIntensity: 0.15 }));
  flag.position.set(kx + 2.3, y0 + 30 + 1.2 + 13 - 1.2, kz); flag.userData.flag = true; g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4), new THREE.MeshStandardMaterial({ color: '#4a3b2a' })); pole.position.set(kx, y0 + 30 + 1.2 + 13 + 0.5, kz); g.add(pole);
  g.position.set(l.x, 0, l.z);
  return g;
}

/** Sunspire: sandstone causeway ring, slender lathe tower (Page profile), gilded crown + needle, amber crystal ring. */
function makeSunspire(l: Landmark, t: BuildTex, solids: Solid[], opts: LOpts): THREE.Group {
  const b = new Builder();
  const sand = triplanar(t.sand, 3, '#e7c98a', { ground: l.pad + 0.8 }), gold = new THREE.MeshStandardMaterial({ color: '#d9b24c', metalness: 0.9, roughness: 0.3 });
  addRimFill(gold, { fill: 0.15, rim: 0.4, rimColor: '#ffe3a0' });
  const y0 = l.pad;
  b.add(sand, cyl(24, 23, 1.6, 48), 0, y0 - 0.8, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add(sand, box(3.2, 0.9, 16), Math.sin(a) * 30, y0 - 0.6, Math.cos(a) * 30, a); }
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
  for (let i = 0; i < 4; i++) { const sx = Math.sin(faceS), sz = Math.cos(faceS); b.add(sand, box(6.5, 0.45, 1.6), sx * (24.6 + i * 1.5), y0 - 0.8 - i * 0.45 + 0.35, sz * (24.6 + i * 1.5), faceS); }
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
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.2), cloth); bn.position.set(Math.sin(a) * 9.3, y0 + 6.6, Math.cos(a) * 9.3); bn.rotation.y = a; g.add(bn); }
  if (opts.lights) { const pl = new THREE.PointLight('#ffb35c', 40, 26, 2); pl.position.set(Math.sin(faceS) * (doorR + 3), y0 + 3, Math.cos(faceS) * (doorR + 3)); g.add(pl); }
  const amber = new THREE.MeshStandardMaterial({ color: '#ffb547', emissive: '#ff8a1c', emissiveIntensity: 0.5, roughness: 0.25, transparent: true, opacity: 0.92 });
  const cg: THREE.BufferGeometry[] = [];
  const ring = [[0, 38, 18, 26], [0.8, 42, 14, 32], [1.6, 36, 16, 22], [2.4, 44, 15, 28], [3.2, 40, 17, 24], [4.0, 38, 13, 30], [4.8, 42, 15, 20], [5.6, 36, 14, 27]];
  for (const [a, r, s, h] of ring) {
    for (let k = 0; k < 3; k++) {
      const H = h * 0.11 * (1 - k * 0.25); const o = new THREE.OctahedronGeometry(1, 0); o.scale(s * 0.045, H, s * 0.045); o.rotateZ((k - 1) * 0.3);
      o.translate(Math.sin(a) * r * 0.5 + (k - 1) * 0.75, y0 + H * 0.55, Math.cos(a) * r * 0.5); cg.push(o);
    }
    solids.push({ x: l.x + Math.sin(a) * r * 0.5, z: l.z + Math.cos(a) * r * 0.5, r: 1.3 });
  }
  const crystals = new THREE.Mesh(mergeGeometries(cg), amber); crystals.castShadow = true; g.add(crystals);
  g.position.set(l.x, 0, l.z);
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
  g.position.set(l.x, 0, l.z);
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
  const foam = new THREE.Mesh(new THREE.RingGeometry(1.5, 4.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.35, depthWrite: false }));
  foam.position.set(0, y0 + 0.3, 12.5); g.add(foam);
  g.position.set(l.x, 0, l.z);
  return { group: g, update: (time) => { fallMat.uniforms.uTime.value = time; foam.scale.setScalar(1 + Math.sin(time * 3) * 0.05); orb.scale.setScalar(1 + Math.sin(time * 1.7) * 0.08);
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
  grp.add(makeKeep(by('pale'), t, '#7b93a8', '#efe6d6', '#e9e4d4', solids));
  grp.add(makeKeep(by('azure'), t, '#3f78b5', '#d9dde0', '#4fa3e0', solids));
  const sun = makeSunspire(by('sunspire'), t, solids, opts); grp.add(sun);
  const dome = makeIronDome(by('dome'), t, solids, opts); grp.add(dome); updates.push(dome.userData.tick);
  const flames: THREE.Object3D[] = []; sun.traverse((o) => { if (o.userData.flicker !== undefined) flames.push(o); });
  updates.push((time) => { for (const f of flames) f.scale.set(1, 0.85 + 0.25 * Math.sin(time * 9 + f.userData.flicker) * Math.sin(time * 5.3 + f.userData.flicker * 2), 1); });
  const vf = makeVeilfall(by('veilfall'), t, solids, opts); grp.add(vf.group); updates.push(vf.update);
  const flags: THREE.Mesh[] = []; grp.traverse((o) => { if (o.userData.flag) flags.push(o as THREE.Mesh); });
  for (const f of flags) { const p = f.geometry.attributes.position; f.userData.base = Float32Array.from(p.array as Float32Array); }
  updates.push((time) => {
    for (const f of flags) { const p = f.geometry.attributes.position, base = f.userData.base as Float32Array; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 1.4 - time * 4) * 0.25 * (x + 2.25) / 4.5); } p.needsUpdate = true; }
  });
  void heightAt;
  return { group: grp, update: (time) => { for (const u of updates) u(time); } };
}
