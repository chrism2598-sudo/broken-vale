/**
 * M54 · save store: verified backups, recovery, storage-failure handling, unknown-field preservation, rollback safety.
 *
 * Keys (all localStorage, same origin):
 *   vale3d-save            PRIMARY. Always the exact v1 shape that release-M52 (and M49) read and rewrite. Known fields only.
 *   vale3d-save-bak        last known-good primary (only ever replaced by a save that parsed + validated).
 *   vale3d-save-tmp        write-ahead copy: written + read back + validated before the primary is replaced.
 *   vale3d-save-ext        {schema:2, unknown:{…}}: fields this build does not know (from newer builds). M52 never touches it.
 *   vale3d-save-quarantine raw text of a primary that could not be read (kept, never parsed again automatically).
 *   vale3d-save-newer      a newer-version save moved aside only if the player explicitly starts a new game.
 * Rollback rule (M54 → M52 → M54): the primary stays v1, so M52 loads it and keeps writing it; M54 then treats the primary
 * as authoritative for every known field and only merges the unknown fields back from -ext. Nothing in -ext can override progress.
 */
export const SAVE_KEY = 'vale3d-save', BAK_KEY = 'vale3d-save-bak', TMP_KEY = 'vale3d-save-tmp', EXT_KEY = 'vale3d-save-ext', QUAR_KEY = 'vale3d-save-quarantine', NEWER_KEY = 'vale3d-save-newer';
export const SAVE_V = 1, EXT_SCHEMA = 2;
/** Every field of the v1 Save type (quest.ts). Anything else in a save is "unknown" and is preserved in -ext. */
export const KNOWN_FIELDS = new Set(['v', 'started', 'done', 'xp', 'seals', 'runes', 'wind', 'warden', 'mirrors', 'beacon', 'echo', 'charted', 'cave', 'coast', 'sea', 'lamp',
  'weapons', 'weapon', 'fog', 'chests', 'lore', 'foes', 'secrets', 'views', 'stashes', 'whet', 'tod', 'day', 'rk', 'sq', 'found', 'hpUp', 'fogV', 'gone', 'ressStair', 'kit']);
type Raw = Record<string, unknown>;
const st = {
  available: true, readOnly: '' as '' | 'unavailable' | 'newer' | 'perf', extReadOnly: false, source: 'fresh' as 'primary' | 'tmp' | 'backup' | 'fresh',
  unknown: {} as Raw, notices: [] as string[], warnFn: null as ((m: string) => void) | null, failures: 0, writes: 0, quarantined: false,
};

// ---------- storage access that never throws ----------
function store(): Storage | null { try { const s = window.localStorage; return s ?? null; } catch { return null; } }
export function lsGet(k: string): string | null { try { return store()?.getItem(k) ?? null; } catch { return null; } }
export function lsSet(k: string, v: string): boolean { try { const s = store(); if (!s) return false; s.setItem(k, v); return true; } catch { return false; } }
export function lsDel(k: string): void { try { store()?.removeItem(k); } catch { /* */ } }

function warn(msg: string) { st.notices.push(msg); try { console.warn('[save] ' + msg); } catch { /* */ } if (st.warnFn) st.warnFn(msg); }
/** The UI registers its toast here; anything raised before the UI existed is shown once, combined. */
export function onSaveWarning(fn: (m: string) => void) { st.warnFn = fn; if (st.notices.length) fn(st.notices.join(' ')); }
export function saveStatus() { return { available: st.available, readOnly: st.readOnly, source: st.source, extReadOnly: st.extReadOnly, unknownKeys: Object.keys(st.unknown), notices: [...st.notices], failures: st.failures, writes: st.writes, quarantined: st.quarantined }; }
/** A measurement session (?perfrun=…) must never write the player's save. */
export function setSaveReadOnly(why: 'perf') { st.readOnly = why; }

type Parsed = { ok: true; s: Raw } | { ok: false; why: 'absent' | 'json' | 'shape' | 'newer'; v?: number };
/** Valid = parses, is a plain object, and is save version 1. (Field types are repaired by the loader in quest.ts.) */
export function parseSave(str: string | null): Parsed {
  if (str === null) return { ok: false, why: 'absent' };
  let s: unknown; try { s = JSON.parse(str); } catch { return { ok: false, why: 'json' }; }
  if (!s || typeof s !== 'object' || Array.isArray(s)) return { ok: false, why: 'shape' };
  const v = (s as Raw).v;
  if (typeof v === 'number' && isFinite(v) && v > SAVE_V) return { ok: false, why: 'newer', v };
  if (v !== SAVE_V) return { ok: false, why: 'shape' };
  return { ok: true, s: s as Raw };
}
const isPlain = (o: unknown): o is Raw => !!o && typeof o === 'object' && !Array.isArray(o);
function splitUnknown(s: Raw): Raw { const u: Raw = {}; for (const [k, v] of Object.entries(s)) if (!KNOWN_FIELDS.has(k)) u[k] = v; return u; }
function capUnknown(u: Raw): Raw { const out: Raw = {}; let n = 0; for (const [k, v] of Object.entries(u)) { if (n >= 64) break; const j = JSON.stringify(v); if (j === undefined || j.length > 16384) continue; out[k] = v; n++; } return out; }

