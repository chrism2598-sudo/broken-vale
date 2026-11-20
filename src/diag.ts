/**
 * M55 · DIAGNOSTICS BUILD ONLY (dist/diag/, loaded from main.ts behind the compile-time __DIAG__ flag; absent from production).
 *
 *   …/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&seq=base,pr0.75,shoff,vegoff,base
 *
 * Runs the M54 perfrun camera paths (meadow 360° orbit · underbridge sway · castle hall hold) once per config token, each
 * on an identical deterministic path: cool-down (nothing simulated or rendered) → warm-up → RUN seconds of recording.
 * One variable per token (combine with '+'):
 *   (tokens combine with '~', or '+' / '%2B' / space)
 *   base · pr1.25 | pr1 | pr0.75 (pixel ratio) · shoff (no shadow casting) | shhalf (shadow map every 2nd frame) | shfreeze
 *   (never re-rendered) · grassoff · foloff (alpha-tested foliage hidden) | folopaque (alpha test + A2C off) · vegoff (grass + foliage)
 *   · adaptoff (M56: Lite adaptive resolution held at the base ratio; any prN token also holds it) · ovl (live overlay DOM updates; default is collect-only) · lodspread (liteLod 1/6 per call) · simcapN (diag-only fixed-step cap).
 * Timing: frame intervals from rAF timestamps of presented frames. CPU breakdown: performance.now() on the main thread.
 * GPU: EXT_disjoint_timer_query_webgl2 (shadow pass vs main pass) when exposed, else "unsupported". Anything inferred from
 * CPU vs frame-time gaps is INDIRECT evidence, never GPU time. Saves: the diag build is read-only (diagguard.ts + save store).
 */
import * as THREE from 'three';
import { grassDiag } from './grass';

export interface Diag { idle: boolean; adaptOff: boolean; simCap: number; lodSpread: boolean; nSteps: number; lodTicks: number;
  b(ts: number): void; m(i: number): void; r0(): void; r1(): void; e(): void; lodMs(ms: number): void }
type Api = { renderer: THREE.WebGLRenderer; camera: THREE.Camera; grass: THREE.Object3D; params: URLSearchParams; quality: string; motion: () => string; activeScene: () => THREE.Scene; adapt: import('./adaptres').AdaptRes | null; adaptOn: () => boolean };
type V = { ready?: boolean; warp: (x: number, z: number) => void; view: (f: number, y: number, p: number, d: number) => void; enterCastle: (id: string) => Promise<void> | void;
  castle: () => { fading?: boolean; inCastle?: boolean }; castleAt: (x: number, z: number, y: number, f: number) => void; castlePeace: () => void };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const headless = () => !!navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);
const heapMB = () => { const pm = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory; return pm ? pm.usedJSHeapSize / 1048576 : NaN; };
const r1 = (v: number) => Math.round(v * 10) / 10, r2 = (v: number) => Math.round(v * 100) / 100;
function pct(a: ArrayLike<number>, n: number) { const s = Array.from({ length: n }, (_, i) => a[i]).filter((v) => !Number.isNaN(v)).sort((x, y) => x - y), k = s.length;
  const avg = k ? s.reduce((x, y) => x + y, 0) / k : 0, q = (p: number) => (k ? s[Math.min(k - 1, Math.floor(p * k))] : 0); const worst = s.slice(Math.floor(k * 0.99)); const wa = worst.length ? worst.reduce((x, y) => x + y, 0) / worst.length : 0;
  return { n: k, avg, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: k ? s[k - 1] : 0, worstAvg: wa }; }
function deviceInfo(gl: WebGL2RenderingContext) {
  const nav = navigator as Navigator & { deviceMemory?: number }; let gpu = 'unknown';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); } catch { /* */ }
  return { ua: navigator.userAgent, cores: navigator.hardwareConcurrency ?? null, deviceMemoryGB: nav.deviceMemory ?? null, screen: `${screen.width}x${screen.height} @${devicePixelRatio}x`, viewport: `${innerWidth}x${innerHeight}`, gpu };
}

