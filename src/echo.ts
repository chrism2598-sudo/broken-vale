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
  const root = new THREE.MeshStandardMaterial({ color: '#7a624a', roughness: 0.85 });
  const trees: { mat: THREE.MeshStandardMaterial; edge: { value: number }; core: THREE.MeshBasicMaterial; k: number; want: number }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3, x = Math.cos(a) * 10, z = Math.sin(a) * 10, y = heightAt(ECHO.x + x, ECHO.z + z) - g.position.y;
    const edge = { value: 0.25 };
    const mat: THREE.MeshStandardMaterial = high
      ? new THREE.MeshPhysicalMaterial({ color: '#b9efe6', emissive: '#5fe8d0', emissiveIntensity: 0.03, roughness: 0.06, metalness: 0, transmission: 0.72, thickness: 1.4, ior: 1.55, attenuationColor: new THREE.Color('#4fbfae'), attenuationDistance: 2.2, iridescence: 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520], specularIntensity: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.05, flatShading: true, envMapIntensity: 1.1 })
      : new THREE.MeshStandardMaterial({ color: '#8fd3c8', emissive: '#5fe8d0', emissiveIntensity: 0.03, roughness: 0.14, metalness: 0.08, flatShading: true, envMapIntensity: 1.3 });
    edgeGlow(mat, edge);
    const core = new THREE.MeshBasicMaterial({ color: '#7ff5de', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = rnd() * 6.28; const sc = 0.78 + rnd() * 0.5; t.scale.setScalar(sc); g.add(t);
    // dark stone base: 3-4 jittered rocks + roots gripping the ground
    for (let k = 0; k < 4; k++) {
      const rg = mergeVertices(new THREE.IcosahedronGeometry(k ? 0.45 + rnd() * 0.4 : 0.9 + rnd() * 0.3, 2).deleteAttribute('normal').deleteAttribute('uv')); const pa = rg.attributes.position as THREE.BufferAttribute; const ph = rnd() * 9;
      for (let v = 0; v < pa.count; v++) { const x = pa.getX(v), y = pa.getY(v), z = pa.getZ(v), r = Math.hypot(x, y, z) || 1; const f = 0.86 + 0.12 * Math.sin(x / r * 3.1 + ph) * Math.cos(z / r * 2.7 - ph) + 0.06 * Math.sin(y / r * 5.3 + ph * 2); pa.setXYZ(v, x * f, Math.max(y * f * 0.72, -0.25), z * f); } rg.computeVertexNormals();
      const m = new THREE.Mesh(rg, stone); const ra = k * 1.7 + rnd(); m.position.set(Math.cos(ra) * (k ? 1.0 : 0), k ? 0.05 : 0.25, Math.sin(ra) * (k ? 1.0 : 0)); m.rotation.y = rnd() * 6; m.castShadow = m.receiveShadow = true; t.add(m);
    }
    for (let k = 0; k < 4; k++) {
      const ra = k * 1.57 + rnd() * 0.5, L = 1.2 + rnd() * 0.8;
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(Math.cos(ra) * L * 0.45, 0.45 + rnd() * 0.2, Math.sin(ra) * L * 0.45), new THREE.Vector3(Math.cos(ra + 0.2) * L, -0.25, Math.sin(ra + 0.2) * L)]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.07 + rnd() * 0.05, 5), root); m.castShadow = true; t.add(m);
    }
    // crystal cluster: tall leaning spire + shards fanning outward and upward
    const parts: THREE.BufferGeometry[] = [], cores: THREE.BufferGeometry[] = [];
    const nS = 9 + Math.floor(rnd() * 5);
    for (let k = 0; k < nS; k++) {
      const main = k === 0, hgt = main ? 5.2 + rnd() * 1.8 : 1.2 + rnd() * (k < 4 ? 3.4 : 2.0), r = main ? 0.55 : 0.18 + rnd() * 0.3;
      const geo = shardGeo(r, hgt, rnd);
      const tilt = main ? 0.06 + rnd() * 0.1 : 0.25 + rnd() * 0.65, az = rnd() * 6.28, axis = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).cross(up).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, tilt).multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd() * 6));
      const off = main ? 0 : 0.2 + rnd() * 0.6, h0 = main ? 0.35 : 0.3 + rnd() * (k < 5 ? 1.6 : 0.4);
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(az) * off, h0, Math.sin(az) * off), q, new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(mtx); parts.push(geo);
      if (k < 4) { const cg = shardGeo(r * 0.45, hgt * 0.8, rnd); cg.applyMatrix4(mtx); cores.push(cg); }
    }
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