function loadExt() {
  const raw = lsGet(EXT_KEY); if (raw === null) return;
  let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
  if (!isPlain(e) || typeof e.schema !== 'number') { lsSet(QUAR_KEY + '-ext', raw); st.extReadOnly = false; return; } // unreadable ext: kept aside, then rebuilt
  if (e.schema > EXT_SCHEMA) { st.extReadOnly = true; return; } // a newer build's metadata: leave it exactly as it is
  if (isPlain(e.unknown)) st.unknown = { ...e.unknown };
}
function quarantine(raw: string | null) { if (raw === null) return; if (lsGet(QUAR_KEY) !== raw) lsSet(QUAR_KEY, raw); st.quarantined = true; }
function absorb(s: Raw, src: typeof st.source): Raw { st.source = src; st.unknown = capUnknown({ ...st.unknown, ...splitUnknown(s) }); return s; }

/**
 * Read the save for this session. With effects (the one real load at startup): recovery, quarantine and warnings.
 * Without effects (e.g. "is there progress?" checks): the same choice of source, but nothing is written or announced.
 */
export function readRawSave(effects = true): Raw | null {
  if (!store()) { if (effects) { st.available = false; if (st.readOnly !== 'perf') st.readOnly = 'unavailable'; warn('Saving is unavailable in this browser (private mode or storage blocked): progress will not be kept.'); } return null; }
  const pRaw = lsGet(SAVE_KEY), p = parseSave(pRaw);
  if (effects) loadExt();
  if (p.ok) { if (effects) lsDel(TMP_KEY); return effects ? absorb(p.s, 'primary') : p.s; }
  if (p.why === 'newer') {
    if (effects) { if (st.readOnly !== 'perf') st.readOnly = 'newer'; warn(`This save was made by a newer version of the game (save v${p.v}). It has been left untouched; progress in this session will not be saved.`); }
    return null;
  }
  const t = parseSave(lsGet(TMP_KEY));
  if (p.why === 'absent') { // no save (new player, or after New Game); a valid write-ahead copy means the very first write was interrupted
    if (t.ok) { if (effects) warn('Your last save was interrupted; restored it.'); return effects ? absorb(t.s, 'tmp') : t.s; }
    return null;
  }
  // a primary exists but cannot be read: keep its raw text, then fall back to the newest complete copy
  if (effects) quarantine(pRaw);
  if (t.ok) { if (effects) warn('Your last save was damaged; restored the most recent complete save.'); return effects ? absorb(t.s, 'tmp') : t.s; }
  const b = parseSave(lsGet(BAK_KEY));
  if (b.ok) { if (effects) warn('Your last save was damaged; restored it from the backup.'); return effects ? absorb(b.s, 'backup') : b.s; }
  if (effects) warn('Your save could not be read and no valid backup was found, so a new game was started. The damaged save has been kept aside.');
  return null;
}

/** Write the (v1, known-fields-only) save: validate → write-ahead → read back → back up the previous good save → replace → read back. */
export function writeRawSave(obj: Raw): boolean {
  if (st.readOnly) return false;
  const s = store(); if (!s) return false;
  const known: Raw = {}; for (const [k, v] of Object.entries(obj)) if (KNOWN_FIELDS.has(k)) known[k] = v;
  let str = '';
  try {
    str = JSON.stringify(known);
    if (!parseSave(str).ok) throw new Error('refusing to write an invalid save');
    s.setItem(TMP_KEY, str); if (s.getItem(TMP_KEY) !== str) throw new Error('write-ahead read-back mismatch');
    const cur = s.getItem(SAVE_KEY);
    if (cur !== null && cur !== str && parseSave(cur).ok) s.setItem(BAK_KEY, cur); // the backup only ever receives a validated save
    s.setItem(SAVE_KEY, str); if (s.getItem(SAVE_KEY) !== str) throw new Error('read-back mismatch');
    s.removeItem(TMP_KEY);
    writeExt(s);
    st.writes++; if (st.failures) { st.failures = 0; } return true;
  } catch {
    st.failures++; if (st.failures === 1 || st.failures % 25 === 0) warn('Progress could not be saved (storage full or blocked). Your previous save is unchanged.');
    try { if (s.getItem(TMP_KEY) === str) s.removeItem(TMP_KEY); } catch { /* */ }
    return false;
  }
}
function writeExt(s: Storage) {
  if (st.extReadOnly) return;
  const has = Object.keys(st.unknown).length > 0, cur = s.getItem(EXT_KEY);
  if (!has && cur === null) return;
  const str = JSON.stringify({ schema: EXT_SCHEMA, unknown: st.unknown });
  if (cur !== str) s.setItem(EXT_KEY, str);
}
/** New Game: the player chose to erase. A newer-version save is moved aside (never destroyed); the backup goes with the old game. */
export function clearRawSave() {
  if (st.readOnly === 'newer') { const raw = lsGet(SAVE_KEY); if (raw !== null && (!lsSet(NEWER_KEY, raw) || lsGet(NEWER_KEY) !== raw)) { warn('The newer-version save could not be moved aside, so it was kept and nothing was erased.'); return; } st.readOnly = ''; }
  for (const k of [SAVE_KEY, TMP_KEY, BAK_KEY]) lsDel(k);
  if (!st.extReadOnly) lsDel(EXT_KEY);
  st.unknown = {};
}
