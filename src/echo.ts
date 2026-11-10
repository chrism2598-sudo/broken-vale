import * as THREE from 'three';
import { fromMap, heightAt, LANDMARKS, SHRINE } from './world';

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

/** Five faceted crystal pines in a ring, a floating memory crystal and motes. light(i) wakes tree i. */
export function makeEchoGrove(hasLight: boolean) {
  const g = new THREE.Group(); g.position.set(ECHO.x, heightAt(ECHO.x, ECHO.z), ECHO.z);
  const trees: { mat: THREE.MeshStandardMaterial; k: number; want: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3, x = Math.cos(a) * 10, z = Math.sin(a) * 10, y = heightAt(ECHO.x + x, ECHO.z + z) - g.position.y;
    const mat = new THREE.MeshStandardMaterial({ color: '#9ccfc8', emissive: '#6ff2d8', emissiveIntensity: 0.04, roughness: 0.12, metalness: 0.35, flatShading: true, envMapIntensity: 1.6 });
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = a * 2.7; t.scale.setScalar(0.92 + (i % 3) * 0.08); g.add(t);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 2.2, 6), mat); trunk.position.y = 1.1; trunk.castShadow = true; t.add(trunk);
    [[2.0, 2.4, 1.6], [1.6, 2.2, 3.0], [1.15, 2.0, 4.3], [0.7, 1.7, 5.4]].forEach(([r, h, yy], j) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6, 1), mat); c.position.y = yy; c.rotation.y = j * 0.5; c.castShadow = true; t.add(c);
    });
    trees.push({ mat, k: 0, want: 0 });
  }
  const memMat = new THREE.MeshStandardMaterial({ color: '#e6fff8', emissive: '#d4fff1', emissiveIntensity: 0, roughness: 0.1, flatShading: true, transparent: true, opacity: 0 });
  const mem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), memMat); mem.scale.y = 1.7; mem.position.y = 7.5; g.add(mem);
  const light = hasLight ? new THREE.PointLight('#bff7ea', 0, 26, 2) : null; if (light) { light.position.y = 5; g.add(light); }
  const N = 70, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = i * 2.399, r = 3 + (i % 9) * 1.1; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 1 + (i % 7) * 1.1; pos[i * 3 + 2] = Math.sin(a) * r; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: '#d4fff1', size: 0.18, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(pg, pm); motes.layers.set(1); g.add(motes);
  let memK = 0, memWant = 0;
  return {
    group: g,
    light(i: number, on = true) { trees[i].want = on ? 1 : 0; },
    memory(on: boolean, instant = false) { memWant = on ? 1 : 0; if (instant) { memK = memWant; for (const t of trees) t.k = t.want; } },
    update(t: number, dt: number) {
      let lit = 0;
      for (const tr of trees) { tr.k += (tr.want - tr.k) * Math.min(1, dt * 4); tr.mat.emissiveIntensity = 0.04 + tr.k * (0.42 + 0.08 * Math.sin(t * 2 + lit)); lit += tr.k; }
      memK += (memWant - memK) * Math.min(1, dt * 1.5);
      memMat.opacity = memK * 0.85; memMat.emissiveIntensity = memK * 1.6; mem.visible = memK > 0.01; mem.rotation.y = t * 0.5; mem.position.y = 7.5 + Math.sin(t) * 0.4;
      pm.opacity = 0.15 + lit / 5 * 0.7; motes.rotation.y = t * 0.05; motes.position.y = Math.sin(t * 0.5) * 0.3;
      if (light) light.intensity = lit * 1.4 + memK * 4;
    },
  };
}
