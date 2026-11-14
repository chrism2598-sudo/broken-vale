import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fromMap, heightAt, LANDMARKS, SHRINE } from './world';
import { triplanar } from './landmarks';

/** Echo Grove (Page): five pale crystal trees east of the old crossing; a seal wakes them; +20 XP once. */
export const ECHO = fromMap(440, 300);
export const ECHO_RANGE = 8.6; // Page range 24 map units
export const ECHO_XP = 20;
export const ECHO_SILENT = 'The grove is silent. Perhaps a seal would wake it.';
export function echoMemoryLines(reward: boolean): string[] {
  return [
    'Memory of the Break',
    'The old custodians stretched one sky across five beacons, then tried to keep every sunrise at once.',
    'The sky split under the weight of mornings it could not finish; these crystal trees still remember the sound.',
    'Each seal returns one unspent dawn to the wind.',
    reward ? '+20 XP · Echo added to your bag. This memory can be recalled without further reward.' : 'The memory remains. Its gift is already yours.',
  ];
}
/** Marr's Unfinished Map (Page MARR_MARKS): charted when you come within 90 map units (~32 m). */
const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;
export const MARR_MARKS = [
  { name: 'Pale Keep', ...pick(lm('pale')) }, { name: 'Azure Keep', ...pick(lm('azure')) },
  { name: 'Sunspire', ...pick(lm('sunspire')) }, { name: 'Iron Dome', ...pick(lm('dome')) },
  { name: 'Veilfall', ...pick(lm('veilfall')) }, { name: 'Wind Shrine', x: SHRINE.x, z: SHRINE.z }, { name: 'Echo Grove', x: ECHO.x, z: ECHO.z },
];
function pick(l: { x: number; z: number }) { return { x: l.x, z: l.z }; }
export const CHART_R = 32.4;
export const CHART_DONE = 'Every familiar landmark has a place on Enna’s map. The blank above the valley remains.';

