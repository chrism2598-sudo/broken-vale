import { SEALS, WAYFINDER, SHRINE, LANDMARKS } from './world';
import { WARDEN } from './warden';
import type { Save } from './quest';

/** M19 · No guide arrow: the Journal's written clues give landmark-based directions for the current goal.
 *  Directions are compass words read from the Wayfinder's meadow (north is up on Marr's map). */
export type ClueCtx = { save: Save; inCave: boolean; inCoast: boolean; inSea: boolean; inKeep: boolean; onIsland: boolean; tide?: string; keeperState?: string | null; owned: string[] };
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export function dirWord(from: { x: number; z: number }, to: { x: number; z: number }) {
  const a = Math.atan2(to.x - from.x, -(to.z - from.z)); // 0 = north (−z), clockwise
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
const far = (from: { x: number; z: number }, to: { x: number; z: number }) => { const d = Math.hypot(to.x - from.x, to.z - from.z); return d > 110 ? 'a long walk' : d > 55 ? 'a fair walk' : 'not far'; };
const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;
const SEAL_HINT: Record<string, string> = {
  dawn: 'among the walls of Pale Keep',
  sun: 'at the foot of the Sunspire, the stone needle that shows above the trees',
  tide: 'by the walls of Azure Keep',
  forge: 'at the Iron Dome, the old domed forge',
};
export function clueLines(c: ClueCtx): { goal: string[]; rumours: string[] } {
  const s = c.save, n = SEALS.filter((d) => s.seals[d.id]).length, W = WAYFINDER, g: string[] = [];
  if (c.inKeep) g.push(s.sea >= 5 ? 'The Keeper sleeps. The ledge you came in by leads back to the Listening Pools.' : 'Fight the Drowned Keeper: roll (Dodge) out of the red spout rings, climb a raised stone when it calls the tide. At low water get close, raise the Tide-Glass (Interact), then Attack the open core. Block or parry a spout if you can’t roll.');
  else if (c.inSea) {
    if (s.sea < 2) g.push('Three lamp-shells sleep in the Listening Pools. They only wake at low water — watch the tide line on the rocks and wake each one with the Tide-Glass.');
    else if (s.sea < 3) g.push('Something was left by the round seal at the back of the cave — an oilcloth packet in Enna’s hand.');
    else if (s.sea < 5) g.push(s.sea >= 4 ? 'The round seal stands open. The drowned chamber lies beyond it, down the steps.' : 'Raise the Tide-Glass to the round seal at the back of the cave.');
    else g.push('Your road leads back out to the causeway and the coast.');
  } else if (c.inCave) {
    if (s.cave < 3) g.push('The braziers must burn in the order the river runs. Read the river carved into the floor and follow it from its spring.');
    else if (s.cave < 4) g.push('The sealed door stands open. Enna left something in the alcove behind it.');
    else if (s.coast < 3 || s.sea < 5 || s.lamp < 2) g.push('The west passage is the old water-road: follow it out to the sea.');
    else g.push('Climb back out by the collapsed stair.');
  } else if (c.inCoast) {
    if (s.coast < 2) g.push('A tide-shrine stands on the shore. It answers only at low water — wait for the sea to pull back.');
    else if (s.coast < 3) g.push('At low water the causeway stones rise out of the sea. Walk them out to the cave mouth in the sea stack.');
    else if (s.sea < 5) g.push('The sea cave waits at the end of the causeway: the Listening Pools.');
    else if (s.lamp === 0) g.push('Enna waits at the foot of the Lowtide Lamp — the tall lighthouse on the coast.');
    else if (s.lamp === 1) g.push('Climb the Lowtide Lamp and set the Tide-Glass in the lantern when the tide turns low.');
    else g.push('The tunnel by the shore leads back to the vale.');
  } else if (c.onIsland) {
    g.push(s.beacon ? 'The held morning is spent. Ride down from the western edge of the isle.' : 'Read the Unspent carving, then turn the four morning mirrors toward the Hollow Beacon.');
  } else if (!s.started) g.push('The Wayfinder waits by the lantern-staff, a few steps north of where you woke.');
  else if (n < 4) {
    g.push(`You hold ${n} of 4 seals. Ask the Wayfinder again if you lose your way.`);
    for (const d of SEALS) if (!s.seals[d.id]) g.push(`${d.name}: ${SEAL_HINT[d.id] ?? d.at}. From the Wayfinder it lies ${dirWord(W, d)} — ${far(W, d)}.`);
    g.push('The creek runs through the middle of the vale; wade it where it runs shallow.');
  } else if (!s.done) g.push('All four seals burn. Bring them back to the Wayfinder in the middle of the meadow.');
  else if (!s.beacon) {
    if (!s.wind) g.push(`The Updraft won’t carry you without the Windward Blessing. The Wind Shrine stands ${dirWord(W, SHRINE)} of the Wayfinder, on the rise above the path — match its three runes to the tablet.`);
    else g.push('The Updraft spirals just east of the Wind Shrine. Ride it up to the floating isle and the Hollow Beacon.');
  } else if (s.cave === 0) g.push('The Wayfinder has word of Enna. Speak with him.');
  else if (s.cave < 4) g.push(`A collapsed stair opens in the hillside just east of Pale Keep (${dirWord(W, lm('pale'))} of the Wayfinder). Lanterns burn at its mouth.`);
  else if (s.coast < 3 || s.sea < 5 || s.lamp < 2) g.push('Enna’s trail runs west to the sea: down the collapsed stair east of Pale Keep and out along the cave’s west passage.');
  else g.push('The vale is mended. Enna rests by the crossing, near the Wayfinder. Explore freely.');
  const r: string[] = [];
  if (!c.owned.includes('spear')) r.push(`Dov says a warden-hunter lost a spear in the rocks below the Veilfall, ${dirWord(W, lm('veilfall'))} of the meadow.`);
  if (!c.owned.includes('maul')) r.push(`An old smith’s maul is said to lean by the forge door of the Iron Dome, ${dirWord(W, lm('dome'))} of the Wayfinder.`);
  if (!c.owned.includes('tide') && (s.coast >= 3 || s.sea >= 1)) r.push('Something sharp glints in a side pool of the Listening Pools, inside the sea stack.');
  if (!s.warden) r.push(`The Vale Warden, an old stone guardian, stands ${dirWord(W, WARDEN)} of the Wayfinder. It is optional, and it hits hard.`);
  return { goal: g, rumours: r };
}
