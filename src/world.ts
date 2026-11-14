// Shared world layout (metres). Spawn at origin, facing north (-Z). Shrine NW, creek west, rift glow NE sky.
export const SPAWN = { x: 0, z: 6 };
export const WAYFINDER = { x: 2.6, z: -2.5 };
export const SHRINE = { x: -34, z: -46 };
export const WATER_Y = -0.62;

/** Canvas-map → world: the Page's 600×720 map, anchored on the Wayfinder (360,420), at 0.36 m per map unit. */
export const MAP_SCALE = 0.36;
export function fromMap(mx: number, my: number): { x: number; z: number } {
  return { x: WAYFINDER.x + (mx - 360) * MAP_SCALE, z: WAYFINDER.z + (my - 420) * MAP_SCALE };
}
/** pad = the floor the landmark stands on; base (M25, Pale only) = the meadow level round a raised castle rock. */
export type Landmark = { id: string; name: string; x: number; z: number; r: number; pad: number; base?: number };
const L = (id: string, name: string, mx: number, my: number, r: number, pad: number, base?: number): Landmark => ({ id, name, ...fromMap(mx, my), r, pad, base });
/** Landmarks at their Page positions (map units → metres). r = footprint radius used to level the ground. */
export const LANDMARKS: Landmark[] = [
  L('pale', 'Pale Keep', 95, 70, 30, 5.6, 1.2), // M25: the keep stands on a 4.4 m castle rock above the meadow
  L('azure', 'Azure Keep', 550, 70, 30, 1.2),
  L('sunspire', 'Sunspire', 95, 660, 28, 0.8),
  L('dome', 'Iron Dome', 480, 665, 24, 0.6),
  L('veilfall', 'Veilfall', 60, 200, 26, 0.4),
];
/** M25 · Pale Keep's castle rock: flat top to `in`, cliff down to the meadow by `out` (clear of Enna's stair at 25.5 m);
 *  the grand stair's corridor (|u| < half, v > cut along the gate axis) is cut down to the meadow under the steps. */
const PALE_F = Math.atan2(SPAWN.x - LANDMARKS[0].x, SPAWN.z - LANDMARKS[0].z);
export const PALE_ROCK = { in: 22.6, out: 25.3, half: 3.25, cut: 20.6, gate: 33, sf: Math.sin(PALE_F), cf: Math.cos(PALE_F), face: PALE_F };
/** M26 · the opening path (Author canon), south of the meadow: the quarry ridge and its stair, the water-cut falls over the
 *  quarry benches into a pool, the stream that runs from it west to the creek, and the quarry track to the meadow hub. */
