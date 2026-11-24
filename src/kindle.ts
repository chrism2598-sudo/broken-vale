/** M64C · Kindling — the custodians' craft. The old keepers carried a spark of a seal's fire from beacon to beacon; Ilka learns
 *  it at her first seal. Sparks are earned only by precise defence (a parry, a roll through a blow, a felled seal guard) and
 *  spent to kindle a claimed seal, whose power is that seal's nature. The same spark mends custodian "fractures" (M64E). */
export type SealId = 'dawn' | 'sun' | 'tide' | 'forge';
export const SEAL_IDS: SealId[] = ['dawn', 'sun', 'tide', 'forge'];
export const KINDLE_BASE_MAX = 3;
export const GAIN = { parried: 1, dodged: 0.5, guards: 1 } as const;
export type Power = { name: string; desc: string; color: string; glyph: string };
export const POWERS: Record<SealId, Power> = {
  forge: { name: 'Temper', desc: 'Your next 3 blows hard-stagger — even a foe that has steadied itself.', color: '#ff9a3c', glyph: '⚒' },
  dawn: { name: 'Daybreak', desc: 'First light breaks around you: foes within 6 m reel, and you mend a heart.', color: '#ffe9a8', glyph: '☀' },
  sun: { name: 'Glare', desc: 'Noon in a heartbeat: foes before you (7 m) lose their wind-up and reel, blinded.', color: '#fff27a', glyph: '✹' },
  tide: { name: 'Undertow', desc: 'The tide turns: foes within 7 m are thrown back and reel.', color: '#7fd6e8', glyph: '≈' },
};
export const kindleMax = (bonus = 0) => KINDLE_BASE_MAX + bonus;
export const clampK = (v: unknown, max = 4) => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(max, Math.round(v * 2) / 2)) : 0;
/** Which seal answers: the attuned one if claimed, else the first claimed in canon order; null before the first seal. */
export function attuned(seals: Record<string, boolean>, attune?: string): SealId | null {
  if (attune && SEAL_IDS.includes(attune as SealId) && seals[attune]) return attune as SealId;
  return SEAL_IDS.find((id) => seals[id]) ?? null;
}
/** Next claimed seal after the current one (tap the glyph to re-attune). */
export function nextAttune(seals: Record<string, boolean>, cur: SealId | null): SealId | null {
  const own = SEAL_IDS.filter((id) => seals[id]); if (!own.length) return null; const i = cur ? own.indexOf(cur) : -1; return own[(i + 1) % own.length];
}
