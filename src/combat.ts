import * as THREE from 'three';

/** M19 · Combat: weapons, a light combo, a charged heavy, block/parry, dodge-roll, stamina and hit stop.
 *  Pure gameplay state — main.ts decides what a strike touches and feeds incoming hits through `incoming()`. */
export type WeaponId = 'rusty' | 'spear' | 'maul' | 'tide' | 'knight' | 'halberd';
export type Weapon = {
  id: WeaponId; name: string; short: string; icon: string; desc: string; where: string;
  dmg: number; heavy: number; reach: number; swing: number; combo: number; stagger: number; keeperMul: number; heavyCost: number;
  style: 0 | 1 | 2; heavyMove: 'cleave' | 'lunge' | 'slam' | 'wave';
};
export const WEAPON_ORDER: WeaponId[] = ['rusty', 'spear', 'maul', 'tide', 'knight', 'halberd'];
export const WEAPONS: Record<WeaponId, Weapon> = {
  rusty: { id: 'rusty', name: 'Rusty Sword', short: 'Sword', icon: '🗡', where: 'Enna’s old blade, from the start',
    desc: 'Quick three-cut combo · heavy is a wide cleave.', dmg: 1, heavy: 2.2, reach: 1, swing: 0.36, combo: 3, stagger: 0, keeperMul: 1, heavyCost: 30, style: 0, heavyMove: 'cleave' },
  spear: { id: 'spear', name: 'Ashwood Spear', short: 'Spear', icon: '🔱', where: 'Wedged in the rocks below the Veilfall',
    desc: 'Long reach, two thrusts · heavy is a running lunge.', dmg: 1, heavy: 2.2, reach: 1.45, swing: 0.42, combo: 2, stagger: 0.2, keeperMul: 1, heavyCost: 28, style: 1, heavyMove: 'lunge' },
  maul: { id: 'maul', name: 'Smith’s Maul', short: 'Maul', icon: '🔨', where: 'By the forge door of the Iron Dome',
    desc: 'Slow and brutal · every hit staggers · heavy is a ground slam.', dmg: 2, heavy: 4, reach: 0.95, swing: 0.72, combo: 2, stagger: 1.1, keeperMul: 1, heavyCost: 40, style: 2, heavyMove: 'slam' },
  tide: { id: 'tide', name: 'Tide-blade', short: 'Tide', icon: '🌊', where: 'In a side pool of the Listening Pools',
    desc: 'Sea-glass edge · bites the Keeper (×1.5) · heavy throws a wave.', dmg: 1.5, heavy: 3, reach: 1.15, swing: 0.34, combo: 3, stagger: 0.3, keeperMul: 1.5, heavyCost: 30, style: 0, heavyMove: 'wave' },
  knight: { id: 'knight', name: 'Knight’s Longsword', short: 'Long', icon: '⚔', where: 'Sealed behind the hearth of Pale Keep',
    desc: 'Bright steel, three long cuts · heavy is a sweeping cleave.', dmg: 1.4, heavy: 3, reach: 1.15, swing: 0.4, combo: 3, stagger: 0.25, keeperMul: 1, heavyCost: 30, style: 0, heavyMove: 'cleave' },
  halberd: { id: 'halberd', name: 'Azure Halberd', short: 'Halb', icon: '🪓', where: 'Hidden in the solar of Azure Keep',
    desc: 'Longest reach · every hit staggers · heavy is a driving lunge.', dmg: 1.3, heavy: 3.2, reach: 1.55, swing: 0.5, combo: 2, stagger: 0.9, keeperMul: 1, heavyCost: 34, style: 1, heavyMove: 'lunge' },
};
export const isWeapon = (s: unknown): s is WeaponId => typeof s === 'string' && s in WEAPONS;

export const JUMP_COST = 9;
export const ST_MAX = 100, DODGE_COST = 22, BLOCK_HIT_COST = 24, BLOCK_DRAIN = 5, PARRY_WIN = 0.24, DODGE_T = 0.42, DODGE_IFR = 0.34, DODGE_SPEED = 8.6;
export type Strike = { dmg: number; reach: number; heavy: boolean; stagger: number; keeperMul: number; finisher: boolean; move: Weapon['heavyMove'] | 'light' };
export type Incoming = 'hit' | 'blocked' | 'parried' | 'dodged' | 'guardbreak';
type Act = { kind: 'light' | 'heavy' | 'dodge'; t: number; dur: number; hitAt: number; hit: boolean; step: number; power: number };

