import * as THREE from 'three';
import { SHRINE, heightAt } from './world';
import { addRimFill } from './shading';
import { triplanar } from './landmarks';
import type { GroundTex } from './terrain';

/** Wind Shrine puzzle (ported from the Page): 0 Still ○ · 1 Rise ▲ · 2 Gale ✕ — West Rise, North Still, East Gale. */
export const RUNE_SOLVE = [1, 0, 2] as const;
export const RUNE_LABELS = ['Still', 'Rise', 'Gale'] as const;
export const RUNE_GLYPHS = ['○', '▲', '✕'] as const;
export const SHRINE_XP = 35, WIND_BLESS = 1.15;
// Page offsets (map units × 0.36, tightened ×0.8 so the west rune clears the creek).
export const RUNES = [
  { id: 'west', name: 'West Rune', x: SHRINE.x - 10.6, z: SHRINE.z },
  { id: 'north', name: 'North Rune', x: SHRINE.x, z: SHRINE.z - 15.3 },
  { id: 'east', name: 'East Rune', x: SHRINE.x + 10.6, z: SHRINE.z },
];
export const TABLET = { x: SHRINE.x + 0.8, z: SHRINE.z + 8.6 };
export const TABLET_LINES = [
  'Wind Tablet (carved):',
  'West must Rise ▲ · North stays Still ○ · East calls the Gale ✕',
  'Cycle each mossy stone with Action until the shrine wakes.',
];
export const SOLVED_LINES = [
  'The three runes lock — warm light crowns the Wind Shrine.',
  'Windward Blessing: your steps quicken (~15% walk speed).',
  '+35 XP (one-time). Seals quest unchanged.',
];
export const runesMatch = (r: number[]) => r[0] === RUNE_SOLVE[0] && r[1] === RUNE_SOLVE[1] && r[2] === RUNE_SOLVE[2];

