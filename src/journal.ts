import { LANDMARKS, SEALS, WAYFINDER, SHRINE, heightAt, creekX, creekHalf, pathMask } from './world';
import { WARDEN } from './warden';
import { UPDRAFT, MIRRORS } from './beacon';
import { ISLAND_POS } from './island';
import { sealCount, levelOf, type Save } from './quest';
import { fill, type Profile } from './dialogue';
import { MARR_MARKS, CHART_DONE, ECHO } from './echo';
import { STAIR, CAVE_XP } from './cave';

// ---------- Journal (live quest state + lore from the Page) ----------
export type JSection = { h: string; items: { t: string; done?: boolean; lore?: boolean }[] };
const CLUES: Record<string, string> = { dawn: 'northwest approach to Pale Keep', sun: 'southwest toward the golden Sunspire', tide: 'northeast near Azure Keep', forge: 'southeast Iron Dome approach' };
export function buildJournal(s: Save, p: Profile, onIsland: boolean): { title: string; sub: string; sections: JSection[] } {
  const n = sealCount(s);
  const quest: JSection = { h: 'The Four Seals', items: [] };
  quest.items.push({ t: !s.started ? 'Talk to the Wayfinder by the meadow crossing to begin.' : s.done ? 'Complete — the seals burn again. You are a Vale Walker.' : n >= 4 ? 'All four seals held — return to the Wayfinder.' : `Seek the ancient seals (${n}/4).`, done: s.done });
  for (const d of SEALS) quest.items.push({ t: s.seals[d.id] ? `${d.name} — found` : `${d.name} — missing · ${CLUES[d.id]}`, done: !!s.seals[d.id] });
  const shrine: JSection = { h: 'Wind Shrine (optional)', items: [{ t: s.wind ? 'Awake · Windward Blessing quickens your step (+35 XP).' : 'Three carved runes; the tablet waits by the old crossing.', done: s.wind }] };
  const warden: JSection = { h: 'Vale Warden (optional)', items: [{ t: s.warden ? 'Dormant on the Iron Dome approach · Warden’s Crest claimed (+40 XP).' : 'Clockwork guard on the Iron Dome approach. When its arms rise, step out of the bright ring before it strikes.', done: s.warden }] };
  const aligned = s.mirrors.filter((v, i) => v === MIRRORS[i].solve).length;
  const beacon: JSection = { h: 'The Hollow Beacon', items: [] };
  if (s.beacon) beacon.items.push({ t: 'Dawn released · Morning-Bearer · Hollow Light carried (+60 XP).', done: true }, { t: 'Enna’s last page points beyond the sea.', lore: true });
  else if (!s.done) beacon.items.push({ t: 'Dark above the vale. The four seals must burn before its Updraft will lift anyone.' });
  else {
    beacon.items.push({ t: s.wind ? 'Ride the Updraft east of the Wind Shrine to the root-hung island.' : 'Locked — the Updraft east of the Wind Shrine needs the Wind Shrine’s Windward Blessing. Solve the shrine’s three runes first.' });
    beacon.items.push({ t: `Four Unspent mirrors record the landmark mornings; read the island carving. ${onIsland || aligned ? `(${aligned}/4 facing their morning)` : ''}`.trim() });
    if (onIsland) beacon.items.push({ t: 'Ride down from the western island edge. Its rim keeps your feet safe.' });
  }
  const echo: JSection = { h: 'Echo Grove (optional)', items: [{ t: s.echo ? 'Memory of the Break heard · Echo carried (+20 XP).' : 'Pale crystal trees east of the old crossing; a seal may wake them.', done: s.echo }] };
  if (s.echo) echo.items.push({ t: 'The old custodians stretched one sky across five beacons, then tried to keep every sunrise at once.', lore: true });
  const nC = s.charted.filter(Boolean).length;
  const chart: JSection = { h: `Marr’s Unfinished Map · ${nC}/${MARR_MARKS.length} charted`, items: MARR_MARKS.map((m, i) => ({ t: `${m.name} — ${s.charted[i] ? 'charted' : 'uncharted'}`, done: s.charted[i] })) };
  if (nC === MARR_MARKS.length) chart.items.push({ t: CHART_DONE, lore: true });
  const lore: JSection = { h: 'Overheard on the road', items: [
    { t: '“Your mother’s map left room for that sound. Don’t hurry to fill every blank.” — Sefa Lune', lore: true },
    { t: s.warden ? '“You’ve let the old Warden sleep. Thank you for not breaking its heart.” — Dov Hask' : '“It was built to warn before it was built to strike.” — Dov Hask', lore: true },
    { t: '“Enna never paid me to follow her map. She paid me to bring her home.” — Ress', lore: true },
  ] };
  if (s.done) lore.items.push({ t: 'Far beyond the root-hung islands, a second seam answers — not in the sky, but beneath the sea.', lore: true });
  const trail: JSection = { h: 'Chapter II · Enna’s Trail', items: [] };
  if (s.beacon) {
    const c = s.cave;
    trail.items.push({ t: c >= 1 ? 'The Wayfinder’s lead: Enna went down the collapsed stair east of Pale Keep — the keep’s old water-road.' : 'The Wayfinder has word of Enna. Speak with them by the meadow crossing.', done: c >= 1 });
    if (c >= 1) trail.items.push({ t: c >= 2 ? 'Descended into the torch-lit ruin beneath Pale Keep.' : 'Descend the collapsed stair east of Pale Keep.', done: c >= 2 });
    if (c >= 2) trail.items.push({ t: c >= 3 ? 'Braziers lit as the river runs — Spring, Ford, Sea. The sealed door is open.' : 'Light the three braziers as the river runs: where it is born, where it is crossed, where it is lost.', done: c >= 3 });
    if (c >= 3) trail.items.push({ t: c >= 4 ? `Enna’s carved message found · Enna’s Tide-Glass (+${CAVE_XP} XP).` : 'Read what waits in the alcove behind the door.', done: c >= 4 });
    if (c >= 4) {
      trail.items.push({ t: '“The water-road runs west beneath the hills to the sea caves, where the second seam answers under the tide. I have gone to listen.” — E. M.', lore: true });
      const k = s.coast;
      trail.items.push({ t: k >= 1 ? 'Followed the water-road west to the Tidewrack Coast, below the Lowtide Lamp.' : 'Follow the west passage in the ruin — the water-road runs on to the sea.', done: k >= 1 });
      if (k >= 1) trail.items.push({ t: k >= 2 ? 'Raised the Tide-Glass at low tide · the custodian causeway stands clear.' : 'At the tide-shrine by the Lowtide Lamp, raise the Tide-Glass when the tide is low.', done: k >= 2 });
      if (k >= 2) trail.items.push({ t: k >= 3 ? 'Reached the sea cave mouth · the Second Seam (+30 XP).' : 'Cross the causeway to the sea cave mouth.', done: k >= 3 });
      if (k >= 3) trail.items.push({ t: '“The custodians tied one sky shut. The sea has been holding the other open. I have gone down to see how.” — E. M.', lore: true }, { t: 'Chapter II · The Second Seam — to be continued.' });
    }
  }
  const sections = s.beacon ? [trail, quest, chart, shrine, warden, echo, beacon, lore] : [quest, chart, shrine, warden, echo, beacon, lore];
  return {
    title: fill('Field notes — {fullname}', p),
    sub: fill(`{Name}, 17 · Enna’s {child} · Level ${levelOf(s.xp)} · ${s.xp} XP`, p),
    sections,
  };
}