const CAP = 12000; // recorded frames per run (60 s at up to 200 Hz)
export function startDiag(a: Api): Diag {
  const P = a.params, R = a.renderer, gl = R.getContext() as WebGL2RenderingContext;
  const SECS = Math.max(1, +(P.get('secs') ?? 60)), WARM = Math.max(0.5, +(P.get('warm') ?? 6)), COOL = Math.max(0, +(P.get('cool') ?? 15));
  const scene = P.get('diag') || '';
  // ---- per-frame record ----
  const F = { iv: new Float32Array(CAP), cpu: new Float32Array(CAP), sim: new Float32Array(CAP), oth: new Float32Array(CAP), grass: new Float32Array(CAP), rnd: new Float32Array(CAP),
    steps: new Uint8Array(CAP), lodT: new Uint8Array(CAP), lodMs: new Float32Array(CAP), swaps: new Uint8Array(CAP), heap: new Float32Array(CAP), calls: new Float32Array(CAP), tris: new Float32Array(CAP),
    gS: new Float32Array(CAP), gM: new Float32Array(CAP), t: new Float32Array(CAP) };
  let n = 0, recording = false, lastTs = -1, tB = 0, tL = 0, fc = 0, lodAcc = 0, swaps0 = 0, bytes0 = 0, shMode = '';
  const D: Diag = { idle: false, adaptOff: false, simCap: 7, lodSpread: false, nSteps: 0, lodTicks: 0,
    b(ts) { tB = tL = performance.now(); D.nSteps = 0; D.lodTicks = 0; lodAcc = 0; fc++; pollGpu();
      if (shMode === 'half') R.shadowMap.needsUpdate = fc % 2 === 0;
      if (recording && n < CAP) { F.iv[n] = lastTs >= 0 ? ts - lastTs : NaN; F.t[n] = ts; F.gS[n] = NaN; F.gM[n] = NaN; } lastTs = ts; },
    m(i) { const t = performance.now(), d = t - tL; tL = t; if (!recording || n >= CAP) return; if (i === 0) F.sim[n] = d; else if (i === 1) F.oth[n] = d; else F.grass[n] = d; },
    r0() { tL = performance.now(); if (gpu && recording && n < CAP) { segs = []; qBegin(1); } },
    r1() { const t = performance.now(); if (recording && n < CAP) F.rnd[n] = t - tL; tL = t; if (gpu && segs.length) { qEnd(); pending.push({ fi: n, segs }); segs = []; if (pending.length > 240) { const o = pending.shift()!; for (const s of o.segs) gl.deleteQuery(s.q); } } },
    e() { if (!recording || n >= CAP) return; const inf = R.info.render;
      F.cpu[n] = performance.now() - tB; F.steps[n] = Math.min(255, D.nSteps); F.lodT[n] = D.lodTicks; F.lodMs[n] = lodAcc; F.swaps[n] = grassDiag.swaps - swaps0; swaps0 = grassDiag.swaps;
      F.heap[n] = heapMB(); F.calls[n] = inf.calls; F.tris[n] = inf.triangles; n++; },
    lodMs(ms) { lodAcc += ms; } };
  // ---- GPU timer queries (shadow pass vs main pass) ----
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null; const gpu = !!ext && P.get('gpu') !== '0';
  type Seg = { q: WebGLQuery; k: 0 | 1 }; let segs: Seg[] = [], cur: Seg | null = null, disjoint = 0; const pending: { fi: number; segs: Seg[] }[] = [], pool: WebGLQuery[] = [];
  const qBegin = (k: 0 | 1) => { const q = pool.pop() ?? gl.createQuery()!; gl.beginQuery(ext!.TIME_ELAPSED_EXT, q); cur = { q, k }; segs.push(cur); };
  const qEnd = () => { if (cur) { gl.endQuery(ext!.TIME_ELAPSED_EXT); cur = null; } };
  if (gpu) { const sm = R.shadowMap as unknown as { render: (...x: unknown[]) => void }; const orig = sm.render;
    sm.render = function (...x: unknown[]) { if (!cur) return orig.apply(this, x); qEnd(); qBegin(0); orig.apply(this, x); qEnd(); qBegin(1); }; }
  function pollGpu() { if (!gpu || !pending.length) return; const dj = gl.getParameter(ext!.GPU_DISJOINT_EXT);
    while (pending.length) { const p = pending[0]; if (!p.segs.every((s) => gl.getQueryParameter(s.q, gl.QUERY_RESULT_AVAILABLE))) break; pending.shift();
      let sh = 0, mn = 0; for (const s of p.segs) { const ns = gl.getQueryParameter(s.q, gl.QUERY_RESULT) as number; if (s.k === 0) sh += ns; else mn += ns; pool.push(s.q); }
      if (dj) { disjoint++; continue; } if (p.fi < CAP) { F.gS[p.fi] = sh / 1e6; F.gM[p.fi] = mn / 1e6; } } }
  // ---- configs ----
  const basePR = Math.min(devicePixelRatio, a.quality === 'high' ? 1.75 : 1.25);
  let casters: THREE.Light[] = [], fol: { m: THREE.Mesh; mask: number; mats: { mt: THREE.Material & { alphaTest: number; alphaToCoverage: boolean }; at: number; a2c: boolean }[] }[] = [], folHide = false; const grassMask = a.grass.layers.mask;
  const isFol = (m: THREE.Mesh) => m.isMesh && m !== a.grass && (Array.isArray(m.material) ? m.material : [m.material]).some((x) => (x as THREE.Material).alphaTest > 0 || (x as THREE.Material).alphaToCoverage);
  function reset() {
    R.setPixelRatio(basePR); R.shadowMap.autoUpdate = true; R.shadowMap.needsUpdate = true; shMode = '';
    for (const l of casters) l.castShadow = true; casters = [];
    for (const f of fol) { f.m.layers.mask = f.mask; for (const x of f.mats) { if (x.mt.alphaTest !== x.at || x.mt.alphaToCoverage !== x.a2c) { x.mt.alphaTest = x.at; x.mt.alphaToCoverage = x.a2c; x.mt.needsUpdate = true; } } } fol = []; folHide = false;
    a.grass.layers.mask = grassMask; D.lodSpread = false; D.simCap = 7; ovl = false; D.adaptOff = false; a.adapt?.reset();
  }
  function collectFol() { if (fol.length) return; a.activeScene().traverse((o) => { const m = o as THREE.Mesh; if (isFol(m)) fol.push({ m, mask: m.layers.mask, mats: (Array.isArray(m.material) ? m.material : [m.material]).map((mt) => ({ mt: mt as never, at: (mt as THREE.Material).alphaTest, a2c: (mt as THREE.Material).alphaToCoverage })) }); }); }
  function apply(cfg: string): string[] {
    reset(); const notes: string[] = [];
    for (const tok of cfg.split(/[+ ~]/).filter(Boolean)) {
      const pr = /^pr([\d.]+)$/.exec(tok), sc = /^simcap(\d)$/.exec(tok);
      if (tok === 'base') continue;
      else if (pr) { D.adaptOff = true; R.setPixelRatio(+pr[1]); }
      else if (tok === 'adaptoff') D.adaptOff = true;
      else if (tok === 'shoff') a.activeScene().traverse((o) => { const l = o as THREE.Light; if (l.isLight && l.castShadow) { l.castShadow = false; casters.push(l); } });
      else if (tok === 'shhalf') { R.shadowMap.autoUpdate = false; shMode = 'half'; }
      else if (tok === 'shfreeze') { R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = true; shMode = 'freeze'; }
      else if (tok === 'grassoff') a.grass.layers.mask = 1 << 30;
      else if (tok === 'foloff') { collectFol(); folHide = true; }
      else if (tok === 'folopaque') { collectFol(); for (const f of fol) for (const x of f.mats) { x.mt.alphaTest = 0; x.mt.alphaToCoverage = false; x.mt.needsUpdate = true; } }
      else if (tok === 'vegoff') { a.grass.layers.mask = 1 << 30; collectFol(); folHide = true; }
      else if (tok === 'ovl') ovl = true;
      else if (tok === 'lodspread') D.lodSpread = true;
      else if (sc) D.simCap = Math.max(1, +sc[1]);
      else notes.push('unknown token ' + tok);
    }
    if (a.adapt && D.adaptOff) notes.push('adaptive resolution off'); else if (a.adapt && !a.adaptOn()) notes.push('adaptive resolution inactive (Smooth, High, or headless without &adapt=1)');
    if (fol.length) notes.push(`${fol.length} alpha-tested meshes`);
    return notes;
  }
  const hideFol = () => { if (folHide) for (const f of fol) f.m.layers.mask = 1 << 30; }; // re-applied each frame (liteLod may restore masks)
  // ---- UI ----
  const badge = document.createElement('div'); badge.id = 'diagbadge'; badge.textContent = 'DIAG BUILD · saves read-only';
  badge.style.cssText = 'position:fixed;right:6px;top:6px;z-index:99999;pointer-events:none;font:10px ui-monospace,monospace;color:#ffd890;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:5px';
  document.body.appendChild(badge);
  const el = document.createElement('div'); el.id = 'diaghud'; el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;pointer-events:none;font:11px/1.35 ui-monospace,monospace;color:#e8f0e0;background:rgba(0,0,0,.62);padding:5px 7px;border-radius:6px;white-space:pre';
  let ovl = false; const W = (window as unknown as { __diag: Record<string, unknown> }); W.__diag = { result: null, status: 'idle', blocked: () => (window as unknown as { __diagBlocked?: string[] }).__diagBlocked ?? [] };
  const status = (s: string) => { (W.__diag as Record<string, unknown>).status = s; if (!ovl) el.textContent = s; };
  if (!scene) return D; document.body.appendChild(el);
  const seq = (P.get('seq') || 'base').split(',').filter(Boolean);
  void (async () => {
    const V = () => (window as unknown as { __vale: V }).__vale; while (!V()?.ready) await sleep(100);
    const title = document.getElementById('title'); if (title && !title.hidden) (document.getElementById('tcont') as HTMLButtonElement | null)?.click(); await sleep(500);
    let path: (k: number) => void = () => {};
    if (scene === 'castle') { await V().enterCastle('pale'); for (let i = 0; i < 300 && (!V().castle().inCastle || V().castle().fading); i++) await sleep(100); V().castlePeace(); path = () => { V().castleAt(0, 2.6, 0, Math.PI); V().view(Math.PI, 0, -0.12, 6.5); }; }
    else if (scene === 'underbridge') path = (k) => { if (k === 0) V().warp(-45, -55.9); V().view(0.7, 0.7 - Math.PI + Math.sin(k * Math.PI * 2) * 0.6, 0.25, 4); };
    else path = (k) => { if (k === 0) V().warp(0, 6); V().view(Math.PI, k * Math.PI * 2, 0.1, 7); }; // meadow: one slow 360° orbit
    const runs: Record<string, unknown>[] = [];
    for (let i = 0; i < seq.length; i++) {
      if (i > 0 && COOL > 0) { D.idle = true; status(`DIAG ${i + 1}/${seq.length} cooling down ${COOL} s (nothing rendered)…`); await sleep(COOL * 1000); D.idle = false; }
      const cfg = seq[i], notes = apply(cfg); path(0); if (scene === 'castle') path(0);
      status(`DIAG ${i + 1}/${seq.length} [${cfg}] warm-up ${WARM} s…`); const w0 = performance.now(); while (performance.now() - w0 < WARM * 1000) { hideFol(); await new Promise((r) => requestAnimationFrame(r)); }
      status(`DIAG ${i + 1}/${seq.length} [${cfg}] recording ${SECS} s${ovl ? '' : ' · collect-only (no live overlay)'}`);
      n = 0; lastTs = -1; swaps0 = grassDiag.swaps; bytes0 = grassDiag.bytes; disjoint = 0; a.adapt?.resetStats(); recording = true; const t0 = performance.now(); let shown = 0;
      while (performance.now() - t0 < SECS * 1000) { const k = (performance.now() - t0) / (SECS * 1000); path(k); hideFol();
        if (ovl && performance.now() - shown > 500) { shown = performance.now(); const s = pct(F.iv.subarray(Math.max(1, n - 120), n), Math.max(0, Math.min(120, n - 1))); el.textContent = `DIAG [${cfg}] ${(k * 100).toFixed(0)}%\nFPS ${s.avg ? (1000 / s.avg).toFixed(1) : '…'}  p95 ${s.p95.toFixed(1)} ms\ncalls ${R.info.render.calls}  tris ${(R.info.render.triangles / 1000).toFixed(0)}k\nPR ${R.getPixelRatio()}${a.adapt ? (a.adaptOn() ? ' adaptive' : ' fixed') : ''}`; }
        await new Promise((r) => requestAnimationFrame(r)); }
      recording = false; for (let k = 0; k < 30 && pending.length; k++) { await new Promise((r) => requestAnimationFrame(r)); pollGpu(); }
      runs.push(summarize(cfg, notes, grassDiag.bytes - bytes0));
    }
    reset();
    const out = { label: headless() ? 'HEADLESS ESTIMATE' : 'DEVICE', kind: 'M55 diag', scene, quality: a.quality, motion: a.motion(), seq, secs: SECS, warm: WARM, cool: COOL,
      gpuTimer: gpu ? 'EXT_disjoint_timer_query_webgl2' : 'unsupported', build: document.querySelector<HTMLScriptElement>('script[type=module][src*="index-"]')?.src.split('/').pop() ?? 'unknown',
      device: deviceInfo(gl), at: new Date().toISOString(), note: 'CPU = main-thread performance.now(). Frame-time not explained by CPU is INDIRECT evidence (GPU/compositor/vsync), never GPU time. GPU time only from timer queries.', runs };
    (W.__diag as Record<string, unknown>).result = out; status('DIAG done'); showCard(out);
  })();
  function summarize(cfg: string, notes: string[], bytes: number) {
    const N = n, iv = pct(F.iv, N), cpu = pct(F.cpu, N), st = (arr: Float32Array) => { const s = pct(arr, N); return { avg: r2(s.avg), p95: r2(s.p95), max: r2(s.max) }; };
    const hist = [0, 0, 0, 0, 0]; let capHits = 0; for (let i = 0; i < N; i++) { hist[Math.min(4, F.steps[i])]++; if (F.steps[i] >= D.simCap && D.simCap < 7) capHits++; }
    const simBy = [1, 2, 3].map((k) => { let s = 0, c = 0; for (let i = 0; i < N; i++) if ((k < 3 ? F.steps[i] === k : F.steps[i] >= 3)) { s += F.sim[i]; c++; } return c ? r2(s / c) : null; });
    // Long-interval attribution: interval i is the gap BEFORE frame i, so the work that preceded it is frame i-1's.
    const conds: Record<string, (i: number) => boolean> = { prevSteps2: (i) => F.steps[i - 1] >= 2, prevLodTick: (i) => F.lodT[i - 1] > 0, prevGrassSwap: (i) => F.swaps[i - 1] > 0,
      prevCpuOver16: (i) => F.cpu[i - 1] > 16, heapDrop: (i) => F.heap[i] < F.heap[i - 1] - 1, prevLong: (i) => F.iv[i - 1] > 33, nextSteps2: (i) => i + 1 < N && F.steps[i] >= 2 };
    let nl = 0; const hit: Record<string, number> = {}, base: Record<string, number> = {}; for (const k in conds) { hit[k] = 0; base[k] = 0; }
    for (let i = 2; i < N; i++) { const long = F.iv[i] > 33; if (long) nl++; for (const k in conds) { const c = conds[k](i); if (c) base[k]++; if (c && long) hit[k]++; } }
    const corr: Record<string, unknown> = { longFrames: nl }; for (const k in conds) corr[k] = { pctOfLong: nl ? r1((hit[k] / nl) * 100) : 0, pctOfAll: N > 2 ? r1((base[k] / (N - 2)) * 100) : 0 };
    const heapOk = !Number.isNaN(F.heap[0]); if (!heapOk) corr.heapDrop = 'unavailable';
    // Long frames vs CPU: of long intervals, how many had a preceding CPU frame cost under 12 ms (time not explained by main-thread work → INDIRECT)
    let unexpl = 0; for (let i = 2; i < N; i++) if (F.iv[i] > 33 && F.cpu[i - 1] < 12) unexpl++; corr.longWithPrevCpuUnder12 = nl ? r1((unexpl / nl) * 100) : 0;
    const trend: number[] = []; if (N > 1) { const t0 = F.t[0]; let b = 0, c = 0; for (let i = 1; i < N; i++) { const bk = Math.floor((F.t[i] - t0) / 10000); if (bk !== b) { trend.push(r1(c / 10)); b = bk; c = 0; } c++; } trend.push(r1(c / Math.max(0.001, ((F.t[N - 1] - t0) / 1000) - b * 10))); }
    const gS = pct(F.gS, N), gM = pct(F.gM, N), gT = pct(F.gS.map((v, i) => v + F.gM[i]), N);
    const gpuRes = !gpu ? 'unsupported' : gT.n === 0 ? `no results (disjoint ${disjoint})` : { samples: gT.n, disjoint, shadowMs: { avg: r2(gS.avg), p95: r2(gS.p95), max: r2(gS.max) }, mainMs: { avg: r2(gM.avg), p95: r2(gM.p95), max: r2(gM.max) }, totalMs: { avg: r2(gT.avg), p95: r2(gT.p95), max: r2(gT.max) } };
    const calls = pct(F.calls, N), tris = pct(F.tris, N);
    return { cfg, notes, pixelRatio: R.getPixelRatio(), drawingBuffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`, frames: N, fpsAvg: iv.avg ? r1(1000 / iv.avg) : 0, fps1Low: iv.worstAvg ? r1(1000 / iv.worstAvg) : 0,
      frameMs: { avg: r1(iv.avg), p50: r1(iv.p50), p95: r1(iv.p95), p99: r1(iv.p99), max: r1(iv.max) }, long33: Array.from(F.iv.subarray(0, N)).filter((v) => v > 33).length, long50: Array.from(F.iv.subarray(0, N)).filter((v) => v > 50).length,
      drawCalls: { avg: Math.round(calls.avg), max: calls.max }, triangles: { avg: Math.round(tris.avg), max: tris.max }, gpu: gpuRes,
      cpuMs: { frame: { avg: r2(cpu.avg), p95: r2(cpu.p95), max: r2(cpu.max) }, simInclLod: st(F.sim), other: st(F.oth), grassPump: st(F.grass), renderSubmit: st(F.rnd), liteLod: st(F.lodMs) },
      counts: { stepsHist: { '0': hist[0], '1': hist[1], '2': hist[2], '3': hist[3], '4+': hist[4] }, simMsBySteps: { '1': simBy[0], '2': simBy[1], '3+': simBy[2] }, simCap: D.simCap, simCapHits: capHits,
        grassSwaps: Array.from(F.swaps.subarray(0, N)).reduce((x, y) => x + y, 0), grassUploadMB: r1(bytes / 1048576), liteLodTicks: Array.from(F.lodT.subarray(0, N)).reduce((x, y) => x + y, 0) },
      adapt: a.adapt ? a.adapt.stats(a.adaptOn()) : 'n/a (High)', longFrameCorrelation: corr, fpsPer10s: trend, jsHeapMB: heapOk ? Math.round(heapMB()) : 'unavailable' };
  }
  function showCard(out: Record<string, unknown>) {
    el.remove(); const runs = out.runs as ReturnType<typeof summarize>[]; const dev = out.device as ReturnType<typeof deviceInfo>;
    const pad = (s: unknown, w: number) => String(s).padEnd(w).slice(0, w);
    const g = (r: ReturnType<typeof summarize>) => typeof r.gpu === 'string' ? '-' : `${r.gpu.shadowMs.avg}+${r.gpu.mainMs.avg}`;
    let txt = `M56 DIAG · ${out.label} · ${out.scene} · ${String(out.quality).toUpperCase()} · motion ${out.motion} · ${out.secs} s each\nGPU timer: ${out.gpuTimer}\n` +
      `${pad('cfg', 14)}fps  1%lo p50  p95  p99  >33 >50 calls tris gpuS+M\n`;
    for (const r of runs) txt += `${pad(r.cfg, 14)}${pad(r.fpsAvg, 5)}${pad(r.fps1Low, 5)}${pad(r.frameMs.p50, 5)}${pad(r.frameMs.p95, 5)}${pad(r.frameMs.p99, 5)}${pad(r.long33, 4)}${pad(r.long50, 4)}${pad(r.drawCalls.avg, 6)}${pad(Math.round(r.triangles.avg / 1000) + 'k', 5)}${g(r)}\n`;
    for (const r of runs) { const A = r.adapt; if (typeof A === 'object') txt += `\n[${r.cfg}] adaptive res ${A.enabled ? 'ON' : 'off'} · PR now ${A.current} min ${A.min} max ${A.max} · steps ${A.steps} (down ${A.down} up ${A.up}) · s at PR ${Object.entries(A.timeAtS).map(([k, v]) => k + ':' + v).join(' ')}`; }
    for (const r of runs) { const c = r.cpuMs, k = r.counts, L = r.longFrameCorrelation as Record<string, { pctOfLong: number; pctOfAll: number } | number | string>, f = (x: string) => { const v = L[x]; return typeof v === 'object' ? `${v.pctOfLong}% (all ${v.pctOfAll}%)` : String(v); };
      txt += `\n[${r.cfg}] PR ${r.pixelRatio} ${r.drawingBuffer} · max ${r.frameMs.max} ms${r.notes.length ? ' · ' + r.notes.join('; ') : ''}\n cpu ms avg/p95: frame ${c.frame.avg}/${c.frame.p95} sim ${c.simInclLod.avg}/${c.simInclLod.p95} grass ${c.grassPump.avg}/${c.grassPump.p95} render ${c.renderSubmit.avg}/${c.renderSubmit.p95} lod ${c.liteLod.avg}/${c.liteLod.max}max\n` +
        ` steps 0:${k.stepsHist['0']} 1:${k.stepsHist['1']} 2:${k.stepsHist['2']} 3:${k.stepsHist['3']} 4+:${k.stepsHist['4+']} · sim ms by steps 1:${k.simMsBySteps['1']} 2:${k.simMsBySteps['2']} 3+:${k.simMsBySteps['3+']} · grass swaps ${k.grassSwaps} (${k.grassUploadMB} MB) · lod ticks ${k.liteLodTicks}\n` +
        ` long>33 (${L.longFrames}) preceded by: steps>=2 ${f('prevSteps2')} · lod ${f('prevLodTick')} · swap ${f('prevGrassSwap')} · cpu>16 ${f('prevCpuOver16')} · long ${f('prevLong')} · GC ${f('heapDrop')} · cpu<12 (indirect: not main-thread) ${L.longWithPrevCpuUnder12}%\n` +
        ` fps/10s ${r.fpsPer10s.join(' ')}${typeof r.gpu === 'string' ? '' : ` · GPU ms avg/p95 shadow ${r.gpu.shadowMs.avg}/${r.gpu.shadowMs.p95} main ${r.gpu.mainMs.avg}/${r.gpu.mainMs.p95}`}\n`; }
    txt += `\ndevice: ${dev.screen} · viewport ${dev.viewport} · ${dev.cores ?? '?'} cores · ${dev.deviceMemoryGB ?? '?'} GB · GPU ${dev.gpu}\nUA: ${dev.ua}\nbuild ${out.build} · ${out.at}\n(DIAG build: the save is never written)`;
    const card = document.createElement('div'); card.id = 'diagcard';
    card.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100000;width:min(96vw,560px);max-height:92vh;overflow:auto;font:10.5px/1.4 ui-monospace,Menlo,monospace;color:#f2f5ec;background:rgba(12,14,12,.95);border:2px solid ' + (out.label === 'DEVICE' ? '#8fd18f' : '#e0b050') + ';border-radius:10px;padding:10px 12px;white-space:pre-wrap;word-break:break-word';
    const pre = document.createElement('div'); pre.textContent = txt; card.appendChild(pre);
    const btn = document.createElement('button'); btn.textContent = 'Copy JSON'; btn.style.cssText = 'position:sticky;bottom:0;margin-top:8px;font:inherit;font-size:13px;padding:6px 12px;border-radius:6px;border:1px solid #888;background:#2a2f2a;color:#fff';
    btn.onclick = () => { const j = JSON.stringify(out, null, 1); void navigator.clipboard?.writeText(j).then(() => { btn.textContent = 'Copied ✓'; }, () => { btn.textContent = 'Copy failed: long-press the text instead'; }); };
    card.appendChild(btn); document.body.appendChild(card);
  }
  return D;
}