function glyphTex(glyph: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round';
  if (glyph === '○') { x.beginPath(); x.arc(64, 64, 34, 0, Math.PI * 2); x.stroke(); }
  else if (glyph === '▲') { x.beginPath(); x.moveTo(64, 26); x.lineTo(102, 96); x.lineTo(26, 96); x.closePath(); x.stroke(); }
  else { x.beginPath(); x.moveTo(32, 32); x.lineTo(96, 96); x.moveTo(96, 32); x.lineTo(32, 96); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Orrery-style Wind Shrine: warm-stone drum on flared pillars, gilded dome, three armillary rings that wake and spin. */
export function makeWindShrine(rock: GroundTex, state: { runes: number[]; solved: boolean }) {
  const stone = new THREE.MeshStandardMaterial({ map: rock.diff, normalMap: rock.nor, roughnessMap: rock.arm, color: '#e8d6b2', roughness: 1 });
  addRimFill(stone, { fill: 0.25, rim: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 0.85, roughness: 0.32 }); addRimFill(gold, { fill: 0.15, rim: 0.35, rimColor: '#ffe3a0' });
  const g = new THREE.Group(); const y0 = heightAt(SHRINE.x, SHRINE.z) - 0.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 0.8, 40), stone); base.position.y = 0.4; g.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.35, 40), stone); step.position.y = 0.1; g.add(step);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 6.2, 16), stone); p.position.set(Math.cos(a) * 3.2, 3.8, Math.sin(a) * 3.2); p.rotation.z = Math.cos(a) * 0.12; p.rotation.x = -Math.sin(a) * 0.12; g.add(p); }
  const drumPts = [[2.6, 0], [3.0, 0.4], [3.0, 0.8], [2.5, 1.1], [2.35, 3.0], [2.9, 3.3], [2.9, 3.8], [2.4, 4.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const drum = new THREE.Mesh(new THREE.LatheGeometry(drumPts, 40), stone); drum.position.y = 6.6; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.y = 10.6; g.add(dome);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.8, 12), gold); fin.position.y = 13.7; g.add(fin);
  // Orrery: a heart-stone hovering under the drum, ringed by three gilded armillary hoops (tilted, nested).
  const coreMat = new THREE.MeshStandardMaterial({ color: '#9fb7c0', emissive: '#ffd27a', emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.2 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), coreMat); core.position.y = 3.6; g.add(core);
  const orrery = new THREE.Group(); orrery.position.y = 3.6; g.add(orrery);
  const rings: THREE.Mesh[] = [];
  [[2.0, 0.5, 0.2], [1.6, -0.6, 0.9], [1.25, 1.2, -0.4]].forEach(([r, tx, tz], i) => {
    const pivot = new THREE.Group(); pivot.rotation.set(tx, 0, tz); orrery.add(pivot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 56), gold); pivot.add(ring); rings.push(ring);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe7a8', toneMapped: false })); bead.position.x = r; ring.add(bead); bead.visible = false; ring.userData.bead = bead; void i;
  });
  // Wind ribbons: two translucent spiral sheets that fade in when awake.
  const windMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uFade;varying vec2 vUv;
      void main(){float s=smoothstep(.0,.25,vUv.y)*smoothstep(1.,.6,vUv.y);float band=smoothstep(.0,.5,vUv.x)*smoothstep(1.,.5,vUv.x);
        float flow=.5+.5*sin(vUv.y*18.-uTime*5.);gl_FragColor=vec4(mix(vec3(.55,.9,.95),vec3(1.,.78,.35),vUv.y),band*s*(.35+.65*flow)*.85*uFade);}`,
  });
  const ribbons: THREE.Mesh[] = [];
  for (let k = 0; k < 2; k++) {
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = u * Math.PI * 4 + k * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * (5.2 - u * 1.6), 0.6 + u * 12, Math.sin(a) * (5.2 - u * 1.6))); }
    const curve = new THREE.CatmullRomCurve3(pts); const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= 80; i++) { const u = i / 80, p = curve.getPoint(u); for (const s of [-1, 1]) { pos.push(p.x, p.y + s * 0.38, p.z); uv.push((s + 1) / 2, u); } if (i < 80) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, windMat); m.visible = false; m.renderOrder = 2; m.layers.set(1); /* layer 1: kept out of the AO normal pass (else it darkens) */ g.add(m); ribbons.push(m);
  }
  const light = new THREE.PointLight('#ffd27a', 0, 26, 2); light.position.y = 4; g.add(light);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material instanceof THREE.ShaderMaterial) && !(m.material instanceof THREE.MeshBasicMaterial)) { m.castShadow = m.receiveShadow = true; } });
  g.position.set(SHRINE.x, y0, SHRINE.z);

  // Clue tablet: a tilted carved slab on a plinth.
  const tablet = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.2), stone); tb.position.y = 0.3;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 0.22), new THREE.MeshStandardMaterial({ color: '#cfc4a8', roughness: 0.9 })); slab.position.set(0, 1.15, 0); slab.rotation.x = -0.35;
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 86; const x = c.getContext('2d')!; x.fillStyle = '#cfc4a8'; x.fillRect(0, 0, 256, 86); x.fillStyle = '#5a4a36'; x.font = 'bold 44px serif'; x.textAlign = 'center'; x.fillText('▲  ○  ✕', 128, 60); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
  carve.position.set(0, 1.2, 0.12); carve.rotation.x = -0.35; slab.castShadow = tb.castShadow = true;
  tablet.add(tb, slab, carve); tablet.position.set(TABLET.x, heightAt(TABLET.x, TABLET.z) - 0.05, TABLET.z);

  // Runes: mossy standing stones with a glowing glyph plate that cycles ○ ▲ ✕.
  const texes = RUNE_GLYPHS.map(glyphTex);
  const moss = triplanar(rock, 1.4, '#aab48e', { sat: 0.55, gain: 1.35 }); // M22: world-space rock (was one stretched UV wrap = flat olive boxes)
  const runeObjs = RUNES.map((r, i) => {
    const o = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.55, 0.85, 2.6, 9, 6); const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setX(k, p.getX(k) * (1 + 0.08 * Math.sin(k * 1.7))); p.setZ(k, p.getZ(k) * (0.75 + 0.06 * Math.cos(k * 2.3))); if (y > 1.2) p.setY(k, y + 0.15 * Math.sin(k)); }
    geo.computeVertexNormals();
    const st = new THREE.Mesh(geo, moss); st.position.y = 1.2; st.castShadow = true;
    const plateMat = new THREE.MeshStandardMaterial({ color: '#4a4236', emissive: '#ffe082', emissiveMap: texes[state.runes[i] | 0], emissiveIntensity: 0.8, roughness: 0.8 });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), plateMat); plate.position.set(0, 1.55, 0.66);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 6, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, opacity: 0.0, toneMapped: false })); ring.position.y = 0.08;
    o.add(st, plate, ring);
    o.position.set(r.x, heightAt(r.x, r.z) - 0.1, r.z);
    // Plates face south, toward the path the player arrives on.
    return { o, plateMat, ring, shake: 0, pulse: 0 };
  });

  let fade = state.solved ? 1 : 0, solved = state.solved, wrong = 0;
  function setRune(i: number, v: number, isWrong: boolean) {
    const r = runeObjs[i]; r.plateMat.emissiveMap = texes[v]; r.plateMat.needsUpdate = true; r.pulse = 1; if (isWrong) { r.shake = 0.5; wrong = 0.6; }
  }
  function awaken(instant = false) { solved = true; if (instant) fade = 1; }
  function update(t: number, dt: number) {
    fade = THREE.MathUtils.clamp(fade + (solved ? dt / 2.5 : -dt), 0, 1);
    const spin = 0.08 + fade * 0.9;
    rings.forEach((r, i) => { r.rotation.z += dt * spin * (i % 2 ? -1 : 1) * (1 + i * 0.4); (r.userData.bead as THREE.Mesh).visible = fade > 0.05; });
    orrery.rotation.y += dt * spin * 0.5;
    core.position.y = 3.6 + Math.sin(t * 1.3) * 0.12 * (0.3 + fade); core.rotation.y += dt * (0.2 + fade);
    wrong = Math.max(0, wrong - dt);
    coreMat.emissive.set(wrong > 0 ? '#ff7a5a' : '#ffd27a'); coreMat.emissiveIntensity = 0.05 + fade * 2.2 + wrong * 1.5;
    windMat.uniforms.uTime.value = t; windMat.uniforms.uFade.value = fade; for (const m of ribbons) { m.visible = fade > 0.01; m.rotation.y = -t * 0.6; }
    light.intensity = fade * 40;
    for (const r of runeObjs) {
      r.shake = Math.max(0, r.shake - dt); r.pulse = Math.max(0, r.pulse - dt * 1.5);
      r.o.children[0].position.x = Math.sin(t * 60) * 0.05 * r.shake * 2;
      r.plateMat.emissiveIntensity = 0.8 + r.pulse * 1.2 + fade * 1.2;
      (r.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(r.pulse * 0.8, fade * (0.55 + 0.25 * Math.sin(t * 3)));
    }
  }
  const root = new THREE.Group(); root.add(g, tablet, ...runeObjs.map((r) => r.o));
  return { group: root, setRune, awaken, update };
}