export class Combat {
  weapon: Weapon = WEAPONS.rusty;
  stamina = ST_MAX; private regenWait = 0;
  act: Act | null = null; private combo = 0; private comboWin = 0; private queued = false;
  charge = -1; blocking = false; blockT = 0; iframes = 0; hitStop = 0; flash = 0; lastFail = 0;
  dodgeDir = 0; counts = { light: 0, heavy: 0, dodge: 0, block: 0, parry: 0, landed: 0, jump: 0 };
  get busy() { return !!this.act || this.charge >= 0; }
  get rolling() { return this.act?.kind === 'dodge'; }
  /** Swing pose progress 0..1 (0 = none) for the procedural overlay; charge holds the wind-up. */
  get swing() { if (this.charge >= 0) return 0.08 + 0.22 * Math.min(1, this.charge / 0.8); const a = this.act; if (!a || a.kind === 'dodge') return 0; return Math.min(0.999, a.t / a.dur); }
  get chargeK() { return this.charge < 0 ? 0 : Math.min(1, this.charge / 0.8); }
  /** Movement multiplier while acting. */
  get moveMul() { const a = this.act; if (a?.kind === 'dodge') return 0; if (a) return a.kind === 'heavy' && this.weapon.heavyMove === 'lunge' ? 0 : 0.18; if (this.charge >= 0) return 0.25; if (this.blocking) return 0.35; return 1; }
  private spend(n: number) { this.stamina = Math.max(0, this.stamina - n); this.regenWait = 0.7; }
  /** Light attack (tap). Buffered if pressed during a swing. Returns false if nothing started. */
  attack(): boolean {
    if (this.act?.kind === 'dodge' || this.charge >= 0) return false;
    if (this.act) { if (this.act.kind === 'light' && this.act.t > this.act.dur * 0.35) this.queued = true; return false; }
    this.blocking = false; this.startLight(); return true;
  }
  private startLight() {
    const w = this.weapon, step = this.comboWin > 0 ? (this.combo % w.combo) : 0, fin = step === w.combo - 1;
    const dur = w.swing * (fin ? 1.25 : 1); this.combo = step + 1; this.comboWin = 0;
    this.act = { kind: 'light', t: 0, dur, hitAt: dur * 0.42, hit: false, step, power: fin ? 1.5 : 1 }; this.counts.light++;
  }
  /** Heavy: hold to charge, release to swing. */
  heavyDown() { if (this.act || this.charge >= 0) return false; if (this.stamina < 12) { this.lastFail = 1; return false; } this.blocking = false; this.charge = 0; return true; }
  heavyUp(): boolean {
    if (this.charge < 0) return false; const k = this.chargeK, w = this.weapon; this.charge = -1;
    const cost = w.heavyCost * (0.6 + 0.4 * k), short = this.stamina < cost, power = (0.55 + 0.45 * k) * (short ? 0.6 : 1);
    this.spend(cost); const dur = w.swing * 1.5 + 0.08; this.act = { kind: 'heavy', t: 0, dur, hitAt: dur * 0.45, hit: false, step: 0, power }; this.combo = 0; this.comboWin = 0; this.counts.heavy++; return true;
  }
  setBlock(on: boolean) { if (on && !this.blocking) { if (this.act?.kind === 'dodge') return; this.blocking = true; this.blockT = 0; this.counts.block++; } else if (!on) this.blocking = false; }
  /** M20b · a short hop: costs a little stamina, cancels a guard; not during a roll or a swing. */
  jump(): boolean {
    if (this.act || this.blocking) return false; if (this.stamina < JUMP_COST) { this.lastFail = 1; return false; }
    this.spend(JUMP_COST); this.blocking = false; this.charge = -1; this.counts.jump++; return true;
  }
  /** Dodge-roll toward `dir` (world yaw). */
  dodge(dir: number): boolean {
    if (this.act?.kind === 'dodge') return false; if (this.stamina < DODGE_COST * 0.5) { this.lastFail = 1; return false; }
    this.spend(DODGE_COST); this.charge = -1; this.blocking = false; this.queued = false; this.combo = 0; this.dodgeDir = dir;
    this.act = { kind: 'dodge', t: 0, dur: DODGE_T, hitAt: 99, hit: true, step: 0, power: 0 }; this.iframes = DODGE_IFR; this.counts.dodge++; return true;
  }
  /** An enemy blow reaches the player. Sweeps (the tide) can't be blocked or rolled through. */
  incoming(unblockable = false): Incoming {
    if (!unblockable && this.iframes > 0) return 'dodged';
    if (!unblockable && this.blocking) {
      if (this.blockT < PARRY_WIN) { this.counts.parry++; this.stamina = Math.min(ST_MAX, this.stamina + 10); this.hitStop = 0.12; this.flash = 1; return 'parried'; }
      if (this.stamina >= BLOCK_HIT_COST * 0.5) { this.spend(BLOCK_HIT_COST); this.hitStop = 0.06; return 'blocked'; }
      this.stamina = 0; this.regenWait = 1.2; this.blocking = false; return 'guardbreak';
    }
    this.act = null; this.charge = -1; this.queued = false; return 'hit';
  }
  /** One fixed tick. Returns a strike at the moment of contact. */
  tick(dt: number): Strike | null {
    this.flash = Math.max(0, this.flash - dt * 3); this.lastFail = Math.max(0, this.lastFail - dt * 2);
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); return null; }
    this.iframes = Math.max(0, this.iframes - dt); if (this.comboWin > 0) this.comboWin -= dt;
    if (this.blocking) { this.blockT += dt; this.stamina = Math.max(0, this.stamina - BLOCK_DRAIN * dt); this.regenWait = Math.max(this.regenWait, 0.3); }
    if (this.charge >= 0) this.charge += dt;
    else if (!this.act && !this.blocking) { if (this.regenWait > 0) this.regenWait -= dt; else this.stamina = Math.min(ST_MAX, this.stamina + 34 * dt); }
    const a = this.act; if (!a) return null;
    a.t += dt; let out: Strike | null = null; const w = this.weapon;
    if (!a.hit && a.t >= a.hitAt) {
      a.hit = true; const heavy = a.kind === 'heavy', fin = !heavy && a.power > 1;
      out = { dmg: (heavy ? w.heavy : w.dmg) * a.power, reach: w.reach * (heavy && (w.heavyMove === 'wave' || w.heavyMove === 'lunge') ? 1.35 : heavy && w.heavyMove === 'slam' ? 1.2 : 1), heavy,
        stagger: w.stagger + (heavy ? 0.8 : fin ? 0.3 : 0), keeperMul: w.keeperMul, finisher: fin, move: heavy ? w.heavyMove : 'light' };
    }
    if (a.t >= a.dur) {
      this.act = null;
      if (a.kind === 'light') { this.comboWin = 0.45; if (this.combo >= w.combo) { this.combo = 0; this.comboWin = 0; } if (this.queued) { this.queued = false; this.startLight(); } }
    }
    return out;
  }
  /** Enemy took a blow: freeze frames scale with the blow. */
  landed(s: Strike) { this.hitStop = s.heavy ? 0.13 : s.finisher ? 0.09 : 0.06; this.counts.landed++; }
  reset() { this.act = null; this.charge = -1; this.blocking = false; this.queued = false; this.combo = 0; this.comboWin = 0; this.iframes = 0; this.hitStop = 0; this.stamina = ST_MAX; }
}

