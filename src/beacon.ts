import * as THREE from 'three';
import { mergeGeometries as mergeG } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fromMap, heightAt } from './world';
import { addRimFill } from './shading';
import type { GroundTex } from './terrain';

/** Hollow Beacon endgame (ported from the Page): Updraft east of the Wind Shrine → four morning mirrors → dawn. */
export const UPDRAFT = fromMap(325, 305);
export const MORNING_DIRS = ['North', 'East', 'South', 'West'] as const;
export const DIR_ARROWS = ['↑', '→', '↓', '←'] as const;
export const BEACON_XP = 60;
/** Island-local beacon centre (the stone ring around the rift shard). */
export const BEACON_L = { x: -3, z: 2 };
// Page MORNING_MIRRORS: Pale (W of the beacon) solve West · Sun (N) solve South · Azure (E) solve East · Iron (S) solve South; ±24 map units ≈ 8.6 m.
export const MIRRORS = [
  { name: 'Pale', solve: 3, color: '#fff5dc', dx: -8.6, dz: 0 },
  { name: 'Sun', solve: 2, color: '#ffbb44', dx: 0, dz: -8.6 },
  { name: 'Azure', solve: 1, color: '#7bdcff', dx: 8.6, dz: 0 },
  { name: 'Iron', solve: 2, color: '#ff7540', dx: 0, dz: 8.6 },
];
export const mirrorsMatch = (m: number[]) => m.every((v, i) => v === MIRRORS[i].solve);
export const CLUE_L = { x: BEACON_L.x + 3.6, z: BEACON_L.z + 5.0 };
export const RETURN_L = { x: BEACON_L.x - 12.6, z: BEACON_L.z };
export const LANDING_L = { x: BEACON_L.x - 11.6, z: BEACON_L.z + 3.2 };
export const ISLAND_WALK_R = 18;
export const CLUE_LINES = [
  'The Unspent carving:',
  'White remembers the western wall. Amber follows the long southern road. Blue greets the eastern roofs. Ember watches the southern forge.',
  'Let each mirror face its own morning; its back will give that light to the hollow.',
];
export const UPDRAFT_DORMANT = ['A thin current turns here, too weak to lift anyone. Above the vale the Hollow Beacon is dark — the four seals must burn first.'];
export const UPDRAFT_NEEDS_WIND = ['The current curls away from {name}’s hands. Wake the Wind Shrine and carry its Windward Blessing to ride it.'];
export const ENDING_TITLE = 'Hollow Beacon — The Unspent Morning';
export const ENDING_LINES = [
  'The lantern opens without breaking. Across the vale, a morning held too long finally learns to arrive.',
  'The custodians’ mirrors go clear. On Enna Marr’s last blank page, ink gathers in a handwriting {name} knows: ‘You finished it. Now go find where I went.’',
  'Far beyond the root-hung islands, a second seam answers — not in the sky, but beneath the sea.',
];
export const ENDING_REWARD = '+60 XP · Morning-Bearer · Hollow Light';
export const WAYFINDER_BEACON = {
  open: 'The Hollow Beacon still keeps an unspent morning. Ride the Updraft east of the Wind Shrine once its Windward Blessing knows your name.',
  done: 'Morning-Bearer. The sky has remembered how to let go. Follow Enna’s last blank beyond the sea.',
};
/** Facing yaw for a pivot whose +Z is the mirror face: N(-Z) · E(+X) · S(+Z) · W(-X). */
const yawOf = (v: number) => Math.PI - v * Math.PI / 2;