export const RIDGE = { x0: -44, x1: -4, zc: 63, h: 6.2 };
export const RSTAIR = { x: -34, z0: 51.6, z1: 63.2, half: 1.35 };
export const QUARRY = { x0: -23.2, x1: -12.8 };
export const POOL = { x: -18, z: 50.2, r: 3.0 };
export type P2 = { x: number; z: number };
export const STREAM: P2[] = [{ x: -18, z: 50.2 }, { x: -21, z: 47 }, { x: -27, z: 44.5 }, { x: -34, z: 43 }, { x: -41, z: 41.5 }, { x: -49, z: 40 }];
export const TRACK: P2[] = [{ x: -34, z: 51 }, { x: -32.5, z: 47 }, { x: -30.5, z: 41 }, { x: -27, z: 35 }, { x: -21, z: 29 }, { x: -14, z: 23 }, { x: -8, z: 17 }, { x: -3, z: 12 }, { x: 0, z: 8.5 }];
export function lineDist(pts: P2[], x: number, z: number): number {
  let bd = 1e9; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); bd = Math.min(bd, Math.hypot(x - a.x - dx * u, z - a.z - dz * u)); } return bd;
}
/** 0..1 packed earth on the quarry track. */
/** M27 · the worn footpath from the ridge-stair head over the crest (narrower than the track). */
export const WORN: P2[] = [{ x: -34, z: 62.6 }, { x: -34.5, z: 67 }, { x: -35.8, z: 72 }, { x: -37.8, z: 77.5 }];
export function trackMask(x: number, z: number): number { if (x < -42 || x > 6 || z < 4 || z > 80) return 0; return Math.max(z > 56 ? 0 : 1 - smoothstep(0.85, 1.9, lineDist(TRACK, x, z)), 0.85 * (1 - smoothstep(0.45, 1.15, lineDist(WORN, x, z)))); }
/** True on open water of the quarry stream or pool (wading). */
export function inStream(x: number, z: number): boolean { if (x < -52 || x > -12 || z < 36 || z > 55) return false; return lineDist(STREAM, x, z) < 1.4 || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r; }
/** M26 · the wandering orchard: old apple trees in rows that drift and break, either side of the quarry track (main.ts plants them). */
export const ORCHARD: { x: number; z: number; s: number; ry: number }[] = (() => { const o: { x: number; z: number; s: number; ry: number }[] = []; let sd = 4242; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) { const z = 15 + row * 5.6 + Math.sin(i * 0.9 + row) * 1.4 + (r() - 0.5), x = -29 + i * 4.3 + row * 1.7 + (r() - 0.5) * 1.3, gap = r() < 0.15, s = 0.8 + r() * 0.35, ry = r() * 6.28;
    if (gap || lineDist(TRACK, x, z) < 3.2 || Math.hypot(x, z - 6) < 10 || x > -1) continue; o.push({ x, z, s, ry }); }
  return o; })();
/** M26 · hazel thickets along the upper track (main.ts plants them as low, sunk broadleaf clumps). */
export const HAZEL: { x: number; z: number; s: number; ry: number }[] = (() => { const o: { x: number; z: number; s: number; ry: number }[] = []; let sd = 919; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120 && o.length < 22; i++) { const k = 1 + Math.floor(r() * 4), a = TRACK[k - 1], c = TRACK[k], u = r(), side = r() < 0.5 ? -1 : 1, L = Math.hypot(c.x - a.x, c.z - a.z), off = 2.8 + r() * 3.4;
    const x = a.x + (c.x - a.x) * u - (c.z - a.z) / L * off * side, z = a.z + (c.z - a.z) * u + (c.x - a.x) / L * off * side, s = 0.75 + r() * 0.4, ry = r() * 6.28;
    if (z < 27 || lineDist(TRACK, x, z) < 2.5 || lineDist(STREAM, x, z) < 2.8 || (x > -38 && x < -9 && z > 48.5) || o.some((p) => Math.hypot(p.x - x, p.z - z) < 2.4)) continue; o.push({ x, z, s, ry }); }
  return o; })();
