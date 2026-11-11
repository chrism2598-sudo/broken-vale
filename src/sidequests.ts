import type { Save } from './quest';
import type { JSection } from './journal';
import { OUTPOSTS } from './world';
import { type Loc } from './outposts';

/** M20b-2 · three side tales (Sefa, Dov, Ress). Stages live in save.sq; directions are spoken clues, never map markers.
 *  sq.sefa: 0 untold · 1 sketching the three edges · 2 done
 *  sq.dov:  0 · 1 find the tongs (Ashen Hollow) · 2 tongs found · 3 find star-iron (Old Barrow) · 4 star-iron found · 5 done (Emberbrand)
 *  sq.ress: 0 · 1 Teo's satchel (Greyhold top) · 2 follow his note (Sunfall Bluff) · 3 bundle found · 4 done (Teo's Harpoon)
 *  sq.barrow: 0 · 1 hall cleared (grate open) · 2 the King rests · 3 vault chest opened */
export const SQ_XP = { step: 15, sefa: 60, dov: 80, ress: 70 } as const;
export const SKETCHES = ['tower', 'bluff', 'cairn'] as const;
const P = Object.fromEntries(OUTPOSTS.map((o) => [o.id, o]));
export const sq = (s: Save) => (s.sq ??= {});
export const stage = (s: Save, id: string) => s.sq?.[id] ?? 0;
export const sketched = (s: Save, id: string) => (s.views ?? []).includes('sk-' + id);
export const sketchesLeft = (s: Save) => SKETCHES.filter((id) => !sketched(s, id));

export const SKETCH_CLUE: Record<(typeof SKETCHES)[number], string> = {
  tower: 'Due east of the crossing, past the Warden’s rise, the last hill before the mountains carries the Greyhold Watchtower. Its stair fell long ago — the stones lie round it like a broken spiral.',
  bluff: 'South-east, further than the Iron Dome, the ground runs out at Sunfall Bluff. Someone stacked a cairn where the evening light hits last.',
  cairn: 'Straight north from the crossing, past every road, right up under the mountains: a lone cairn. Enna marked it with a single word — “cold”.',
};
export function sefaTale(s: Save): string[] {
  const st = stage(s, 'sefa'), left = sketchesLeft(s);
  if (st === 0) return ['Your mother’s map has three blank corners, {name}. Not lost places — she just never stood in them.', 'Stand at each one, look out, and sketch what you see. I’ll ink them in.', ...SKETCHES.map((k) => SKETCH_CLUE[k]), 'Bring me the sketches. I have something of hers for the one who finishes it.'];
  if (st === 1 && left.length) return [`${3 - left.length} of 3 corners sketched. Still blank:`, ...left.map((k) => SKETCH_CLUE[k])];
  if (st === 1) return ['All three… look at that. The tower’s shadow, the bluff at sunset, the cold cairn.', 'Enna gave me this when she left — a heartstone, cut from the Dome’s first furnace. It made her harder to knock down. Keep it close.'];
  return ['Every corner inked. The map is finished at last, and it has your hand in it.'];
}
export function dovTale(s: Save): string[] {
  const st = stage(s, 'dov');
  if (st === 0) return ['Ash-robed folk came through the south-west in the spring, chanting about a sun that should stay dead.', 'They took my forge-tongs — the old Dome pair, the only ones that can hold star-iron.', 'Their camp sits in a hollow beyond the Sunspire, near where the vale meets the mountains. Low walls, three tents, a fire that never goes out. Bring the tongs back and I’ll make you something worth the walk.'];
  if (st === 1) return ['South-west, past the Sunspire, the hollow with the low broken wall. Smoke by day, fire by night. Mind the big one — they call him a zealot.'];
  if (st === 2) return ['My tongs! Still sound. Now — I need the iron that fell with the old sky. The cult wrote where they were going for it.', 'Their orders named the Old Barrow: north-west, beyond the far side of Pale Keep, a grass mound with a stone door. The dead keep it, and something with a crown keeps them.'];
  if (st === 3) return ['The Old Barrow — north-west, past Pale Keep, where the land humps up before the mountains. Star-iron glows a little in the dark. You’ll know it.'];
  if (st === 4) return ['That’s it — warm as a heart. Give me a moment at the anvil.', '…There. Emberbrand. Dome-forged star-iron, the last blade I’ll ever make. It bites harder than anything in the vale.'];
  return ['Swing it like you mean it. And let the old Warden sleep.'];
}
export function ressTale(s: Save): string[] {
  const st = stage(s, 'ress');
  if (st === 0) return ['My brother Teo kept the Greyhold watch before the Break — the lonely tower on the far east edge of the vale.', 'He wrote he’d leave a satchel up top if he ever had to go. He went. I never climbed it.', 'The stair’s fallen — you’d have to hop the stones. Find what he left, and I’ll owe you more than a guide’s fee.'];
  if (st === 1) return ['Greyhold — far east, the last rise before the mountains. Up top, if the stones hold you.'];
  if (st === 2) return ['“Gone to watch the sun fall from the bluff,” he wrote. That’s south-east, past the Iron Dome. Look under the stones — he always hid things under stones.'];
  if (st === 3) return ['His harpoon. And his letter — he made it to the bluff, and then to the coast. He was looking for me.', 'Keep the harpoon. He’d want it thrown, not hung on a wall.'];
  return ['Teo would have liked you. He liked anyone who climbs things they shouldn’t.'];
}

