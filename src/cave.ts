import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS, SPAWN, heightAt } from './world';
import { triplanar } from './landmarks';
import type { GroundTex } from './terrain';

/** Chapter II opener — Enna's Trail: the collapsed stair by Pale Keep and the drowned water-road ruin beneath it. */
const PALE = LANDMARKS.find((l) => l.id === 'pale')!;
const FACE = Math.atan2(SPAWN.x - PALE.x, SPAWN.z - PALE.z); // the keep's gate faces the meadow
const SA = FACE + 0.78; // stair sits outside the east curtain wall
export const STAIR = { x: PALE.x + Math.sin(SA) * 27, z: PALE.z + Math.cos(SA) * 27, rot: SA + Math.PI * 0.5 };
/** Stair descends along this direction (world), mouth faces back the other way. */
export const STAIR_DIR = { x: Math.sin(STAIR.rot), z: Math.cos(STAIR.rot) };
/** The stair opening (world): terrain + grass are cut away inside this rotated rectangle so the real steps below show. */
export const PIT = { x: STAIR.x, z: STAIR.z, rot: STAIR.rot, w: 1.5, l: 2.5 };
const PIT_GLSL = `bool inPit(vec2 p){vec2 d=p-vec2(${PIT.x.toFixed(3)},${PIT.z.toFixed(3)});float c=${Math.cos(PIT.rot).toFixed(5)},s=${Math.sin(PIT.rot).toFixed(5)};vec2 l=vec2(d.x*c-d.y*s,d.x*s+d.y*c);return abs(l.x)<${PIT.w.toFixed(2)}&&abs(l.y)<${PIT.l.toFixed(2)};}`;
/** Terrain: discard fragments over the opening (fragment world position varying `vWP`). */
export function cutTerrain(mat: THREE.Material) { const prev = mat.onBeforeCompile.bind(mat); mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', PIT_GLSL + '\nvoid main() {\n if (inPit(vWP.xz)) discard;'); }; mat.customProgramCacheKey = () => 'pitcut'; }
/** Grass: collapse blades whose root lies in (or right at the edge of) the opening. */
export function cutGrass(mat: THREE.Material) { const prev = mat.onBeforeCompile.bind(mat); mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.vertexShader = sh.vertexShader.replace('void main() {', PIT_GLSL.replace('<' + PIT.w.toFixed(2), '<' + (PIT.w + 0.5).toFixed(2)).replace('<' + PIT.l.toFixed(2), '<' + (PIT.l + 0.5).toFixed(2)) + '\nvoid main() {').replace('vBend=bend;', 'vBend=bend; if (inPit(iw.xz)) transformed*=0.;'); }; mat.customProgramCacheKey = () => 'pitcutg'; }
export const CAVE_O = { x: 1000, z: 1000 }; // the interior lives in its own scene, far outside the vale's coordinates
export const CAVE_XP = 40;
export type CaveStage = 0 | 1 | 2 | 3 | 4; // 0 none · 1 Wayfinder's lead · 2 descended · 3 door open · 4 Enna's message found

export const CAVE_LINES = {
  lead: [
    'Morning-Bearer. The sky has remembered how to let go. Follow Enna’s last blank beyond the sea.',
    'Her trail starts lower than you would think, {name}. East of Pale Keep there is a collapsed stair — the keep’s old water-road.',
    'Enna went down it the spring she left. The river there does not run to the vale. Take the light with you.',
  ],
  remind: ['The collapsed stair lies just east of Pale Keep’s walls, {name}. Mind the dark; mind the water.'],
  found: ['You found her words. The water-road runs west under the hills to the sea caves.', 'When you are ready, {name}, the trail is yours to follow.'],
  locked: 'The stair is choked with rubble and dark. Nothing calls you down — yet.',
  quiet: 'Water murmurs far below the rubble. The Wayfinder may know where it goes.',
  hint: ['Carved above the sealed door, worn but clear:', '“Light them as the river runs — where it is born, where it is crossed, where it is lost.”', 'Three braziers stand before the door. Each bears a worn sign: a Spring, a Ford, the Sea.'],
  wrong: 'The flames gutter out. The river does not run that way.',
  open: 'Stone grinds on stone — the sealed door sinks into the floor.',
  carving: (name: string, reward: boolean) => [
    'Carved into the alcove wall, in a hand you know:',
    `“${name} — if you are reading this, the morning came back. I knew you would read the river the way I taught you.`,
    'This stair is the old water-road. It runs west beneath the hills to the sea caves, where the second seam answers under the tide.',
    'I have gone to listen. Take the tide-glass; it remembers the way. — E. M.”',
    reward ? `Enna’s Tide-Glass added · +${CAVE_XP} XP · Chapter II: the trail to the sea begins.` : 'Her words are already in your journal. The tide-glass hums faintly toward the west.',
  ],
};
/** Braziers before the door (left → right): Ford, Sea, Spring. Order to light: Spring → Ford → Sea. */
export const BRAZIERS = [{ name: 'Ford', glyph: '⁘', x: -3.6, z: -5.2 }, { name: 'Sea', glyph: '≈', x: 0, z: -4.2 }, { name: 'Spring', glyph: '◎', x: 3.6, z: -5.2 }];
export const RIVER_ORDER = [2, 0, 1];
export const CAVE_ENTRY = { x: 0, z: 6.6 }, CAVE_EXIT = { x: 0, z: 8.0 }, CAVE_DOOR = { x: 0, z: -8.4 }, CAVE_CARVING = { x: 0, z: -9.9 };

function noise3(x: number, y: number, z: number) { const s = Math.sin(x * 1.7 + y * 3.1) * Math.cos(z * 1.3 - x * 0.7) + 0.5 * Math.sin(x * 4.3 - z * 3.7 + y * 2.2) + 0.25 * Math.sin(y * 7.1 + z * 6.3); return s / 1.75; }
function rockGeo(r: number, rnd: () => number, flat = 0.75) {
  const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 0.8 + 0.35 * noise3(x * 2 + rnd(), y * 2, z * 2); p.setXYZ(i, x * f, y * f * flat, z * f); }
  g.computeVertexNormals(); return g;
}
function flameTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 92, 2, 32, 80, 56); g.addColorStop(0, 'rgba(255,246,214,1)'); g.addColorStop(0.25, 'rgba(255,190,90,0.95)'); g.addColorStop(0.55, 'rgba(240,110,30,0.45)'); g.addColorStop(1, 'rgba(120,30,0,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(54, 50, 62, 92, 32, 124); x.bezierCurveTo(2, 92, 10, 50, 32, 4); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeFlame(tex: THREE.Texture, s = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd9a0', fog: false }));
  sp.scale.set(0.42 * s, 0.8 * s, 1); sp.center.set(0.5, 0.1); sp.layers.set(1); return sp;
}
function glyphTex(glyph: string, label: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = '#7d7468'; x.fillRect(0, 0, 256, 256); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const [dx, col] of [[3, 'rgba(255,240,215,0.35)'], [0, 'rgba(30,22,16,0.92)']] as const) { x.fillStyle = col; x.font = 'bold 128px serif'; x.fillText(glyph, 128 + dx, 110 + dx); x.font = '600 40px serif'; x.fillText(label.toUpperCase(), 128 + dx, 212 + dx); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function carvingTex(name: string) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 640); x.textAlign = 'center';
  const lines = [`${name} —`, 'the morning came back.', 'The water-road runs west', 'beneath the hills to the sea.', 'I have gone to listen.', '— E. M.'];
  lines.forEach((l, i) => { const y = 90 + i * 92; x.font = `italic ${i === 0 ? 64 : 56}px serif`; x.fillStyle = 'rgba(28,18,10,0.9)'; x.fillText(l, 512, y); });
  // Enna's surveyor mark: a river line running off to the left (west) with an arrow and a wave.
  x.strokeStyle = 'rgba(18,12,8,0.9)'; x.lineWidth = 7; x.beginPath(); x.moveTo(900, 590); x.bezierCurveTo(760, 540, 640, 630, 470, 585); x.bezierCurveTo(330, 548, 230, 600, 120, 580); x.stroke();
  x.beginPath(); x.moveTo(140, 556); x.lineTo(110, 580); x.lineTo(142, 604); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** World-side: the collapsed stair. A ring of broken flagstones around a real opening (depth-mask trick: the hole writes far
 *  depth over the terrain, then the steps/walls below draw only through it), a broken arch, rubble and a torch post. */
