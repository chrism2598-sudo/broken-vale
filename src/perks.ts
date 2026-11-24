// M64F · progression: a choice of one perk from two at Levels 3, 6, 9 and 12, and one relic slot filled from discoveries.
// Perks and relics are save lists (`perks`, `relics`, `relic`); saves from M54–M63 carry none → every due choice is offered once, calmly.
export type Perk = { id: string; name: string; desc: string; glyph: string };
export const PERK_TIERS: { lv: number; pair: [Perk, Perk] }[] = [
  { lv: 3, pair: [{ id: 'hearth', name: 'Hearth-Kept', desc: 'Hold one more Kindling spark (4).', glyph: '✦' }, { id: 'stride', name: 'Light Stride', desc: 'Rolls cost 30% less stamina.', glyph: '➶' }] },
  { lv: 6, pair: [{ id: 'riposte', name: 'Quick Riposte', desc: 'After a parry: 1.5 s to answer, blows ×1.75.', glyph: '⚔' }, { id: 'mend', name: 'Field Mending', desc: 'Hearts return sooner after a fight.', glyph: '♥' }] },
  { lv: 9, pair: [{ id: 'guard', name: 'Steady Guard', desc: 'A wider parry window (0.24 → 0.34 s).', glyph: '⛨' }, { id: 'heart', name: 'Stout Heart', desc: 'One more heart.', glyph: '❤' }] },
  { lv: 12, pair: [{ id: 'blaze', name: 'Bright Kindling', desc: 'Seal powers reach farther and daze longer.', glyph: '✹' }, { id: 'might', name: 'Iron Arm', desc: 'Heavy blows cost 30% less stamina.', glyph: '⚒' }] },
];
export const PERK_IDS = PERK_TIERS.flatMap((t) => t.pair.map((p) => p.id));
/** The tier still owed a choice at this level (lowest first), or null. A tier counts as chosen when either of its pair is held. */
export function perkDue(level: number, perks: readonly string[]): (typeof PERK_TIERS)[number] | null {
  for (const t of PERK_TIERS) if (level >= t.lv && !t.pair.some((p) => perks.includes(p.id))) return t;
  return null;
}
export type Relic = { id: string; name: string; desc: string; glyph: string; from: string };
export const RELICS: Relic[] = [
  { id: 'emberstone', name: 'Emberstone', desc: 'Rolling through a blow gathers a whole spark.', glyph: '◆', from: 'the Hearth Ruin, east of the Dome road' },
  { id: 'tidepearl', name: 'Tide-Pearl', desc: 'A parry mends a heart (once every 8 s).', glyph: '●', from: 'the Reed Shrine, south of the Sunspire' },
  { id: 'oathring', name: 'Oath-Ring', desc: 'Every blow +10%.', glyph: '○', from: 'the cairn on Shepherd’s Rise, past Azure Keep to the east' },
];
export const RELIC_IDS = RELICS.map((r) => r.id);
export const relicOf = (id?: string) => RELICS.find((r) => r.id === id) ?? null;
