/** M18 · Sound: original procedural ambient music per region (WebAudio synthesis, no samples) with crossfades, plus footsteps,
 *  sword, hit, reward and UI sounds. One AudioContext, created/resumed on the first user gesture. Setting: localStorage 'vale3d-sound'. */
export type Region = 'meadow' | 'coast' | 'cave' | 'keeper' | 'ending';
export type Surface = 'grass' | 'gravel' | 'stone' | 'sand' | 'water';
const SND_KEY = 'vale3d-sound', VOL_KEY = 'vale3d-music';
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// MIDI note sets
const D_PENT = [62, 64, 66, 69, 71, 74, 76, 78];
const A_DOR = [69, 71, 72, 74, 76, 78, 79, 81];
const D_MIN_PENT = [74, 77, 79, 81, 84, 86];
const KEEP_OST = [50, 50, 53, 50, 48, 50, 45, 48];
const END_CHORDS = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]]; // D A Bm G
const MEAD_PADS = [[50, 57], [55, 62], [47, 54], [45, 52]];
const COAST_PADS = [[45, 52, 60], [43, 50, 59]];

type Reg = { g: GainNode; step: number; next: number; dur: number };
export class GameAudio {
  ctx: AudioContext | null = null; private master!: GainNode; private music!: GainNode; private sfx!: GainNode; private send!: GainNode; private noise!: AudioBuffer;
  private regs = {} as Record<Region, Reg>; region: Region = 'meadow'; private timer = 0;
  enabled = (() => { try { return localStorage.getItem(SND_KEY) !== 'off'; } catch { return true; } })();
  musicVol = (() => { try { const v = parseFloat(localStorage.getItem(VOL_KEY) ?? ''); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7; } catch { return 0.7; } })();
  onChange: ((on: boolean) => void) | null = null;
  /** Create/resume on a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!C) return;
        const ctx = new C(); this.ctx = ctx;
        this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.9; this.music.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(comp);
        // Echo "room": two feedback delays, low-passed, shared by music and some sfx.
        this.send = ctx.createGain(); this.send.gain.value = 1;
        for (const [t, fb] of [[0.37, 0.42], [0.53, 0.35]] as const) { const d = ctx.createDelay(2); d.delayTime.value = t; const f = ctx.createGain(); f.gain.value = fb; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; this.send.connect(d); d.connect(lp).connect(f).connect(d); const o = ctx.createGain(); o.gain.value = 0.35; lp.connect(o).connect(this.music); }
        const len = ctx.sampleRate, nb = ctx.createBuffer(1, len, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
        const durs: Record<Region, number> = { meadow: 0.5, coast: 0.62, cave: 0.8, keeper: 0.3, ending: 0.55 };
        for (const r of Object.keys(durs) as Region[]) { const g = ctx.createGain(); g.gain.value = r === this.region ? 1 : 0; g.connect(this.music); this.regs[r] = { g, step: 0, next: 0, dur: durs[r] }; }
        this.timer = window.setInterval(() => this.schedule(), 120);
      }
      void this.ctx.resume(); this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
    } catch { /* audio is optional */ }
  }
  setEnabled(on: boolean) {
    this.enabled = on; try { localStorage.setItem(SND_KEY, on ? 'on' : 'off'); } catch { /* */ }
    if (on) this.unlock(); else if (this.ctx) { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); window.setTimeout(() => { if (!this.enabled) void this.ctx?.suspend(); }, 600); }
    this.onChange?.(on);
  }
  setMusicVol(v: number) { this.musicVol = v; try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* */ } if (this.ctx) this.music.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.1); }
  /** Crossfade to a region's music (≈2.5 s). */
  setRegion(r: Region) {
    if (r === this.region) return; this.region = r; if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const k of Object.keys(this.regs) as Region[]) { const g = this.regs[k].g.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(k === r ? 1 : 0, t + 2.5); }
    const R = this.regs[r]; R.next = Math.max(R.next, t + 0.05);
  }
  // ---------- voices ----------
  private tone(out: AudioNode, t: number, f: number, dur: number, o: { type?: OscillatorType; vol?: number; a?: number; r?: number; lp?: number; send?: number; det?: number }) {
    const c = this.ctx!, osc = c.createOscillator(), g = c.createGain(), vol = o.vol ?? 0.05, a = o.a ?? 0.01, r = o.r ?? dur;
    osc.type = o.type ?? 'sine'; osc.frequency.value = f; if (o.det) osc.detune.value = o.det;
    let n: AudioNode = osc; if (o.lp) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; osc.connect(lp); n = lp; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setTargetAtTime(0, t + Math.max(a, dur - r), r / 4);
    n.connect(g); g.connect(out); if (o.send) { const s = c.createGain(); s.gain.value = o.send; g.connect(s); s.connect(this.send); }
    osc.start(t); osc.stop(t + dur + r + 0.1);
  }
  private bell(out: AudioNode, t: number, f: number, vol: number, send = 0.5) { this.tone(out, t, f, 2.2, { vol, a: 0.005, r: 2.0, send }); this.tone(out, t, f * 2.76, 0.9, { vol: vol * 0.35, a: 0.003, r: 0.8, send }); }
  private noiseHit(out: AudioNode, t: number, dur: number, o: { bp?: number; q?: number; vol?: number; lp?: number; sweep?: number; send?: number }) {
    const c = this.ctx!, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = o.lp ? 'lowpass' : 'bandpass'; f.frequency.value = o.lp ?? o.bp ?? 1500; f.Q.value = o.q ?? 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.05, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); if (o.send) { const sg = c.createGain(); sg.gain.value = o.send; g.connect(sg); sg.connect(this.send); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  private kick(out: AudioNode, t: number, vol: number) { const c = this.ctx!, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(out); o.start(t); o.stop(t + 0.4); }
  // ---------- music ----------
  private schedule() {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return; const now = this.ctx.currentTime, R = this.regs[this.region];
    if (R.next < now) R.next = now + 0.05;
    while (R.next < now + 0.45) { this.play(this.region, R.step, R.next, R.g, R.dur); R.step++; R.next += R.dur; }
  }
  private play(r: Region, s: number, t: number, out: GainNode, d: number) {
    const rnd = Math.random, pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    if (r === 'meadow') {
      if (s % 8 === 0) for (const m of MEAD_PADS[(s / 8 | 0) % 4]) { this.tone(out, t, hz(m), d * 8.5, { type: 'triangle', vol: 0.03, a: 1.2, r: 2.5, lp: 900 }); this.tone(out, t, hz(m), d * 8.5, { vol: 0.022, a: 1.5, r: 2.5, det: 7 }); }
      if (rnd() < 0.34) this.tone(out, t, hz(pick(D_PENT)), 1.2, { type: 'triangle', vol: 0.045, a: 0.006, r: 1.1, lp: 2400, send: 0.45 });
    } else if (r === 'coast') {
      if (s % 8 === 0) for (const m of COAST_PADS[(s / 8 | 0) % 2]) this.tone(out, t, hz(m), d * 8.6, { vol: 0.03, a: 2.0, r: 3, det: rnd() * 8 - 4 });
      if (rnd() < 0.22) this.bell(out, t, hz(pick(A_DOR) + 12), 0.03, 0.6);
    } else if (r === 'cave') {
      if (s % 8 === 0) { this.tone(out, t, hz(38), d * 9, { vol: 0.05, a: 2.5, r: 3 }); this.tone(out, t, hz(45), d * 9, { vol: 0.03, a: 3, r: 3, det: 5 }); this.noiseHit(out, t, d * 6, { bp: 420, q: 6, vol: 0.012 }); }
      if (rnd() < 0.16) this.bell(out, t, hz(pick(D_MIN_PENT)), 0.028, 0.9);
    } else if (r === 'keeper') {
      const b = s % 8; if (b === 0 || b === 3 || b === 4) this.kick(out, t, 0.16); if (b % 2) this.noiseHit(out, t, 0.05, { bp: 7000, q: 0.7, vol: 0.012 });
      this.tone(out, t, hz(KEEP_OST[b]), d * 0.9, { type: 'sawtooth', vol: 0.03, a: 0.005, r: 0.25, lp: 700 });
      if (s % 16 === 0) { this.tone(out, t, hz(38), d * 17, { vol: 0.045, a: 0.5, r: 1.5 }); this.tone(out, t, hz(62), d * 16, { type: 'triangle', vol: 0.015, a: 1.5, r: 1.5, lp: 1200 }); }
    } else {
      const ch = END_CHORDS[(s / 8 | 0) % 4];
      if (s % 8 === 0) for (const m of ch) { this.tone(out, t, hz(m - 12), d * 8.6, { type: 'triangle', vol: 0.028, a: 1.0, r: 2.5, lp: 1100 }); this.tone(out, t, hz(m), d * 8.6, { vol: 0.02, a: 1.4, r: 2.5, det: 6 }); }
      this.tone(out, t, hz(ch[s % 3] + 12 * (1 + ((s >> 2) & 1))), 0.9, { type: 'triangle', vol: 0.03, a: 0.008, r: 0.8, lp: 2600, send: 0.5 });
    }
  }
  // ---------- sfx ----------
  private ok() { return !!this.ctx && this.enabled && this.ctx.state === 'running'; }
  steps = 0; lastSurf: Surface | '' = '';
  step(surf: Surface, run: boolean) {
    if (!this.ok()) return; this.steps++; this.lastSurf = surf; const t = this.ctx!.currentTime, v = run ? 1.25 : 1, o = this.sfx;
    if (surf === 'grass') this.noiseHit(o, t, 0.07, { bp: 1900 + Math.random() * 500, q: 0.8, vol: 0.05 * v });
    else if (surf === 'gravel') { this.noiseHit(o, t, 0.08, { bp: 2700, q: 1.4, vol: 0.06 * v }); this.noiseHit(o, t + 0.02, 0.05, { bp: 4200, q: 2, vol: 0.03 * v }); }
    else if (surf === 'stone') { this.noiseHit(o, t, 0.05, { bp: 1100, q: 1.6, vol: 0.07 * v, send: 0.25 }); this.tone(o, t, 130 + Math.random() * 30, 0.06, { vol: 0.05 * v, a: 0.002, r: 0.05 }); }
    else if (surf === 'sand') this.noiseHit(o, t, 0.09, { lp: 900, vol: 0.05 * v });
    else { this.noiseHit(o, t, 0.16, { lp: 1400, vol: 0.08 * v }); this.noiseHit(o, t + 0.04, 0.12, { bp: 3000, q: 3, vol: 0.025 * v }); }
  }
  swing() { if (!this.ok()) return; const t = this.ctx!.currentTime; this.noiseHit(this.sfx, t, 0.24, { bp: 500, q: 2.2, sweep: 3200, vol: 0.12 }); }
  hit() { if (!this.ok()) return; const t = this.ctx!.currentTime, o = this.sfx; for (const [f, v] of [[523, 0.08], [1347, 0.05], [2210, 0.025]] as const) this.tone(o, t, f, 0.5, { vol: v, a: 0.002, r: 0.45, send: 0.3 }); this.noiseHit(o, t, 0.06, { bp: 3500, q: 1, vol: 0.08 }); }
  hurt() { if (!this.ok()) return; const t = this.ctx!.currentTime; this.kick(this.sfx, t, 0.22); this.noiseHit(this.sfx, t, 0.25, { lp: 600, vol: 0.09 }); }
  warn() { if (!this.ok()) return; const t = this.ctx!.currentTime; this.tone(this.sfx, t, 220, 0.18, { type: 'square', vol: 0.025, a: 0.005, r: 0.1, lp: 900 }); this.tone(this.sfx, t + 0.2, 175, 0.22, { type: 'square', vol: 0.025, a: 0.005, r: 0.12, lp: 900 }); }
  chime() { if (!this.ok()) return; const t = this.ctx!.currentTime; [74, 78, 81, 86].forEach((m, i) => this.bell(this.sfx, t + i * 0.09, hz(m), 0.045, 0.5)); }
  ui() { if (!this.ok()) return; const t = this.ctx!.currentTime; this.tone(this.sfx, t, 990, 0.04, { vol: 0.035, a: 0.002, r: 0.035 }); }
  get state() { return { steps: this.steps, surf: this.lastSurf, ctx: this.ctx?.state ?? 'none', enabled: this.enabled, region: this.region, musicVol: this.musicVol, gains: this.ctx ? Object.fromEntries(Object.entries(this.regs).map(([k, r]) => [k, +r.g.gain.value.toFixed(2)])) : null }; }
}
