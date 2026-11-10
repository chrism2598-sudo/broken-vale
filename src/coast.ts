import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triplanar } from './landmarks';
import type { GroundTex } from './terrain';

/** Chapter II, part 2 — the Tidewrack Coast beyond the western hills, reached by the water-road out of the ruin. */
export const COAST_O = { x: 2000, z: 2000 }; // own scene, far outside the vale's coordinates
export const COAST_XP = 30;
export const TIDE_PERIOD = 24; // seconds per tide cycle (game time)
export const COAST_LINES = {
  arrive: 'Tidewrack Coast · the water-road comes out above the sea',
  shrineHigh: 'The Tide-Glass clouds over. The sea stands too high to remember the way — wait for the ebb.',
  reveal: [
    'You raise Enna’s Tide-Glass over the tide-shrine. Through it, the low water turns clear as a window.',
    'A line of old custodian stones shows beneath the shallows — and the sea draws back from them, as if it has been asked politely.',
    'The causeway to the sea cave is open.',
  ],
  revealed: 'The sea keeps the causeway clear. The Tide-Glass is quiet.',
  lamp: [
    'The Lowtide Lamp · kept by the custodians of the second sky.',
    '“When the Break came, one seam ran across the heavens. The other ran under the water. We lit this lamp so no ship would sail over it.”',
    'The lamp has been dark a long time. Someone has wiped the salt from this stone, not long ago.',
  ],
  seaCave: (reward: boolean) => [
    'The sea cave breathes cold air that smells of rain, not salt.',
    'Deep inside, under the waterline, a thin seam of light runs through the rock like a second horizon. The Tide-Glass hums against it.',
    'Scratched into the arch in Enna’s hand: “The custodians tied one sky shut. The sea has been holding the other open. I have gone down to see how. — E. M.”',
    reward ? `+${COAST_XP} XP · Chapter II: The Second Seam — to be continued.` : 'The seam glows on below the water. Chapter II continues…',
  ],
  card: { k: 'Chapter II · to be continued', title: 'The Second Seam', tease: 'Beneath the Tidewrack Coast the second seam answers the Tide-Glass. Enna went down. The tide will turn again.' },
};

// ---------- shared shape: coast height field (local metres; sea to the west, -x) ----------
const SH = `
float shoreX(float z){ float a=abs(z); return -4.+5.*sin(z*.045+.6)+2.*sin(z*.11)-26.*smoothstep(40.,62.,a); }
float coastH(vec2 p){ float x=p.x, z=p.y; float d=x-shoreX(z);
  float h = d<0. ? d*.16-max(0.,-d-18.)*.3 : (d<14. ? d*.11 : 1.54+(d-14.)*.18);
  float n = .6*sin(x*.21+z*.13)*sin(z*.17-x*.07)+.3*sin(x*.5+1.3)*sin(z*.43);
  h += n*smoothstep(4.,14.,d) + .25*n*smoothstep(-2.,-10.,d);
  h += 21.*smoothstep(31.,38.,x+1.5*sin(z*.2));
  float a=abs(z); h += 15.*smoothstep(43.,55.,a)*smoothstep(-3.,6.,d);
  return max(h,-14.); }`;
function shoreX(z: number) { const a = Math.abs(z); return -4 + 5 * Math.sin(z * 0.045 + 0.6) + 2 * Math.sin(z * 0.11) - 26 * ss(40, 62, a); }
function ss(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export function coastH(x: number, z: number) {
  const d = x - shoreX(z);
  let h = d < 0 ? d * 0.16 - Math.max(0, -d - 18) * 0.3 : d < 14 ? d * 0.11 : 1.54 + (d - 14) * 0.18;
  const n = 0.6 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.07) + 0.3 * Math.sin(x * 0.5 + 1.3) * Math.sin(z * 0.43);
  h += n * ss(4, 14, d) + 0.25 * n * ss(-2, -10, d);
  h += 21 * ss(31, 38, x + 1.5 * Math.sin(z * 0.2));
  const a = Math.abs(z); h += 15 * ss(43, 55, a) * ss(-3, 6, d);
  return Math.max(h, -14);
}
// Sky: warm dawn horizon behind (east), soft blue overhead and to the west. Shared by the sky dome and the sea's reflections.
const SKY = `
uniform vec3 uSunDir;
vec3 HOR = vec3(.86,.72,.64);
vec3 skyCol(vec3 d){ float y=max(d.y,0.); float e=max(dot(normalize(vec3(d.x,0.,d.z)+1e-4),normalize(vec3(uSunDir.x,0.,uSunDir.z))),0.);
  vec3 hor=mix(vec3(.62,.66,.74),vec3(1.02,.74,.56),pow(e,2.)); vec3 zen=vec3(.26,.42,.70);
  vec3 c=mix(hor,zen,pow(y,.5)); float s=max(dot(d,uSunDir),0.);
  c+=vec3(1.,.62,.34)*(pow(s,6.)*.35+pow(s,48.)*.7); c+=vec3(3.,2.4,1.8)*smoothstep(.9994,.99975,s);
  float cl=sin(d.x*9.+d.z*3.)*sin(d.z*11.-d.x*2.)*.5+.5; c=mix(c,c*1.08+vec3(.05,.03,.02),smoothstep(.55,.9,cl)*smoothstep(.02,.12,y)*smoothstep(.5,.15,y)*.6);
  if(d.y<0.) c=mix(hor,hor*.82,min(1.,-d.y*3.)); return c; }`;