function beamMat(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uC: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv;varying float vF;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vF=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float uTime,uFade;uniform vec3 uC;varying vec2 vUv;varying float vF;
      void main(){float pulse=.65+.35*sin(vUv.y*24.-uTime*6.);float a=smoothstep(.1,.9,vF)*uFade*pulse*.85;gl_FragColor=vec4(uC*a*1.6,a);}`,
  });
}

function carvingTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 160);
  x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineCap = 'round';
  // A sun-hollow in the middle with four mirrors and their mornings.
  x.beginPath(); x.arc(128, 80, 16, 0, Math.PI * 2); x.stroke();
  const m: [number, number, number, number][] = [[64, 80, -1, 0], [128, 22, 0, 1], [192, 80, 1, 0], [128, 138, 0, 1]];
  for (const [mx, my, ax, ay] of m) { x.beginPath(); x.arc(mx, my, 9, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + ax * 26, my + ay * 16); x.stroke(); }
  x.lineWidth = 2; x.setLineDash([4, 6]); for (const [mx, my] of m) { x.beginPath(); x.moveTo(mx, my); x.lineTo(128, 80); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Four morning mirrors, the Unspent carving and the return current — built in island-local space. */
export function makeHollowPuzzle(rock: GroundTex, topY: (x: number, z: number) => number, init: { mirrors: number[]; solved: boolean }) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: rock.diff, normalMap: rock.nor, roughnessMap: rock.arm, color: '#e6d8bc', roughness: 1 }); addRimFill(stone, { fill: 0.3, rim: 0.25 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#b08440', metalness: 0.9, roughness: 0.32 }); addRimFill(bronze, { fill: 0.2, rim: 0.4, rimColor: '#ffe0a0' });
  const back = new THREE.MeshStandardMaterial({ color: '#4a3a2a', metalness: 0.6, roughness: 0.5 });
  const shardL = new THREE.Vector3(BEACON_L.x, 7.6, BEACON_L.z);
  const ms = MIRRORS.map((d, i) => {
    const x = BEACON_L.x + d.dx, z = BEACON_L.z + d.dz, y = topY(x, z) - 0.15;
    const root = new THREE.Group(); root.position.set(x, y, z); g.add(root);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 1.5, 10), stone); post.position.y = 0.75; post.castShadow = true; root.add(post);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.25, 12), stone); plinth.position.y = 0.12; root.add(plinth);
    const pivot = new THREE.Group(); pivot.position.y = 1.5; root.add(pivot);
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 24, Math.PI), bronze); yoke.rotation.z = Math.PI; yoke.position.y = 0.95; pivot.add(yoke);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.085, 8, 36), bronze); frame.position.y = 0.95; frame.castShadow = true; pivot.add(frame);
    const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color).lerp(new THREE.Color('#ffffff'), 0.55), metalness: 1, roughness: 0.06, envMapIntensity: 1.8, emissive: d.color, emissiveIntensity: 0 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.74, 36), glass); face.position.set(0, 0.95, 0.02); pivot.add(face);
    const rear = new THREE.Mesh(new THREE.CircleGeometry(0.74, 36), back); rear.rotation.y = Math.PI; rear.position.set(0, 0.95, -0.02); pivot.add(rear);
    const gemMat = new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.6, roughness: 0.25 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), gemMat); gem.position.y = 1.86; gem.scale.y = 1.5; pivot.add(gem);
    // Ground pointer: which morning the mirror faces.
    const sh = new THREE.Shape(); sh.moveTo(0, 1.9); sh.lineTo(0.42, 1.1); sh.lineTo(0.15, 1.15); sh.lineTo(0.15, 0.95); sh.lineTo(-0.15, 0.95); sh.lineTo(-0.15, 1.15); sh.lineTo(-0.42, 1.1); sh.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: d.color, side: THREE.DoubleSide })); arrow.rotation.x = Math.PI / 2; arrow.position.y = -1.22; pivot.add(arrow);
    // Light beam from the mirror's back to the hollow (shown when aligned).
    const from = new THREE.Vector3(x, y + 2.45, z), len = from.distanceTo(shardL);
    const bm = beamMat(d.color); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, len, 10, 1, true), bm);
    beam.position.copy(from).lerp(shardL, 0.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shardL.clone().sub(from).normalize()); beam.renderOrder = 4; g.add(beam);
    const st = { v: init.mirrors[i] ?? 0, yaw: yawOf(init.mirrors[i] ?? 0), target: yawOf(init.mirrors[i] ?? 0), fade: 0 };
    pivot.rotation.y = st.yaw;
    return { d, root, pivot, glass, gemMat, bm, st, x, z, y };
  });
  // Carving tablet.
  const cy = topY(CLUE_L.x, CLUE_L.z);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 0.32), stone); tab.position.set(CLUE_L.x, cy + 0.62, CLUE_L.z); tab.rotation.set(-0.35, Math.atan2(BEACON_L.x - CLUE_L.x, BEACON_L.z - CLUE_L.z) + Math.PI, 0); tab.castShadow = true; g.add(tab);
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), new THREE.MeshBasicMaterial({ map: carvingTex(), color: '#ffd889', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  carve.position.z = 0.17; tab.add(carve);
  // Return current: a soft mint ring at the western edge.
  const ry = topY(RETURN_L.x, RETURN_L.z);
  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x);
      float sw=.5+.5*sin(a*3.-r*9.+uTime*3.);float ring=smoothstep(.55,.8,r)*smoothstep(1.,.85,r);float a2=(ring*.7+smoothstep(.85,0.,r)*.25*sw)*(.7+.3*sin(uTime*2.));
      gl_FragColor=vec4(vec3(.85,1.,.9),a2);}`,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(RETURN_L.x, ry + 0.08, RETURN_L.z); g.add(ring);
  let solved = init.solved;
  return {
    group: g,
    mirrorL: (i: number) => ({ x: ms[i].x, z: ms[i].z }),
    setMirror(i: number, v: number) { const m = ms[i]; m.st.v = v; let tg = yawOf(v); while (tg - m.st.yaw > Math.PI) tg -= Math.PI * 2; while (tg - m.st.yaw < -Math.PI) tg += Math.PI * 2; m.st.target = tg; },
    solve(on = true) { solved = on; },
    update(t: number, dt: number) {
      for (const m of ms) {
        m.st.yaw += (m.st.target - m.st.yaw) * Math.min(1, dt * 6); m.pivot.rotation.y = m.st.yaw;
        const lit = m.st.v === m.d.solve && Math.abs(m.st.target - m.st.yaw) < 0.08;
        m.st.fade = THREE.MathUtils.clamp(m.st.fade + (lit ? dt * 1.6 : -dt * 3), 0, 1);
        m.bm.uniforms.uFade.value = m.st.fade * (solved ? 1.3 : 1); m.bm.uniforms.uTime.value = t;
        m.glass.emissiveIntensity = m.st.fade * 0.9; m.gemMat.emissiveIntensity = 0.6 + m.st.fade * 2.2;
      }
      ringMat.uniforms.uTime.value = t;
    },
  };
}

