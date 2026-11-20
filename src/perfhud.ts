/**
 * M53/M54 · `?perf=1` performance overlay + `?perf=1&perfrun=meadow|castle|underbridge` 60-second measurement.
 * Loaded only with the flag (dynamic import from main.ts): zero cost otherwise.
 *
 * Frame timing counts PRESENTED frames (renderer.info.render.frame advanced since the previous animation frame), so the
 * Smooth-motion pacing (which skips rendering on some vsyncs) is measured as the player sees it, not as raw vsync callbacks.
 * Draw calls / triangles come from renderer.info for the last rendered frame. Memory: performance.memory (JS heap only)
 * where the browser exposes it, otherwise "unavailable" (never estimated). Results are labelled DEVICE, or HEADLESS ESTIMATE
 * when the page runs under automation (navigator.webdriver / HeadlessChrome) — software rendering, not phone numbers.
 * A perf run puts the save store in read-only mode (main.ts), so measuring never touches the player's progress.
 */
type Info = { calls: number; triangles: number; frame: number };
type Opts = { ready: () => boolean; info: () => Info; quality: () => string; run: string | null; adapt?: () => Record<string, unknown> | null };
type Stats = { fps: number; low1: number; avg: number; p50: number; p95: number; p99: number; max: number; n: number; long33: number; long50: number; long33All: number; long50All: number; frames: number;
  calls: number; tris: number; firstFrameMs: number | null; readyMs: number | null; memMB: number | null; memLimitMB: number | null };
type V = { warp: (x: number, z: number) => void; view: (f: number, y: number, p: number, d: number) => void; enterCastle: (id: string) => Promise<void> | void; castle: () => { fading?: boolean; inCastle?: boolean };
  castleAt: (x: number, z: number, y: number, f: number) => void; castlePeace: () => void };
export const RUN_SECS = 60, WARM_SECS = 5;

