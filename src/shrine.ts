import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHRINE, heightAt } from './world';
import { addRimFill } from './shading';
import { triplanar } from './landmarks';
import { standingStone } from './stonework';
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
  // M29 · weathered world-space stone: lichen blots, moss in the up-facing joints, rain streaks running down (was one UV-wrapped tint)
  const stone = triplanar(rock, 1.5, '#e4d4b4', { sat: 0.55, gain: 1.55, rough: 0.95, emissive: '#15120d' });
  { const prev = stone.onBeforeCompile; stone.onBeforeCompile = (sh, r) => { prev.call(stone, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 n = normalize(vTN); float up = smoothstep(.55, .9, n.y), side = 1. - up;
    float lich = smoothstep(.72, .8, tVn(vTW.xy * 3.1 + vTW.zy * 2.7 + vTW.xz * 1.3)) * (.6 + .4 * tVn(vTW.xz * 9.));
    float moss = up * smoothstep(.5, .72, tVn(vTW.xz * 2.2)) + side * smoothstep(.0, -.9, vTW.y - ${(heightAt(SHRINE.x, SHRINE.z) + 0.6).toFixed(2)}) * .5;
    float streak = side * smoothstep(.5, .85, tVn(vec2((vTW.x + vTW.z) * 4.5, vTW.y * .3)));
    diffuseColor.rgb *= 1. - .22 * streak;
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(.72, .74, .58), vec3(.86, .82, .62), tVn(vTW.xy * 5.)), lich * .6);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.33, .4, .2), clamp(moss, 0., .8)); }`); }; }
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
  // M29 · carved wind motifs: a shallow spiral groove winding up each pillar, and wind-scrolls cut round the drum
  const groove = new THREE.MeshStandardMaterial({ color: '#5b5142', roughness: 1 }); const G: THREE.BufferGeometry[] = [], S: THREE.BufferGeometry[] = []; // merged below: flat draw calls
  const pillars = g.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry && Math.abs(o.position.y - 3.8) < 0.01) as THREE.Mesh[];
  for (const p of pillars) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * Math.PI * 6, y = -2.4 + u * 4.8, r = 0.5 + (0.75 - 0.5) * (1 - (y + 3.1) / 6.2) - 0.015; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
    p.updateMatrix(); G.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.035, 4).applyMatrix4(p.matrix)); }
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, sc = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 4, 14, Math.PI * 1.5), groove); sc.position.set(Math.cos(a) * 2.37, 6.6 + 2.0, Math.sin(a) * 2.37); sc.rotation.y = -a + Math.PI / 2; sc.rotation.z = k % 2 ? 0.6 : -0.6; sc.updateMatrix(); G.push(sc.geometry.applyMatrix4(sc.matrix)); }
  // worn steps: a few cracked, sunk slabs leading in from the hub side, chipped blocks at the step ring
  { let sd = 31; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const toHub = Math.atan2(-SHRINE.z, -SHRINE.x);
    for (let k = 0; k < 4; k++) { const r = 8.1 + k * 1.05, a = toHub + (rnd() - 0.5) * 0.05, wx = SHRINE.x + Math.cos(a) * r, wz = SHRINE.z + Math.sin(a) * r;
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 1.9 - k * 0.1), stone); sl.position.set(Math.cos(a) * r, heightAt(wx, wz) - y0 - 0.03, Math.sin(a) * r); sl.rotation.y = -a + (rnd() - 0.5) * 0.12; sl.rotation.z = (rnd() - 0.5) * 0.05; sl.updateMatrix(); S.push(sl.geometry.applyMatrix4(sl.matrix)); }
    for (let k = 0; k < 9; k++) { const a = rnd() * 6.28, r = 7.35 + rnd() * 0.4, ch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + rnd() * 0.18, 0).scale(1.3, 0.55, 1), stone); ch.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); ch.rotation.y = rnd() * 6; ch.updateMatrix(); S.push(ch.geometry.applyMatrix4(ch.matrix)); } }
  // prayer strips: faded cloth on cords between the pillars, swaying in the wind (vertex sway, timed by update)
  const stripT = { value: 0 };
  { const pos: number[] = [], col: number[] = [], uv: number[] = [], ph: number[] = [], idx: number[] = []; const C = ['#d8cfb8', '#b89a5c', '#5f6f86', '#8a9a74', '#cbbf9a'].map((c) => new THREE.Color(c)); let sd = 5, n = 0; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const tops = pillars.map((p) => { p.updateMatrix(); return new THREE.Vector3(0, 1.55, 0).applyMatrix4(p.matrix); });
    for (let k = 0; k < tops.length; k++) { const A = tops[k], B = tops[(k + 1) % tops.length];
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, A.distanceTo(B), 4), groove); cord.position.copy(A).lerp(B, 0.5).y -= 0.25; cord.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); cord.updateMatrix(); G.push(cord.geometry.applyMatrix4(cord.matrix));
      for (let i = 1; i <= 7; i++) { const u = i / 8, P = A.clone().lerp(B, u); P.y -= 0.25 + Math.sin(u * Math.PI) * 0.35; const len = 0.6 + rnd() * 0.45, w = 0.14 + rnd() * 0.05, c = C[Math.floor(rnd() * C.length)], f = rnd() * 6.28, d = B.clone().sub(A).normalize();
        for (let j = 0; j <= 4; j++) { const v = j / 4; for (const sx of [-1, 1]) { pos.push(P.x + d.x * sx * w / 2, P.y - v * len, P.z + d.z * sx * w / 2); col.push(c.r * (0.85 + 0.15 * (1 - v)), c.g * (0.85 + 0.15 * (1 - v)), c.b * (0.85 + 0.15 * (1 - v))); uv.push(v); ph.push(f); } if (j) { const o = n + (j - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
        n += 10; } }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sg.setAttribute('aV', new THREE.Float32BufferAttribute(uv, 1)); sg.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1)); sg.setIndex(idx); sg.computeVertexNormals();
    const sm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    sm.onBeforeCompile = (sh) => { sh.uniforms.uT = stripT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; attribute float aPh; attribute float aV;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { float v = aV; float sw = v * v * (.22 * sin(uT * 2.3 + aPh) + .1 * sin(uT * 5.1 + aPh * 2.)); transformed.x += sw * .8; transformed.z += sw * .55; transformed.y += v * v * .04 * sin(uT * 3. + aPh); }`); };
    const strips = new THREE.Mesh(sg, sm); strips.castShadow = true; g.add(strips); }
  { const ni = (a: THREE.BufferGeometry[]) => a.map((q) => { const n = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; });
    g.add(new THREE.Mesh(mergeGeometries(ni(G))!, groove), new THREE.Mesh(mergeGeometries(ni(S))!, stone)); }
  const light = new THREE.PointLight('#ffd27a', 0, 26, 2); light.position.y = 4; g.add(light);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material instanceof THREE.ShaderMaterial) && !(m.material instanceof THREE.MeshBasicMaterial)) { m.castShadow = m.receiveShadow = true; } });
  g.position.set(SHRINE.x, y0, SHRINE.z);

  // Clue tablet: a tilted carved slab on a plinth.
  const tablet = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.2), stone); tb.position.y = 0.3;
  // M23 · the slab is cut stone (rough-hewn edges, the same rock as the shrine) and the runes are incised into it: the groove
  //       is dark, its lower lip catches light and a bump map gives it depth (was an unlit beige label on a plain box).
  const slabGeo = (() => { const gq = new THREE.BoxGeometry(1.9, 1.3, 0.22, 10, 7, 1); const pp = gq.attributes.position as THREE.BufferAttribute; for (let k = 0; k < pp.count; k++) { const x = pp.getX(k), y = pp.getY(k); const e = Math.max(Math.abs(x) / 0.95, Math.abs(y) / 0.65); if (e > 0.98) { pp.setX(k, x * (1 - 0.025 * (1 + Math.sin(k * 3.7)))); pp.setY(k, y * (1 - 0.03 * (1 + Math.cos(k * 2.9)))); } } gq.computeVertexNormals(); return gq; })();
  const slab = new THREE.Mesh(slabGeo, stone); slab.position.set(0, 1.15, 0); slab.rotation.x = -0.35;
  const runeTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 172; const x = c.getContext('2d')!; x.textAlign = 'center'; x.font = 'bold 92px serif'; x.lineJoin = 'round';
    const txt = '▲  ○  ✕'; x.clearRect(0, 0, 512, 172);
    x.fillStyle = 'rgba(255,244,220,0.55)'; x.fillText(txt, 258, 124); x.fillStyle = 'rgba(20,14,8,0.95)'; x.fillText(txt, 256, 120); x.fillStyle = 'rgba(70,56,40,0.9)'; x.fillText(txt, 254, 117);
    x.strokeStyle = 'rgba(30,22,14,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 22); x.lineTo(472, 22); x.moveTo(40, 150); x.lineTo(472, 150); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshStandardMaterial({ map: runeTex, bumpMap: runeTex, bumpScale: -2.5, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
  carve.position.set(0, 1.2, 0.113); carve.rotation.x = -0.35; slab.castShadow = tb.castShadow = true;
  tablet.add(tb, slab, carve); tablet.position.set(TABLET.x, heightAt(TABLET.x, TABLET.z) - 0.05, TABLET.z);

  // Runes: mossy standing stones with a glowing glyph plate that cycles ○ ▲ ✕.
  const texes = RUNE_GLYPHS.map(glyphTex);
  const moss = triplanar(rock, 1.4, '#aab48e', { sat: 0.55, gain: 1.35 }); // M22: world-space rock (was one stretched UV wrap = flat olive boxes)
  const runeObjs = RUNES.map((r, i) => {
    const o = new THREE.Group();
    // M23 · a dressed, leaning standing stone (rounded section, chipped crown, cleavage facets) instead of a squashed 9-sided can;
    //       the glyph is cut into a smoothed panel on its face rather than stuck on as a dark square plaque.
    const geo = standingStone(1.25, 2.75, 0.95, 3.1 + i * 2.7, { lean: 0.05 * (i - 1), flatY: 1.65, flatR: 0.6 });
    const st = new THREE.Mesh(geo, moss); st.position.y = -0.1; st.castShadow = true;
    const plateMat = new THREE.MeshStandardMaterial({ color: '#1c1812', emissive: '#ffe082', emissiveMap: texes[state.runes[i] | 0], alphaMap: texes[state.runes[i] | 0], transparent: true, depthWrite: false, emissiveIntensity: 0.9, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    let front = 0; { const pp = geo.attributes.position as THREE.BufferAttribute; for (let k = 0; k < pp.count; k++) if (Math.abs(pp.getY(k) - 1.65) < 0.25 && Math.abs(pp.getX(k)) < 0.25) front = Math.max(front, pp.getZ(k)); }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), plateMat); plate.position.set(0, 1.55, front + 0.012);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 6, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, opacity: 0.0, toneMapped: false })); ring.position.y = 0.08;
    o.add(st, plate, ring);
    o.position.set(r.x, heightAt(r.x, r.z) - 0.1, r.z);
    // Plates face south, toward the path the player arrives on.
    return { o, plateMat, ring, shake: 0, pulse: 0 };
  });

  let fade = state.solved ? 1 : 0, solved = state.solved, wrong = 0;
  function setRune(i: number, v: number, isWrong: boolean) {
    const r = runeObjs[i]; r.plateMat.emissiveMap = texes[v]; r.plateMat.alphaMap = texes[v]; r.plateMat.needsUpdate = true; r.pulse = 1; if (isWrong) { r.shake = 0.5; wrong = 0.6; }
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
    stripT.value = t; windMat.uniforms.uTime.value = t; windMat.uniforms.uFade.value = fade; for (const m of ribbons) { m.visible = fade > 0.01; m.rotation.y = -t * 0.6; }
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
