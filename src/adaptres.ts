/**
 * M56 · Lite adaptive render resolution (pixel ratio only; nothing else in the scene changes).
 * Holds the Lite pixel ratio min(DPR, 1.25) while presented frames are on time. Presented-frame intervals (rAF timestamps)
 * go into a rolling 180-frame (~3 s at 60 Hz) window, evaluated every 0.5 s once it holds ≥ 60 frames:
 *   · p95 > 20 ms (budget 16.7 ms + vsync jitter) on 3 consecutive evaluations → one step down (−0.1, floor 0.8)
 *   · p99 ≤ 20 ms (≤ 1% missed frames; stricter than the step-down test) continuously for the up-hold (4 s, doubled up to 64 s whenever an up step had to be undone within 4 s,
 *     halved again after 30 s stable) → one step up toward the base ratio
 *   · never more than one change every 1.5 s (down) / 3 s (up); 0.4 s settle after any change or resume (the resize frame
 *     itself is never counted); gaps > 250 ms (tab switch, loading) clear the window instead of counting as slow.
 * A change is one renderer.setPixelRatio() (a single canvas/back-buffer resize; Lite has no composer or extra render targets).
 */
import type * as THREE from 'three';

export interface AdaptStats { enabled: boolean; current: number; base: number; floor: number; min: number; max: number; steps: number; down: number; up: number; level: number;
  timeAtS: Record<string, number>; resizeMsMax: number; upHoldS: number }
export interface AdaptRes { feed(ivMs: number, nowMs: number): void; idle(): void; reset(): void; resetStats(): void; stats(enabled: boolean): AdaptStats; ratio(): number }

export function createAdaptRes(R: THREE.WebGLRenderer, base: number, floor = 0.8): AdaptRes {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const L: number[] = [r2(base)]; for (let p = base - 0.1; p > floor + 1e-3; p -= 0.1) L.push(r2(p)); if (base > floor + 1e-3) L.push(floor);
  const WIN = 180, win = new Float32Array(WIN), srt = new Float32Array(WIN); let wn = 0, wi = 0;
  let level = 0, settle = 0, evalAt = 0, lastEval = -1, slowEv = 0, okMs = 0, lastChange = -1e9, lastUp = -1e9, upHold = 4000, lastNow = -1;
  let steps = 0, down = 0, up = 0, mn = L[0], mx = L[0], resizeMsMax = 0; const timeAt: Record<string, number> = {};
  const clear = () => { wn = 0; wi = 0; slowEv = 0; okMs = 0; lastEval = -1; };
  const set = (lv: number, now: number) => {
    level = lv; const pr = L[lv], t0 = performance.now(); R.setPixelRatio(pr); resizeMsMax = Math.max(resizeMsMax, performance.now() - t0);
    steps++; mn = Math.min(mn, pr); mx = Math.max(mx, pr); lastChange = now; settle = now + 400; clear(); };
  const pq = (): [number, number] => { srt.set(win.subarray(0, wn)); const s = srt.subarray(0, wn).sort(); return [s[Math.min(wn - 1, Math.floor(0.95 * wn))], s[Math.min(wn - 1, Math.floor(0.99 * wn))]]; };
  return {
    feed(iv, now) {
      if (lastNow >= 0 && now > lastNow) { const k = L[level].toFixed(2); timeAt[k] = (timeAt[k] ?? 0) + Math.min(250, now - lastNow); } lastNow = now;
      if (!(iv > 0) || iv > 250) { clear(); settle = now + 400; return; }
      if (now < settle) return;
      win[wi] = iv; wi = (wi + 1) % WIN; wn = Math.min(WIN, wn + 1);
      if (now < evalAt || wn < 60) return; evalAt = now + 500;
      const [p, p99] = pq(), dtE = lastEval < 0 ? 0 : now - lastEval; lastEval = now;
      slowEv = p > 20 ? slowEv + 1 : 0; okMs = p99 <= 20 ? okMs + dtE : 0; // headroom = ≤ 1% missed (stricter than the step-down test: hysteresis)
      if (lastUp > lastChange - 1 && now - lastUp > 30000 && upHold > 4000) { upHold = Math.max(4000, upHold / 2); lastUp = now; }
      if (slowEv >= 3 && level < L.length - 1 && now - lastChange >= 1500) { if (now - lastUp < 4000) upHold = Math.min(64000, upHold * 2); down++; set(level + 1, now); return; }
      if (okMs >= upHold && level > 0 && now - lastChange >= 3000) { up++; set(level - 1, now); lastUp = now; }
    },
    idle() { clear(); lastNow = -1; settle = 0; evalAt = 0; },
    reset() { clear(); lastNow = -1; settle = 0; evalAt = 0; lastChange = -1e9; lastUp = -1e9; upHold = 4000; if (level !== 0) { level = 0; R.setPixelRatio(L[0]); } },
    resetStats() { steps = down = up = 0; mn = mx = L[level]; resizeMsMax = 0; for (const k in timeAt) delete timeAt[k]; },
    stats(enabled) { const t: Record<string, number> = {}; for (const k in timeAt) t[k] = Math.round(timeAt[k] / 100) / 10;
      return { enabled, current: L[level], base: L[0], floor: L[L.length - 1], min: mn, max: mx, steps, down, up, level, timeAtS: t, resizeMsMax: r2(resizeMsMax), upHoldS: upHold / 1000 }; },
    ratio: () => L[level],
  };
}