/** The Updraft: a ring of standing stones with a spiralling wind column (weak until the seals burn). */
export function makeUpdraft(rock: GroundTex) {
  const g = new THREE.Group(); const y0 = heightAt(UPDRAFT.x, UPDRAFT.z); g.position.set(UPDRAFT.x, y0, UPDRAFT.z);
  const stone = new THREE.MeshStandardMaterial({ map: rock.diff, normalMap: rock.nor, roughnessMap: rock.arm, color: '#ddd2bd', roughness: 1 }); addRimFill(stone, { fill: 0.25, rim: 0.2 });
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3, h = 1.4 + (i % 3) * 0.6; const s = new THREE.BoxGeometry(0.7, h, 0.45); s.rotateY(-a); s.rotateZ(0.06 * Math.sin(i * 2.1)); s.translate(Math.cos(a) * 4.6, h / 2 - 0.15, Math.sin(a) * 4.6); geos.push(s.toNonIndexed()); }
  const disc = new THREE.CylinderGeometry(3.2, 3.5, 0.3, 28); disc.translate(0, 0, 0); geos.push(disc.toNonIndexed());
  for (const ge of geos) ge.deleteAttribute('uv');
  const stones = new THREE.Mesh(mergeG(geos), stone); stones.castShadow = true; stones.receiveShadow = true; g.add(stones);
  const colMat = (k: number, speed: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uPow: { value: 0.25 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uPow;varying vec2 vUv;
      void main(){float s=fract(vUv.x*${k.toFixed(1)}+vUv.y*5.-uTime*${speed.toFixed(2)});float streak=smoothstep(.0,.15,s)*smoothstep(.45,.15,s);
        float fade=smoothstep(0.,.08,vUv.y)*(1.-smoothstep(.45,1.,vUv.y));gl_FragColor=vec4(vec3(.86,1.,.93),streak*fade*.42*uPow);}`,
  });
  const cols = [colMat(3, 0.55), colMat(2, 0.8)];
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 2.6, 70, 32, 1, true), cols[0]); c1.position.y = 35;
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.8, 50, 24, 1, true), cols[1]); c2.position.y = 25;
  for (const c of [c1, c2]) { c.renderOrder = 2; c.frustumCulled = false; g.add(c); }
  // Rising motes.
  const N = 90, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = i / N; pos[i * 3] = 0; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPow: { value: 0.25 } },
    vertexShader: `attribute float aSeed;uniform float uTime;varying float vA;void main(){float ph=fract(uTime*.09+aSeed*7.13);float a=ph*14.+aSeed*40.;float r=1.6+fract(aSeed*13.7)*2.4;
      vec3 p=vec3(cos(a)*r,ph*60.,sin(a)*r);vA=smoothstep(0.,.08,ph)*(1.-ph);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(90./-mv.z,1.,9.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'uniform float uPow;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(.9,1.,.95)*vA*uPow*smoothstep(.5,.1,d),1.);}',
  });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.layers.set(1); g.add(pts);
  let pow = 0.25, want = 0.25;
  return {
    group: g,
    setActive(on: boolean, instant = false) { want = on ? 1 : 0.22; if (instant) pow = want; },
    update(t: number, dt: number) { pow += (want - pow) * Math.min(1, dt * 1.5); for (const m of [...cols, pm]) { m.uniforms.uTime.value = t; m.uniforms.uPow.value = pow; } c1.rotation.y = t * 0.15; c2.rotation.y = -t * 0.22; },
  };
}

/** Sunrise sky shell: drawn over the HDRI (fades in with the dawn) with a low warm sun, rose band and lit cloud streaks. */
export function makeDawnSky(sunDir: THREE.Vector3) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide, fog: false,
    uniforms: { uK: { value: 0 }, uSun: { value: sunDir.clone() }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p;}',
    fragmentShader: `uniform float uK,uTime;uniform vec3 uSun;varying vec3 vDir;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
      void main(){vec3 d=normalize(vDir);float y=d.y;float s=max(dot(d,normalize(uSun)),0.);
        vec3 hor=vec3(.92,.5,.24),mid=vec3(.78,.42,.44),zen=vec3(.2,.24,.52);
        vec3 c=mix(hor,mid,smoothstep(-.02,.16,y));c=mix(c,zen,smoothstep(.12,.7,y));
        c+=vec3(1.,.5,.18)*pow(s,5.)*.9*(1.-smoothstep(0.,.45,y));
        c+=vec3(1.,.8,.5)*pow(s,48.)*1.4;
        c+=vec3(1.,.93,.78)*smoothstep(.9990,.9997,s)*7.;
        // Cloud streaks low in the sky, lit gold toward the sun and rose away from it.
        vec2 q=vec2(atan(d.x,d.z)*4.,y*22.);float cl=smoothstep(.52,.8,fbm(q*vec2(1.,.6)+vec2(uTime*.004,0.)));
        float band=smoothstep(.02,.08,y)*(1.-smoothstep(.22,.42,y));
        vec3 cc=mix(vec3(.62,.36,.48),vec3(1.,.72,.42),pow(s,3.));c=mix(c,cc*1.15,cl*band*.85);
        c=mix(c,hor*.85,smoothstep(0.,-.12,y));
        gl_FragColor=vec4(c,uK*.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), m); mesh.renderOrder = -2; mesh.frustumCulled = false;
  return { mesh, set(k: number, t: number) { m.uniforms.uK.value = k; m.uniforms.uTime.value = t; mesh.visible = k > 0.002; } };
}