/** Irregular hexagonal crystal shard (prism + off-centre point), non-indexed so it shades faceted. */
function shardGeo(r: number, h: number, rnd: () => number) {
  const n = 6, body = h * (0.62 + rnd() * 0.18), rr = Array.from({ length: n }, () => r * (0.72 + rnd() * 0.5));
  const ring = (y: number, k: number) => rr.map((q, i) => { const a = (i / n) * Math.PI * 2 + 0.2; return new THREE.Vector3(Math.cos(a) * q * k, y, Math.sin(a) * q * k); });
  const b = ring(-0.15, 1), m = ring(body, 0.86 + rnd() * 0.1), tip = new THREE.Vector3((rnd() - 0.5) * r * 0.5, h, (rnd() - 0.5) * r * 0.5);
  const v: number[] = [], push = (...ps: THREE.Vector3[]) => ps.forEach((q) => v.push(q.x, q.y, q.z));
  for (let i = 0; i < n; i++) { const k = (i + 1) % n; push(b[i], m[i], m[k], b[i], m[k], b[k], m[i], tip, m[k]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
/** M29 · a faceted crystal limb (6-sided, slightly irregular) from p0 to p1, radius r0 → r1; non-indexed so it shades in facets. */
function limbGeo(p0: THREE.Vector3, p1: THREE.Vector3, r0: number, r1: number, rnd: () => number) {
  const n = 6, d = p1.clone().sub(p0), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), j = Array.from({ length: n }, () => 0.8 + rnd() * 0.4);
  const ring = (y: number, r: number) => j.map((f, i) => { const a = (i / n) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r * f, y, Math.sin(a) * r * f).applyQuaternion(q).add(p0); });
  const b = ring(0, r0), m = ring(L * 0.55, (r0 + r1) / 2 * (0.95 + rnd() * 0.15)), tp = ring(L, r1), v: number[] = [], push = (...ps: THREE.Vector3[]) => ps.forEach((p) => v.push(p.x, p.y, p.z));
  for (let i = 0; i < n; i++) { const k = (i + 1) % n; push(b[i], m[i], m[k], b[i], m[k], b[k], m[i], tp[i], tp[k], m[i], tp[k], m[k]); }
  const tip = p1.clone().addScaledVector(d, r1 * 1.4); for (let i = 0; i < n; i++) push(tp[i], tip, tp[(i + 1) % n]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
/** Fresnel edge glow: emissive rises at grazing angles (cheap "light caught in the facets"). */
function edgeGlow(mat: THREE.MeshStandardMaterial, k: { value: number }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = k;
    sh.fragmentShader = 'uniform float uEdge;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.5); totalEmissiveRadiance += emissive * fr * uEdge; }`);
  };
}

/** Five crystal "trees": clusters of irregular faceted shards on dark stone-and-root bases, natural size variation.
 *  High: MeshPhysicalMaterial (transmission + iridescence); Lite: glossy standard + fresnel edge glow. light(i) wakes tree i. */
export function makeEchoGrove(high: boolean, rock?: { diff: THREE.Texture; nor: THREE.Texture; arm: THREE.Texture }) {
  const hasLight = high;
  const g = new THREE.Group(); g.position.set(ECHO.x, heightAt(ECHO.x, ECHO.z), ECHO.z);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stone: THREE.MeshStandardMaterial = rock ? triplanar(rock, 1.3, '#e2dcc6', { sat: 1.0, gain: 1.45 }) : new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95, flatShading: true });
  const moss = new THREE.MeshStandardMaterial({ color: '#b7c3a4', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }); // pale moss
  const trees: { mat: THREE.MeshStandardMaterial; edge: { value: number }; core: THREE.MeshBasicMaterial; k: number; want: number }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3, x = Math.cos(a) * 10, z = Math.sin(a) * 10, y = heightAt(ECHO.x + x, ECHO.z + z) - g.position.y;
    const edge = { value: 0.25 };
    const mat: THREE.MeshStandardMaterial = high
      ? new THREE.MeshPhysicalMaterial({ color: '#eef8f6', emissive: '#a6efe2', emissiveIntensity: 0.03, roughness: 0.06, metalness: 0, transmission: 0.72, thickness: 1.4, ior: 1.55, attenuationColor: new THREE.Color('#b8e6df'), attenuationDistance: 3.2, iridescence: 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520], specularIntensity: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.05, flatShading: true, envMapIntensity: 1.1 })
      : new THREE.MeshStandardMaterial({ color: '#d6efeb', emissive: '#a6efe2', emissiveIntensity: 0.05, roughness: 0.16, metalness: 0.04, flatShading: true, envMapIntensity: 1.4 });
    edgeGlow(mat, edge);
    const core = new THREE.MeshBasicMaterial({ color: '#c8fff3', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = rnd() * 6.28; const sc = 0.78 + rnd() * 0.5; t.scale.setScalar(sc); g.add(t);
    // M29 · a crystal TREE: faceted trunk rising from crystal roots driven into the ground, forking into boughs and twigs that
    // end in tufts of small shards; a pale inner core runs up the trunk and boughs; a couple of half-buried stones, pale moss, fallen shards.
    for (let k = 0; k < 2; k++) {
      const rg = mergeVertices(new THREE.IcosahedronGeometry(0.4 + rnd() * 0.3, 1).deleteAttribute('normal').deleteAttribute('uv')); rg.scale(1.3, 0.55, 1); rg.computeVertexNormals();
      const m = new THREE.Mesh(rg, stone); const ra = k * 2.6 + rnd(); m.position.set(Math.cos(ra) * 1.1, 0.02, Math.sin(ra) * 1.1); m.rotation.y = rnd() * 6; m.castShadow = m.receiveShadow = true; t.add(m);
    }
    const parts: THREE.BufferGeometry[] = [], cores: THREE.BufferGeometry[] = [];
    const lean = new THREE.Vector3((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.5).normalize(), H = 3.0 + rnd() * 0.8;
    const top = lean.clone().multiplyScalar(H);
    parts.push(limbGeo(new THREE.Vector3(0, -0.3, 0), top, 0.55, 0.3, rnd)); cores.push(limbGeo(new THREE.Vector3(0, 0, 0), top, 0.16, 0.09, rnd));
    for (let k = 0; k < 6; k++) { const ra = k * 1.05 + rnd() * 0.4, L = 1.1 + rnd() * 0.9; // roots: flare out and dive into the ground
      parts.push(limbGeo(new THREE.Vector3(Math.cos(ra) * 0.15, 0.5, Math.sin(ra) * 0.15), new THREE.Vector3(Math.cos(ra) * L, -0.45, Math.sin(ra) * L), 0.2, 0.05, rnd)); }
    const grow = (p0: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
      const p1 = p0.clone().addScaledVector(dir, len); parts.push(limbGeo(p0, p1, r, r * 0.62, rnd)); if (depth < 2) cores.push(limbGeo(p0, p1, r * 0.35, r * 0.22, rnd));
      if (depth >= 3) { for (let q = 0; q < 3; q++) { const sh = shardGeo(0.07 + rnd() * 0.06, 0.45 + rnd() * 0.5, rnd), d2 = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.4, rnd() * 0.6, (rnd() - 0.5) * 1.4)).normalize(); sh.applyMatrix4(new THREE.Matrix4().compose(p1, new THREE.Quaternion().setFromUnitVectors(up, d2), new THREE.Vector3(1, 1, 1))); parts.push(sh); } return; }
      const n = depth === 0 ? 3 : 2 + (rnd() < 0.5 ? 1 : 0); const az0 = rnd() * 6.28;
      for (let q = 0; q < n; q++) { const az = az0 + q * 6.28 / n + (rnd() - 0.5) * 0.6, spread = 0.45 + rnd() * 0.35 + depth * 0.1;
        const d2 = dir.clone().multiplyScalar(1 - spread).add(new THREE.Vector3(Math.cos(az) * spread, 0.25, Math.sin(az) * spread)).normalize(); grow(p1, d2, len * (0.68 + rnd() * 0.15), r * 0.62, depth + 1); } };
    grow(top, lean, 1.5 + rnd() * 0.4, 0.3, 0);
    for (let k = 0; k < 7; k++) { const ra = rnd() * 6.28, rr = 1.2 + rnd() * 2.2, sh = shardGeo(0.06 + rnd() * 0.08, 0.25 + rnd() * 0.45, rnd); // fallen and seeded shards
      sh.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(ra) * rr, -0.05, Math.sin(ra) * rr), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(ra), 0, -Math.cos(ra)), (rnd() - 0.5) * 1.4), new THREE.Vector3(1, 1, 1))); parts.push(sh); }
    for (let k = 0; k < 5; k++) { const ra = rnd() * 6.28, rr = 0.6 + rnd() * 1.6, mg = new THREE.CircleGeometry(0.35 + rnd() * 0.4, 9); const pa = mg.attributes.position; for (let v = 1; v < pa.count; v++) { const f = 0.7 + rnd() * 0.5; pa.setXY(v, pa.getX(v) * f, pa.getY(v) * f); }
      const m = new THREE.Mesh(mg.rotateX(-Math.PI / 2), moss); m.position.set(Math.cos(ra) * rr, 0.04, Math.sin(ra) * rr); m.receiveShadow = true; t.add(m); }
    const cm = new THREE.Mesh(mergeGeometries(parts), mat); cm.castShadow = false; t.add(cm); // light passes through: no hard shadow on the base
    const cc = new THREE.Mesh(mergeGeometries(cores), core); cc.renderOrder = 2; t.add(cc);
    trees.push({ mat, edge, core, k: 0, want: 0 });
  }
  const memMat = new THREE.MeshStandardMaterial({ color: '#cffff3', emissive: '#7ff5de', emissiveIntensity: 0, roughness: 0.08, metalness: 0.1, flatShading: true, transparent: true, opacity: 0 });
  const mg1 = shardGeo(0.55, 1.9, rnd), mg2 = shardGeo(0.55, 1.5, rnd); mg2.rotateX(Math.PI); mg1.translate(0, -0.1, 0); mg2.translate(0, 0.1, 0);
  const mem = new THREE.Mesh(mergeGeometries([mg1, mg2]), memMat); mem.position.y = 7.5; g.add(mem);
  const light = hasLight ? new THREE.PointLight('#bff7ea', 0, 26, 2) : null; if (light) { light.position.y = 5; g.add(light); }
  const N = 70, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = i * 2.399, r = 3 + (i % 9) * 1.1; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 1 + (i % 7) * 1.1; pos[i * 3 + 2] = Math.sin(a) * r; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: '#d4fff1', size: 0.18, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(pg, pm); motes.layers.set(1); g.add(motes);
  let memK = 0, memWant = 0;
  return {
    group: g,
    light(i: number, on = true) { trees[i].want = on ? 1 : 0; },
    /** Transmission re-renders the opaque scene, so only enable it when the camera is near the grove (High). */
    near(d: number) { const on = d < 42; for (const tr of trees) { const m = tr.mat as THREE.MeshPhysicalMaterial; if (m.isMeshPhysicalMaterial) { const want = on ? 0.72 : 0; if (m.transmission !== want) m.transmission = want; } } },
    memory(on: boolean, instant = false) { memWant = on ? 1 : 0; if (instant) { memK = memWant; for (const t of trees) t.k = t.want; } },
    update(t: number, dt: number) {
      let lit = 0;
      for (const tr of trees) { tr.k += (tr.want - tr.k) * Math.min(1, dt * 4); const pulse = 0.08 * Math.sin(t * 2 + lit); tr.mat.emissiveIntensity = 0.03 + tr.k * (0.22 + pulse); tr.edge.value = 0.25 + tr.k * (2.2 + pulse * 4); tr.core.opacity = 0.14 + tr.k * (0.5 + pulse); lit += tr.k; }
      memK += (memWant - memK) * Math.min(1, dt * 1.5);
      memMat.opacity = memK * 0.85; memMat.emissiveIntensity = memK * 0.9; mem.visible = memK > 0.01; mem.rotation.y = t * 0.5; mem.position.y = 7.5 + Math.sin(t) * 0.4;
      pm.opacity = 0.15 + lit / 5 * 0.7; motes.rotation.y = t * 0.05; motes.position.y = Math.sin(t * 0.5) * 0.3;
      if (light) light.intensity = lit * 1.4 + memK * 4;
    },
  };
}