// ---------- weapon models (1 unit = 1 m, grip at the origin, blade/haft toward −Y like the rig's original sword) ----------
const M = (color: string, metal: number, rough: number, emissive?: string, ei = 0) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...(emissive ? { emissive, emissiveIntensity: ei } : {}) });
function blade(len: number, w: number, th: number, mat: THREE.Material, curve = 0) {
  // Tapered blade with a ridge: a flat diamond-section prism from the guard down to the tip.
  const g = new THREE.BufferGeometry(), seg = 6, P: number[] = [], I: number[] = [];
  for (let i = 0; i <= seg; i++) { const v = i / seg, y = -v * len, hw = w * (v < 0.82 ? 1 - v * 0.18 : (1 - v) / 0.18 * 0.82), cx = curve * Math.sin(v * Math.PI * 0.8) * 0.06;
    P.push(cx - hw, y, 0, cx, y, th, cx + hw, y, 0, cx, y, -th); }
  for (let i = 0; i < seg; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4; I.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return new THREE.Mesh(g, mat);
}
export function makeWeaponModel(id: WeaponId): THREE.Group {
  const g = new THREE.Group(); g.name = 'weapon-' + id;
  const leather = M('#3a2416', 0, 0.85), wood = M('#7a5634', 0, 0.7), iron = M('#8d8f90', 0.85, 0.42);
  const add = (m: THREE.Mesh, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (id === 'rusty') {
    const rust = M('#a89482', 0.6, 0.55);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.17, 8), leather), 0, 0.02, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), rust), 0, 0.12, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), rust), 0, -0.075, 0);
    add(blade(0.74, 0.03, 0.008, rust), 0, -0.09, 0);
  } else if (id === 'spear') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 1.95, 8), wood), 0, -0.35, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 8), iron), 0, -1.3, 0);
    add(blade(0.3, 0.045, 0.012, iron), 0, -1.32, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.12, 8), leather), 0, 0.02, 0);
    { const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), iron), 0, 0.66, 0); t.rotation.x = 0; }
  } else if (id === 'maul') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.95, 8), wood), 0, -0.36, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), leather), 0, 0.02, 0);
    const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.34), M('#5d5f61', 0.8, 0.5)), 0, -0.86, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.36), iron), 0, -0.79, 0); add(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.36), iron), 0, -0.93, 0); void head;
  } else if (id === 'knight') {
    const steel = M('#d6d9dc', 0.9, 0.28), gold = M('#c9a24a', 0.8, 0.35);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 8), leather), 0, 0.04, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), gold), 0, 0.17, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.045), gold), 0, -0.08, 0);
    add(blade(0.98, 0.034, 0.009, steel), 0, -0.095, 0);
  } else if (id === 'halberd') {
    const steel = M('#b9c8d6', 0.9, 0.3), az = M('#2f5f9a', 0.3, 0.5);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.021, 2.0, 8), M('#4a3524', 0, 0.7)), 0, -0.4, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), az), 0, 0.02, 0);
    { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.24, 0.02, 0.27, 0.16); sh.lineTo(0.27, -0.2); sh.quadraticCurveTo(0.2, -0.08, 0, -0.1); sh.lineTo(0, 0);
      const ax = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); ax.translate(0.015, 0, -0.006); add(new THREE.Mesh(ax, steel), 0, -1.22, 0); }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.12, 4), steel), -0.05, -1.2, 0).rotation.z = -Math.PI / 2;
    add(blade(0.28, 0.035, 0.01, steel), 0, -1.38, 0);
  } else {
    const glass = M('#6fd6cc', 0.25, 0.18, '#1d7a72', 0.55), bone = M('#d9cdb4', 0, 0.6);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.17, 8), M('#1f4f52', 0.1, 0.7)), 0, 0.02, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), bone), 0, -0.08, 0).rotation.y = Math.PI / 2;
    add(blade(0.8, 0.034, 0.009, glass, 1), 0, -0.1, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), glass), 0, 0.12, 0);
  }
  return g;
}

