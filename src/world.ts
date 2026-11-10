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
export type Landmark = { id: string; name: string; x: number; z: number; r: number; pad: number };
const L = (id: string, name: string, mx: number, my: number, r: number, pad: number): Landmark => ({ id, name, ...fromMap(mx, my), r, pad });
/** Landmarks at their Page positions (map units → metres). r = footprint radius used to level the ground. */
export const LANDMARKS: Landmark[] = [
  L('pale', 'Pale Keep', 95, 70, 30, 1.2),
  L('azure', 'Azure Keep', 550, 70, 30, 1.2),
  L('sunspire', 'Sunspire', 95, 660, 28, 0.8),
  L('dome', 'Iron Dome', 480, 665, 24, 0.6),
  L('veilfall', 'Veilfall', 60, 200, 26, 0.4),
];
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
export function pathX(z: number): number {
  // Dirt path from spawn north toward the shrine, bending west.
  const t = Math.max(0, -z);
  return 1.2 * Math.sin(z / 9) * smoothstep(0, 10, t) - 0.0105 * t * t - 0.25 * t;
}
export function pathMask(x: number, z: number): number {
  if (z > 22) return 0;
  const d = Math.abs(x - pathX(z));
  const w = 1.25 + 0.35 * Math.sin(z * 0.37) + (z < -40 ? 0.4 : 0);
  return (1 - smoothstep(w * 0.55, w * 1.35, d)) * smoothstep(26, 16, z) * (z < -70 ? smoothstep(-90, -70, z) : 1);
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
export function heightAt(x: number, z: number): number {
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
  // Creek channel.
  const half = creekHalf(z);
  h -= 1.9 * (1 - smoothstep(half * 0.55, half + 3.2, dc));
  h -= 0.07 * pathMask(x, z);
  // Level the ground under each landmark (and its seal plinth).
  for (const l of LANDMARKS) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r * 1.4) h += (l.pad - h) * (1 - smoothstep(l.r * 0.85, l.r * 1.4, d)); }
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
