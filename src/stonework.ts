import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** M23 · shared craft pieces: a hand-dressed standing stone and a living hearth fire (several licking tongues, not one blob). */

/** A weathered standing stone: rounded-rectangle section, tapered and leaning, chipped crown, two-octave lumps and
 *  a few flat cleavage facets. Base at y=0, front (+z) face can be kept flatter around `flatY` for a carved panel. */
export function standingStone(w: number, h: number, d: number, seed: number, o: { lean?: number; flatY?: number; flatR?: number } = {}) {
  const g = mergeVertices(new THREE.BoxGeometry(w, h, d, 5, 12, 4).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position as THREE.BufferAttribute; const lean = o.lean ?? 0.06;
  const s1 = Math.sin(seed * 12.9898) * 43758.5453, fr = (k: number) => { const v = Math.sin(s1 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  const facets = [0, 1, 2].map((k) => ({ n: new THREE.Vector3(fr(k) - 0.5, fr(k + 3) * 0.6 + 0.2, fr(k + 6) - 0.5).normalize(), c: 0.38 + fr(k + 9) * 0.1 }));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / (w / 2), y = p.getY(i) / h + 0.5, z = p.getZ(i) / (d / 2);
    // rounded rectangle: push corners toward a superellipse (n≈3.2) so no edge reads as a sawn box
    const ax = Math.abs(x), az = Math.abs(z), m = Math.pow(Math.pow(ax, 3.2) + Math.pow(az, 3.2), 1 / 3.2), mx = Math.max(ax, az);
    if (m > 1e-4) { const k = mx / m; x *= k; z *= k; }
    const tp = 1 - 0.3 * y * y; let X = x * w / 2 * tp, Z = z * d / 2 * tp, Y = y * h;
    if (y > 0.82) Y -= (x * x * 0.8 + z * z * 0.35) * h * 0.09 * (y - 0.82) / 0.18 + fr(4) * 0.04 * h * (y - 0.82) * x; // chipped, sloped crown
    const n = 0.05 * Math.sin(X * 6.1 + Y * 2.7 + seed) * Math.cos(Z * 5.3 - Y * 2.1 + seed * 0.7) + 0.022 * Math.sin(Y * 13 + X * 9 + seed * 3) + 0.012 * Math.sin(Z * 17 + Y * 19);
    let amp = 1; if (o.flatY !== undefined && z > 0.3) { const dy = Math.abs(Y - o.flatY); amp = THREE.MathUtils.smoothstep(dy, (o.flatR ?? 0.5) * 0.7, o.flatR ?? 0.5); }
    const r = Math.hypot(X, Z) || 1; X += X / r * n * Math.max(w, d) * amp; Z += Z / r * n * Math.max(w, d) * amp;
    for (const f of facets) { const dd = X * f.n.x + (Y / h - 0.5) * h * 0.25 * f.n.y + Z * f.n.z - f.c * Math.max(w, d); if (dd > 0 && amp > 0.5) { X -= f.n.x * dd * 0.8; Z -= f.n.z * dd * 0.8; } }
    X += lean * Y * Y / h; p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals(); return g;
}

let fireTexCache: THREE.Texture[] | null = null;
/** Two flame-tongue cards: forked, flickering silhouettes with a white-gold root and orange-red tips. */
export function fireTex(): THREE.Texture[] {
  if (fireTexCache) return fireTexCache;
  fireTexCache = [0, 1].map((v) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d')!;
    const tongue = (cx: number, top: number, wid: number, bend: number) => { x.beginPath(); x.moveTo(cx - wid, 124); x.bezierCurveTo(cx - wid * 1.25, 92, cx - wid * 0.2 + bend, 60, cx + bend * 1.6, top); x.bezierCurveTo(cx + wid * 0.25 + bend, 62, cx + wid * 1.2, 92, cx + wid, 124); x.closePath(); x.fill(); };
    const outer = x.createLinearGradient(0, 128, 0, 0); outer.addColorStop(0, 'rgba(255,200,110,0.95)'); outer.addColorStop(0.35, 'rgba(255,120,30,0.85)'); outer.addColorStop(0.75, 'rgba(200,50,10,0.45)'); outer.addColorStop(1, 'rgba(120,20,0,0)');
    x.fillStyle = outer; if (v === 0) { tongue(32, 4, 20, 2); tongue(20, 40, 10, -6); tongue(45, 30, 10, 5); } else { tongue(30, 10, 18, -4); tongue(44, 46, 9, 6); tongue(18, 58, 8, -3); }
    const core = x.createLinearGradient(0, 128, 0, 30); core.addColorStop(0, 'rgba(255,250,225,1)'); core.addColorStop(0.45, 'rgba(255,214,120,0.85)'); core.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = core; tongue(32, 44, 11, v ? -2 : 1);
    x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.ellipse(10 + ((i * 37 + v * 11) % 46), 8 + i * 9, 3 + (i % 3), 5, 0, 0, Math.PI * 2); x.fill(); } // ragged gaps near the tips
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  return fireTexCache;
}

/** A hearth fire spread along `span` (local z): 3 big tongues, 3 small ones, an ember glow and rising sparks. Layer 1
 *  (kept out of the AO pass like every other flame). Call `update(time)` each frame. */
export function makeFire(span: number, s = 1) {
  const g = new THREE.Group(); const tx = fireTex(); const parts: { sp: THREE.Sprite; ph: number; w: number; h: number; z: number; kind: number }[] = [];
  const mk = (map: THREE.Texture, color: string, op: number) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mats = [mk(tx[0], '#ffd8a0', 0.95), mk(tx[1], '#ffc890', 0.9)];
  for (let i = 0; i < 6; i++) { const big = i < 3; const sp = new THREE.Sprite(mats[i % 2]); sp.center.set(0.5, 0.04); const z = (big ? (i - 1) * 0.34 : (i - 4) * 0.42 + 0.17) * span;
    sp.position.set(big ? 0 : 0.05, 0, z); sp.layers.set(1); g.add(sp); parts.push({ sp, ph: i * 1.91, w: (big ? 0.42 : 0.26) * s, h: (big ? 0.95 : 0.55) * s, z, kind: 0 }); }
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; { const x = glowC.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,170,80,0.9)'); gr.addColorStop(0.5, 'rgba(220,80,20,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glowT = new THREE.CanvasTexture(glowC); glowT.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#ff9a50', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.scale.set(1.3 * s * Math.max(1, span), 0.7 * s, 1); glow.position.y = 0.12 * s; glow.layers.set(1); g.add(glow);
  const sparkM = new THREE.SpriteMaterial({ map: glowT, color: '#ffcf7a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(sparkM); sp.layers.set(1); g.add(sp); parts.push({ sp, ph: i * 0.137, w: 0.035 * s, h: 0, z: ((i * 0.37) % 1 - 0.5) * span * 0.8, kind: 1 }); }
  return { group: g, update(t: number) {
    for (const k of parts) {
      if (k.kind === 0) { const f = 0.78 + 0.22 * Math.sin(t * 13 + k.ph) * Math.sin(t * 5.3 + k.ph * 1.7) + 0.08 * Math.sin(t * 29 + k.ph * 3); k.sp.scale.set(k.w * (1.08 - 0.25 * f), k.h * f, 1); k.sp.position.z = k.z + 0.03 * Math.sin(t * 7 + k.ph); }
      else { const u = (t * 0.55 + k.ph * 7.3) % 1; k.sp.position.set(0.05 * Math.sin(t * 3 + k.ph * 40), u * 1.5 * s, k.z + 0.12 * Math.sin(u * 9 + k.ph * 20)); const r = k.w * (1 - u); k.sp.scale.set(r, r, 1); }
    }
    glow.material.opacity = 0.45 + 0.1 * Math.sin(t * 9) * Math.sin(t * 4.1);
  } };
}