export function makeStairEntrance(t: { brick: GroundTex; rock: GroundTex }) {
  const g = new THREE.Group(); const y0 = Math.max(...[[-1.6, -2.6], [1.6, -2.6], [-1.6, 2.6], [1.6, 2.6], [0, 0]].map(([a, b]) => heightAt(STAIR.x + Math.cos(STAIR.rot) * a + Math.sin(STAIR.rot) * b, STAIR.z - Math.sin(STAIR.rot) * a + Math.cos(STAIR.rot) * b))) + 0.05;
  g.position.set(STAIR.x, y0, STAIR.z); g.rotation.y = STAIR.rot;
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stone = triplanar(t.brick, 2.6, '#b9ad9c', { sat: 0.4, gain: 1.25 }), rough = triplanar(t.rock, 2.2, '#9a9284');
  const W = 1.5, L = 2.5; // half sizes of the opening (x across, z along the descent)
  // Pit: steps descending along +z (local), side walls, far wall with a black tunnel mouth.
  const pit = new THREE.Group(); g.add(pit); const pitMat = stone;
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) { if (i === 2) continue; const b = new THREE.BoxGeometry(W * 2 - 0.1, 0.32, 0.56); b.translate((i === 3 ? 0.12 : 0), -0.3 * (i + 1) + 0.16 - 0.04, -L + 0.28 + i * 0.52); if (i === 3) b.rotateZ(0.08); steps.push(b); }
  const broken = new THREE.BoxGeometry(W * 1.1, 0.25, 0.5); broken.rotateX(0.35); broken.translate(-0.5, -0.95, -L + 0.3 + 2 * 0.52); steps.push(broken);
  for (const sx of [-1, 1]) { const w = new THREE.BoxGeometry(0.3, 3.4, L * 2 + 0.2); w.translate(sx * (W + 0.1), -1.7, 0); steps.push(w); }
  { const w = new THREE.BoxGeometry(W * 2 + 0.4, 1.2, 0.3); w.translate(0, -0.6, L + 0.1); steps.push(w); }
  { const w = new THREE.BoxGeometry(W * 2 + 0.6, 0.4, L * 2 + 0.6); w.translate(0, -3.4, 0); steps.push(w); }
  const stepMesh = new THREE.Mesh(mergeGeometries(steps.map((s) => s.index ? s.toNonIndexed() : s)), pitMat); stepMesh.receiveShadow = true; pit.add(stepMesh);
  { const v = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 2.3), new THREE.MeshBasicMaterial({ color: '#020101' })); v.position.set(0, -2.35, L - 0.06); v.rotation.y = Math.PI; pit.add(v); } // black tunnel mouth
  // depth darkening inside the pit: a black volume gradient (additive darkness via a dark transparent box)
  const shade = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 0.02, 3.2, L * 2 - 0.02), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide,
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vP;void main(){float d=clamp((-vP.y-0.6)/2.6,0.,1.)*0.55+clamp((vP.z+0.5)/3.,0.,1.)*0.35;gl_FragColor=vec4(0.01,0.008,0.006,clamp(d,0.,0.9));}' }));
  shade.position.y = -1.6; shade.renderOrder = 2; shade.layers.set(1); pit.add(shade);
  // Curb of broken flagstones around the opening, a broken arch at the far end and rubble.
  const curb: THREE.BufferGeometry[] = [];
  const ring = (x: number, z: number, w: number, d: number, ry: number, h = 0.34) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateY(ry); b.translate(x, h / 2 - 0.08, z); curb.push(b); };
  for (let i = 0; i < 6; i++) { const z = -L + 0.45 + i * 0.85; for (const sx of [-1, 1]) if (!(sx > 0 && i === 4)) ring(sx * (W + 0.42), z, 0.8, 0.84, (rnd() - 0.5) * 0.1, 0.2 + rnd() * 0.08); }
  for (let i = 0; i < 4; i++) ring(-W + 0.4 + i * 0.75, -L - 0.42, 0.72, 0.78, (rnd() - 0.5) * 0.1, 0.22 + rnd() * 0.1);
  const jamb = (sx: number, h: number) => { const b = new THREE.BoxGeometry(0.95, h, 0.95); b.translate(sx * (W + 0.55), h / 2, L + 0.45); curb.push(b); const c = new THREE.BoxGeometry(1.15, 0.3, 1.15); c.translate(sx * (W + 0.55), 0.15, L + 0.45); curb.push(c); if (h > 2) { const k = new THREE.BoxGeometry(1.1, 0.28, 1.1); k.translate(sx * (W + 0.55), h, L + 0.45); curb.push(k); } };
  jamb(-1, 3.3); jamb(1, 1.7);
  // arch voussoirs: the left half still springs from the tall jamb; the rest lies broken across the opening and on the grass
  for (let k = 0; k < 4; k++) { const a = Math.PI - k * 0.32; const b = new THREE.BoxGeometry(0.9, 0.5, 0.9); b.rotateZ(a - Math.PI / 2); b.translate(Math.cos(a) * (W + 0.55), 3.3 + Math.sin(a) * 1.4 - 0.1, L + 0.45); curb.push(b); }
  { const b = new THREE.BoxGeometry(2.4, 0.55, 0.85); b.rotateZ(-0.55); b.rotateY(0.25); b.translate(W + 0.1, 0.75, L + 0.2); curb.push(b); }
  for (let k = 0; k < 3; k++) { const b = new THREE.BoxGeometry(0.85, 0.45, 0.8); b.rotateY(rnd() * 3); b.rotateZ((rnd() - 0.5) * 0.5); b.translate(W + 1.4 + rnd() * 1.2, 0.18, L - 0.6 - k * 0.9); curb.push(b); }
  const curbMesh = new THREE.Mesh(mergeGeometries(curb.map((s) => s.index ? s.toNonIndexed() : s)), stone); curbMesh.castShadow = curbMesh.receiveShadow = true; g.add(curbMesh);
  const rub: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) { const r = 0.25 + rnd() * 0.55, a = rnd() * 6.28; const rg = rockGeo(r, rnd, 0.6); const side = i < 7 ? 1 : -1; rg.translate(side * (W + 0.9 + rnd() * 1.6), r * 0.3, (rnd() - 0.2) * L * 1.8); rg.rotateY(a * 0); rub.push(rg); }
  const rubMesh = new THREE.Mesh(mergeGeometries(rub), rough); rubMesh.castShadow = rubMesh.receiveShadow = true; g.add(rubMesh);
  // Torch post (lit once the Wayfinder has given the lead).
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 6), new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.9 }));
  post.position.set(-(W + 0.95), 0.85, -L - 0.3); post.castShadow = true; g.add(post);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.2, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#2b2622', metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide })); cup.position.set(post.position.x, 1.75, post.position.z); g.add(cup);
  const flame = makeFlame(flameTex(), 0.75); flame.position.set(post.position.x, 1.78, post.position.z); g.add(flame);
  const light = new THREE.PointLight('#ffb26b', 0, 9, 2); light.position.set(post.position.x, 2.1, post.position.z); g.add(light);
  let lit = 0, want = 0;
  return {
    group: g, y0,
    /** World point at the top step (where the player stands to descend). */
    mouth: { x: STAIR.x - STAIR_DIR.x * (L + 1.4), z: STAIR.z - STAIR_DIR.z * (L + 1.4) },
    setLit(on: boolean) { want = on ? 1 : 0; },
    update(time: number, dt: number) {
      lit += (want - lit) * Math.min(1, dt * 3); flame.visible = lit > 0.02; const f = 0.85 + 0.15 * Math.sin(time * 17) * Math.sin(time * 7.3);
      flame.scale.set(0.32 * f, 0.6 * (0.9 + 0.2 * f), 1); flame.material.opacity = lit; light.intensity = lit * 6 * f;
    },
  };
}