// ---------- Map (parchment, top-down) ----------
export const MAPBOX = { x0: -140, x1: 126, z0: -166, z1: 112 };
let terrainCache: { w: number; h: number; c: HTMLCanvasElement } | null = null;
function parchment(w: number, h: number): HTMLCanvasElement {
  if (terrainCache && terrainCache.w === w && terrainCache.h === h) return terrainCache.c;
  const sw = Math.ceil(w / 2), sh = Math.ceil(h / 2), c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d')!, img = x.createImageData(sw, sh), d = img.data;
  const wx = (i: number) => MAPBOX.x0 + (i + 0.5) / sw * (MAPBOX.x1 - MAPBOX.x0), wz = (j: number) => MAPBOX.z0 + (j + 0.5) / sh * (MAPBOX.z1 - MAPBOX.z0);
  const hs: number[] = new Array(sw * sh);
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) hs[j * sw + i] = heightAt(wx(i), wz(j));
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const k = j * sw + i, hh = hs[k], hx = hs[j * sw + Math.min(sw - 1, i + 1)] - hs[j * sw + Math.max(0, i - 1)], hz = hs[Math.min(sh - 1, j + 1) * sw + i] - hs[Math.max(0, j - 1) * sw + i];
    const X = wx(i), Z = wz(j);
    let r = 236, g = 222, b = 184;
    const e = Math.min(1, Math.max(0, (hh - 6) / 34)); r -= 40 * e; g -= 52 * e; b -= 64 * e;
    const shade = Math.max(-0.35, Math.min(0.3, (-hx * 0.6 - hz * 0.8) * 0.09)); r *= 1 + shade; g *= 1 + shade; b *= 1 + shade;
    const pm = pathMask(X, Z); if (pm > 0.3) { const t = Math.min(1, (pm - 0.3) * 2.5) * 0.6; r += (176 - r) * t; g += (138 - g) * t; b += (92 - b) * t; }
    const cw = Math.abs(X - creekX(Z)) - creekHalf(Z); if (cw < 1.2) { const t = cw < 0 ? 0.85 : 0.5; r += (92 - r) * t; g += (138 - g) * t; b += (150 - b) * t; }
    // Contour every 5 m.
    const lvl = Math.floor(hh / 5); if (Math.floor(hs[j * sw + Math.min(sw - 1, i + 1)] / 5) !== lvl || Math.floor(hs[Math.min(sh - 1, j + 1) * sw + i] / 5) !== lvl) { r -= 34; g -= 40; b -= 44; }
    const sp = (rnd() - 0.5) * 12; d[k * 4] = r + sp; d[k * 4 + 1] = g + sp; d[k * 4 + 2] = b + sp * 0.8; d[k * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  terrainCache = { w, h, c }; return c;
}
export type MapData = { player: { x: number; z: number; facing: number }; target: { x: number; z: number; name: string } | null; save: Save; onIsland: boolean; t: number };
export function drawValeMap(cv: HTMLCanvasElement, cssW: number, cssH: number, m: MapData) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
  const x = cv.getContext('2d')!; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH, sx = (X: number) => (X - MAPBOX.x0) / (MAPBOX.x1 - MAPBOX.x0) * W, sz = (Z: number) => (Z - MAPBOX.z0) / (MAPBOX.z1 - MAPBOX.z0) * H, k = W / (MAPBOX.x1 - MAPBOX.x0);
  x.imageSmoothingEnabled = true; x.drawImage(parchment(Math.round(W), Math.round(H)), 0, 0, W, H);
  // Aged edges.
  const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(120,80,30,0)'); vg.addColorStop(1, 'rgba(110,70,25,.45)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#6b4a26'; x.lineWidth = 2; x.strokeRect(5, 5, W - 10, H - 10); x.lineWidth = 0.8; x.strokeRect(9, 9, W - 18, H - 18);
  const fs = Math.max(11, Math.min(14, W / 34));
  const label = (t: string, X: number, Y: number, al: CanvasTextAlign = 'left', col = '#3a2814', size = fs, italic = true) => {
    x.font = `${italic ? 'italic ' : ''}${size}px Georgia,serif`; x.textAlign = al; x.textBaseline = 'middle';
    x.lineWidth = 3; x.strokeStyle = 'rgba(240,228,196,.9)'; x.strokeText(t, X, Y); x.fillStyle = col; x.fillText(t, X, Y);
  };
  // Landmarks: small towers.
  const charted = (name: string) => { const i = MARR_MARKS.findIndex((m) => m.name === name); return i < 0 || !!m.save.charted[i]; };
  const blank = (X: number, Y: number, r: number) => { x.save(); x.setLineDash([2, 4]); x.strokeStyle = 'rgba(90,60,30,.55)'; x.lineWidth = 1.2; x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.stroke(); x.restore(); label('?', X, Y, 'center', 'rgba(90,60,30,.7)', fs + 2, false); };
  for (const l of LANDMARKS) {
    const X = sx(l.x), Y = sz(l.z);
    if (!charted(l.name)) { blank(X, Y, 10); continue; }
    x.fillStyle = 'rgba(90,60,30,.18)'; x.beginPath(); x.arc(X, Y, l.r * k * 0.7, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#5a3d20'; x.strokeStyle = '#2e1e0e'; x.lineWidth = 1;
    if (l.id === 'dome') { x.beginPath(); x.arc(X, Y + 3, 7, Math.PI, 0); x.closePath(); x.fill(); }
    else if (l.id === 'sunspire') { x.beginPath(); x.moveTo(X, Y - 11); x.lineTo(X + 4, Y + 5); x.lineTo(X - 4, Y + 5); x.closePath(); x.fill(); }
    else if (l.id === 'veilfall') { x.beginPath(); x.moveTo(X - 8, Y + 5); x.lineTo(X - 2, Y - 7); x.lineTo(X + 3, Y - 2); x.lineTo(X + 8, Y + 5); x.closePath(); x.fill(); x.strokeStyle = '#4f7f8c'; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 1, Y - 4); x.lineTo(X + 1, Y + 6); x.stroke(); }
    else { x.fillRect(X - 7, Y - 3, 14, 8); x.fillRect(X - 7, Y - 7, 3, 4); x.fillRect(X - 1.5, Y - 9, 3, 6); x.fillRect(X + 4, Y - 7, 3, 4); }
    label(l.name, X, Y + 15, 'center', '#2e1e0e', fs, false);
  }
  // Wind Shrine, Wayfinder, Warden, Updraft.
  { const X = sx(ECHO.x), Y = sz(ECHO.z);
    if (!charted('Echo Grove')) blank(X, Y, 8);
    else { x.fillStyle = m.save.echo ? '#3fae9a' : '#7fb5a8'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3; x.beginPath(); x.moveTo(X + Math.cos(a) * 9, Y + Math.sin(a) * 9 - 4); x.lineTo(X + Math.cos(a) * 9 + 3, Y + Math.sin(a) * 9 + 3); x.lineTo(X + Math.cos(a) * 9 - 3, Y + Math.sin(a) * 9 + 3); x.closePath(); x.fill(); }
      if (m.save.echo) { x.fillStyle = '#d4fff1'; x.strokeStyle = '#244e46'; x.beginPath(); x.arc(X, Y, 3.5, 0, Math.PI * 2); x.fill(); x.stroke(); }
      label('Echo Grove', X, Y + 17, 'center', '#244e46', fs - 1); } }
  if (!charted('Wind Shrine')) blank(sx(SHRINE.x), sz(SHRINE.z), 8); else { const X = sx(SHRINE.x), Y = sz(SHRINE.z); x.strokeStyle = m.save.wind ? '#b07a1a' : '#5a3d20'; x.lineWidth = 2; x.beginPath(); x.arc(X, Y, 6, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(X, Y, 2.2, 0, Math.PI * 2); x.stroke(); label('Wind Shrine', X - 9, Y - 2, 'right'); }
  { const X = sx(WAYFINDER.x), Y = sz(WAYFINDER.z); x.fillStyle = '#c98a1a'; x.beginPath(); x.arc(X, Y, 3.5, 0, Math.PI * 2); x.fill(); label('Wayfinder', X + 7, Y - 8); }
  { const X = sx(WARDEN.x), Y = sz(WARDEN.z); x.strokeStyle = m.save.warden ? '#8a7a66' : '#9c3d1c'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.moveTo(X + Math.cos(a) * 4, Y + Math.sin(a) * 4); x.lineTo(X + Math.cos(a) * 7, Y + Math.sin(a) * 7); } x.stroke(); x.beginPath(); x.arc(X, Y, 4, 0, Math.PI * 2); x.stroke(); label(m.save.warden ? 'Warden (dormant)' : 'Vale Warden', X - 10, Y, 'right'); }
  { const X = sx(UPDRAFT.x), Y = sz(UPDRAFT.z); x.strokeStyle = m.save.done ? '#2f8f7a' : '#7f9a90'; x.lineWidth = 1.6; x.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = 1 + a * 0.6; const px = X + Math.cos(a) * r, py = Y + Math.sin(a) * r; if (a === 0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke(); label('Updraft', X + 10, Y + 4); }
  // Floating island + Hollow Beacon.
  { const X = sx(ISLAND_POS.x), Y = sz(ISLAND_POS.z); x.setLineDash([4, 4]); x.strokeStyle = '#4a3a6a'; x.lineWidth = 1.4; x.beginPath(); x.ellipse(X, Y, 24 * k, 22 * k, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    const BX = sx(ISLAND_POS.x - 3), BY = sz(ISLAND_POS.z + 2), lit = m.save.done;
    x.fillStyle = m.save.beacon ? '#e0a020' : lit ? '#7a5ae0' : '#6a6070'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 3 : 7; x.lineTo(BX + Math.cos(a) * r, BY + Math.sin(a) * r); } x.closePath(); x.fill();
    label('Hollow Beacon', X - 6, Y - 22 * k - 8 - fs, 'center', '#3a2a5a'); label('(floating isle)', X - 6, Y - 22 * k - 8, 'center', '#3a2a5a', fs - 2); }
  // Chapter II: the collapsed stair (once the Wayfinder points to it) and, after Enna's message, the trail west to the sea.
  if (m.save.cave >= 1) { const X = sx(STAIR.x), Y = sz(STAIR.z);
    if (m.save.cave >= 4) { x.save(); x.setLineDash([5, 4]); x.strokeStyle = 'rgba(31,95,120,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X, Y); x.bezierCurveTo(X - 30 * k, Y + 40 * k, sx(MAPBOX.x0) + 40, Y + 70 * k, sx(MAPBOX.x0) + 4, Y + 60 * k); x.stroke(); x.restore();
      label('to the sea ←', sx(MAPBOX.x0) + 8, Y + 60 * k - 10, 'left', '#1f5f78', fs - 1, true); }
    x.fillStyle = '#2e1e0e'; for (let i = 0; i < 4; i++) x.fillRect(X - 6 + i * 1.5, Y - 5 + i * 3, 12 - i * 3, 2.2);
    label('Collapsed Stair', X + 9, Y - 6, 'left', '#2e1e0e', fs - 1); }
  // Tidewrack Coast inset (beyond the western hills), once reached.
  if (m.save.coast >= 1) { const bw = Math.min(150, W * 0.3), bh = bw * 0.72, X0 = 10, Y0 = H - bh - 10;
    x.save(); x.fillStyle = 'rgba(238,224,190,.94)'; x.strokeStyle = '#4a3218'; x.lineWidth = 1.2; x.fillRect(X0, Y0, bw, bh); x.strokeRect(X0, Y0, bw, bh);
    x.beginPath(); x.rect(X0, Y0, bw, bh); x.clip();
    const sxC = (lx: number) => X0 + (lx + 80) / 125 * bw, szC = (lz: number) => Y0 + (lz + 55) / 110 * bh;
    x.fillStyle = 'rgba(70,120,140,.35)'; x.beginPath(); x.moveTo(X0, Y0); for (let z = -55; z <= 55; z += 5) { const a = Math.abs(z); const sxz = -4 + 5 * Math.sin(z * 0.045 + 0.6) + 2 * Math.sin(z * 0.11) - 26 * Math.min(1, Math.max(0, (a - 40) / 22)); x.lineTo(sxC(sxz), szC(z)); } x.lineTo(X0, Y0 + bh); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(40,80,100,.6)'; x.setLineDash([2, 3]); x.beginPath(); for (let z = -55; z <= 55; z += 5) { const a = Math.abs(z); const sxz = -4 + 5 * Math.sin(z * 0.045 + 0.6) + 2 * Math.sin(z * 0.11) - 26 * Math.min(1, Math.max(0, (a - 40) / 22)); if (z === -55) x.moveTo(sxC(sxz - 3), szC(z)); else x.lineTo(sxC(sxz - 3), szC(z)); } x.stroke(); x.setLineDash([]);
    x.fillStyle = '#5a4a3a'; for (const [lx, lz, r] of [[-27, -33, 3], [-58, -14, 4], [-31, 46, 3], [-45, 20, 6]] as const) { x.beginPath(); x.arc(sxC(lx), szC(lz), r, 0, Math.PI * 2); x.fill(); }
    if (m.save.coast >= 2) { x.strokeStyle = '#3a2814'; x.lineWidth = 2; x.setLineDash([3, 2]); x.beginPath(); x.moveTo(sxC(-3), szC(14)); x.quadraticCurveTo(sxC(-20), szC(22), sxC(-37), szC(20)); x.stroke(); x.setLineDash([]); }
    x.fillStyle = '#2e1e0e'; x.fillRect(sxC(10) - 2, szC(-30) - 7, 4, 9);
    x.restore();
    label('Tidewrack Coast · west', X0 + 4, Y0 + 9, 'left', '#3a2814', fs - 1);
    label(m.save.coast >= 3 ? 'Sea cave ✦' : 'Sea cave', sxC(-45), szC(20) + 13, 'center', '#1f4f60', fs - 2);
    label('Lamp', sxC(10), szC(-30) - 12, 'center', '#3a2814', fs - 2); }
  // Seals.
  for (const d of SEALS) { const X = sx(d.x), Y = sz(d.z), got = !!m.save.seals[d.id]; x.save(); x.translate(X, Y); x.rotate(Math.PI / 4); x.fillStyle = got ? d.color : 'rgba(0,0,0,0)'; x.strokeStyle = '#3a2814'; x.lineWidth = 1.4; x.fillRect(-4.5, -4.5, 9, 9); x.strokeRect(-4.5, -4.5, 9, 9); x.restore(); label(d.short, X + 9, Y, 'left', got ? '#3a2814' : '#6b4a26', fs - 1); }
  // Objective marker.
  if (m.target) { const X = sx(m.target.x), Y = sz(m.target.z), p = 0.5 + 0.5 * Math.sin(m.t * 4); x.strokeStyle = `rgba(200,60,20,${0.55 + 0.4 * p})`; x.lineWidth = 2.5; x.beginPath(); x.arc(X, Y, 10 + p * 3, 0, Math.PI * 2); x.stroke(); x.lineWidth = 1.2; x.beginPath(); x.arc(X, Y, 15 + p * 3, 0, Math.PI * 2); x.stroke(); }
  // Player arrow.
  { const X = sx(m.player.x), Y = sz(m.player.z), dx = Math.sin(m.player.facing), dz = Math.cos(m.player.facing);
    x.save(); x.translate(X, Y); x.rotate(Math.atan2(dz, dx) + Math.PI / 2); x.fillStyle = '#1f6f78'; x.strokeStyle = '#f4ead2'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.stroke(); x.fill(); x.restore(); }
  // Compass rose + title.
  { const X = W - 30, Y = H - 34; x.strokeStyle = '#4a3218'; x.fillStyle = '#4a3218'; x.lineWidth = 1; x.beginPath(); x.arc(X, Y, 12, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(X, Y - 17); x.lineTo(X + 3.5, Y); x.lineTo(X, Y + 17); x.lineTo(X - 3.5, Y); x.closePath(); x.fill(); label('N', X - 16, Y - 12, 'center', '#4a3218', fs - 1, false); }
  label('Marr’s Unfinished Map', 20, 24, 'left', '#3a2814', fs + 4);
  label('The Broken Vale', 20, 24 + fs + 4, 'left', '#6b4a26', fs - 1);
}
