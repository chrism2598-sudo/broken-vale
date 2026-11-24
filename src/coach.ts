/** M58 · Opening coach: short, one-time, context-triggered tips for the first ten minutes.
 *  UI text only (no NPC lines). It teaches by reacting to what is happening — a foe's wind-up, a roll that worked,
 *  a parry, low stamina, a first hit — and never pauses the game. Progress lives in its own localStorage key
 *  (never in the save), resets with a fresh game, and is skipped for players who already hold a seal. */
export type CoachCtx = {
  dt: number; touch: boolean; busy: boolean; started: boolean; seals: number; px: number; pz: number; yaw: number;
  near: string | null; hostile: boolean; winding: boolean; rolling: boolean; stamina: number; hp: number; landed: number;
  pickNear: boolean;
};
export type CoachEvent = 'hit' | 'blocked' | 'parried' | 'dodged' | 'guardbreak' | 'questStart' | 'sealClaimed';
const KEY = 'vale3d-coach';
const ROLLED = 'Rolled clear! The glow and the raised arm are your cue. Rolls cost stamina — the bar above the buttons.';
type Step = 'move' | 'talk' | 'seal' | 'attack' | 'dodge' | 'rolled' | 'parry' | 'parried' | 'stamina' | 'hurt' | 'claim' | 'pick';
const ALL: Step[] = ['move', 'talk', 'seal', 'attack', 'dodge', 'rolled', 'parry', 'parried', 'stamina', 'hurt', 'claim', 'pick'];
/** M63 · taught after the first seal (the first guard fight), not in the opening two-husk fight. */
export const LATE: Step[] = ['parry', 'parried', 'stamina'];

