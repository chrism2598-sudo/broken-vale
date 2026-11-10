/** M16 · The Lowtide Lamp (Chapter II finale and the game's ending) + M17 · the people of the vale.
 *  Save field `lamp`: 0 = Enna waits at the foot of the Lamp · 1 = reunited, tide released, climb and set the glass at the turn of the tide · 2 = the seam is tied (the end). */
import type { Save } from './quest';
import { MARR_MARKS } from './echo';

export const LAMP_XP = 70;
export const MAX_XP = 580; // 510 before M16
export const ENNA_NAME = 'Enna Marr';

export const ENNA_LINES = {
  reunion: [
    '{Name}. Look at you. You came the whole way — you read every blank I left you.',
    'I’m sorry. The Break left two seams: one across the sky, one under the sea. Alone I could only keep one of them quiet, so I went down and kept the drowned one, and left you a map with holes in it.',
    'The Keeper held that seam for three hundred years. You let it rest. Now the Lamp can do the last of the custodians’ work — if we light it properly, together.',
    'The Lamp drinks from the sea. It has to be fed a turning tide, so I’m letting the water run again — the causeway will sink for a while.',
    'Climb with me. When the tide turns — low water — set your Tide-Glass in the lantern. The beam goes through the glass and up into the seam, and the sky gets tied shut.',
  ],
  waiting: ['When the tide turns, {name}. Low water, glass in the lantern. I’ll hold the key steady.'],
  notYet: (phase: string) => `Not yet — the tide is ${phase}. Wait for low water, when it turns.`,
  set: ['Enna’s hand closes over yours on the glass. “Now.”'],
  after: [
    'I keep looking up to check it’s still closed. It is. You did that.',
    'Go and see the vale, {name}. I’ll be at the meadow crossing with the Wayfinder when you want me — we have nine years of talking to do.',
  ],
  vale: [
    'I’d forgotten what the meadow smells like after rain.',
    'The map is yours now, {name}. Fill the blanks, or leave them. I liked them, actually.',
  ],
};

export const LAMP_TOAST = {
  footLocked: 'The lighthouse stair is choked with fallen blocks. Someone has been climbing it, though.',
  climb: 'The lantern room of the Lowtide Lamp',
  down: 'Back at the foot of the Lamp',
};

export const FINAL_TITLE = 'The Broken Vale — Mended';
export const FINAL_KICKER = 'The End';
export const FINAL_LINES = [
  'The Lowtide Lamp blazes for the first time since the Break. Its light runs through Enna’s Tide-Glass and climbs, a gold thread over the sea, into the violet seam in the sky.',
  'Stitch by stitch the seam draws closed. Far to the east, over the Broken Vale, the rift above the Wind Shrine thins to nothing, and the Wayfinder’s lantern steadies for the first time in years.',
  'Enna comes down the broken stair with salt in her hair. “Your map now,” she says, and puts the pen in {name}’s hand.',
];
export const FINAL_REWARD = `+${LAMP_XP} XP · Seam-Binder · Enna’s pen`;

export function finalStats(s: Save, level: number): string {
  const charted = s.charted.filter(Boolean).length, extras = [s.wind ? 'Wind Shrine ✓' : 'Wind Shrine —', s.warden ? 'Vale Warden ✓' : 'Vale Warden —', s.echo ? 'Echo Grove ✓' : 'Echo Grove —', `Map ${charted}/${MARR_MARKS.length}`];
  return `Level ${level} · ${s.xp}/${MAX_XP} XP · ${extras.join(' · ')}`;
}

export const CREDITS = [
  ['The Broken Vale', 'An original fantasy adventure in two chapters'],
  ['Created by', 'C S — from his tabletop map of the vale'],
  ['Chapter I', 'The Four Seals · the Wind Shrine · the Vale Warden · the Hollow Beacon'],
  ['Chapter II', 'Enna’s Trail · the Tidewrack Coast · the Listening Pools · the Drowned Keeper · the Lowtide Lamp'],
  ['Characters', 'Enna Marr · the Wayfinder · Sefa Lune · Dov Hask · Ress'],
  ['Engine', 'three.js (MIT) · Vite · TypeScript'],
  ['Characters (models)', 'Quaternius — Hooded Adventurer, Hoodie Character, King (CC0)'],
  ['Nature', 'Quaternius Stylized Nature MegaKit (CC0) · Poly Haven rocks, shrub and fern (CC0)'],
  ['Textures & sky', 'Poly Haven — grass, path, rock, brick, roof, sandstone, metal, cliff, blocks, rock face, Kloofendal HDRI (CC0)'],
  ['Everything else', 'Made in code for this game: the Keeper, sea caves, coast, sea, beacons, seals, shrine, Warden, map and all the light'],
  ['Thank you for playing', 'The vale is yours to wander — keep exploring.'],
] as const;