/** Keep scattered trees, rocks and grass off the track, the stream, the stair and the quarry. */
export function openingBusy(x: number, z: number): boolean {
  if (x < -52 || x > 3 || z < 7 || z > 68) return false;
  return lineDist(TRACK, x, z) < 4.5 || lineDist(STREAM, x, z) < 4.2 || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 4 || (x > -38 && x < -9 && z > 45) || (x > -32 && z < 38);
}
function ridgeRise(x: number, z: number): number {
  if (z < 50 || z > 84 || x < RIDGE.x0 - 7 || x > RIDGE.x1 + 11) return 0;
  const mx = smoothstep(RIDGE.x0 - 7, RIDGE.x0, x) * (1 - smoothstep(RIDGE.x1 - 1, RIDGE.x1 + 11, x));
  const p = z < RIDGE.zc ? smoothstep(51.5, RIDGE.zc, z) : 1 - smoothstep(RIDGE.zc + 2, RIDGE.zc + 20, z);
  let r = RIDGE.h * mx * p * (0.9 + 0.2 * fbm(x * 0.06 + 4, z * 0.06));
  r -= 0.3 * (1 - smoothstep(RSTAIR.half, RSTAIR.half + 0.6, Math.abs(x - RSTAIR.x))) * smoothstep(RSTAIR.z0 - 0.5, RSTAIR.z0 + 0.5, z) * (1 - smoothstep(RSTAIR.z1, RSTAIR.z1 + 1, z)); // the stair's shallow trench
  return r;
}
function streamCarve(x: number, z: number, h: number): number {
  if (x < -54 || x > -10 || z < 34 || z > 57) return h;
  const sd = lineDist(STREAM, x, z); if (sd < 4.6) { const tgt = WATER_Y - 0.4 - 0.18 * (1 - smoothstep(0, 1.6, sd)); h += (Math.min(h, tgt) - h) * (1 - smoothstep(1.4, 4.6, sd)); }
  const pd = Math.hypot(x - POOL.x, z - POOL.z); if (pd < POOL.r + 2.6) { const tgt = WATER_Y - 1.0; h += (Math.min(h, tgt) - h) * (1 - smoothstep(POOL.r - 0.5, POOL.r + 2.6, pd)); }
  return h;
}
export type SealDef = { id: string; name: string; short: string; color: string; x: number; z: number; at: string };
const S = (id: string, name: string, short: string, color: string, mx: number, my: number, at: string): SealDef => ({ id, name, short, color, ...fromMap(mx, my), at });
/** The four seals (Page makeItems positions). */
export const SEALS: SealDef[] = [
  S('dawn', 'Dawn Sigil', 'Dawn', '#f5e6c8', 175, 150, 'Pale Keep'),
  S('sun', 'Sun Shard', 'Sun', '#ffb74d', 185, 575, 'Sunspire'),
  S('tide', 'Tide Seal', 'Tide', '#81d4fa', 470, 140, 'Azure Keep'),
  S('forge', 'Forge Heart', 'Forge', '#ff9e5e', 385, 575, 'Iron Dome'),
];

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function creekX(z: number): number {
  return -50 + 7 * Math.sin(z / 21) + 4 * Math.sin(z / 8.5 + 1.3) + 2 * Math.sin(z / 4.1 + 0.4);
}
export function creekHalf(z: number): number {
  return 2.6 + 0.9 * Math.sin(z / 13 + 2.1) + 0.5 * Math.sin(z / 5.3);
}
function pathX0(z: number): number {
  // Dirt path from spawn north toward the shrine, bending west.
  const t = Math.max(0, -z);
  return 1.2 * Math.sin(z / 9) * smoothstep(0, 10, t) - 0.0105 * t * t - 0.25 * t;
}
/** M26 · past the creek the road bends north-west to Pale Keep's Wing Gate (Hermite from t0 to the gate, arriving on its axis). */
export const PATH_BEND = (() => { const t0 = 64, t1 = 101.3, x0 = pathX0(-t0), m0 = (pathX0(-(t0 + 0.01)) - pathX0(-(t0 - 0.01))) / 0.02; return { t0, L: t1 - t0, x0, m0, x1: -74.1, m1: -0.69 }; })();
export function pathX(z: number): number {
  const t = Math.max(0, -z); if (t <= PATH_BEND.t0) return pathX0(z);
  const B = PATH_BEND, u = Math.min(1, (t - B.t0) / B.L), u2 = u * u, u3 = u2 * u;
  const x = (2 * u3 - 3 * u2 + 1) * B.x0 + (u3 - 2 * u2 + u) * B.L * B.m0 + (-2 * u3 + 3 * u2) * B.x1 + (u3 - u2) * B.L * B.m1;
  return x + Math.max(0, t - B.t0 - B.L) * B.m1;
}
export function pathMask(x: number, z: number): number {
  if (z > 22) return 0;
  const d = Math.abs(x - pathX(z));
  const w = 1.25 + 0.35 * Math.sin(z * 0.37) + (z < -40 ? 0.4 : 0);
  return (1 - smoothstep(w * 0.55, w * 1.35, d)) * smoothstep(26, 16, z) * (z < -92 ? smoothstep(-100, -92, z) : 1); // M26: the road now runs on to the Wing Gate
}
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { s += a * (vnoise(x * f, z * f) * 2 - 1); f *= 2.03; a *= 0.5; }
  return s;
}
function ridged(x: number, z: number): number {
  let s = 0, a = 0.6, f = 1;
  for (let i = 0; i < 4; i++) { const n = 1 - Math.abs(vnoise(x * f, z * f) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5; }
  return s;
}
/** M20b-2 · optional places at the wide edges of the vale (ground is levelled around each one). */
export type Outpost = { id: string; name: string; x: number; z: number; r: number; flat: number; kind: 'tower' | 'camp' | 'barrow' | 'view' };
export const OUTPOSTS: Outpost[] = [
  { id: 'tower', name: 'Greyhold Watchtower', x: 165, z: -40, r: 9, flat: 13, kind: 'tower' },
  { id: 'camp', name: 'Ashen Hollow', x: -122, z: 148, r: 14, flat: 18, kind: 'camp' },
  { id: 'barrow', name: 'The Old Barrow', x: -152, z: -108, r: 7, flat: 10, kind: 'barrow' },
  { id: 'bluff', name: 'Sunfall Bluff', x: 128, z: 150, r: 4, flat: 6, kind: 'view' },
  { id: 'cairn', name: 'North Cairn', x: 8, z: -196, r: 4, flat: 6, kind: 'view' },
  { id: 'crown', name: 'Greycrown Outlook', x: 0, z: -263, r: 4, flat: 7, kind: 'view' }, // M22: up the switchback trail past the North Cairn
];
const padCache = new Map<string, number>();
export function outpostPad(o: Outpost): number { let v = padCache.get(o.id); if (v === undefined) { v = baseHeight(o.x, o.z) + (o.kind === 'view' ? 0.6 : 0); padCache.set(o.id, v); } return v; }
export function heightAt(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (const o of OUTPOSTS) { const d = Math.hypot(x - o.x, z - o.z); if (d < o.flat * 1.6) h += (outpostPad(o) - h) * (1 - smoothstep(o.flat * 0.75, o.flat * 1.6, d)); }
  return h;
}
/** M22 · the Greycrown trail: a graded switchback from the North Cairn up the north ridge to the outlook. */
export const TRAIL: { x: number; z: number }[] = [{ x: 8, z: -196 }, { x: 6, z: -201 }, { x: -12, z: -226 }, { x: 12, z: -244 }, { x: 2, z: -254 }, { x: 0, z: -258 }];
const TRAIL_LEN: number[] = []; { let a = 0; TRAIL_LEN.push(0); for (let i = 1; i < TRAIL.length; i++) { a += Math.hypot(TRAIL[i].x - TRAIL[i - 1].x, TRAIL[i].z - TRAIL[i - 1].z); TRAIL_LEN.push(a); } }
/** Distance to the trail centreline and the 0..1 position along it. */
export function trailAt(x: number, z: number): { d: number; t: number } {
  let bd = 1e9, bt = 0; const L = TRAIL_LEN[TRAIL_LEN.length - 1];
  for (let i = 1; i < TRAIL.length; i++) { const a = TRAIL[i - 1], b = TRAIL[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); const d = Math.hypot(x - a.x - dx * u, z - a.z - dz * u); if (d < bd) { bd = d; bt = (TRAIL_LEN[i - 1] + u * Math.sqrt(l2)) / L; } }
  return { d: bd, t: bt };
}
let trailH: [number, number] | null = null;
/** True where the walk boundary opens up for the trail and the outlook (beyond the vale's 235 m ring). */
export function onTrail(x: number, z: number): boolean { return trailAt(x, z).d < 4.2 || Math.hypot(x - 0, z + 263) < 7.5; }
/** 0..1 packed earth on the Greycrown trail or the outlook standing-pad (used to clear and shorten grass). */
export function trailMask(x: number, z: number): number {
  return Math.max(1 - smoothstep(1.45, 2.7, trailAt(x, z).d), 1 - smoothstep(5.15, 6.8, Math.hypot(x, z + 263)));
}
function baseHeight(x: number, z: number): number {
  const h0 = baseHeight0(x, z);
  if (z > -190 || z < -275 || Math.abs(x) > 40) return h0;
  const tr = trailAt(x, z); if (tr.d > 10) return h0;
  trailH ??= [baseHeight0(TRAIL[0].x, TRAIL[0].z), baseHeight0(0, -263) + 0.6];
  const ty = trailH[0] + (trailH[1] - trailH[0]) * tr.t; // an even ~37% grade
  let h = h0 + (ty - h0) * (1 - smoothstep(3.2, 10, tr.d));
  h -= 0.08 * (1 - smoothstep(1.4, 2.6, tr.d)); // M22b: a shallow worn trough so the cut reads from the cairn
  return h;
}
function baseHeight0(x: number, z: number): number {
  const r = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  const dc = Math.abs(x - creekX(z));
  let h = 2.2 * fbm(x * 0.018, z * 0.018) + 0.35 * fbm(x * 0.09, z * 0.09);
  h += 1.4 * Math.sin(x * 0.021 + 0.6) * Math.cos(z * 0.017);
  h *= smoothstep(9, 38, r) * 0.8 + 0.2;
  h *= smoothstep(5, 22, dc) * 0.85 + 0.15;
  // Rolling hills and a mountain ring frame the meadow.
  const edge = Math.max(0, r - 200); // the vale floor now reaches the keeps; mountains ring beyond
  h += Math.pow(edge, 1.35) * 0.09 * (0.7 + 0.6 * fbm(x * 0.01 + 3, z * 0.01));
  // Ridged peaks on the mountain ring (breaks the smooth bowl into crests and gullies).
  const mt = smoothstep(200, 290, r);
  if (mt > 0) h += mt * (30 * ridged(x * 0.009, z * 0.009) + 9 * ridged(x * 0.03 + 7, z * 0.03));
  // East rise behind the Wayfinder; gentle shoulder for the shrine terrace.
  h += 3.5 * smoothstep(30, 80, x) * (0.6 + 0.4 * Math.sin(z * 0.03));
  const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  h = h * smoothstep(8, 20, ds) + (1 - smoothstep(8, 20, ds)) * 1.2;
  h += ridgeRise(x, z); // M26 · the quarry ridge south of the meadow
  // Creek channel.
  const half = creekHalf(z);
  h -= 1.9 * (1 - smoothstep(half * 0.55, half + 3.2, dc));
  h -= 0.07 * pathMask(x, z) + 0.06 * trackMask(x, z);
  h = streamCarve(x, z, h);
  // Level the ground under each landmark (and its seal plinth).
  for (const l of LANDMARKS) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r * 1.4) h += ((l.base ?? l.pad) - h) * (1 - smoothstep(l.r * 0.85, l.r * 1.4, d)); }
  { const l = LANDMARKS[0], dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz); // M25 · Pale Keep's castle rock, with the grand stair's cut
    if (d < PALE_ROCK.out) { const v = dx * PALE_ROCK.sf + dz * PALE_ROCK.cf, u = dx * PALE_ROCK.cf - dz * PALE_ROCK.sf;
      const cut = v > PALE_ROCK.cut ? 1 - smoothstep(PALE_ROCK.half - 0.4, PALE_ROCK.half, Math.abs(u)) : 0;
      h += (l.pad - l.base!) * (1 - smoothstep(PALE_ROCK.in, PALE_ROCK.out, d)) * (1 - cut); } }
  for (const sd of SEALS) { const d = Math.hypot(x - sd.x, z - sd.z); if (d < 7) h += (Math.max(h, 0.3) - h) * (1 - smoothstep(3, 7, d)); }
  return h;
}
export function normalAt(x: number, z: number): [number, number, number] {
  const e = 0.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e);
  const l = Math.hypot(dx, 2 * e, dz);
  return [-dx / l, (2 * e) / l, -dz / l];
}
// Seeded PRNG for deterministic scatter.
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
