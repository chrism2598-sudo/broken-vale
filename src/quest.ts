import * as THREE from 'three';
import { SEALS, heightAt, WAYFINDER, type SealDef } from './world';
import { fill, type Profile } from './dialogue';

/** Save format (localStorage 'vale3d-save'). */
export type Save = { v: 1; started: boolean; done: boolean; xp: number; seals: Record<string, boolean>; runes: number[]; wind: boolean };
const KEY = 'vale3d-save';
export const SEAL_XP = 25, QUEST_XP = 80;
export const levelOf = (xp: number) => 1 + Math.floor(xp / 50);

export function loadSave(): Save {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return { v: 1, started: !!s.started, done: !!s.done, xp: Math.max(0, +s.xp || 0), seals: { ...s.seals }, runes: Array.isArray(s.runes) && s.runes.length === 3 ? s.runes.map((v: number) => ((v | 0) % 3 + 3) % 3) : [0, 0, 0], wind: !!s.wind }; } catch { /* corrupt → fresh */ }
  return { v: 1, started: false, done: false, xp: 0, seals: {}, runes: [0, 0, 0], wind: false };
}
export function writeSave(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* */ } }
export const sealCount = (s: Save) => SEALS.filter((d) => s.seals[d.id]).length;

/** Wayfinder lines (tokens: {name} {fullname} {child} {they}… plus {n}). Ported from the Page's quest text. */
export const WAYFINDER_LINES = {
  start: [
    '{fullname}. Enna’s {child}. The Broken Vale’s beacons have gone dark.',
    'Dawn Sigil at Pale Keep · Sun Shard at Sunspire · Tide Seal at Azure Keep · Forge Heart at Iron Dome.',
    'Return the seals to me, {name}. The Wind Shrine up the path holds an optional trial.',
  ],
  progress: [
    'You hold {n}/4 seals, {name}.',
    'Pale Keep to the north-west, Azure Keep to the north-east; the Sunspire and the Iron Dome lie south. Wade the creek where it runs shallow.',
  ],
  complete: [
    'Do you see it, {name}? The Hollow Beacon answers — all four seals burn, and the wild vale stirs once more!',
    'The Hollow Beacon on the floating isle still keeps an unspent morning. That road is for another day, {name}.',
    'You are a Vale Walker. +80 XP',
  ],
  after: [
    'The four seals already burn again.',
    'Rest a while, {name}. Your mother would have liked this light.',
  ],
};

/** A seal: carved plinth, a slowly turning glowing crystal, and (once claimed) a tall light column. */
export class SealObject {
  group = new THREE.Group();
  private crystal: THREE.Mesh; private column: THREE.Mesh; private halo: THREE.Mesh; private colMat: THREE.ShaderMaterial; private fade = 0;
  constructor(public def: SealDef, stoneMat: THREE.Material, public claimed: boolean) {
    const y = heightAt(def.x, def.z);
    this.group.position.set(def.x, y, def.z);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 1.1, 10), stoneMat); plinth.position.y = 0.55; plinth.castShadow = plinth.receiveShadow = true;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.35, 12), stoneMat); step.position.y = 0.17; step.receiveShadow = true;
    const col = new THREE.Color(def.color);
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.1 }));
    this.crystal.scale.set(0.8, 1.5, 0.8); this.crystal.position.y = 2.1;
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = 1.13;
    this.colMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uCol: { value: col } },
      vertexShader: 'varying vec2 vUv;varying float vNear;void main(){vUv=uv;vec3 c=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vNear=smoothstep(5.,26.,length(cameraPosition.xz-c.xz));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime,uFade;uniform vec3 uCol;varying vec2 vUv;varying float vNear;
        void main(){float edge=sin(vUv.x*3.14159);edge*=edge;float top=1.-smoothstep(.55,1.,vUv.y);
          float flow=.75+.25*sin(vUv.y*40.-uTime*3.+vUv.x*6.28);
          gl_FragColor=vec4((uCol*.8+vec3(.25))*edge*top*flow*uFade*.5*(.06+.94*vNear),1.);}`,
    });
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 160, 20, 1, true), this.colMat);
    this.column.position.y = 80; this.column.frustumCulled = false; this.column.renderOrder = 2;
    this.group.add(step, plinth, this.crystal, this.halo, this.column);
    if (claimed) this.fade = 1;
  }
  claim() { this.claimed = true; }
  update(t: number, dt: number) {
    if (this.claimed) this.fade = Math.min(1, this.fade + dt / 1.5);
    this.colMat.uniforms.uFade.value = this.fade; this.colMat.uniforms.uTime.value = t;
    this.column.visible = this.fade > 0.001;
    this.crystal.rotation.y = t * (this.claimed ? 1.6 : 0.7);
    this.crystal.position.y = 2.1 + Math.sin(t * 1.7) * 0.12 + this.fade * 0.6;
    (this.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(t * 2.2) + this.fade * 0.3;
  }
}

/** Compass hint: next target + bearing relative to the camera's forward direction. */
export function nextTarget(s: Save): { name: string; x: number; z: number } {
  if (!s.started || sealCount(s) === 4) return { name: 'Wayfinder', x: WAYFINDER.x, z: WAYFINDER.z };
  return SEALS.filter((d) => !s.seals[d.id]).map((d) => ({ name: `${d.name} · ${d.at}`, x: d.x, z: d.z }))[0];
}

export function fillLines(lines: string[], p: Profile, extra: Record<string, string | number> = {}): string[] {
  return lines.map((l) => fill(l.replace(/\{(\w+)\}/g, (m, k: string) => (k in extra ? String(extra[k]) : m)), p));
}

/** Chapter card copy (teaser drawn from the Page's Hollow Beacon ending). */
export const CHAPTER_TEASER = 'Above the vale the Hollow Beacon has woken, keeping an unspent morning. Far beyond the root-hung islands, a second seam answers — not in the sky, but beneath the sea.';