/** Places that name themselves on the map when you reach them (the old landmarks too). */
export function makeLocs(base: { id: string; name: string; x: number; z: number; r: number }[]): Loc[] {
  const out: Loc[] = base.map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z, r: Math.max(14, l.r), xp: 5, reveal: 40 }));
  out.push({ id: 'tower', name: P.tower.name, x: P.tower.x, z: P.tower.z, r: 18, xp: 10, reveal: 46 }, { id: 'camp', name: P.camp.name, x: P.camp.x, z: P.camp.z, r: 22, xp: 10, reveal: 44 },
    { id: 'barrow', name: P.barrow.name, x: P.barrow.x, z: P.barrow.z, r: 16, xp: 10, reveal: 40 }, { id: 'bluff', name: P.bluff.name, x: P.bluff.x, z: P.bluff.z, r: 10, xp: 15, reveal: 80, view: true },
    { id: 'cairn', name: P.cairn.name, x: P.cairn.x, z: P.cairn.z, r: 10, xp: 15, reveal: 80, view: true },
    { id: 'crown', name: P.crown.name, x: P.crown.x, z: P.crown.z, r: 9, xp: 25, reveal: 120, view: true });
  return out;
}

export function sideJournal(s: Save): JSection {
  const it: JSection['items'] = [];
  const sf = stage(s, 'sefa'), dv = stage(s, 'dov'), rs = stage(s, 'ress');
  if (sf === 0) it.push({ t: 'Sefa Lune, the mapmaker by the crossing, has been looking at your mother’s map.' });
  else if (sf === 1) { it.push({ t: `The Blank Corners — sketch the three edges of Enna’s map (${3 - sketchesLeft(s).length}/3).` }); for (const k of SKETCHES) it.push({ t: sketched(s, k) ? `${P[k].name} — sketched` : SKETCH_CLUE[k], done: sketched(s, k) }); if (!sketchesLeft(s).length) it.push({ t: 'All three sketched — take them to Sefa.' }); }
  else it.push({ t: `The Blank Corners — complete · Enna’s heartstone (+1 heart, +${SQ_XP.sefa} XP).`, done: true });
  if (dv === 0) it.push({ t: 'Dov Hask, the old smith, looks like he has lost something.' });
  else if (dv < 5) { it.push({ t: 'The Dome’s Last Fire — Dov will forge a blade from star-iron.' });
    it.push({ t: dv >= 2 ? 'Forge-tongs taken back from the Ashen Hollow.' : 'Take back Dov’s forge-tongs from the ash-robed camp in a hollow south-west of the Sunspire.', done: dv >= 2 });
    if (dv >= 2) it.push({ t: dv >= 3 ? 'Dov has his tongs.' : 'Bring the tongs to Dov.', done: dv >= 3 });
    if (dv >= 3) it.push({ t: dv >= 4 ? 'Star-iron taken from the Barrow-King’s vault.' : 'Find star-iron in the Old Barrow — north-west, beyond Pale Keep, a grass mound with a stone door.', done: dv >= 4 });
    if (dv >= 4) it.push({ t: 'Bring the star-iron to Dov.' }); }
  else it.push({ t: `The Dome’s Last Fire — complete · Emberbrand (+${SQ_XP.dov} XP).`, done: true });
  if (rs === 0) it.push({ t: (s.coast | 0) >= 1 ? 'Ress, Enna’s guide on the Tidewrack Coast, mentioned a brother.' : 'Somewhere beyond the western hills, someone is still waiting for word of a brother.' });
  else if (rs < 4) { it.push({ t: 'The Lights Teo Left — find what Ress’s brother left behind.' });
    it.push({ t: rs >= 2 ? 'Teo’s satchel found atop Greyhold: “Gone to watch the sun fall from the bluff.”' : 'Climb the Greyhold Watchtower on the far east edge — the stair is fallen; hop its stones.', done: rs >= 2 });
    if (rs >= 2) it.push({ t: rs >= 3 ? 'Teo’s bundle found under the Sunfall cairn.' : 'Follow Teo’s note to the bluff south-east of the Iron Dome. Look under the stones.', done: rs >= 3 });
    if (rs >= 3) it.push({ t: 'Take Teo’s harpoon and letter to Ress on the coast.' }); }
  else it.push({ t: `The Lights Teo Left — complete · Teo’s Harpoon (+${SQ_XP.ress} XP).`, done: true });
  const b = stage(s, 'barrow');
  if (b > 0 || (s.found ?? []).includes('barrow')) it.push({ t: b >= 2 ? 'The Old Barrow — Ossric the Barrow-King rests again.' : 'The Old Barrow — the dead keep its hall, and a crowned thing keeps the vault.', done: b >= 2 });
  const camps = (s.gone?.ashen ?? -1) >= 0;
  if (camps || (s.found ?? []).includes('camp')) it.push({ t: camps ? 'Ashen Hollow — broken once; they may drift back in a few days.' : 'Ashen Hollow — an ash-robed camp in the south-west hollow.', done: camps });
  return { h: 'Side tales', items: it };
}