export function makeCoach(el: HTMLElement, pulse: (id: string | null) => void) {
  let done = new Set<Step>();
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); if (Array.isArray(v)) done = new Set(v.filter((s) => ALL.includes(s))); } catch { /* */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch { /* */ } };
  const finish = (s: Step) => { if (!done.has(s)) { done.add(s); persist(); } };
  let cur: { id: Step; text: string; t: number; min: number; pulse: string | null } | null = null;
  let moved = 0, turned = 0, lastX = NaN, lastZ = NaN, lastYaw = NaN, moveT = 0, atkT = 0, landed0 = -1, windShown = 0, wasWinding = false, rolledIn = false, hpAtWind = 0, parryTries = 0, hp0 = -1;
  let seals = 0; // M63 · last seen seal count (gates the LATE tips)
  let queued: { id: Step; text: string; secs: number; wait?: number } | null = null, shownAt: Record<string, number> = {}, clock = 0;
  const show = (id: Step, text: string, secs: number, pulseId: string | null = null, min = 1.2) => {
    if (cur && cur.id === id) { cur.t = Math.max(cur.t, secs); if (cur.text !== text) { cur.text = text; el.textContent = text; } return; }
    cur = { id, text, t: secs, min, pulse: pulseId }; el.textContent = text; el.classList.add('on'); pulse(pulseId); shownAt[id] = clock;
  };
  const hide = () => { if (!cur) return; cur = null; el.classList.remove('on'); pulse(null); };
  /** A tip that reacts to an event: shows once, then is done. */
  const once = (id: Step, text: string, secs: number) => { if (done.has(id)) return; finish(id); if (cur && clock - (shownAt[cur.id] ?? 0) < cur.min && cur.id !== 'dodge' && cur.id !== 'parry') { queued = { id, text, secs }; return; } show(id, text, secs); };
  const api = {
    /** Fresh game → start over; a player who already holds a seal never sees the opening tips. */
    sync(started: boolean, seals: number) {
      if (!started && seals === 0) { done = new Set(); persist(); }
      // M63 · a returning player with exactly one seal may still be owed the LATE tips (kept if already seen)
      else if (seals > 0) { done = new Set(seals >= 2 ? ALL : [...ALL.filter((s) => !LATE.includes(s)), ...[...done].filter((s) => LATE.includes(s))]); persist(); }
    },
    get on() { return !!cur; }, get id() { return cur?.id ?? null; }, get text() { return cur?.text ?? ''; },
    done: () => [...done],
    event(e: CoachEvent, ctx?: { touch?: boolean; name?: string }) {
      const tap = ctx?.touch ?? true;
      if (e === 'questStart') { finish('talk'); show('seal', `First seal: the ${ctx?.name ?? 'nearest seal'} — follow the arrow at the top. It is only a short walk.`, 8); finish('seal'); return; }
      // M61 · the claim tip waits until the seal toast (4.5 s) and level-up banner have cleared, so the three never stack
      if (e === 'sealClaimed') { finish('seal'); if (!done.has('claim')) { finish('claim'); hide(); queued = { id: 'claim', text: 'Seal 1 of 4! The other three are yours to find — Menu ▸ Journal holds the clues (or switch the guidance arrow on in Settings).', secs: 10, wait: 4.6 }; } return; }
      if (e === 'dodged') { if (cur?.id === 'dodge') hide(); finish('dodge'); once('rolled', ROLLED, 3.5); return; }
      if (e === 'parried') { if (cur?.id === 'parry') hide(); finish('parry'); once('parried', 'Parried! It reels — strike now. Parries also refill stamina.', 4); return; }
      if (e === 'blocked' && !done.has('parry') && done.has('dodge') && seals >= 1) { show('parry', `A little early — that was a plain block. ${tap ? 'Tap' : 'Press'} Block right as the blow lands to parry.`, 3.5, 'b-blk'); return; }
    },
    tick(c: CoachCtx) {
      clock += c.dt; seals = c.seals;
      if (c.busy) { if (cur) { el.classList.remove('on'); } return; } else if (cur && !el.classList.contains('on')) el.classList.add('on');
      if (cur) { cur.t -= c.dt; if (cur.t <= 0) hide(); }
      if (queued?.wait) queued.wait = Math.max(0, queued.wait - c.dt);
      if (!cur && queued && !queued.wait) { const q = queued; queued = null; show(q.id, q.text, q.secs); }
      // movement + look
      if (!Number.isNaN(lastX)) moved += Math.hypot(c.px - lastX, c.pz - lastZ); lastX = c.px; lastZ = c.pz;
      if (!Number.isNaN(lastYaw)) { let d = c.yaw - lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); turned += Math.abs(d); } lastYaw = c.yaw;
      // combat (opening fights only: until the first seal is claimed or the tips are spent)
      const fight = c.hostile;
      if (hp0 >= 0 && c.hp < hp0 && fight) { if (!done.has('dodge') && windShown > 0) show('dodge', `Hit! When a foe glows and raises its arm, ${c.touch ? 'tap Roll' : 'press C'} to dodge. Your hearts (♥) refill after the fight.`, 4, 'b-dge', 2.5); else once('hurt', 'You were hit! Your hearts (♥) are your health — they refill, a heart at a time, once the fight is over.', 4.5); }
      hp0 = c.hp;
      if (fight && !done.has('attack')) {
        if (landed0 < 0) landed0 = c.landed; atkT += c.dt;
        if (c.landed - landed0 >= 2 || atkT > 10) { finish('attack'); if (cur?.id === 'attack') hide(); }
        else if (!c.winding && (!cur || cur.id === 'attack')) show('attack', c.touch ? 'Foes! Tap the big Attack button to strike — tap again to chain a combo.' : 'Foes! Press K (or click) to attack — again to chain a combo.', 2, 'b-atk');
      }
      if (c.winding && c.rolling) rolledIn = true;
      if (!c.winding && wasWinding) { if (rolledIn && c.hp >= hpAtWind && !done.has('dodge')) { if (cur?.id === 'dodge') hide(); finish('dodge'); once('rolled', ROLLED, 3.5); } rolledIn = false; }
      if (c.winding && !wasWinding) { hpAtWind = c.hp; rolledIn = c.rolling;
        if (!done.has('dodge')) { windShown++; show('dodge', c.touch ? '⚠ Wind-up — tap Roll!' : '⚠ Wind-up — press C to roll!', 1.6, 'b-dge', 0.4); if (windShown >= 3) finish('dodge'); }
        else if (!done.has('parry') && c.seals >= 1) { parryTries++; show('parry', c.touch ? '⚠ Wind-up — tap Block just as it strikes!' : '⚠ Wind-up — press Q just as it strikes!', 1.6, 'b-blk', 0.4); if (parryTries >= 4) finish('parry'); }
      }
      wasWinding = c.winding;
      if (fight && c.stamina < 25 && c.seals >= 1) once('stamina', `Stamina low — the bar above the buttons. Ease off rolling and blocking for a moment and it refills.`, 4.5);
      if (fight && cur && (cur.id === 'move' || cur.id === 'talk' || cur.id === 'pick' || cur.id === 'seal' || cur.id === 'claim')) hide();
      if (fight) return;
      // calm: the opening steps
      if (!c.started) {
        if (!done.has('move')) {
          if (moved > 0.5) moveT += c.dt;
          if ((moved > 6 && turned > 0.5) || moveT > 14) { finish('move'); hide(); }
          else show('move', c.touch ? 'Drag the circle at the bottom left to walk · drag anywhere else to look around.' : 'WASD or arrow keys to walk · drag the mouse to look around.', 2);
          return;
        }
        if (!done.has('talk')) show('talk', /^Talk/.test(c.near ?? '') ? (c.touch ? 'Tap the gold Talk button to speak with the Wayfinder.' : 'Press E (or tap the gold button) to speak with the Wayfinder.') : 'The Wayfinder waits by the camp — follow the arrow at the top and walk up to him.', 2);
        return;
      }
      if (c.seals <= 1 && c.pickNear && !done.has('pick') && !cur && !queued) { finish('pick'); show('pick', 'Something glints nearby — a weapon? Look for the light and walk up to it.', 6); }
    },
  };
  return api;
}
export type Coach = ReturnType<typeof makeCoach>;
