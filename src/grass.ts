import * as THREE from 'three';
import { heightAt, normalAt, pathMask, creekX, creekHalf, rng, SHRINE, fbm } from './world';

/** Instanced grass clumps (tapered curved blades) with GPU wind sway and distance fade. */
export function makeGrass(count: number, radius: number, bladesPerClump: number, seg = 4, inner = 0): { mesh: THREE.InstancedMesh; uniforms: { uTime: THREE.IUniform; uPlayer: THREE.IUniform }; center: THREE.Vector2; recenter: (x: number, z: number) => void; recenterSoon: (x: number, z: number) => void; pump: (ms: number) => void; busy: () => boolean } {
  const r = rng(7); void rng;
  const pos: number[] = [], col: number[] = [], bend: number[] = [], idx: number[] = [];
  let v = 0;
  for (let b = 0; b < bladesPerClump; b++) {
    const wide = inner > 0 ? 1.7 : 1; const a = r() * Math.PI, ox = (r() - 0.5) * 0.35, oz = (r() - 0.5) * 0.35, h = 0.2 + r() * 0.3, w = (0.022 + r() * 0.018) * wide, lean = (r() - 0.5) * 0.25;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, ww = w * (1 - t * 0.92), y = h * t, f = lean * t * t;
      for (const side of [-1, 1]) {
        pos.push(ox + ca * ww * side + -sa * f, y, oz + sa * ww * side + ca * f);
        const g = 0.38 + 0.58 * t; col.push(0.20 * g + 0.05, 0.28 * g + 0.07, 0.09 * g + 0.03); bend.push(t);
      }
      if (s < seg) { const o = v + s * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    v += (seg + 1) * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('bend', new THREE.Float32BufferAttribute(bend, 1));
  geo.setIndex(idx);
  const normals = new Float32Array(pos.length); for (let i = 1; i < normals.length; i += 3) normals[i] = 1; geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float bend; uniform float uTime; uniform vec3 uPlayer; varying float vBend;')
      .replace('#include <begin_vertex>', `vec3 transformed=vec3(position);
  vec4 iw=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  float gust=sin(iw.x*.11+uTime*1.3)*.5+sin(iw.z*.07+iw.x*.03+uTime*.71)*.5;
  float sway=(.10+.14*gust)+.05*sin(uTime*3.1+iw.x*1.7+iw.z*1.3);
  vec2 away=iw.xz-uPlayer.xz; float pd=length(away); float push=(1.-smoothstep(.3,1.3,pd))*.35;
  float b2=bend*bend; transformed.x+=sway*b2; transformed.z+=sway*.45*b2;
  transformed.xz+=normalize(away+1e-4)*push*b2; transformed.y-=push*b2*.4;
  float cd=length(cameraPosition.xz-iw.xz); transformed*=(1.-smoothstep(${(radius * 0.72).toFixed(1)},${radius.toFixed(1)},cd))${inner > 0 ? `*smoothstep(${(inner - 4).toFixed(1)},${inner.toFixed(1)},cd)` : ''};
  vBend=bend;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal=vec3(0.,1.,0.);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBend;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 blade=diffuseColor.rgb*mix(.82,1.06,vBend); float L=dot(blade,vec3(.3,.59,.11)); blade=mix(vec3(L),blade,.85);
    vec3 ground=vec3(.36,.32,.18); diffuseColor.rgb=mix(ground,blade,smoothstep(.0,.28,vBend)); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.05,.08,.02)*vBend*vBend;');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const center = new THREE.Vector2();
  // Grass lives in a disc around the player and is re-scattered (deterministically per cell) as they travel.
  // The re-scatter is time-sliced into a back buffer (a few ms per frame) and swapped in when complete: a synchronous
  // rebuild of ~15k instances cost 30–140 ms every ~6 m, i.e. a hitch about once a second while running.
  const mk = () => ({ m: new THREE.InstancedBufferAttribute(new Float32Array(count * 16), 16), c: new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3) });
  let back = mk(); const cellCache = new Map<number, Float32Array>(); let job: Generator<void, number, void> | null = null; let jobC = new THREE.Vector2();
  function* fill(cx: number, cz: number, dm: Float32Array, dc: Float32Array): Generator<void, number, void> {
    let n = 0;
    const cell = 2, R = radius, c0x = Math.floor((cx - R) / cell), c1x = Math.floor((cx + R) / cell), c0z = Math.floor((cz - R) / cell), c1z = Math.floor((cz + R) / cell);
    const ri = Math.max(0, inner - 10), per = Math.max(1, Math.round(count / (Math.PI * (R * R - ri * ri) / (cell * cell))));
    for (let gx = c0x; gx <= c1x && n < count; gx++) { for (let gz = c0z; gz <= c1z && n < count; gz++) {
      // Per-cell blades are cached (matrix 16 + colour 3 + x,z), so a re-scatter mostly copies and only computes new cells.
      const key = gx * 100003 + gz; let cb = cellCache.get(key);
      if (!cb) {
        const rr = rng((gx * 73856093) ^ (gz * 19349663)); const tmpA: number[] = [];
        for (let k = 0; k < per; k++) {
          const x = (gx + rr()) * cell, z = (gz + rr()) * cell;
          const rot = rr() * Math.PI * 2, sc0 = rr(), sc1 = rr(), t0 = rr(), t1 = rr(), t2 = rr();
          const pm = pathMask(x, z); if (pm > 0.42) continue;
          const dcr = Math.abs(x - creekX(z)); if (dcr < creekHalf(z) + 0.6) continue;
          if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < 7) continue;
          const nrm = normalAt(x, z); if (nrm[1] < 0.86) continue;
          p.set(x, heightAt(x, z) - 0.02, z);
          q.setFromAxisAngle(up, rot);
          // Height varies ankle → knee: lawn-like short patches, taller tussocks, and a trodden fringe along the path.
          const patch = fbm(x * 0.07 + 11, z * 0.07);
          let hy = patch < -0.12 ? 0.32 + 0.18 * sc1 : patch > 0.22 ? 1.05 + 0.35 * sc1 : 0.6 + 0.45 * sc1;
          hy *= 1 - 0.75 * Math.min(1, pm / 0.42);
          const sc = 0.8 + sc0 * 0.45; s.set(sc, sc * hy, sc);
          m.compose(p, q, s); const o = tmpA.length; m.toArray(tmpA, o);
          tmpA.push(0.85 + t0 * 0.3, 0.9 + t1 * 0.2, 0.7 + t2 * 0.35, x, z);
        }
        cb = new Float32Array(tmpA); if (cellCache.size > 6000) cellCache.clear(); cellCache.set(key, cb);
      }
      for (let o = 0; o < cb.length && n < count; o += 21) {
        const dd = Math.hypot(cb[o + 19] - cx, cb[o + 20] - cz); if (dd > R || dd < inner - 10) continue;
        dm.set(cb.subarray(o, o + 16), n * 16); dc[n * 3] = cb[o + 16]; dc[n * 3 + 1] = cb[o + 17]; dc[n * 3 + 2] = cb[o + 18]; n++;
      }
      yield; }
    }
    return n;
  }
  function swapIn(n: number) {
    const cur = { m: mesh.instanceMatrix, c: mesh.instanceColor! };
    back.m.needsUpdate = true; back.c.needsUpdate = true; mesh.instanceMatrix = back.m; mesh.instanceColor = back.c; mesh.count = n;
    back = { m: cur.m as THREE.InstancedBufferAttribute, c: cur.c }; center.copy(jobC);
  }
  /** Immediate rebuild (load, teleports). */
  function recenter(cx: number, cz: number) { job = null; jobC.set(cx, cz); const g = fill(cx, cz, back.m.array as Float32Array, back.c.array as Float32Array); let r = g.next(); while (!r.done) r = g.next(); swapIn(r.value); }
  /** Start a time-sliced rebuild around (cx, cz); keeps the current grass until it is ready. */
  function recenterSoon(cx: number, cz: number) { if (job) return; jobC.set(cx, cz); job = fill(cx, cz, back.m.array as Float32Array, back.c.array as Float32Array); }
  /** Advance a pending rebuild for up to `ms` milliseconds. */
  function pump(ms: number) { if (!job) return; const t0 = performance.now(); let r = job.next(); while (!r.done && performance.now() - t0 < ms) r = job.next(); if (r.done) { job = null; swapIn(r.value); } }
  const busy = () => !!job;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  recenter(0, 0);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return { mesh, uniforms, center, recenter, recenterSoon, pump, busy };
}