/** Glinting ground pickup: the weapon laid on a mossy stone with a pulsing star glint and a soft light shaft. */
export function makePickup(id: WeaponId) {
  const g = new THREE.Group(); const w = makeWeaponModel(id); w.rotation.set(Math.PI / 2, 0, 0.6); w.position.y = 0.16; g.add(w);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.14, 9), new THREE.MeshStandardMaterial({ color: '#7d7a6e', roughness: 0.95 })); stone.position.y = 0.05; stone.receiveShadow = true; g.add(stone);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.18, 'rgba(255,236,170,.75)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,250,230,.95)'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.moveTo(2, 32); x.lineTo(62, 32); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); glint.scale.setScalar(0.7); glint.position.set(0.15, 0.32, 0); g.add(glint);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  shaft.position.y = 1.6; g.add(shaft);
  return {
    group: g, id,
    update(t: number) { const p = 0.5 + 0.5 * Math.sin(t * 3.1 + id.length); glint.scale.setScalar(0.35 + 0.55 * p * p); (glint.material as THREE.SpriteMaterial).rotation = t * 0.6; (shaft.material as THREE.MeshBasicMaterial).opacity = 0.07 + 0.07 * p; w.position.y = 0.16 + 0.02 * Math.sin(t * 1.7); },
    set taken(v: boolean) { g.visible = !v; },
  };
}
export type Pickup = ReturnType<typeof makePickup>;

/** Attach a weapon holder to a hero rig, matching the rig's original sword socket (child of Middle1.R). */
const SOCKET_Q = new THREE.Quaternion(0.000648100627586246, -1.27118431336726e-8, -0.712019681930542, 0.70215916633606);
const SOCKET_P = new THREE.Vector3(-0.00000420987589677679, 0.000910800823476166, -0.000251135061262175);
export function makeHolder(root: THREE.Object3D) {
  const bone = root.getObjectByName('Middle1.R') ?? root.getObjectByName('Middle1R') ?? root.getObjectByName('Wrist.R') ?? root;
  const holder = new THREE.Group(); holder.name = 'weapon-holder'; holder.position.copy(SOCKET_P); holder.quaternion.copy(SOCKET_Q); bone.add(holder);
  const models = new Map<WeaponId, THREE.Group>(); let cur: WeaponId | null = null;
  const v = new THREE.Vector3();
  return {
    holder,
    set(id: WeaponId) {
      if (cur === id) return; cur = id;
      for (const m of models.values()) m.visible = false;
      let m = models.get(id); if (!m) { m = makeWeaponModel(id); models.set(id, m); holder.add(m); }
      m.visible = true;
      // 1 unit = 1 m regardless of the armature's ×100 / character scale.
      root.updateMatrixWorld(true); holder.scale.set(1, 1, 1); holder.updateMatrixWorld(true); holder.getWorldScale(v); const s = root.parent ? 1 : 1; holder.scale.setScalar(s / Math.max(1e-6, v.x));
    },
    get id() { return cur; },
  };
}
