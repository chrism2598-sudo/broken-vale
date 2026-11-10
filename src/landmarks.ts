import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS, SPAWN, heightAt, type Landmark } from './world';
import { addRimFill } from './shading';
import type { GroundTex } from './terrain';

type Solid = { x: number; z: number; r: number };
export type BuildTex = { brick: GroundTex; roof: GroundTex; sand: GroundTex; metal: GroundTex; rock: GroundTex };

/**
 * World-space triplanar PBR (diffuse + ARM roughness/AO, tangent-free normal perturbation) on a standard
 * material, so any primitive (lathes, boxes, domes) gets correctly scaled texture without UV work.
 */
function triplanar(set: GroundTex, scale: number, tint: string, o: { metal?: number; rough?: number; emissive?: string; sat?: number; gain?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: o.rough ?? 1, metalness: o.metal ?? 0, emissive: o.emissive ?? '#000000' });
  for (const t of [set.diff, set.nor, set.arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  set.diff.colorSpace = THREE.SRGBColorSpace;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tD = { value: set.diff }; sh.uniforms.uSat = { value: o.sat ?? 1 }; sh.uniforms.uGain = { value: o.gain ?? 1 }; sh.uniforms.tN = { value: set.nor }; sh.uniforms.tA = { value: set.arm };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  #ifdef USE_INSTANCING
  mat4 tm = modelMatrix * instanceMatrix;
  #else
  mat4 tm = modelMatrix;
  #endif
  vTW = (tm * vec4(transformed, 1.)).xyz; vTN = normalize(mat3(tm) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tD; uniform float uSat; uniform float uGain; uniform sampler2D tN; uniform sampler2D tA; varying vec3 vTW; varying vec3 vTN;
vec3 W3; vec2 UX, UY, UZ;
vec4 tri(sampler2D t){ return texture2D(t,UX)*W3.x + texture2D(t,UY)*W3.y + texture2D(t,UZ)*W3.z; }`)
      .replace('#include <map_fragment>', `
  W3 = pow(abs(normalize(vTN)), vec3(4.)); W3 /= dot(W3, vec3(1.));
  vec3 P = vTW / ${scale.toFixed(2)}; UX = P.zy; UY = P.xz; UZ = P.xy;
  { vec3 td = tri(tD).rgb; diffuseColor.rgb *= mix(vec3(dot(td, vec3(.3, .59, .11))), td, uSat) * uGain; }`)
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
function makeSunspire(l: Landmark, t: BuildTex, solids: Solid[]): THREE.Group {
  const b = new Builder();
  const sand = triplanar(t.sand, 3, '#e7c98a'), gold = new THREE.MeshStandardMaterial({ color: '#d9b24c', metalness: 0.9, roughness: 0.3 });
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
  solids.push({ x: l.x, z: l.z, r: 10.5 });
  const g = b.build();
  const amber = new THREE.MeshStandardMaterial({ color: '#ffb547', emissive: '#ff8a1c', emissiveIntensity: 1.3, roughness: 0.25, transparent: true, opacity: 0.92 });
  const cg: THREE.BufferGeometry[] = [];
  const ring = [[0, 38, 18, 26], [0.8, 42, 14, 32], [1.6, 36, 16, 22], [2.4, 44, 15, 28], [3.2, 40, 17, 24], [4.0, 38, 13, 30], [4.8, 42, 15, 20], [5.6, 36, 14, 27]];
  for (const [a, r, s, h] of ring) {
    for (let k = 0; k < 3; k++) {
      const o = new THREE.OctahedronGeometry(1, 0); o.scale(s * 0.09, h * 0.33 * (1 - k * 0.22), s * 0.09); o.rotateZ((k - 1) * 0.25);
      o.translate(Math.sin(a) * r * 0.5 + (k - 1) * 1.6, y0 + h * 0.15, Math.cos(a) * r * 0.5); cg.push(o);
    }
    solids.push({ x: l.x + Math.sin(a) * r * 0.5, z: l.z + Math.cos(a) * r * 0.5, r: 2.4 });
  }
  const crystals = new THREE.Mesh(mergeGeometries(cg), amber); crystals.castShadow = true; g.add(crystals);
  g.position.set(l.x, 0, l.z);
  return g;
}

/** Iron Dome (the foundry): stone drum, riveted rust-iron dome with ribs, lantern oculus, chimneys and a glowing forge mouth. */
function makeIronDome(l: Landmark, t: BuildTex, solids: Solid[]): THREE.Group {
  const b = new Builder();
  const stone = triplanar(t.sand, 2.6, '#a59a88'), iron = triplanar(t.metal, 2.4, '#b9a89a', { metal: 0.65, rough: 0.9 });
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
  solids.push({ x: l.x, z: l.z, r: R + 1.8 });
  const g = b.build();
  const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z);
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
function makeVeilfall(l: Landmark, t: BuildTex, solids: Solid[]): { group: THREE.Group; update: (time: number) => void } {
  const b = new Builder();
  const rock = triplanar(t.rock, 4, '#b8ab96'), sand = triplanar(t.sand, 2.2, '#e2d2b0');
  const teal = new THREE.MeshStandardMaterial({ color: '#5f9a88', metalness: 0.5, roughness: 0.45 }); addRimFill(teal, { fill: 0.15, rim: 0.35 });
  const y0 = l.pad;
  const face = Math.atan2(SPAWN.x - l.x, SPAWN.z - l.z);
  const blobs: [number, number, number, number, number, number][] = [[0, 9, -2, 15, 11, 13], [-4, 18, -4, 11, 9, 10], [5, 14, -6, 10, 10, 9], [9, 6, 4, 8, 7, 7], [-10, 6, 3, 9, 7, 8], [2, 24, -3, 9, 5, 8], [-6, 3, -12, 10, 6, 9]];
  for (const [x, y, z, sx, sy, sz] of blobs) {
    const gm = new THREE.IcosahedronGeometry(1, 3); const p = gm.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + 0.18 * Math.sin(v.x * 5 + v.y * 3) * Math.sin(v.z * 4 + 1) + 0.08 * Math.sin(v.y * 11); p.setXYZ(i, v.x * sx * n, v.y * sy * n, v.z * sz * n); }
    gm.computeVertexNormals(); b.add(rock, gm, x, y0 + y, z);
  }
  const top = y0 + 29;
  b.add(sand, cyl(7.5, 7.2, 1.4, 32), 0, top - 1, -3);
  const prof: [number, number][] = [[11.6, 37], [11.8, 38.6], [10.2, 39.6], [10.2, 49.6], [11.3, 50.4], [11.3, 52], [9.6, 53], [8.2, 57], [6, 60.2], [3.2, 62.2], [0.05, 62.8]];
  const sc = 0.5;
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; b.add(sand, cyl(0.45, 0.4, (49.6 - 38.8) * sc, 10), Math.cos(a) * 11.2 * sc, top + (38.8 - 37) * sc, -3 + Math.sin(a) * 11.2 * sc); }
  b.add(sand, lathe(prof.slice(0, 3).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  b.add(sand, lathe(prof.slice(4, 6).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  b.add(teal, lathe(prof.slice(5).map(([r, y]) => [r * sc, (y - 37) * sc] as [number, number]), 32), 0, top, -3);
  solids.push({ x: l.x, z: l.z - 2, r: 14 });
  const g = b.build(); g.rotation.y = face;
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
  return { group: g, update: (time) => { fallMat.uniforms.uTime.value = time; foam.scale.setScalar(1 + Math.sin(time * 3) * 0.05); } };
}

export function makeLandmarks(t: BuildTex, solids: Solid[]): { group: THREE.Group; update: (time: number) => void } {
  const grp = new THREE.Group(); const updates: ((time: number) => void)[] = [];
  const by = (id: string) => LANDMARKS.find((l) => l.id === id)!;
  grp.add(makeKeep(by('pale'), t, '#7b93a8', '#efe6d6', '#e9e4d4', solids));
  grp.add(makeKeep(by('azure'), t, '#3f78b5', '#d9dde0', '#4fa3e0', solids));
  grp.add(makeSunspire(by('sunspire'), t, solids));
  grp.add(makeIronDome(by('dome'), t, solids));
  const vf = makeVeilfall(by('veilfall'), t, solids); grp.add(vf.group); updates.push(vf.update);
  const flags: THREE.Mesh[] = []; grp.traverse((o) => { if (o.userData.flag) flags.push(o as THREE.Mesh); });
  for (const f of flags) { const p = f.geometry.attributes.position; f.userData.base = Float32Array.from(p.array as Float32Array); }
  updates.push((time) => {
    for (const f of flags) { const p = f.geometry.attributes.position, base = f.userData.base as Float32Array; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 1.4 - time * 4) * 0.25 * (x + 2.25) / 4.5); } p.needsUpdate = true; }
  });
  void heightAt;
  return { group: grp, update: (time) => { for (const u of updates) u(time); } };
}