/** The drowned water-road ruin: one cheap room (dome + floor + 4 carved pillars + door/alcove), torch-lit, with its own scene. */
export function makeCaveInterior(high: boolean, t: { rock: GroundTex; blocks: GroundTex; bed: GroundTex }, env: THREE.Texture | null, heroName: string) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#040302');
  scene.fog = new THREE.FogExp2('#0a0706', high ? 0.03 : 0.036);
  if (env) { scene.environment = env; scene.environmentIntensity = 0.07; }
  scene.add(new THREE.HemisphereLight('#6d7d8c', '#2a1e14', 0.16));
  const g = new THREE.Group(); g.position.set(CAVE_O.x, 0, CAVE_O.z); scene.add(g);
  let seed = 23; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const RX = 9.4, RZ = 12.9, RY = 6.6;
  const rock = triplanar(t.rock, 3.2, '#a29a90', { rough: 0.95 }), wet = triplanar(t.bed, 2.0, '#6f6a64', { rough: 0.55 }), blocks = triplanar(t.blocks, 2.4, '#b8aa96', { sat: 0.6 });
  // Dome: noise-displaced half-ellipsoid seen from inside.
  { const d = new THREE.SphereGeometry(1, high ? 72 : 48, high ? 30 : 20, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = noise3(x * 3.1, y * 3.3, z * 3.0) * 0.55 + noise3(x * 9, y * 9, z * 9) * 0.18; p.setXYZ(i, x * (RX + n), y * RY + n * 0.6 * y, z * (RZ + n)); }
    const ix = d.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; } // inward-facing
    d.computeVertexNormals(); const m = new THREE.Mesh(d, rock); m.receiveShadow = true; m.position.y = -0.2; g.add(m); }
  // Floor: wet river-stone with a shallow pool.
  { const f = new THREE.CircleGeometry(1, 48); f.scale(RX + 0.6, RZ + 0.6, 1); const m = new THREE.Mesh(f, wet); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; g.add(m); }
  const POOL = { x: 5.2, z: 2.4, r: 1.5 };
  const pool = new THREE.Mesh(new THREE.CircleGeometry(POOL.r, 32), new THREE.MeshStandardMaterial({ color: '#0b1416', roughness: 0.03, metalness: 0.2, envMapIntensity: 3 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(POOL.x, 0.02, POOL.z); pool.receiveShadow = true; g.add(pool);
  const rimRocks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + rnd() * 0.3, r = 0.18 + rnd() * 0.2; const rg = rockGeo(r, rnd, 0.55); rg.translate(POOL.x + Math.cos(a) * (POOL.r + 0.05), 0.04, POOL.z + Math.sin(a) * (POOL.r + 0.05)); rimRocks.push(rg); }
  // Rubble below the stair and along the walls.
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, rr = 0.78 + rnd() * 0.16, r = 0.3 + rnd() * (i < 6 ? 0.9 : 0.5); const x = i < 6 ? (rnd() - 0.5) * 6 + (rnd() < 0.5 ? -3 : 3) : Math.cos(a) * RX * rr, z = i < 6 ? 9.5 + rnd() * 2 : Math.sin(a) * RZ * rr; if (z < -7.6 && Math.abs(x) < 4.5) continue; const rg = rockGeo(r, rnd, 0.7); rg.translate(x, r * 0.25, z); rimRocks.push(rg); }
  { const m = new THREE.Mesh(mergeGeometries(rimRocks), rock); m.castShadow = m.receiveShadow = true; g.add(m); }
  // Stair rising out of the room toward the daylight (south, +z).
  const stairs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) { const b = new THREE.BoxGeometry(2.6, 0.34 * (i + 1), 0.52); b.translate(i === 5 ? 0.15 : 0, 0.17 * (i + 1), 8.9 + i * 0.5); if (i === 5) b.rotateZ(0.04); stairs.push(b.toNonIndexed()); }
  for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.5, 4.4, 5.2); b.translate(sx * 1.55, 2.0, 11.1); stairs.push(b.toNonIndexed()); }
  { const m = new THREE.Mesh(mergeGeometries(stairs), blocks); m.castShadow = m.receiveShadow = true; g.add(m); }
  // Daylight leaking down the stair: soft additive shaft + (High) a cool spot light.
  const shaftMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;void main(){float e=sin(vUv.x*3.14159);float a=e*e*smoothstep(0.,.6,vUv.y)*0.10;gl_FragColor=vec4(vec3(.62,.72,.85)*a,1.);\n#include <colorspace_fragment>\n}' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 7.5, 16, 1, true), shaftMat); shaft.position.set(0, 3.2, 11.0); shaft.rotation.x = -0.55; shaft.layers.set(1); g.add(shaft);
  if (high) { const sp = new THREE.SpotLight('#a9bcd6', 22, 18, 0.55, 0.8, 1.6); sp.position.set(0, 7.5, 14.5); sp.target.position.set(0, 0, 7); g.add(sp, sp.target); }
  // Carved pillars: octagonal shafts with banded collars and capitals; one broken.
  const pil: THREE.BufferGeometry[] = [];
  const PILLARS = [[-4.4, 2.2], [4.4, 2.2], [-4.6, -2.6], [4.6, -2.6]];
  PILLARS.forEach(([x, z], i) => {
    const H = i === 1 ? 2.6 : 6.4; const sh = new THREE.CylinderGeometry(0.48, 0.56, H, 8, 6); const p = sh.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) { const yy = p.getY(v); const k = 1 + 0.05 * Math.sin(yy * 6 + i) * (Math.abs(yy) < H * 0.4 ? 1 : 0); p.setX(v, p.getX(v) * k); p.setZ(v, p.getZ(v) * k); }
    sh.computeVertexNormals(); sh.translate(x, H / 2, z); pil.push(sh.toNonIndexed());
    const base = new THREE.CylinderGeometry(0.78, 0.86, 0.5, 8); base.translate(x, 0.25, z); pil.push(base.toNonIndexed());
    for (const yy of [1.1, 2.0]) if (yy < H) { const c = new THREE.TorusGeometry(0.55, 0.07, 5, 8); c.rotateX(Math.PI / 2); c.translate(x, yy, z); pil.push(c.toNonIndexed()); }
    if (i !== 1) { const cap = new THREE.CylinderGeometry(0.95, 0.55, 0.6, 8); cap.translate(x, 4.6, z); pil.push(cap.toNonIndexed()); }
    else { for (let k = 0; k < 3; k++) { const d = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8); d.rotateZ(Math.PI / 2 - 0.2 + k * 0.2); d.rotateY(k * 0.9); d.translate(x + 0.9 + k * 0.7, 0.42, z - 1 + k * 0.9); pil.push(d.toNonIndexed()); } }
  });
  { const m = new THREE.Mesh(mergeGeometries(pil), blocks); m.castShadow = m.receiveShadow = true; g.add(m); }
  // Door wall with a sealed slab, and Enna's alcove behind it.
  const doorWall: THREE.BufferGeometry[] = [];
  const DZ = -9.0, DW = 0.95, DH = 2.5;
  for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(4.2, 5.2, 0.8); b.translate(sx * (DW + 2.1), 2.6, DZ); doorWall.push(b.toNonIndexed()); }
  { const b = new THREE.BoxGeometry(DW * 2, 5.2 - DH, 0.8); b.translate(0, DH + (5.2 - DH) / 2, DZ); doorWall.push(b.toNonIndexed()); }
  { const b = new THREE.BoxGeometry(DW * 2 + 0.7, 0.4, 1.0); b.translate(0, DH + 0.2, DZ + 0.1); doorWall.push(b.toNonIndexed()); }

  // alcove box: side walls, back wall, ceiling
  const AZ = -11.1;
  for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.4, 2.9, AZ - DZ < 0 ? DZ - AZ : 1); b.translate(sx * 1.55, 1.45, (DZ + AZ) / 2); doorWall.push(b.toNonIndexed()); }
  { const b = new THREE.BoxGeometry(3.5, 2.9, 0.4); b.translate(0, 1.45, AZ - 0.2); doorWall.push(b.toNonIndexed()); }
  { const b = new THREE.BoxGeometry(3.5, 0.4, DZ - AZ + 0.4); b.translate(0, 2.9, (DZ + AZ) / 2); doorWall.push(b.toNonIndexed()); }
  { const b = new THREE.BoxGeometry(1.6, 0.9, 0.5); b.translate(0, 0.45, AZ + 0.25); doorWall.push(b.toNonIndexed()); } // ledge
  { const m = new THREE.Mesh(mergeGeometries(doorWall), blocks); m.castShadow = m.receiveShadow = true; g.add(m); }
  // Carved frame (lighter dressed stone) proud of the wall.
  { const fr: THREE.BufferGeometry[] = []; for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.55, DH + 0.2, 1.3); b.translate(sx * (DW + 0.27), (DH + 0.2) / 2, DZ + 0.15); fr.push(b.toNonIndexed()); const c = new THREE.BoxGeometry(0.75, 0.3, 1.45); c.translate(sx * (DW + 0.27), 0.15, DZ + 0.15); fr.push(c.toNonIndexed()); }
    const l = new THREE.BoxGeometry(DW * 2 + 1.5, 0.55, 1.45); l.translate(0, DH + 0.45, DZ + 0.15); fr.push(l.toNonIndexed());
    const m = new THREE.Mesh(mergeGeometries(fr), triplanar(t.blocks, 1.6, '#e3d3b8', { sat: 0.5, gain: 1.15 })); m.castShadow = m.receiveShadow = true; g.add(m); }
  // The slab: darker stone with Enna-era chalk signs (river order, top to bottom) — the visible clue.
  const slabTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, 256, 320); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = '76px serif';
    ['◎', '⁘', '≈'].forEach((gl, i) => x.fillText(gl, 128, 60 + i * 100)); x.font = '40px serif'; x.fillText('↓', 128, 110); x.fillText('↓', 128, 210); const t2 = new THREE.CanvasTexture(c); return t2; })();
  const slabMat = triplanar(t.blocks, 1.4, '#6f665b', { sat: 0.5 }); slabMat.emissive = new THREE.Color('#cfc6b4'); slabMat.emissiveMap = slabTex; slabMat.emissiveIntensity = 0.16;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(DW * 2 - 0.04, DH, 0.4), slabMat); slab.position.set(0, DH / 2, DZ); slab.castShadow = true; g.add(slab);
  // Enna's carved message and the tide-glass.
  const carveTex = carvingTex(heroName);
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.62), new THREE.MeshStandardMaterial({ map: carveTex, bumpMap: carveTex, bumpScale: 0.6, transparent: true, roughness: 0.85, color: '#4a3c30', polygonOffset: true, polygonOffsetFactor: -2 }));
  carve.position.set(0, 1.68, AZ + 0.01); carve.layers.set(1); g.add(carve);
  const glassG = new THREE.Group(); glassG.position.set(0, 1.02, AZ + 0.32); glassG.rotation.x = -0.9; g.add(glassG);
  const brass = new THREE.MeshStandardMaterial({ color: '#b8893e', metalness: 0.95, roughness: 0.32 });
  glassG.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 28), brass));
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), brass); h.position.set(0, -0.26, 0); glassG.add(h); }
  const lensMat = high ? new THREE.MeshPhysicalMaterial({ color: '#cfeeff', emissive: '#59c9ff', emissiveIntensity: 0.15, roughness: 0.02, transmission: 0.8, thickness: 0.1, ior: 1.5, iridescence: 0.4 }) : new THREE.MeshStandardMaterial({ color: '#9fd8f0', emissive: '#59c9ff', emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.2 });
  glassG.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), lensMat));
  const glassLight = new THREE.PointLight('#7fd2ff', 0, 4, 2); glassLight.position.set(0, 1.3, AZ + 0.8); g.add(glassLight);
  // Torches: stair foot and door (door torch casts shadows on High).
  const ft = flameTex();
  const torches: { f: THREE.Sprite; l: THREE.PointLight; ph: number }[] = [];
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2522', metalness: 0.75, roughness: 0.55 });
  for (const [x, y, z, ry] of [[-1.95, 2.0, 8.6, 0], [-2.2, 2.2, DZ + 0.55, 0], [2.2, 2.2, DZ + 0.55, 0]] as const) {
    if (!high && x > 0) continue; // Lite: two torches
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.28, 8, 1, true), iron); br.position.set(x, y, z); br.rotation.y = ry; g.add(br);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), iron); arm.position.set(x, y - 0.16, z - 0.2 * Math.sign(z)); g.add(arm);
    const f = makeFlame(ft, 1); f.position.set(x, y + 0.08, z); g.add(f);
    const l = new THREE.PointLight('#ff9f52', 9, high ? 16 : 14, 1.6); l.position.set(x, y + 0.45, z + (z > 0 ? -0.3 : 0.3));
    if (high && z < 0 && x < 0) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.004; l.shadow.radius = 3; }
    g.add(l); torches.push({ f, l, ph: torches.length * 1.7 });
  }
  // Braziers: pedestal + iron bowl + glyph plaque; Lite shares one light for all three.
  const brz: { f: THREE.Sprite; l: THREE.PointLight | null; k: number; want: number }[] = [];
  const sharedL = high ? null : new THREE.PointLight('#ffa860', 0, 12, 1.6); if (sharedL) { sharedL.position.set(0, 2.2, -4.6); g.add(sharedL); }
  for (const b of BRAZIERS) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 1.0, 8), blocks); ped.position.set(b.x, 0.5, b.z); ped.castShadow = ped.receiveShadow = true; g.add(ped);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), iron); bowl.material.side = THREE.DoubleSide; bowl.position.set(b.x, 1.28, b.z); bowl.castShadow = true; g.add(bowl);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshStandardMaterial({ color: '#1b1410', emissive: '#ff5a14', emissiveIntensity: 0, roughness: 1 })); coals.rotation.x = -Math.PI / 2; coals.position.set(b.x, 1.16, b.z); g.add(coals);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: glyphTex(b.glyph, b.name), roughness: 0.95 }));
    const a = Math.atan2(CAVE_ENTRY.x - b.x, CAVE_ENTRY.z - b.z); pl.position.set(b.x + Math.sin(a) * 0.43, 0.58, b.z + Math.cos(a) * 0.43); pl.rotation.y = a; pl.rotation.x = -0.08; g.add(pl);
    const f = makeFlame(ft, 1.7); f.position.set(b.x, 1.18, b.z); f.visible = false; g.add(f);
    let l: THREE.PointLight | null = null; if (high) { l = new THREE.PointLight('#ffa860', 0, 11, 1.6); l.position.set(b.x, 1.9, b.z); g.add(l); }
    brz.push({ f, l, k: 0, want: 0 }); (f as THREE.Sprite).userData.coals = coals;
  }
  // Water drip into the pool: falling drop + expanding ripple.
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#cfe6ef', roughness: 0.05, emissive: '#2a3a40' })); g.add(drop);
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#b8d2dc', transparent: true, opacity: 0, depthWrite: false });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), rippleMat); ripple.rotation.x = -Math.PI / 2; ripple.position.set(POOL.x + 0.3, 0.04, POOL.z - 0.2); ripple.layers.set(1); g.add(ripple);
  const ripple2 = ripple.clone(); ripple2.material = rippleMat.clone(); g.add(ripple2);
  // Hanging stalactites above the pool (where the drip forms).
  { const st: THREE.BufferGeometry[] = []; for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(0.12 + rnd() * 0.16, 0.6 + rnd() * 1.1, 6); c.rotateX(Math.PI); const x = POOL.x + (rnd() - 0.5) * 2.4, z = POOL.z + (rnd() - 0.5) * 2.4; c.translate(x, 4.9 - 0.4 * Math.hypot(x / RX, z / RZ) * 4, z); st.push(c.toNonIndexed()); } const m = new THREE.Mesh(mergeGeometries(st), rock); g.add(m); }
  // Dust motes in the torchlight.
  { const N = high ? 120 : 50, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (rnd() - 0.5) * 12; pos[i * 3 + 1] = 0.3 + rnd() * 4; pos[i * 3 + 2] = (rnd() - 0.5) * 18; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffd9a8', size: 0.03, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); pts.layers.set(1); g.add(pts); g.userData.motes = pts; }
  let doorK = 0, doorWant = 0, glassK = 0, glassWant = 0;
  const L = (x: number, z: number) => ({ x: CAVE_O.x + x, z: CAVE_O.z + z });
  const PSOL = [...PILLARS.map(([x, z], i) => ({ x, z, r: i === 1 ? 0.95 : 0.95 })), { x: 5.9, z: -2.0, r: 1.0 }, { x: 6.7, z: -1.3, r: 0.9 }, ...BRAZIERS.map((b) => ({ x: b.x, z: b.z, r: 0.7 })), { x: POOL.x, z: POOL.z, r: POOL.r + 0.2 }];
  const ex = new THREE.Vector3();
  return {
    scene,
    entry: L(CAVE_ENTRY.x, CAVE_ENTRY.z), exit: L(CAVE_EXIT.x, CAVE_EXIT.z), door: L(CAVE_DOOR.x, CAVE_DOOR.z), carving: L(CAVE_CARVING.x, CAVE_CARVING.z),
    braziers: BRAZIERS.map((b) => L(b.x, b.z)),
    /** Keep the player inside the room (world coords in, world coords out). */
    constrain(wx: number, wz: number): [number, number] {
      let x = wx - CAVE_O.x, z = wz - CAVE_O.z;
      const inAlcove = doorK > 0.95 && Math.abs(x) < 1.15 && z < DZ + 0.5;
      if (inAlcove) { z = Math.max(z, AZ + 0.75); x = THREE.MathUtils.clamp(x, -1.15, 1.15); }
      else {
        const e = Math.hypot(x / (RX - 1.4), z / (RZ - 1.6)); if (e > 1) { x /= e; z /= e; }
        z = Math.min(z, 8.3); if (z < DZ + 0.75 && !(doorK > 0.95 && Math.abs(x) < 0.75)) z = DZ + 0.75;
        for (const s of PSOL) { const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz); if (d < s.r && d > 1e-4) { x = s.x + dx / d * s.r; z = s.z + dz / d * s.r; } }
      }
      return [x + CAVE_O.x, z + CAVE_O.z];
    },
    /** Pull the camera in so it stays under the dome and outside the door wall. */
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const inside = (v: THREE.Vector3) => { const x = v.x - CAVE_O.x, z = v.z - CAVE_O.z; if (v.y < 0.35) return false; if (z < DZ + 0.5 && !(Math.abs(x) < 1.2 && v.y < 2.6 && doorK > 0.95)) return false; if (z > 8.4) return Math.abs(x) < 1.1 && v.y > 0.34 * (1 + (z - 8.9) / 0.5) + 0.6 && v.y < 4.2; return (x / (RX - 1.2)) ** 2 + (v.y / (RY - 0.9)) ** 2 + (z / (RZ - 1.2)) ** 2 < 1; };
      if (inside(cam)) return; let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; ex.lerpVectors(target, cam, m); if (inside(ex)) lo = m; else hi = m; } cam.lerpVectors(target, cam, Math.max(0.15, lo * 0.95));
    },
    lightBrazier(i: number, on: boolean, instant = false) { brz[i].want = on ? 1 : 0; if (instant) brz[i].k = brz[i].want; },
    setDoor(open: boolean, instant = false) { doorWant = open ? 1 : 0; if (instant) doorK = doorWant; },
    setGlass(on: boolean, instant = false) { glassWant = on ? 1 : 0; if (instant) glassK = glassWant; },
    get doorOpen() { return doorK > 0.95; },
    update(time: number, dt: number) {
      for (const tc of torches) { const f = 0.82 + 0.18 * Math.sin(time * 13 + tc.ph) * Math.sin(time * 5.3 + tc.ph * 2); tc.l.intensity = 9 * f; tc.f.scale.set(0.42 * f, 0.8 * (0.9 + 0.2 * f), 1); }
      let lit = 0;
      for (const b of brz) { b.k += (b.want - b.k) * Math.min(1, dt * 3); const f = 0.85 + 0.15 * Math.sin(time * 11 + lit * 2.1); b.f.visible = b.k > 0.02; b.f.material.opacity = b.k; b.f.scale.set(0.7 * f * (0.6 + 0.4 * b.k), 1.35 * (0.9 + 0.2 * f) * (0.5 + 0.5 * b.k), 1);
        ((b.f.userData.coals as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = b.k * 1.6 * f; if (b.l) b.l.intensity = b.k * 10 * f; lit += b.k; }
      if (sharedL) sharedL.intensity = lit * 7;
      doorK += (doorWant - doorK) * Math.min(1, dt * 0.9); if (doorWant && doorK > 0.995) doorK = 1; slab.position.y = DH / 2 - doorK * (DH + 0.05); slab.visible = doorK < 0.999;
      glassK += (glassWant - glassK) * Math.min(1, dt * 1.5); glassLight.intensity = 0.4 + glassK * 1.6 + doorK * 0.8; lensMat.emissiveIntensity = 0.12 + glassK * 0.45 + 0.08 * Math.sin(time * 2);
      glassG.position.y = 1.02 + glassK * (0.18 + Math.sin(time * 1.4) * 0.03);
      const dp = (time % 2.4) / 2.4; drop.position.set(POOL.x + 0.3, 4.3 - Math.min(1, dp / 0.28) ** 2 * 4.25, POOL.z - 0.2); drop.visible = dp < 0.28;
      for (const [r, off] of [[ripple, 0.28], [ripple2, 0.42]] as const) { const k = THREE.MathUtils.clamp((dp - off) / 0.6, 0, 1); r.scale.setScalar(0.08 + k * 0.7); (r.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.45 * (k > 0 ? 1 : 0); }
      (g.userData.motes as THREE.Points).rotation.y = time * 0.01;
    },
  };
}
export type CaveInterior = ReturnType<typeof makeCaveInterior>;