const SNU = new THREE.Vector3(), SNV = new THREE.Vector3(), SNY = new THREE.Vector3(0, 1, 0);
export const COAST_SUN = new THREE.Vector3(-0.55, 0.42, -0.72).normalize(); // afternoon sun over the sea to the south-west: a glitter path off the left of the view

function rnd0(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function blob(r: number, rnd: () => number, sx = 1, sy = 1, sz = 1, detail = 3) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv')); const p = g.attributes.position as THREE.BufferAttribute; const o = rnd() * 10;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.16 * Math.sin(x * 0.7 + o) * Math.sin(y * 0.9 - o) + 0.08 * Math.sin(z * 2.1 + y * 1.7) + 0.05 * Math.sin(x * 4.3 + z * 3.9) + 0.035 * Math.sin(y * 2.6 + 0.4 * Math.sin(x * 1.3)); p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz); }
  g.computeVertexNormals(); return g;
}

/** Procedural surf: filtered noise swelling on a slow wave rhythm (WebAudio, started on a user gesture). */
class Surf {
  ctx: AudioContext | null = null; out: GainNode | null = null;
  start() {
    try {
      if (!this.ctx) {
        const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!C) return;
        const ctx = new C(), len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        let b = 0; for (let i = 0; i < len; i++) { b = 0.985 * b + 0.15 * (Math.random() * 2 - 1); d[i] = b; }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        const swell = ctx.createGain(); swell.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.value = 1 / 7; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(swell.gain);
        const out = ctx.createGain(); out.gain.value = 0; src.connect(lp).connect(swell).connect(out).connect(ctx.destination); src.start(); lfo.start();
        this.ctx = ctx; this.out = out;
      }
      void this.ctx.resume(); this.out!.gain.setTargetAtTime(0.22, this.ctx.currentTime, 1.2);
    } catch { /* audio is optional */ }
  }
  stop() { try { if (this.ctx && this.out) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } catch { /* */ } }
}

