/**
 * M57 · DIAG BUILD ONLY · per-frame draw breakdown (&draws=1; off by default) and stall instrumentation (always on in diag).
 * Draws are tallied in WebGLRenderer.renderBufferDirect (every main-pass and shadow-pass draw goes through it), split by
 * object category, owner group (top-level scene object), material type, transparent vs opaque, and pass. Visibility is sampled
 * once a second (meshes visible / hidden by Lite LOD layers / inside the camera frustum / shadow casters).
 */
import * as THREE from 'three';

type Cnt = Record<string, number>;
const inc = (o: Cnt, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };
export function startDraws(R: THREE.WebGLRenderer, cam: THREE.Camera, grass: THREE.Object3D, refs: Record<string, THREE.Object3D | undefined>, active: () => THREE.Scene) {
  let on = false, inShadow = false, frames = 0, tallied = 0;
  let byCat: Cnt = {}, byGroup: Cnt = {}, byMat: Cnt = {}, byTr: Cnt = {}, byObj: Cnt = {}, vis: Cnt = {}, visN = 0;
  const cat = new WeakMap<THREE.Object3D, [string, string, string]>(); const refOf = new Map<THREE.Object3D, string>();
  for (const k in refs) { const o = refs[k]; if (o) refOf.set(o, k); }
  let charSet = new WeakSet<THREE.Object3D>(), lastScene: THREE.Scene | null = null;
  const prepScene = (sc: THREE.Scene) => { if (sc === lastScene) return; lastScene = sc; charSet = new WeakSet();
    sc.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.parent) o.parent.traverse((c) => charSet.add(c)); }); };
  const r1 = (v: number) => Math.round(v * 10) / 10;
  function classify(o: THREE.Object3D, mat: THREE.Material): [string, string, string] {
    let c = cat.get(o); if (c) return c;
    let top: THREE.Object3D = o, tag = ''; for (let q: THREE.Object3D | null = o; q; q = q.parent) { const t = refOf.get(q); if (t && !tag) tag = t; if (q.parent && (q.parent as THREE.Scene).isScene) top = q; }
    const sc = top.parent; const idx = sc ? sc.children.indexOf(top) : -1;
    const group = tag || `${top.type}${top.name ? ':' + top.name : ''}#${idx}(${top.children.length})`;
    const m = o as THREE.Mesh, g = m.geometry as THREE.BufferGeometry | undefined; if (g && !g.boundingSphere) g.computeBoundingSphere();
    const ws = new THREE.Vector3(); o.getWorldScale(ws); const rad = (g?.boundingSphere?.radius ?? 0) * Math.max(ws.x, ws.y, ws.z);
    const mt = mat as THREE.Material & { blending: number; alphaTest: number; alphaToCoverage: boolean; side: number };
    let k: string;
    if (o === grass) k = 'grass'; else if (tag === 'terrain') k = 'terrain'; else if (tag === 'water') k = 'water'; else if (tag === 'dawnSky' || tag === 'nightSky' || (mt.side === THREE.BackSide && rad > 100)) k = 'sky';
    else if (charSet.has(o)) k = tag === 'player' ? 'hero' : 'characters/foes/NPCs';
    else if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || mt.blending === THREE.AdditiveBlending || (mt.transparent && !mt.depthWrite)) k = 'vfx/particles/glow';
    else if (mt.alphaTest > 0 || mt.alphaToCoverage) k = 'foliage (alpha-tested)';
    else if ((o as THREE.InstancedMesh).isInstancedMesh) k = 'instanced props';
    else if (rad > 3) k = 'buildings/landmarks (r>3)'; else k = 'props (r<=3)';
    const p = new THREE.Vector3(); o.getWorldPosition(p);
    c = [k, group, `${k} | ${group} | ${o.name || o.type} | ${mat.type} | r ${r1(rad)} @ ${Math.round(p.x)},${Math.round(p.z)}`]; cat.set(o, c); return c;
  }
  const orig = R.renderBufferDirect;
  R.renderBufferDirect = function (this: THREE.WebGLRenderer, camera, scene, geometry, material, object, group) {
    if (on) { const own = (object as THREE.Mesh).material as THREE.Material | THREE.Material[]; const mat = inShadow ? (Array.isArray(own) ? own[0] : own) ?? material : material;
      const [k, gname, label] = classify(object, mat); const pass = inShadow ? 'shadow' : 'main'; tallied++;
      inc(byCat, `${k}|${pass}`); inc(byGroup, `${gname}|${pass}`); inc(byMat, `${mat.type}|${pass}`); if (!inShadow) inc(byTr, mat.transparent ? 'transparent' : 'opaque'); inc(byObj, `${label} | ${pass}`); }
    return orig.call(this, camera, scene, geometry, material, object, group);
  } as typeof R.renderBufferDirect;
  const sm = R.shadowMap as unknown as { render: (...x: unknown[]) => void }; const smr = sm.render;
  sm.render = function (...x: unknown[]) { inShadow = true; try { smr.apply(this, x); } finally { inShadow = false; } };
  const fr = new THREE.Frustum(), pm = new THREE.Matrix4();
  function sampleVis() { const sc = active(); prepScene(sc); cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    const v: Cnt = { meshes: 0, visibleChain: 0, lodHidden: 0, inFrustum: 0, castShadow: 0, charactersInFrustum: 0 };
    const walk = (o: THREE.Object3D) => { if (!o.visible) return; const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints) { v.meshes++; v.visibleChain++;
        if (!o.layers.test(cam.layers)) v.lodHidden++; else { if (m.castShadow) v.castShadow++; if (!o.frustumCulled || fr.intersectsObject(o)) { v.inFrustum++; if (charSet.has(o)) v.charactersInFrustum++; } } }
      for (const c of o.children) walk(c); };
    walk(sc); for (const k in v) inc(vis, k, v[k]); visN++; }
  let visT = 0;
  return {
    start() { byCat = {}; byGroup = {}; byMat = {}; byTr = {}; byObj = {}; vis = {}; visN = 0; frames = 0; tallied = 0; on = true; prepScene(active()); visT = 0; },
    frame(now: number) { if (!on) return; frames++; if (now - visT > 1000) { visT = now; sampleVis(); } },
    stop(infoCallsAvg: number) { on = false; const F = Math.max(1, frames); const avg = (o: Cnt) => { const out: Record<string, number> = {}; for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1])) out[k] = r1(v / F); return out; };
      const pass = (o: Cnt) => { const r: Record<string, { main: number; shadow: number; total: number }> = {}; for (const [k, v] of Object.entries(o)) { const [n, ps] = k.split('|'); const e = (r[n] ??= { main: 0, shadow: 0, total: 0 }); e[ps as 'main' | 'shadow'] = r1(v / F); e.total = r1(e.main + e.shadow); } return Object.fromEntries(Object.entries(r).sort((a, b) => b[1].total - a[1].total)); };
      const top = Object.entries(byObj).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${r1(v / F)} · ${k}`);
      const vv: Record<string, number> = {}; for (const k in vis) vv[k] = r1(vis[k] / Math.max(1, visN));
      return { frames, talliedPerFrame: r1(tallied / F), infoCallsPerFrame: infoCallsAvg, byCategory: pass(byCat), byGroup: pass(byGroup), byMaterial: pass(byMat), mainTransparency: avg(byTr), topObjects: top, visibility: vv }; },
  };
}

/** Stall instrumentation: page lifecycle / focus / resize / WebGL context events, pixel-ratio changes, and long rAF gaps. */
export function startStalls(R: THREE.WebGLRenderer) {
  const t0 = performance.now(), ev: { t: number; e: string; hidden: boolean; v?: number }[] = [], gaps: Record<string, unknown>[] = [];
  const log = (e: string, v?: number) => { ev.push({ t: Math.round(performance.now() - t0), e, hidden: document.hidden, ...(v !== undefined ? { v } : {}) }); if (ev.length > 200) ev.shift(); };
  for (const e of ['blur', 'focus', 'pagehide', 'pageshow', 'resize', 'orientationchange']) addEventListener(e, () => log(e));
  document.addEventListener('visibilitychange', () => log('visibility:' + document.visibilityState));
  R.domElement.addEventListener('webglcontextlost', () => log('webglcontextlost')); R.domElement.addEventListener('webglcontextrestored', () => log('webglcontextrestored'));
  const spr = R.setPixelRatio.bind(R); R.setPixelRatio = (v: number) => { if (Math.abs(v - R.getPixelRatio()) > 1e-6) log('pixelRatio', v); spr(v); };
  return {
    gap(ts: number, gapMs: number, ctx: Record<string, unknown>) { if (gapMs <= 100) return; const t = Math.round(ts - t0);
      const near = ev.filter((x) => x.t >= t - gapMs - 1000 && x.t <= t + 200).map((x) => `${x.e}${x.v !== undefined ? '=' + x.v : ''}@${x.t}`);
      gaps.push({ t, gapMs: Math.round(gapMs), hidden: document.hidden, ...ctx, near }); if (gaps.length > 300) gaps.shift(); },
    out: () => ({ events: ev.slice(), gaps: gaps.slice() }),
    since: (tRel: number) => gaps.filter((g) => (g.t as number) >= tRel),
    now: () => Math.round(performance.now() - t0),
  };
}
