/**
 * Dialogue with player tokens. Canon: the hero is "<First> Marr", 17, Enna's child (default Ilka, female).
 * Tokens: {name} first name · {fullname} "First Marr" · {surname} · pronouns {they} {them} {their} {theirs} {themself}
 * and {child} (daughter/son); capitalise the token ({They}, {Their}, {Name}…) to capitalise the output.
 */
export const SURNAME = 'Marr';
export type Sex = 'female' | 'male';
export type Profile = { name: string; sex: Sex };

const PRONOUNS: Record<Sex, Record<string, string>> = {
  female: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself', child: 'daughter' },
  male: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself', child: 'son' },
};

export function fill(line: string, p: Profile): string {
  const table: Record<string, string> = { ...PRONOUNS[p.sex], name: p.name, fullname: `${p.name} ${SURNAME}`, surname: SURNAME };
  return line.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = table[key.toLowerCase()];
    if (v === undefined) return m;
    return key[0] === key[0].toUpperCase() ? v[0].toUpperCase() + v.slice(1) : v;
  });
}

/** Line bank (speaker → lines). Plain text only; rendered with textContent. */
export const LINES = {
  wayfinder: {
    greet: '{fullname} — Enna’s {child}, at last. The Vale’s beacons have gone dark. The Wind Shrine lies up the path to the north-west; the rift above it has been singing all morning, {name}, as if it knows your step.',
  },
  // Canon lines for upcoming NPCs.
  sefa: { meet: '{name} Marr? You have Enna’s way of listening with your whole face.' },
  ress: { steady: 'Hold still, {name}.' },
  // M27 · Author canon: Ress at the head of the broken ridge stair (opening). Verbatim; the coast-only line never plays here.
  ressStair: {
    meet: [
      'I resoled her boots. Ress. If you’re going to have a complaint.',
      'I guessed. You’ve got her chin. She said she’d be back for winter soles.',
      'Quarrymen used the north shelf when the stair iced. There’s a water cut halfway along. The plank went with the slide.',
      'Tie the rope to it. Wedge it in a crack. Hit somebody if you have to. It’s paid for. Your mother left a copper over.',
      'Don’t thank me yet. I haven’t seen you get down.',
    ],
    idle: 'Hold still, {name}. That heel is arguing with the road.',
  },
} as const;

export function say(speaker: string, line: string, p: Profile): string {
  return `${speaker}: ${fill(line, p)}`;
}