export function makeCoast(high: boolean, t: { grass: GroundTex; pebble: GroundTex; rock: GroundTex; blocks: GroundTex }, waterNormals: THREE.Texture, env: THREE.Texture | null) {
  const scene = new THREE.Scene();
  const HORL = new THREE.Color().setRGB(0.86, 0.72, 0.64, THREE.LinearSRGBColorSpace);
  scene.fog = new THREE.FogExp2(HORL.clone(), high ? 0.0042 : 0.005);
  if (env) { scene.environment = env; scene.environmentIntensity = 0.55; }
  const sun = new THREE.DirectionalLight('#ffd2a8', 3.0); sun.castShadow = true; sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#bcd0e8', '#6a5a46', 0.55));
  const g = new THREE.Group(); g.position.set(COAST_O.x, 0, COAST_O.z); scene.add(g);
  const rnd = rnd0(41);
  const uSun = { value: COAST_SUN.clone() };
  // Sky dome (analytic, matches fog + sea reflections).
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSunDir: uSun },
    vertexShader: 'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: SKY + '\nvarying vec3 vD;void main(){gl_FragColor=vec4(skyCol(normalize(vD)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));
  sky.scale.setScalar(3000); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  // ---------- ground ----------
  const N = high ? 200 : 120, SIZE = 170;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, N, N); tg.rotateX(-Math.PI / 2); tg.translate(15, 0, 0);
  { const p = tg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setY(i, coastH(p.getX(i), p.getZ(i))); tg.computeVertexNormals(); }
  for (const s of [t.grass, t.pebble, t.rock]) { for (const tx of [s.diff, s.nor, s.arm]) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; } s.diff.colorSpace = THREE.SRGBColorSpace; }
  const uTide = { value: 0.2 };
  const gm = new THREE.MeshStandardMaterial({ roughness: 1 });
  gm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGd: { value: t.grass.diff }, tGn: { value: t.grass.nor }, tPd: { value: t.pebble.diff }, tPn: { value: t.pebble.nor }, tRd: { value: t.rock.diff }, tRn: { value: t.rock.nor }, tRa: { value: t.rock.arm }, uTide, uO: { value: new THREE.Vector2(COAST_O.x, COAST_O.z) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform sampler2D tGd,tGn,tPd,tPn,tRd,tRn,tRa; uniform float uTide; uniform vec2 uO;
${SH}
float vn2(vec2 p){return sin(p.x*1.3+sin(p.y*.7))*sin(p.y*1.1+sin(p.x*.9))*.5+.5;}
vec3 WG; vec2 TP;`)
      .replace('#include <map_fragment>', `
{ vec2 L=vWP.xz-uO; float slope=1.-clamp(vWN.y,0.,1.); float d=L.x-shoreX(L.y); float hh=vWP.y;
  float rk=smoothstep(.38,.62,slope+.12*(vn2(L*.3)-.5)); float gr=smoothstep(8.,12.,d+3.*(vn2(L*.17)-.5))*(1.-rk); float pb=max(0.,1.-rk-gr);
  WG=vec3(gr,pb,rk);
  vec3 W3=pow(abs(normalize(vWN)),vec3(4.)); W3/=dot(W3,vec3(1.)); vec3 P=vWP/5.;
  vec3 cr=(texture2D(tRd,P.zy)*W3.x+texture2D(tRd,P.xz)*W3.y+texture2D(tRd,P.xy)*W3.z).rgb; cr=mix(vec3(dot(cr,vec3(.3,.55,.15))),cr,.45)*vec3(.92,.9,.86);
  vec3 cg=texture2D(tGd,vWP.xz/3.2).rgb*mix(vec3(1.05,1.,.72),vec3(.9,1.,.8),vn2(L*.09));
  vec3 cp=texture2D(tPd,vWP.xz/2.2).rgb*vec3(1.02,.98,.92);
  vec3 c=cg*gr+cp*pb+cr*rk;
  float wet=1.-smoothstep(uTide+.05,uTide+.9,hh); c*=mix(1.,.55,wet); c=mix(c,c*vec3(.75,.85,.9),smoothstep(uTide,uTide-1.5,hh));
  diffuseColor.rgb=c; TP=vec2(wet,rk); }`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(mix(.95,.82,WG.y),.35,TP.x);`)
      .replace('#include <normal_fragment_maps>', `{ vec3 W3=pow(abs(normalize(vWN)),vec3(4.)); W3/=dot(W3,vec3(1.)); vec3 P=vWP/5.;
  vec3 tr=(texture2D(tRn,P.zy)*W3.x+texture2D(tRn,P.xz)*W3.y+texture2D(tRn,P.xy)*W3.z).xyz*2.-1.;
  vec3 tg2=texture2D(tGn,vWP.xz/3.2).xyz*2.-1.; vec3 tp=texture2D(tPn,vWP.xz/2.2).xyz*2.-1.;
  vec3 tn=tg2*WG.x+tp*WG.y*1.4+tr*WG.z; vec3 wn=normalize(vWN+vec3(tn.x,0.,tn.y)*.55);
  normal=normalize((viewMatrix*vec4(wn,0.)).xyz); }`);
  };
  gm.customProgramCacheKey = () => 'coastground';
  const ground = new THREE.Mesh(tg, gm); ground.receiveShadow = true; ground.castShadow = true; g.add(ground);
  const rockMat = triplanar(t.rock, 7.5, '#a9a59d', { rough: 0.92, sat: 0.4 }), blockMat = triplanar(t.blocks, 2.4, '#cbbca5', { sat: 0.55 }), darkBlock = triplanar(t.blocks, 2.4, '#8f8576', { sat: 0.5 });
  // ---------- sea stacks, the sea-cave stack and beach boulders ----------
  const stackGeos: THREE.BufferGeometry[] = [];
  const stack = (x: number, z: number, r: number, h: number) => { const b = blob(r, rnd, 1, h / r / 2, 1, high ? 5 : 4); b.translate(x, h / 2 - 10, z); stackGeos.push(b); };
  stack(-27, -33, 4.6, 34); stack(-58, -14, 6.5, 40); stack(-31, 46, 5.2, 30); stack(-70, 30, 5, 26);
  // Sea-cave stack: two flanks, a lintel and a back mass leave a dark arch facing the shore.
  const CAVE = { x: -38.2, z: 20 };
  stackGeos.push(blob(7.2, rnd, 1, 2.6, 1, 3).translate(-45, 7, 11.5), blob(7.2, rnd, 1, 2.4, 1, 3).translate(-45, 6, 28.5), blob(6.4, rnd, 1.1, 0.7, 0.85, 3).translate(-43.5, 10.5, 20), blob(8.5, rnd, 1, 2.2, 1.3, 3).translate(-54, 8, 20), blob(7, rnd, 1, 1.6, 1.25, 3).translate(-53, 13, 20));
  const stacks = new THREE.Mesh(mergeGeometries(stackGeos), rockMat); stacks.castShadow = stacks.receiveShadow = true; g.add(stacks);
  // The throat beyond the arch: a tapering tunnel whose vertex colour falls from wet rock to black, a glistening lip, and a faint teal glow far inside.
  { const len = 8, x0 = -39.4; const tg = new THREE.CylinderGeometry(1.5, 2.7, len, 28, 8, true); tg.rotateZ(Math.PI / 2); tg.scale(1, 1.5, 1); tg.translate(x0 - len / 2, 2.4, 20);
    const p = tg.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (x0 - p.getX(i)) / len)); const f = (1 - k) ** 2.2 * 0.05 + 0.0015; const wob = 1 + 0.25 * Math.sin(p.getY(i) * 3.1 + p.getZ(i) * 2.3); p.setY(i, p.getY(i) + 0.18 * Math.sin(p.getZ(i) * 2.7 + p.getX(i))); col[i * 3] = f * 0.8 * wob; col[i * 3 + 1] = f * 0.95 * wob; col[i * 3 + 2] = f * wob; }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const throat = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); throat.userData.noAO = true; g.add(throat);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), new THREE.MeshBasicMaterial({ color: '#000102', fog: false })); cap.scale.y = 1.5; cap.position.set(x0 - len + 0.1, 2.4, 20); cap.rotation.y = Math.PI / 2; g.add(cap);
    const lipG = new THREE.TorusGeometry(2.55, 0.26, 8, 40, Math.PI * 1.15); lipG.rotateZ(-0.075 * Math.PI); lipG.scale(1, 1.5, 1); const lp = lipG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) lp.setXYZ(i, lp.getX(i) * (1 + 0.06 * Math.sin(i * 1.7)), lp.getY(i), lp.getZ(i) * (1 + 0.5 * Math.sin(i * 0.9)));
    lipG.computeVertexNormals(); const lip = new THREE.Mesh(lipG, new THREE.MeshStandardMaterial({ color: '#57514a', roughness: 0.3, metalness: 0.0, envMapIntensity: 0.25 })); lip.rotation.y = Math.PI / 2; lip.position.set(x0 + 0.15, 2.4 - 0.2, 20); lip.castShadow = lip.receiveShadow = true; g.add(lip);
    const glowM = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(110,235,220,0.9)'); gr.addColorStop(1, 'rgba(40,160,180,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const gl = new THREE.Sprite(glowM); gl.scale.set(3.4, 2.6, 1); gl.position.set(x0 - len + 0.6, 1.4, 20); gl.layers.set(1); g.add(gl); }
  // shelf at the mouth (dry once the sea draws back)
  { const b = blob(3.2, rnd, 1.2, 0.25, 1.0, 2); b.translate(CAVE.x - 1.5, -0.25, CAVE.z); const m = new THREE.Mesh(b, rockMat); m.receiveShadow = true; g.add(m); }
  const bould: THREE.BufferGeometry[] = [];
  for (let i = 0; i < (high ? 60 : 34); i++) { const z = (rnd() - 0.5) * 84, d = rnd() < 0.6 ? -1 + rnd() * 9 : 22 + rnd() * 9, x = shoreX(z) + d; if (Math.abs(z - 14) < 4 && d < 4) continue; const r = d > 20 ? 0.8 + rnd() * 1.8 : 0.25 + rnd() * 0.7; const b = blob(r, rnd, 1, 0.65, 1.1, 1); b.translate(x, coastH(x, z) + r * 0.1, z); bould.push(b); }
  { const m = new THREE.Mesh(mergeGeometries(bould), rockMat); m.castShadow = m.receiveShadow = true; g.add(m); }
  // ---------- the Lowtide Lamp: ruined lighthouse + tide-shrine ----------
  const LZ = -30, LX = shoreX(LZ) + 10, LY = coastH(LX, LZ) - 0.4;
  { const tw = new THREE.CylinderGeometry(2.3, 2.9, 12, 20, 8, true); const p = tw.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); if (y > 5.9) p.setY(i, Math.max(4.7, y - (0.6 + 0.5 * Math.sin(a * 3 + 1) + 0.35 * Math.sin(a * 7)) * 1.0)); }
    tw.computeVertexNormals(); tw.translate(LX, LY + 6, LZ);
    const inner = tw.clone(); inner.scale(1, 1, 1); const ip = inner.index!.array as Uint16Array; for (let i = 0; i < ip.length; i += 3) { const t0 = ip[i + 1]; ip[i + 1] = ip[i + 2]; ip[i + 2] = t0; } inner.computeVertexNormals();
    const parts: THREE.BufferGeometry[] = [tw]; void inner;
    for (let k = 0; k < 3; k++) { const r = new THREE.TorusGeometry(2.75 - k * 0.15, 0.22, 6, 20); r.rotateX(Math.PI / 2); r.translate(LX, LY + 1.2 + k * 3.4, LZ); parts.push(r); }
    const m = new THREE.Mesh(mergeGeometries(parts.map((q) => q.index ? q.toNonIndexed() : q)), blockMat); m.material.side = THREE.DoubleSide; m.castShadow = m.receiveShadow = true; g.add(m);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: '#070606' })); const da = Math.atan2(-1, 0.25); door.position.set(LX + Math.cos(da) * -2.95 * 0 + -2.92, LY + 1.55, LZ + 0.6); door.rotation.y = -Math.PI / 2 + 0.2; g.add(door);
    const fall: THREE.BufferGeometry[] = []; for (let i = 0; i < 9; i++) { const b = new THREE.BoxGeometry(0.9 + rnd() * 0.6, 0.5, 0.7); b.rotateY(rnd() * 3); b.rotateX((rnd() - 0.5) * 0.6); const a = rnd() * 6.28, rr = 3.6 + rnd() * 3; const x = LX + Math.cos(a) * rr, z = LZ + Math.sin(a) * rr; b.translate(x, coastH(x, z) + 0.2, z); fall.push(b.toNonIndexed()); }
    const fm = new THREE.Mesh(mergeGeometries(fall), darkBlock); fm.castShadow = fm.receiveShadow = true; g.add(fm); }
  const SHRINE = { x: LX - 4.2, z: LZ + 3.2 };
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#fff'; for (let i = 0; i < 5; i++) { x.lineWidth = 6 - i; x.beginPath(); x.arc(128, 128, 26 + i * 22, 0, Math.PI * 2); x.stroke(); } x.fillStyle = '#fff'; x.font = '54px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('≈', 128, 130); return new THREE.CanvasTexture(c); })();
  const shrineMat = triplanar(t.blocks, 1.6, '#cfc2ac', { sat: 0.5 }); shrineMat.emissive = new THREE.Color('#7fd8ff'); shrineMat.emissiveMap = ringTex; shrineMat.emissiveIntensity = 0.05;
  const sy = coastH(SHRINE.x, SHRINE.z);
  { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.0, 12), blockMat); ped.position.set(SHRINE.x, sy + 0.5, SHRINE.z); ped.castShadow = ped.receiveShadow = true; g.add(ped);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.22, 24), shrineMat); top.position.set(SHRINE.x, sy + 1.1, SHRINE.z); top.castShadow = true; g.add(top);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 16), darkBlock); step.position.set(SHRINE.x, sy + 0.05, SHRINE.z); step.receiveShadow = true; g.add(step); }
  const LAMPSTONE = { x: LX - 3.2, z: LZ - 1.8 };
  { const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.9), darkBlock); s.position.set(LAMPSTONE.x, coastH(LAMPSTONE.x, LAMPSTONE.z) + 0.5, LAMPSTONE.z); s.rotation.y = 0.3; s.rotation.z = 0.08; s.castShadow = true; g.add(s); }
  // ---------- the causeway (custodian stones) ----------
  const path: [number, number][] = []; { const x0 = shoreX(14) - 0.5; const P0 = new THREE.Vector2(x0, 14), P1 = new THREE.Vector2(CAVE.x + 0.5, CAVE.z); for (let i = 0; i <= 22; i++) { const u = i / 22; path.push([P0.x + (P1.x - P0.x) * u + Math.sin(u * 6.28) * 1.2, P0.y + (P1.y - P0.y) * u + Math.sin(u * 3.14) * 3.5]); } }
  const TOP = -0.32; const stoneMat = triplanar(t.blocks, 2.0, '#b4a996', { sat: 0.5 });
  const stones = new THREE.Group(); g.add(stones);
  for (let i = 1; i < path.length; i++) { const [x, z] = path[i], hb = coastH(x, z), hgt = TOP - hb + 0.4; const b = new THREE.BoxGeometry(1.55 + rnd() * 0.3, hgt, 1.25 + rnd() * 0.2); b.translate(0, -hgt / 2, 0); const m = new THREE.Mesh(b, stoneMat); m.position.set(x, TOP, z); m.rotation.y = Math.atan2(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) + (rnd() - 0.5) * 0.25; m.castShadow = m.receiveShadow = true; m.userData.k = i; stones.add(m); }
  // ---------- the arrival tunnel in the east cliff ----------
  const TUN = { x: 31.2, z: 2 };
  { const ty = coastH(TUN.x - 1, TUN.z); const fr: THREE.BufferGeometry[] = [];
    for (const sz of [-1, 1]) { const b = new THREE.BoxGeometry(1.2, 4.4, 1.1); b.translate(TUN.x + 1.2, ty + 2.0, TUN.z + sz * 2.0); fr.push(b.toNonIndexed()); }
    for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; const b = new THREE.BoxGeometry(1.1, 0.7, 0.9); b.rotateX(-(a - Math.PI / 2)); b.translate(TUN.x + 1.2, ty + 4.2 + Math.sin(a) * 1.6, TUN.z + Math.cos(a) * 2.0); fr.push(b.toNonIndexed()); }
    const m = new THREE.Mesh(mergeGeometries(fr), blockMat); m.castShadow = m.receiveShadow = true; g.add(m);
    const dk = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.2), new THREE.MeshBasicMaterial({ color: '#050404' })); dk.position.set(TUN.x + 2.2, ty + 2.4, TUN.z); dk.rotation.y = -Math.PI / 2; g.add(dk); }
  // ---------- marram tufts on the headland ----------
  { const blade = new THREE.ConeGeometry(0.05, 0.9, 3, 1, true); blade.translate(0, 0.45, 0); const tuft: THREE.BufferGeometry[] = []; for (let k = 0; k < 7; k++) { const b = blade.clone(); b.rotateZ((rnd() - 0.5) * 0.9); b.rotateY(k * 0.9); b.scale(1, 0.6 + rnd() * 0.7, 1); tuft.push(b.toNonIndexed()); }
    const tg2 = mergeGeometries(tuft); const n = high ? 1400 : 600; const im = new THREE.InstancedMesh(tg2, new THREE.MeshStandardMaterial({ color: '#a7a565', roughness: 0.9 }), n); const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(); let c = 0;
    for (let i = 0; i < n * 3 && c < n; i++) { const z = (rnd() - 0.5) * 90, x = shoreX(z) + 7 + rnd() * 26; const h = coastH(x, z); if (h > 5.5) continue; const e = 0.01; const sl = Math.abs(coastH(x + 1, z) - h) + Math.abs(coastH(x, z + 1) - h); if (sl > 0.7) continue; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); s.setScalar(0.7 + rnd() * 0.8 + e); mtx.compose(pv.set(x, h - 0.05, z), q, s); im.setMatrixAt(c++, mtx); }
    im.count = c; im.castShadow = false; im.receiveShadow = true; g.add(im); }
  // ---------- gulls ----------
  const gulls: { o: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; r: number; h: number; s: number; c: [number, number]; ph: number }[] = [];
  { const bodyM = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 }), wingM = new THREE.MeshStandardMaterial({ color: '#d9dadb', roughness: 0.8, side: THREE.DoubleSide });
    const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, 0, 0.16, 0.95, 0.05, -0.05, 0, 0, 0.16, 0.95, 0.05, -0.05, 0.7, 0.04, 0.12], 3)); wingG.computeVertexNormals();
    for (let i = 0; i < 7; i++) { const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyM); b.scale.set(0.8, 0.8, 2.1); o.add(b); const wl = new THREE.Mesh(wingG, wingM), wr = new THREE.Mesh(wingG, wingM); wr.scale.x = -1; o.add(wl, wr); g.add(o);
      gulls.push({ o, wl, wr, r: 10 + rnd() * 22, h: 12 + rnd() * 14, s: (0.18 + rnd() * 0.15) * (rnd() < 0.5 ? -1 : 1), c: [i % 2 ? -40 : -20, (rnd() - 0.5) * 50], ph: rnd() * 6.28 }); } }
  // ---------- the sea ----------
  const grid = (() => { const n = high ? 200 : 110, R = 2600, pos: number[] = [], idx: number[] = []; const map = (u: number) => Math.sign(u) * R * (0.055 * Math.abs(u) + 0.945 * Math.abs(u) ** 3.2);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(map(i / n * 2 - 1), 0, map(j / n * 2 - 1));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.5); return geo; })();
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const fogD = (scene.fog as THREE.FogExp2).density;
  const seaMat = new THREE.ShaderMaterial({ transparent: true, fog: false,
    uniforms: { uTime: { value: 0 }, uTide, uSunDir: uSun, uNor: { value: waterNormals }, uO: { value: new THREE.Vector2(COAST_O.x, COAST_O.z) }, uFogD: { value: fogD }, uSunCol: { value: new THREE.Color().setRGB(1.0, 0.78, 0.58, THREE.LinearSRGBColorSpace) } },
    defines: { WAVES: high ? 4 : 2 },
    vertexShader: `uniform float uTime,uTide; uniform vec2 uO; varying vec3 vW; varying vec3 vN; varying float vCrest;
${SH}
void wave(vec2 p, vec2 dir, float wl, float st, float att, inout vec3 P, inout vec3 T, inout vec3 B){
  float k=6.2832/wl, c=sqrt(9.8/k); vec2 d=normalize(dir); float f=k*(dot(d,p)-c*uTime); float a=st*att/k;
  P+=vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
  T+=vec3(-d.x*d.x*st*att*sin(f), d.x*st*att*cos(f), -d.x*d.y*st*att*sin(f));
  B+=vec3(-d.x*d.y*st*att*sin(f), d.y*st*att*cos(f), -d.y*d.y*st*att*sin(f)); }
void main(){ vec3 w=(modelMatrix*vec4(position,1.)).xyz; vec2 L=w.xz-uO; float depth=uTide-coastH(L);
  float att=clamp(depth/3.5,.12,1.)*(1.-smoothstep(150.,420.,distance(w.xz,cameraPosition.xz)));
  vec3 P=vec3(w.x,uTide,w.z), T=vec3(1.,0.,0.), B=vec3(0.,0.,1.);
  wave(w.xz,vec2(1.,.12),23.,.15,att,P,T,B); wave(w.xz,vec2(.9,-.42),11.5,.13,att,P,T,B);
  #if WAVES > 2
  wave(w.xz,vec2(.75,.62),6.3,.10,att,P,T,B); wave(w.xz,vec2(1.,-.08),3.4,.07,att,P,T,B);
  #endif
  vN=normalize(cross(B,T)); vW=P; vCrest=(P.y-uTide)/(.6*att+.05);
  gl_Position=projectionMatrix*viewMatrix*vec4(P,1.); }`,
    fragmentShader: `uniform float uTime,uTide,uFogD; uniform vec2 uO; uniform sampler2D uNor; uniform vec3 uSunCol; varying vec3 vW; varying vec3 vN; varying float vCrest;
${SH}
${SKY}
void main(){ vec2 L=vW.xz-uO; float depth=uTide-coastH(L); float dist=distance(vW,cameraPosition);
  float det=1.-smoothstep(60.,260.,dist);
  vec3 t1=texture2D(uNor,vW.xz*.045+vec2(uTime*.018,uTime*.008)).xyz*2.-1.; vec3 t2=texture2D(uNor,vW.xz*.12-vec2(uTime*.012,-uTime*.021)).xyz*2.-1.;
  vec3 dn=vec3(t1.x+t2.x,0.,t1.y+t2.y);
  #if WAVES < 3
  vec3 t3=texture2D(uNor,vW.xz*.31+vec2(uTime*.024,-uTime*.017)).xyz*2.-1.; dn+=vec3(t3.x,0.,t3.y)*.8; // Lite: an extra fine layer stands in for the missing Gerstner octaves
  #endif
  vec3 n=normalize(normalize(vN)+dn*mix(.16,.38,float(WAVES<3))*det);
  vec3 v=normalize(cameraPosition-vW); float ndv=max(dot(n,v),0.); float fres=.02+.98*pow(1.-ndv,5.);
  vec3 r=reflect(-v,n); r.y=abs(r.y); vec3 refl=skyCol(r);
  vec3 deep=vec3(.018,.074,.094), shal=vec3(.055,.215,.2); vec3 body=mix(shal,deep,smoothstep(.2,7.,depth));
  body*=.55+.45*max(uSunDir.y+.4,0.); body+=vec3(.02,.09,.075)*clamp(vCrest,0.,1.)*(1.-smoothstep(1.,6.,depth));
  #if WAVES < 3
  body=mix(body,vec3(.008,.05,.078),.35); fres=min(fres*.75,.3+.2*(1.-det)); vec3 col=mix(body,mix(refl,vec3(.16,.34,.42),.4)*.72,fres); // Lite: deeper, less milky
  col+=vec3(.0,.03,.035)*smoothstep(.1,.5,t3.x+t1.y)*det; col*=.82+.36*clamp(.5+.6*(dn.x-dn.z),0.,1.)*(.4+.6*det); // ripple light/dark keeps the surface reading as moving water // glints of green in the troughs
  #else
  fres=min(fres,.62+.2*(1.-det)); vec3 col=mix(body,refl*.86,fres);
  #endif
  col+=uSunCol*pow(max(dot(r,uSunDir),0.),520.)*6.;
  float fn=texture2D(uNor,vW.xz*.21+vec2(uTime*.03,0.)).x*.5+.5;
  float band=sin(depth*7.5-uTime*1.7+fn*4.)*.5+.5;
  float foam=(1.-smoothstep(0.,.65,depth))*smoothstep(.5,.85,band*.7+fn*.5)*.85+(1.-smoothstep(0.,.14,depth))*.8;
  #if WAVES > 2
  foam+=smoothstep(.72,1.05,vCrest)*smoothstep(.55,.8,fn)*.55*det;
  #endif
  foam=clamp(foam,0.,1.); vec3 lit=vec3(.95,.93,.9)*(.6+.4*max(uSunDir.y+.3,0.)); col=mix(col,lit,foam*.92);
  float a=max(smoothstep(-.03,.45,depth),foam*.9);
  float ff=1.-exp(-uFogD*uFogD*dist*dist);
  #if WAVES < 3
  ff*=.6;
  #endif
  col=mix(col,HOR,ff);
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` });
  const sea = new THREE.Mesh(grid, seaMat); sea.frustumCulled = false; sea.renderOrder = 1; sea.userData.noAO = true; scene.add(sea);
  // ---------- state ----------
  let tideT = 0, held = false, holdK = 0, rise = 0, riseWant = 0, glow = 0;
  const level = () => { const nat = -0.35 + 0.55 * Math.cos(tideT * Math.PI * 2 / TIDE_PERIOD); return nat + (-0.95 - nat) * holdK; };
  const W = (x: number, z: number) => ({ x: COAST_O.x + x, z: COAST_O.z + z });
  const segD = (x: number, z: number) => { let best = 1e9; for (let i = 0; i < path.length - 1; i++) { const [ax, az] = path[i], [bx, bz] = path[i + 1]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(x - ax - dx * u, z - az - dz * u)); } return best; };
  const onShelf = (x: number, z: number) => Math.hypot((x - CAVE.x + 1.0) / 2.6, (z - CAVE.z) / 2.4) < 1;
  const SOL = [{ x: LX, z: LZ, r: 3.3 }, { x: SHRINE.x, z: SHRINE.z, r: 1.15 }, { x: LAMPSTONE.x, z: LAMPSTONE.z, r: 0.6 }];
  const surf = new Surf();
  const sv = new THREE.Vector3();
  return {
    scene, sun,
    arrive: W(TUN.x - 2.2, TUN.z), tunnel: W(TUN.x - 0.6, TUN.z), shrine: W(SHRINE.x, SHRINE.z), lamp: W(LAMPSTONE.x, LAMPSTONE.z), caveMouth: W(CAVE.x + 0.3, CAVE.z), pathStart: W(path[0][0] + 1.5, path[0][1]),
    lighthouse: W(LX, LZ),
    tide() { return level(); }, get tidePhase() { const l = level(); const d = -Math.sin(tideT * Math.PI * 2 / TIDE_PERIOD); return held ? 'held low' : l < -0.6 ? 'low' : d < 0 ? 'ebbing' : l > 0.05 ? 'high' : 'flooding'; },
    get revealed() { return held; },
    isLow() { return level() < -0.6; },
    get rise() { return rise; },
    reveal(instant = false) { held = true; riseWant = 1; if (instant) { holdK = 1; rise = 1; } },
    /** Ground height at a world point (stones count once raised). */
    groundY(wx: number, wz: number) { const x = wx - COAST_O.x, z = wz - COAST_O.z; let h = coastH(x, z); if (rise > 0.9 && segD(x, z) < 1.0) h = Math.max(h, TOP); if (rise > 0.9 && onShelf(x, z)) h = Math.max(h, -0.05); return h; },
    constrain(ox: number, oz: number, wx: number, wz: number): [number, number] {
      const x = wx - COAST_O.x, z = wz - COAST_O.z;
      const ok = (x2: number, z2: number) => { if (SOL.some((s) => Math.hypot(x2 - s.x, z2 - s.z) < s.r)) return false; if (rise > 0.9 && (segD(x2, z2) < 0.95 || onShelf(x2, z2))) return true; const h = coastH(x2, z2); return h < 5.4 && x2 - shoreX(z2) > -0.8 && x2 < TUN.x - 0.3 && Math.abs(z2) < 47; };
      if (ok(x, z)) return [wx, wz]; if (ok(x, oz - COAST_O.z)) return [wx, oz]; if (ok(ox - COAST_O.x, z)) return [ox, wz]; return [ox, oz];
    },
    camFloor(wx: number, wz: number) { return Math.max(coastH(wx - COAST_O.x, wz - COAST_O.z), level() + 0.35); },
    glowShrine(on: boolean) { glow = on ? 1 : 0; },
    audio(on: boolean) { if (on) surf.start(); else surf.stop(); },
    update(time: number, dt: number, cam: THREE.Camera, focus: THREE.Vector3) {
      tideT += dt; if (held) holdK = Math.min(1, holdK + dt / 4); rise += (riseWant - rise) * Math.min(1, dt * 0.8); if (riseWant && rise > 0.995) rise = 1;
      uTide.value = level(); seaMat.uniforms.uTime.value = time;
      const s = 2; sea.position.set(Math.round(cam.position.x / s) * s, 0, Math.round(cam.position.z / s) * s); sky.position.copy(cam.position);
      stones.visible = rise > 0.004; for (const st of stones.children) { st.position.y = TOP - (1 - rise) * (2.4 + (st.userData.k % 3) * 0.2); } // fully sunk (and hidden) until revealed: no edges through high water
      shrineMat.emissiveIntensity = 0.05 + glow * (0.6 + 0.2 * Math.sin(time * 3)) + (held ? 0.25 : 0);
      sun.target.position.copy(focus); { const tx = 90 / sun.shadow.mapSize.x, tp = sun.target.position; const u = SNU.crossVectors(COAST_SUN, SNY).normalize(), v = SNV.crossVectors(u, COAST_SUN).normalize(); tp.addScaledVector(u, Math.round(tp.dot(u) / tx) * tx - tp.dot(u)).addScaledVector(v, Math.round(tp.dot(v) / tx) * tx - tp.dot(v)); } sun.position.copy(sun.target.position).addScaledVector(COAST_SUN, 150); // texel-snapped: no shadow crawl while running
      for (const gl of gulls) { const a = gl.ph + time * gl.s; gl.o.position.set(gl.c[0] + Math.cos(a) * gl.r, gl.h + Math.sin(time * 0.7 + gl.ph) * 1.2, gl.c[1] + Math.sin(a) * gl.r); gl.o.rotation.y = -a + (gl.s > 0 ? 0 : Math.PI); gl.o.rotation.z = gl.s > 0 ? -0.25 : 0.25; const f = Math.sin(time * 5 + gl.ph) * (Math.sin(time * 0.3 + gl.ph) > 0.3 ? 0.08 : 0.55); gl.wl.rotation.z = f; gl.wr.rotation.z = -f; }
      void sv;
    },
  };
}
export type Coast = ReturnType<typeof makeCoast>;