// ---------- M17 · the people of the vale ----------
type L = string[];
export function sefaLines(s: Save, nextMark: string | null): L {
  const n = s.charted.filter(Boolean).length;
  if (s.lamp >= 2) return ['The seam is gone. I’m drawing the first sky I’ve ever drawn without a crack in it, {name}. My hand keeps adding it out of habit.'];
  if (!s.started) return ['Sefa Lune — I chart the vale. Or I did, until your mother started tearing up my borders and drawing better ones.', '{name} Marr? You have Enna’s way of listening with your whole face. Go and see the Wayfinder at the crossing; then come and tell me what the vale looks like now.'];
  if (n < MARR_MARKS.length) return [`Marr’s Unfinished Map has ${n} of ${MARR_MARKS.length} old marks inked.${nextMark ? ` The nearest you haven’t stood near is ${nextMark}.` : ''}`, 'Walk close to a mark and the page inks itself. Enna made it that way — she never trusted a line nobody had walked.'];
  if (!s.beacon) return ['Seven of seven. Enna would have argued with every line, so I know it’s right.', 'Your mother’s map left room for that sound in the sky. Don’t hurry to fill every blank.'];
  if (s.sea < 5) return ['She went west under the hills, didn’t she? She always said the sea was just a valley that hadn’t finished filling.', 'If you find her, tell her Sefa still has her good pen.'];
  return ['Enna is at the Lamp? Then go — what are you doing talking to a mapmaker?'];
}
export function dovLines(s: Save): L {
  if (s.lamp >= 2) return ['The Dome’s forge caught a spark this morning, on its own. First in thirty years. I think the vale is breathing out.'];
  if (!s.warden) return ['Dov Hask. I forged the Warden’s joints, back when the Iron Dome still had fire in it. It still guards the old ring south-east of here.', 'It was built to warn before it was built to strike. When the ground glows under you, step out of the ring. Strike while it’s heavy, just after the slam.', 'You don’t have to fight it. But it’s been lonely, and it would be glad of a proper match.'];
  if (s.sea >= 5) return ['A drowned keeper wearing brass collars? Custodian work, that. Older than my grandmother’s anvil.', 'You let both of them rest. Most heroes only know how to break things.'];
  return ['You’ve let the old Warden sleep. Thank you for not breaking its heart.', 'One thing for the road: anything built to guard rests when its heart is shown. Remember that if you meet its older cousins.'];
}
export function ressLines(s: Save): L {
  if (s.lamp >= 2) return ['Enna never paid me to follow her map. She paid me to bring her home.', 'Looks like you did that part for me. I’ll take the boat money anyway.'];
  if (s.lamp === 1) return ['When the tide turns — that’s all she ever says. Low water, glass up, and don’t blink.'];
  if (s.sea >= 5) return ['She came out. She’s at the foot of the Lamp — go on, I’ll keep watch on the water.'];
  if (s.coast < 2) return ['You’re the Marr kid. I’m Ress — Enna hired me to carry rope and keep her out of the water. Half the job went well.', 'The tide-shrine by the Lamp can hold the sea back, but only from low water. Watch the beach stones go dry, then raise that glass of hers.'];
  return ['She went into that cave three tides ago. Said if she didn’t come out, to wait for someone who listens like she does.', 'I suppose that’s you. Mind the Listening Pools — the shells only answer when the water’s down.'];
}
export function nextUncharted(s: Save, px: number, pz: number): string | null {
  let best: string | null = null, bd = 1e9; MARR_MARKS.forEach((m, i) => { if (s.charted[i]) return; const d = Math.hypot(m.x - px, m.z - pz); if (d < bd) { bd = d; best = m.name; } }); return best;
}