function summarize(ms: number[]) {
  const a = [...ms].sort((x, y) => x - y), n = a.length, avg = n ? a.reduce((s, v) => s + v, 0) / n : 0, pct = (p: number) => n ? a[Math.min(n - 1, Math.floor(p * n))] : 0;
  const worst = a.slice(Math.floor(n * 0.99)), worstAvg = worst.length ? worst.reduce((s, v) => s + v, 0) / worst.length : 0;
  return { n, avg, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: n ? a[n - 1] : 0, fps: avg ? 1000 / avg : 0, low1: worstAvg ? 1000 / worstAvg : 0, long33: a.filter((v) => v > 33).length, long50: a.filter((v) => v > 50).length };
}
function deviceInfo() {
  const nav = navigator as Navigator & { deviceMemory?: number }; let gpu = 'unknown';
  try { const c = document.querySelector('canvas') as HTMLCanvasElement | null; const gl = (c?.getContext('webgl2') || c?.getContext('webgl')) as WebGLRenderingContext | null; const ext = gl?.getExtension('WEBGL_debug_renderer_info'); if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); } catch { /* */ }
  return { ua: navigator.userAgent, cores: navigator.hardwareConcurrency ?? null, deviceMemoryGB: nav.deviceMemory ?? null, screen: `${screen.width}×${screen.height} @${devicePixelRatio}x`, viewport: `${innerWidth}×${innerHeight}`, gpu };
}
const headless = () => !!navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);
const mem = () => { const pm = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory; return pm ? { memMB: pm.usedJSHeapSize / 1048576, memLimitMB: pm.jsHeapSizeLimit / 1048576 } : { memMB: null, memLimitMB: null }; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startPerfHud(o: Opts): void {
  const W = 300, buf: number[] = []; let lastT = -1, lastFrame = -1, frames = 0, long33All = 0, long50All = 0, calls = 0, tris = 0;
  let firstFrameMs: number | null = null, readyMs: number | null = null;
  // per-run collection (perfrun)
  let rec: { ms: number[]; calls: number[]; tris: number[] } | null = null;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#e8f0e0;background:rgba(0,0,0,.62);padding:5px 7px;border-radius:6px;white-space:pre';
  document.body.appendChild(el);
  const adaptLine = () => { const A = o.adapt?.() as { enabled: boolean; current: number; min: number; max: number; steps: number } | null | undefined; return A ? `\nres: PR ${A.current} ${A.enabled ? 'adaptive' : 'fixed'} (min ${A.min} max ${A.max}, ${A.steps} steps)` : ''; }; // M56
  const stats = (): Stats => { const s = summarize(buf); return { ...s, long33All, long50All, frames, calls, tris, firstFrameMs, readyMs, ...mem() }; };
  let result: unknown = null;
  (window as unknown as { __perf: unknown }).__perf = { stats, result: () => result, reset: () => { buf.length = 0; long33All = 0; long50All = 0; frames = 0; } };
  let shown = 0;
  const tick = (t: number) => {
    if (firstFrameMs === null && document.querySelector('canvas')) firstFrameMs = t;
    if (readyMs === null && o.ready()) readyMs = performance.now();
    const inf = o.info();
    if (inf.frame !== lastFrame) { // a frame was presented since the previous callback
      if (lastT >= 0 && lastFrame >= 0) { const d = t - lastT; buf.push(d); if (buf.length > W) buf.shift(); frames++; if (d > 33) long33All++; if (d > 50) long50All++; if (rec) rec.ms.push(d); }
      lastT = t; lastFrame = inf.frame;
      if (inf.calls > 0) { calls = inf.calls; tris = inf.triangles; if (rec) { rec.calls.push(calls); rec.tris.push(tris); } }
    }
    if (t - shown > 500) { shown = t; const s = stats(); const f = (v: number | null) => v === null ? '…' : (v / 1000).toFixed(2) + ' s';
      el.textContent = `${o.run ? 'PERF RUN ' + o.run + ' · ' : ''}FPS ${s.fps.toFixed(1)}  (${s.n} frames)\nframe avg ${s.avg.toFixed(1)}  p95 ${s.p95.toFixed(1)}  p99 ${s.p99.toFixed(1)} ms\nlong >33ms ${s.long33}  >50ms ${s.long50}  (since start ${s.long33All}/${s.long50All})\ncalls ${s.calls}  tris ${(s.tris / 1000).toFixed(0)}k\nload: first frame ${f(s.firstFrameMs)}  ready ${f(s.readyMs)}\n` +
        (s.memMB === null ? 'memory: unavailable' : `memory: JS heap ${s.memMB.toFixed(0)} / ${s.memLimitMB!.toFixed(0)} MB`) + adaptLine(); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { lastT = -1; }); // a hidden tab is not a long frame

  if (!o.run) return;
  const scene = o.run;
  void (async () => {
    while (!o.ready()) await sleep(100);
    const V = (window as unknown as { __vale: V }).__vale;
    const title = document.getElementById('title'); if (title && !title.hidden) (document.getElementById('tcont') as HTMLButtonElement | null)?.click();
    await sleep(500);
    let orbit: ((k: number) => void) | null = null;
    if (scene === 'castle') { await V.enterCastle('pale'); for (let i = 0; i < 300 && (!V.castle().inCastle || V.castle().fading); i++) await sleep(100); V.castlePeace(); V.castleAt(0, 2.6, 0, Math.PI); V.view(Math.PI, 0, -0.12, 6.5); }
    else if (scene === 'underbridge') { V.warp(-45, -55.9); V.view(0.7, 0.7 - Math.PI, 0.25, 4); orbit = (k) => V.view(0.7, 0.7 - Math.PI + Math.sin(k * Math.PI * 2) * 0.6, 0.25, 4); }
    else { V.warp(0, 6); V.view(Math.PI, 0, 0.1, 7); orbit = (k) => V.view(Math.PI, k * Math.PI * 2, 0.1, 7); } // meadow (spawn hub): one slow 360° orbit
    el.textContent = `PERF RUN ${scene}: warming up ${WARM_SECS} s…`;
    await sleep(WARM_SECS * 1000);
    rec = { ms: [], calls: [], tris: [] }; const t0 = performance.now();
    while (performance.now() - t0 < RUN_SECS * 1000) { if (orbit) orbit((performance.now() - t0) / (RUN_SECS * 1000)); await new Promise((r) => requestAnimationFrame(r)); }
    const r = rec; rec = null;
    const s = summarize(r.ms), avgOf = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    result = { label: headless() ? 'HEADLESS ESTIMATE' : 'DEVICE', scene, quality: o.quality(), seconds: RUN_SECS, frames: s.n,
      fpsAvg: +s.fps.toFixed(1), fps1Low: +s.low1.toFixed(1), frameMs: { avg: +s.avg.toFixed(1), p50: +s.p50.toFixed(1), p95: +s.p95.toFixed(1), p99: +s.p99.toFixed(1), max: +s.max.toFixed(1) },
      long33: s.long33, long50: s.long50, drawCalls: { avg: Math.round(avgOf(r.calls)), max: Math.max(0, ...r.calls) }, triangles: { avg: Math.round(avgOf(r.tris)), max: Math.max(0, ...r.tris) },
      load: { firstFrameS: firstFrameMs === null ? null : +(firstFrameMs / 1000).toFixed(2), readyS: readyMs === null ? null : +(readyMs / 1000).toFixed(2) },
      jsHeapMB: mem().memMB === null ? 'unavailable' : +mem().memMB!.toFixed(0), adapt: o.adapt?.() ?? null, device: deviceInfo(), build: document.querySelector<HTMLScriptElement>('script[type=module][src*="index-"]')?.src.split('/').pop() ?? 'unknown', at: new Date().toISOString() };
    showCard(result as Record<string, unknown>);
  })();
}

function showCard(r: Record<string, unknown>) {
  const R = r as { label: string; scene: string; quality: string; frames: number; fpsAvg: number; fps1Low: number; frameMs: Record<string, number>; long33: number; long50: number; drawCalls: { avg: number; max: number }; triangles: { avg: number; max: number }; load: { firstFrameS: number | null; readyS: number | null }; jsHeapMB: number | string; device: Record<string, unknown>; build: string; at: string };
  const card = document.createElement('div'); card.id = 'perfcard';
  card.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100000;width:min(92vw,380px);font:13px/1.45 ui-monospace,Menlo,monospace;color:#f2f5ec;background:rgba(12,14,12,.94);border:2px solid ' + (R.label === 'DEVICE' ? '#8fd18f' : '#e0b050') + ';border-radius:10px;padding:12px 14px;white-space:pre-wrap;word-break:break-word';
  const d = R.device as { ua: string; cores: number | null; deviceMemoryGB: number | null; screen: string; viewport: string; gpu: string };
  const txt = `${R.label} · ${R.scene} · ${R.quality.toUpperCase()} · ${RUN_SECS} s\n` +
    `FPS avg ${R.fpsAvg}   1% low ${R.fps1Low}   (${R.frames} frames)\n` +
    `frame ms avg ${R.frameMs.avg}  p50 ${R.frameMs.p50}  p95 ${R.frameMs.p95}  p99 ${R.frameMs.p99}  max ${R.frameMs.max}\n` +
    `long frames >33 ms ${R.long33}   >50 ms ${R.long50}\n` +
    `draw calls ${R.drawCalls.avg} (max ${R.drawCalls.max})   triangles ${(R.triangles.avg / 1000).toFixed(0)}k (max ${(R.triangles.max / 1000).toFixed(0)}k)\n` +
    `load: first frame ${R.load.firstFrameS ?? '?'} s   ready ${R.load.readyS ?? '?'} s\n` +
    `memory: ${typeof R.jsHeapMB === 'number' ? 'JS heap ' + R.jsHeapMB + ' MB' : 'unavailable'}\n` +
    `device: ${d.screen} · viewport ${d.viewport} · ${d.cores ?? '?'} cores · ${d.deviceMemoryGB ?? '?'} GB · GPU ${d.gpu}\nUA: ${d.ua}\nbuild ${R.build} · ${R.at}\n(progress is not saved during a perf run)`;
  const pre = document.createElement('div'); pre.textContent = txt; card.appendChild(pre);
  const btn = document.createElement('button'); btn.textContent = 'Copy JSON'; btn.style.cssText = 'margin-top:8px;font:inherit;padding:6px 12px;border-radius:6px;border:1px solid #888;background:#2a2f2a;color:#fff';
  btn.onclick = () => { const j = JSON.stringify(r, null, 1); void navigator.clipboard?.writeText(j).then(() => { btn.textContent = 'Copied ✓'; }, () => { btn.textContent = 'Copy failed: long-press the text instead'; }); };
  card.appendChild(btn); document.body.appendChild(card);
}
