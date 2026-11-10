import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triplanar } from './landmarks';
import type { GroundTex } from './terrain';

/** The Listening Pools: the sea cave beyond the Tidewrack Coast's cave mouth (Chapter II, part 3). Its own scene at a far origin. */
export const SEA_O = { x: 3000, z: 3000 };
export const SEA_XP = 45;
export const SEA_PERIOD = 22;
const SHELL_Y = -0.42; // a lamp-shell is under water when the chamber's tide is above this
const CX = -13, RX = 19, RZ = 11.5, RY = 8.5; // chamber ellipsoid (centre x, radii)
const POOLS = [{ x: -5.5, z: -4.2 }, { x: -13, z: 4.6 }, { x: -21, z: -3.4 }];
const DOOR = { x: -32.6, z: 0 };
const RXW = RX + 3.6; // the west half of the chamber is longer: the seal stands in a deep apse
const rxOf = (c: number) => (c < 0 ? RXW : RX);

export const SEA_LINES = {
  arrive: 'The Listening Pools · the sea breathes in and out of the dark',
  shellCovered: 'A lamp-shell sleeps under the water. The Tide-Glass light cannot reach it through the sea — wait for the ebb.',
  shellLit: (n: number) => `The lamp-shell drinks the Tide-Glass light and answers, blue · ${n}/3`,
  shellAlready: 'This shell already burns. Wake the others before the tide returns.',
  reset: 'The tide comes back over the shells and takes their light with it. Wake all three in one ebb.',
  solved: [
    'The third shell catches. For a breath all three burn together, and their light runs across the wet floor like a tide going the wrong way —',
    '— west, into the great round seal. Three of its seven rings wake and hold. Beside the seal, in a crack above the waterline, something pale: oilcloth.',
  ],
  sealShut: [
    'A round seal of tide-worn stone, taller than the Lowtide Lamp. Seven rings of glyphs, salt-white.',
    'The stone is warm. On the other side, very far down, something is very patient.',
  ],
  sealWoken: ['Three of the seven rings burn blue. The other four stay dark — this door wants a second key.', 'Through the stone you feel a slow turning, like a tide deciding which way to go.'],
  page: (name: string) => [
    'An oilcloth packet, tucked in a crack beside the seal. Enna’s hand — hurried, salt-stained:',
    `“${name} — if the shells let you in, you have the glass and the patience. Good.”`,
    '“The custodians never sealed the second seam. They drowned it, and left a keeper in the water to keep it drowned. It is still keeping.”',
    '“When the shells woke I heard it turn over, the way a tide turns. I am going round by the old lamp-roads to find this seal’s other key. Do not open the door alone.” — E. M.',
  ],
  pageAgain: ['Enna’s page, dry now in your journal. “Do not open the door alone.”'],
  card: { k: 'Chapter II · the sealed chamber', title: 'The Drowned Keeper', tease: 'Behind the round seal, something vast keeps the second seam under water. Enna has gone for the seal’s other key. The door opens in the next chapter.' },
};

const sh = (x: number, z: number) => { // floor height (local), shared with GLSL below
  let h = 0.12 * Math.sin(x * 0.45 + z * 0.3) + 0.08 * Math.sin(z * 0.9 - x * 0.2) + 0.15;
  for (const p of POOLS) { const d = Math.hypot(x - p.x, z - p.z); h -= 1.25 * Math.max(0, 1 - (d / 3.1) ** 2); }
  const w = Math.max(0, (-(x - CX) - 13.5) / 3); h -= 1.6 * Math.min(1, w); // the seal pool at the west end
  return h;
};
const SHG = `float seaH(vec2 p){ float h=.12*sin(p.x*.45+p.y*.3)+.08*sin(p.y*.9-p.x*.2)+.15;
  ${POOLS.map((p) => `{ float d=length(p-vec2(${p.x.toFixed(2)},${p.z.toFixed(2)})); h-=1.25*max(0.,1.-(d/3.1)*(d/3.1)); }`).join('')}
  float w=max(0.,(-(p.x-(${CX.toFixed(1)}))-13.5)/3.); h-=1.6*min(1.,w); return h; }`;

function rockBlob(r: number, rnd: () => number, sx = 1, sy = 1, sz = 1, detail = 2) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv')); const p = g.attributes.position as THREE.BufferAttribute; const o = rnd() * 10;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.18 * Math.sin(x * 1.3 + o) * Math.sin(y * 1.7 - o) + 0.07 * Math.sin(z * 3.1 + y * 2.3); p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz); }
  g.computeVertexNormals(); return g;
}
const gradTex = (stops: [number, string][], w = 4, h = 128, radial = false) => { const c = document.createElement('canvas'); c.width = radial ? 128 : w; c.height = h; const x = c.getContext('2d')!;
  const gr = radial ? x.createRadialGradient(64, 64, 0, 64, 64, 64) : x.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) gr.addColorStop(o, col); x.fillStyle = gr; x.fillRect(0, 0, c.width, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function makeSeaCave(high: boolean, t: { rock: GroundTex; bed: GroundTex; blocks: GroundTex }, waterNormals: THREE.Texture, env: THREE.Texture | null) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020607');
  scene.fog = new THREE.FogExp2('#04100f', high ? 0.034 : 0.04);
  if (env) { scene.environment = env; scene.environmentIntensity = 0.05; }
  scene.add(new THREE.HemisphereLight('#4f7f86', '#120e0a', 0.22));
  const g = new THREE.Group(); g.position.set(SEA_O.x, 0, SEA_O.z); scene.add(g);
  let seed = 41; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const L = (x: number, z: number) => ({ x: x + SEA_O.x, z: z + SEA_O.z });
  // Cold daylight through cracks in the roof (shadows on High only).
  const moon = new THREE.DirectionalLight('#a9d4ff', 0.75); moon.position.set(SEA_O.x - 6, 30, SEA_O.z + 4); moon.target.position.set(SEA_O.x - 12, 0, SEA_O.z); scene.add(moon, moon.target);
  if (high) { moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, near: 1, far: 60 }); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.05; }
  const glassLight = new THREE.PointLight('#7fd2ff', 1.3, 9, 1.6); scene.add(glassLight); // Ilka's Tide-Glass glow, follows her
  const rock = triplanar(t.rock, 3.0, '#8e8a84', { rough: 0.52, sat: 0.5 }), wetRock = triplanar(t.rock, 1.3, '#a39a90', { rough: 0.5, sat: 0.55 }), floorM = triplanar(t.bed, 1.4, '#5e5b55', { rough: 0.34, sat: 0.7 });
  // Dome: noise-displaced half-ellipsoid seen from inside (winding flipped so the triplanar normals face in).
  { const d = new THREE.SphereGeometry(1, high ? 80 : 56, high ? 32 : 22, 0, Math.PI * 2, 0, Math.PI / 2 + 0.16); const p = d.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.6 * Math.sin(x * 5.1 + z * 2.3) * Math.cos(y * 4.7 - x * 1.9) + 0.3 * Math.sin(z * 11 + y * 9) + 0.15 * Math.sin(x * 23 + y * 17); p.setXYZ(i, CX + x * (rxOf(x) + n * 1.3), y * RY + n * 0.7 * y - 0.6, z * (RZ + n * 1.1)); }
    const ix = d.index!.array as Uint16Array | Uint32Array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; } d.computeVertexNormals();
    const m = new THREE.Mesh(d, rock); m.receiveShadow = true; g.add(m); }
  // Floor with three pools and the seal pool.
  { const f = new THREE.PlaneGeometry(RX + RXW + 4, 2 * RZ + 4, high ? 156 : 100, high ? 90 : 56); f.rotateX(-Math.PI / 2); f.translate(CX - (RXW - RX) / 2, 0, 0); const p = f.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, sh(p.getX(i), p.getZ(i))); f.computeVertexNormals(); const m = new THREE.Mesh(f, floorM); m.receiveShadow = true; g.add(m); }
  // Boulders, pool rims, shell pedestals, stalactites.
  const solids: { x: number; z: number; r: number }[] = [];
  { const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (high ? 46 : 30); i++) { const a = rnd() * Math.PI * 2, e = 0.82 + rnd() * 0.15; const x = CX + Math.cos(a) * rxOf(Math.cos(a)) * e, z = Math.sin(a) * RZ * e; if (x > 2) continue; const r = 0.6 + rnd() * 1.6; parts.push(rockBlob(r, rnd, 1, 0.7, 1).translate(x, sh(x, z) + r * 0.2, z)); }
    for (const pl of POOLS) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + rnd(), x = pl.x + Math.cos(a) * 3.3, z = pl.z + Math.sin(a) * 3.3; parts.push(rockBlob(0.35 + rnd() * 0.35, rnd, 1, 0.55, 1, 1).translate(x, sh(x, z) + 0.05, z)); }
    for (const pl of POOLS) { parts.push(rockBlob(0.75, rnd, 1.1, 0.45, 1, 2).translate(pl.x, SHELL_Y - 0.25, pl.z)); }
    const m = new THREE.Mesh(mergeGeometries(parts), wetRock); m.castShadow = m.receiveShadow = true; g.add(m);
    const st: THREE.BufferGeometry[] = []; for (let i = 0; i < (high ? 70 : 40); i++) { const x = CX + (rnd() - 0.5) * RX * 1.6, z = (rnd() - 0.5) * RZ * 1.5; const e = ((x - CX) / RX) ** 2 + (z / RZ) ** 2; if (e > 0.8) continue; const y = RY * Math.sqrt(Math.max(0.05, 1 - e)) - 0.9; const h = 0.6 + rnd() * 2.2; const c = new THREE.ConeGeometry(0.12 + rnd() * 0.22, h, 6, 3); c.rotateX(Math.PI); c.translate(x, y - h / 2 + 0.3, z); st.push(c); }
    const sm = new THREE.Mesh(mergeGeometries(st), wetRock); g.add(sm); }
  // Glow-lichen: bioluminescent flecks on the lower walls, two pulsing sets.
  const lichenMats = [new THREE.MeshBasicMaterial({ color: '#2fe0c8', fog: true }), new THREE.MeshBasicMaterial({ color: '#4aa8ff', fog: true })];
  { const blob = new THREE.IcosahedronGeometry(0.06, 0); blob.scale(1, 0.5, 1); const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    for (let set = 0; set < 2; set++) { const n = high ? 420 : 240; const im = new THREE.InstancedMesh(blob, lichenMats[set], n); let c = 0;
      for (let i = 0; i < n * 3 && c < n; i++) { const a = rnd() * Math.PI * 2, y = 0.1 + rnd() ** 1.6 * 3.2; const e = Math.sqrt(Math.max(0.02, 1 - ((y + 0.6) / RY) ** 2)) * 0.985; const x = CX + Math.cos(a) * rxOf(Math.cos(a)) * e, z = Math.sin(a) * RZ * e; if (x > 1) continue;
        const near = POOLS.some((p) => Math.hypot(p.x - x, p.z - z) < 9) || x < -26; if (!near && rnd() < 0.6) continue;
        q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)); s.setScalar(0.5 + rnd() * 1.6); mtx.compose(v.set(x, y, z), q, s); im.setMatrixAt(c++, mtx); }
      im.count = c; im.frustumCulled = false; g.add(im); } }
  // Light shafts from roof cracks (additive, kept out of the AO pass on layer 1) and their pools of light on the floor.
  const spotTex = gradTex([[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']], 4, 128, true);
  const shafts: THREE.Mesh[] = [];
  // Soft volumetric look: brightness falls off toward the silhouette (view-facing normals) and toward both ends.
  const shaftMat = new THREE.ShaderMaterial({ uniforms: { uOp: { value: 0.16 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uOp; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float e = smoothstep(0.,.35,vY) * smoothstep(1.,.6,vY); gl_FragColor = vec4(vec3(.62,.82,1.) * f * e * uOp * 0.85, 1.); }' });
  for (const [x, z, r] of [[-8.5, 1.5, 1.4], [-17, -1.2, 1.9], [-24, 3.4, 1.2]] as const) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r, 9.5, 20, 1, true), shaftMat);
    c.position.set(x, 4.2, z); c.rotation.z = 0.12; c.layers.set(1); c.renderOrder = 3; g.add(c); shafts.push(c);
    const sp = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 24), new THREE.MeshBasicMaterial({ color: '#bfe6ff', map: spotTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.rotation.x = -Math.PI / 2; sp.position.set(x - 0.6, sh(x, z) + 0.04, z); sp.layers.set(1); g.add(sp); }
  // Lamp-shells: ridged fan shells on wet pedestals in each pool.
  const shellMats = POOLS.map(() => { const m = new THREE.MeshStandardMaterial({ color: '#d9e4e0', roughness: 0.35, metalness: 0.1, emissive: '#39d6ff', emissiveIntensity: 0.04 }); return m; });
  const haloTex = gradTex([[0, 'rgba(160,240,255,1)'], [0.35, 'rgba(70,200,255,0.35)'], [1, 'rgba(40,160,255,0)']], 4, 128, true);
  const halos: THREE.Sprite[] = [];
  POOLS.forEach((pl, i) => { const sg = new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); const p = sg.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const a = Math.atan2(z, x); const rib = 1 + 0.08 * Math.cos(a * 9); p.setXYZ(k, x * rib, y * 0.9, z * rib * 1.2); } sg.computeVertexNormals();
    const m = new THREE.Mesh(sg, shellMats[i]); m.position.set(pl.x, SHELL_Y + 0.02, pl.z); m.rotation.set(-0.5, i * 1.3, 0); m.castShadow = true; g.add(m);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#7fe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); h.scale.setScalar(2.6); h.position.set(pl.x, SHELL_Y + 0.5, pl.z); h.layers.set(1); g.add(h); halos.push(h); });
  // The round seal (Chapter II arena door) set into the west wall, with seven glyph rings.
  const ringsTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const glyphs = '◎⁘≈◇△☽✶'; for (let r = 0; r < 7; r++) { const R = 46 + r * 30; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, R, 0, Math.PI * 2); x.stroke(); x.font = `${16 + r}px serif`; const n = 6 + r * 3; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + r * 0.4; x.fillText(glyphs[(k + r) % 7], 256 + Math.cos(a) * (R + 14), 256 + Math.sin(a) * (R + 14)); } }
    x.font = '64px serif'; x.fillText('≈', 256, 258); const t2 = new THREE.CanvasTexture(c); return t2; })();
  const sealMat = triplanar(t.blocks, 2.4, '#b5ad9e', { sat: 0.4 }); sealMat.emissive = new THREE.Color('#4fd8ff'); sealMat.emissiveMap = ringsTex; sealMat.emissiveIntensity = 0.04;
  const sealY = 4.1;
  { const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.9, 64), sealMat); disc.rotation.z = Math.PI / 2; disc.rotation.x = Math.PI / 2; disc.position.set(DOOR.x - 0.2, sealY, DOOR.z);
    // CylinderGeometry caps face ±Y; after rotation.z = π/2 they face ±X. Fix UVs so the glyph texture lands on the +X cap.
    disc.castShadow = disc.receiveShadow = true; g.add(disc);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.55, 10, 48), wetRock); fr.rotation.y = Math.PI / 2; fr.position.copy(disc.position).add(new THREE.Vector3(0.25, 0, 0)); fr.castShadow = true; g.add(fr);
    const mass = new THREE.Mesh(rockBlob(7.5, rnd, 0.7, 1.15, 1.2, 3), rock); mass.position.set(DOOR.x - 4.2, 4, DOOR.z); g.add(mass);
    // ledge across the seal pool to the door
    const ledge = new THREE.Mesh(rockBlob(1.6, rnd, 2.2, 0.35, 1.0, 2), wetRock); ledge.position.set(DOOR.x + 3.0, -0.2, 1.4); ledge.receiveShadow = true; g.add(ledge); }
  const sealPulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#3fb8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sealPulse.scale.setScalar(5); sealPulse.position.set(DOOR.x + 0.35, sealY, DOOR.z); sealPulse.layers.set(1); g.add(sealPulse);
  // Enna's packet: oilcloth bundle + a small lamp, on a dry shelf beside the seal (appears once the shells answer).
  const PAGE = { x: DOOR.x + 2.3, z: 2.9 };
  const packet = new THREE.Group(); packet.position.set(PAGE.x, 0.55, PAGE.z); g.add(packet);
  { const shelf = new THREE.Mesh(rockBlob(0.8, rnd, 1.2, 0.5, 1, 2), wetRock); shelf.position.set(0, -0.35, 0); packet.add(shelf);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#c8b48a', roughness: 0.8 })); cloth.position.set(0, 0.1, 0); cloth.rotation.y = 0.4; packet.add(cloth);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: '#2a3a3a', emissive: '#7fe8ff', emissiveIntensity: 1.6 })); lamp.position.set(0.32, 0.16, -0.1); packet.add(lamp); }
  packet.visible = false;
  // The way back: a pale glow at the east entrance.
  const EXIT = { x: 1.2, z: 0 };
  { const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 5), new THREE.MeshBasicMaterial({ color: '#cfe6ee', map: gradTex([[0, 'rgba(255,255,255,0.15)'], [0.6, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0.9)']]), transparent: true, fog: false })); glow.rotation.y = -Math.PI / 2; glow.position.set(CX + RX - 0.3, 1.8, 0); g.add(glow); }
  // Chamber water: one level for the whole cave, breathing with the sea; depth-aware colour, alpha and bioluminescence that stirs near Ilka and the lit shells.
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const uLev = { value: -0.5 }, uTime = { value: 0 }, uPl = { value: new THREE.Vector3() }, uLit = { value: new THREE.Vector3() };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(RX + RXW, 2 * RZ, 1, 1).rotateX(-Math.PI / 2).translate(CX - (RXW - RX) / 2, 0, 0), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uLev, uTime, uPl, uLit, uNor: { value: waterNormals } },
    vertexShader: 'uniform float uLev; varying vec3 vW; varying vec2 vL; void main(){ vec3 p=position; p.y=uLev; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; vL=p.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uLev,uTime; uniform vec3 uPl,uLit; uniform sampler2D uNor; varying vec3 vW; varying vec2 vL;
${SHG}
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){ float depth=uLev-seaH(vL); if(depth<0.) discard;
  vec3 n1=texture2D(uNor,vL*.18+vec2(uTime*.02,uTime*.013)).xyz*2.-1., n2=texture2D(uNor,vL*.43-vec2(uTime*.017,-uTime*.01)).xyz*2.-1.; vec3 n=normalize(vec3(0,1,0)+vec3(n1.x+n2.x,0.,n1.y+n2.y)*.22);
  vec3 v=normalize(cameraPosition-vW); float fres=.03+.97*pow(1.-max(dot(n,v),0.),5.);
  vec3 body=mix(vec3(.04,.16,.15),vec3(.006,.03,.04),smoothstep(.05,1.4,depth));
  vec3 refl=mix(vec3(.02,.05,.06),vec3(.25,.42,.48),smoothstep(.0,.6,reflect(-v,n).y))*.6;
  vec3 col=mix(body,refl,fres);
  // bioluminescent motes: sparse cells that brighten near Ilka (wading stirs them) and around lit shells
  vec2 cell=floor(vL*6.); float h=hash(cell); vec2 f=fract(vL*6.)-.5; float dot1=smoothstep(.12,.0,length(f-vec2(hash(cell+3.)-.5,hash(cell+7.)-.5)*.6));
  float stir=1.-smoothstep(0.,3.2,length(vW.xz-uPl.xz)); float tw=.5+.5*sin(uTime*2.+h*30.);
  float glow=dot1*step(.82,h)*(.12+stir*1.6+uLit.x)*tw;
  col+=vec3(.2,.95,1.)*glow; col+=vec3(.02,.12,.14)*uLit.x*smoothstep(1.5,0.,depth);
  float a=clamp(smoothstep(0.,.25,depth)*.85+fres*.3,0.,.96); float edge=1.-smoothstep(0.,.08,depth); col=mix(col,vec3(.55,.7,.72),edge*.5);
  gl_FragColor=vec4(col,max(a,edge*.6));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` }));
  water.position.set(0, 0, 0); water.renderOrder = 2; water.userData.noAO = true; g.add(water);
  // ---------- state ----------
  let tideT = 5, lev = -0.5; const lit = [false, false, false]; let litK = [0, 0, 0], solvedK = 0, solved = false;
  const level = (tt: number) => -0.55 + 0.55 * Math.cos((2 * Math.PI * tt) / SEA_PERIOD);
  const ellipse = (x: number, z: number, sh2 = 0) => ((x - CX) / (rxOf(x - CX) - 2.2 - sh2)) ** 2 + (z / (RZ - 2.0 - sh2)) ** 2;
  const W = (x: number, z: number) => new THREE.Vector3(x + SEA_O.x, 0, z + SEA_O.z);
  const exV = new THREE.Vector3();
  return {
    scene, entry: L(EXIT.x - 2.2, 0), exit: L(EXIT.x, EXIT.z), shells: POOLS.map((p) => L(p.x, p.z)), door: L(DOOR.x + 1.6, DOOR.z), page: L(PAGE.x, PAGE.z),
    get level() { return lev; }, get tidePhase() { const d = -Math.sin((2 * Math.PI * tideT) / SEA_PERIOD); return lev < SHELL_Y ? (d > 0 ? 'ebbing' : 'turning') : d > 0 ? 'falling' : 'rising'; },
    isLow() { return lev < SHELL_Y; }, get lit() { return lit.slice(); }, get solved() { return solved; },
    /** Wake shell i with the Tide-Glass. */
    light(i: number): 'covered' | 'already' | 'lit' | 'solved' { if (solved) return 'already'; if (lev >= SHELL_Y) return 'covered'; if (lit[i]) return 'already'; lit[i] = true; if (lit.every(Boolean)) { solved = true; return 'solved'; } return 'lit'; },
    setSolved(on: boolean, instant = false) { solved = on; for (let i = 0; i < 3; i++) lit[i] = on; if (instant) { solvedK = on ? 1 : 0; litK = lit.map((l) => (l ? 1 : 0)); } },
    setPacket(on: boolean) { packet.visible = on; },
    groundY(wx: number, wz: number) { const x = wx - SEA_O.x, z = wz - SEA_O.z; return Math.max(sh(x, z), Math.hypot(x - (DOOR.x + 3), z - 1.4) < 3.05 ? 0.25 : -9); },
    constrain(wx: number, wz: number): [number, number] {
      let x = wx - SEA_O.x, z = wz - SEA_O.z; const e = Math.sqrt(ellipse(x, z)); if (e > 1) { x = CX + (x - CX) / e; z /= e; }
      x = Math.min(x, EXIT.x + 0.4); if (x < DOOR.x + 1.4) x = DOOR.x + 1.4;
      { const lx = DOOR.x + 3, lz = 1.4, d = Math.hypot(x - lx, z - lz); // past x = −27 the seal pool is deep: only the ledge crosses it
        if (x < -27 && d > 3.0) { const toLine = -27 - x, toLedge = d - 3.0; if (toLine <= toLedge) x = -27; else { x = lx + (x - lx) / d * 3.0; z = lz + (z - lz) / d * 3.0; } } }
      return [x + SEA_O.x, z + SEA_O.z];
    },
    clampCam(target: THREE.Vector3, cam: THREE.Vector3) {
      const inside = (v: THREE.Vector3) => { const x = v.x - SEA_O.x, z = v.z - SEA_O.z; if (v.y < Math.max(sh(x, z), lev) + 0.4) return false; return ((x - CX) / (rxOf(x - CX) - 1.4)) ** 2 + ((v.y + 0.6) / (RY - 1.2)) ** 2 + (z / (RZ - 1.4)) ** 2 < 1 && x > DOOR.x + 0.8; };
      if (inside(cam)) return; let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; exV.lerpVectors(target, cam, m); if (inside(exV)) lo = m; else hi = m; } cam.lerpVectors(target, cam, Math.max(0.15, lo * 0.95));
    },
    /** Advance the chamber tide and effects. Returns 'reset' when the tide drowns a partial set of lit shells. */
    update(time: number, dt: number, player: THREE.Vector3): 'reset' | null {
      tideT += dt; lev = level(tideT); uLev.value = lev; uTime.value = time; uPl.value.copy(player).sub(g.position);
      glassLight.position.set(player.x, player.y + 1.5, player.z);
      let ev: 'reset' | null = null;
      if (!solved && lit.some(Boolean) && lev > SHELL_Y + 0.02) { for (let i = 0; i < 3; i++) lit[i] = false; ev = 'reset'; }
      for (let i = 0; i < 3; i++) { litK[i] += ((lit[i] ? 1 : 0) - litK[i]) * Math.min(1, dt * (lit[i] ? 3 : 1.5)); shellMats[i].emissiveIntensity = 0.04 + litK[i] * 2.4 + (solved ? 0.25 * Math.sin(time * 1.3 + i) : 0); (halos[i].material as THREE.SpriteMaterial).opacity = litK[i] * (0.75 + 0.15 * Math.sin(time * 2 + i)); }
      solvedK += ((solved ? 1 : 0) - solvedK) * Math.min(1, dt * 0.8); sealMat.emissiveIntensity = 0.04 + solvedK * (0.85 + 0.25 * Math.sin(time * 0.6));
      (sealPulse.material as THREE.SpriteMaterial).opacity = solvedK * 0.25 * (0.5 + 0.5 * Math.sin(time * 0.45)); uLit.value.x = (litK[0] + litK[1] + litK[2]) / 3 * 0.6;
      lichenMats[0].color.setRGB(0.12, 0.62 + 0.25 * Math.sin(time * 0.9), 0.52 + 0.2 * Math.sin(time * 0.9)); lichenMats[1].color.setRGB(0.18, 0.42 + 0.2 * Math.sin(time * 0.7 + 2), 0.85);
      shaftMat.uniforms.uOp.value = 0.14 + 0.03 * Math.sin(time * 0.5);
      return ev;
    },
    W,
  };
}
export type SeaCave = ReturnType<typeof makeSeaCave>;
