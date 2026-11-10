import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import type { GroundTex } from './terrain';
import { type Kind, TreeField, type TreeInst } from './nature';
import { rng } from './world';
import { addRimFill } from './shading';

export const ISLAND_POS = new THREE.Vector3(92, 34, 34) // east-south-east of spawn: front-lit by the late-morning sun;

function noise3(x: number, y: number, z: number) {
  return Math.sin(x * 1.7 + Math.sin(z * 1.3)) * 0.5 + Math.sin(z * 2.3 + y * 1.1) * 0.3 + Math.sin(x * 4.1 + z * 3.7 + y) * 0.2;
}

/** The floating island: grassy top, jagged rock underside, trees, a ribbon waterfall and a glowing rift shard. */
export function makeFloatingIsland(renderer: THREE.WebGLRenderer, grass: GroundTex, rock: GroundTex, trees: Kind[]): { group: THREE.Group; update: (t: number, dt?: number) => void; light: (on: boolean, instant?: boolean) => void; beaconWorld: () => THREE.Vector3 } {
  const g = new THREE.Group(); g.position.copy(ISLAND_POS); g.rotation.set(-0.03, 0, 0.1); // tip the top toward spawn so it reads from the meadow
  const R = 24, r = rng(5);
  // Top: a slightly domed disc with a wavy rim.
  const top = new THREE.CircleGeometry(R, 72, 0, Math.PI * 2); top.rotateX(-Math.PI / 2);
  // subdivide radially by building rings instead (CircleGeometry has no rings): use a lathe-like grid.
  const rings = 14, segs = 96; const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const rimR = (a: number) => R * (1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7 + 2) + 0.03 * Math.sin(a * 13));
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
    const f = i / rings, a = j / segs * Math.PI * 2, rr = rimR(a) * f;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = 2.2 * (1 - f * f) + 0.6 * noise3(x * 0.15, 0, z * 0.15) - (f > 0.92 ? (f - 0.92) * 14 : 0);
    pos.push(x, y, z); uv.push(x / 3, z / 3);
    if (i < rings && j < segs) { const o = i * (segs + 1) + j; idx.push(o, o + segs + 1, o + 1, o + 1, o + segs + 1, o + segs + 2); }
  }
  void top;
  const topGeo = new THREE.BufferGeometry(); topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); topGeo.setIndex(idx); topGeo.computeVertexNormals();
  const gmap = grass.diff.clone(); gmap.wrapS = gmap.wrapT = THREE.RepeatWrapping; gmap.needsUpdate = true;
  const topMat = new THREE.MeshStandardMaterial({ map: gmap, color: '#9fd06a', roughness: 0.95 });
  addRimFill(topMat, { fill: 0.3, rim: 0.25, rimColor: '#e8f3c8' });
  const topMesh = new THREE.Mesh(topGeo, topMat); topMesh.receiveShadow = true; g.add(topMesh);
  // Underside: an inverted, jagged cone of rock.
  const under: number[] = [], uuv: number[] = [], uidx: number[] = [];
  const hs = 22, depth = 34;
  for (let i = 0; i <= hs; i++) for (let j = 0; j <= segs; j++) {
    const f = i / hs, a = j / segs * Math.PI * 2;
    const taper = Math.pow(1 - f, 1.35);
    const jag = 1 + 0.22 * noise3(Math.cos(a) * 3, f * 6, Math.sin(a) * 3) + 0.1 * Math.sin(a * 11 + f * 9);
    const rr = rimR(a) * taper * jag + 0.4;
    const y = -f * depth * (0.85 + 0.25 * Math.sin(a * 2 + 1)) - (f > 0 ? 0 : 0) + (i === 0 ? -0.0 : 0);
    under.push(Math.cos(a) * rr, y + (i === 0 ? -0.2 : 0), Math.sin(a) * rr); uuv.push(j / segs * 12, f * 6);
    if (i < hs && j < segs) { const o = i * (segs + 1) + j; uidx.push(o, o + 1, o + segs + 1, o + 1, o + segs + 2, o + segs + 1); }
  }
  const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(under, 3)); ug.setAttribute('uv', new THREE.Float32BufferAttribute(uuv, 2)); ug.setIndex(uidx); ug.computeVertexNormals();
  const rmaps = [rock.diff, rock.nor, rock.arm].map((t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c; });
  const rockMat = new THREE.MeshStandardMaterial({ map: rmaps[0], normalMap: rmaps[1], aoMap: rmaps[2], roughnessMap: rmaps[2], color: '#e9dcc6', roughness: 1, envMapIntensity: 1.3 });
  addRimFill(rockMat, { fill: 0.55, rim: 0.5, sky: '#e8e4da', ground: '#5a4a72', rimColor: '#d9c9ff' });
  const underMesh = new THREE.Mesh(ug, rockMat); g.add(underMesh);
  // Satellite rocks: kept tight under the rim so none reads as a lone stone floating off in the sky.
  for (let i = 0; i < 6; i++) {
    const s = 1.2 + r() * 2.2; const d = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
    const a = r() * Math.PI * 2, dd = R * (0.9 + r() * 0.22);
    d.position.set(Math.cos(a) * dd, -3 - r() * 6, Math.sin(a) * dd); d.scale.y = 1.4; d.rotation.set(r() * 3, r() * 3, r() * 3); d.userData.bob = r() * 6;
    g.add(d);
  }
  // Trees on top (a couple autumn-gold).
  const list: TreeInst[] = [];
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.75, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const k = Math.floor(r() * trees.length); const y = 2.2 * (1 - (d / R) ** 2) - 0.2;
    list.push({ k, autumn: r() < 0.3, x, y, z, s: (0.9 + r() * 0.5) * 7.5 / trees[k].height, ry: r() * 6.28 });
  }
  // Island trees are always distant: impostor cards only.
  const tf = new TreeField(renderer, trees, list, new THREE.Vector3(-0.45, 0.62, -0.64), { nearR: 0, triBudget: 0, shadowR: 0 }); tf.update(0, 0, true); g.add(tf.group);
  // Waterfall ribbon off the rim (towards the meadow).
  /* rim point facing spawn */ const wfA = Math.atan2(-ISLAND_POS.z + 6, -ISLAND_POS.x); const wx = Math.cos(wfA) * rimR(wfA) * 0.98, wz = Math.sin(wfA) * rimR(wfA) * 0.98;
  const wfMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){float streak=n(vec2(vUv.x*14.,vUv.y*3.+uTime*2.2))*.6+n(vec2(vUv.x*30.,vUv.y*6.+uTime*3.1))*.4;
        float edge=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.75,vUv.x); float fade=smoothstep(0.,.55,vUv.y);
        float a=edge*fade*(.35+.65*streak); gl_FragColor=vec4(mix(vec3(.75,.88,.95),vec3(1.),streak),a*.6*smoothstep(0.,.3,1.-vUv.y+.3));}`,
  });
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 46, 1, 1), wfMat);
  wf.position.set(wx * 1.02, 0.4 - 23, wz * 1.02); wf.rotation.y = Math.atan2(wx, wz); g.add(wf);
  // Mist puff at the waterfall base fades into the air.
  // Rift shard: a glowing violet crystal at the island centre.
  const shardMat = new THREE.MeshStandardMaterial({ color: '#b48cff', emissive: '#8e5cff', emissiveIntensity: 2.4, roughness: 0.2, metalness: 0.1 });
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), shardMat); shard.scale.set(0.7, 2.2, 0.7); shard.position.set(-3, 7.5, 2); g.add(shard);
  const glow = new THREE.PointLight('#a77bff', 30, 40, 2); glow.position.copy(shard.position); g.add(glow);
  // Hollow Beacon: a ring of weathered stone pillars with a broken lintel cradling the shard.
  const bMat = new THREE.MeshStandardMaterial({ color: '#c9c0ae', roughness: 0.92 }); addRimFill(bMat, { fill: 0.3, rim: 0.3, rimColor: '#e9dcff' });
  const bGeos: THREE.BufferGeometry[] = [];
  const base = new THREE.CylinderGeometry(3.6, 4.2, 1.2, 10); base.translate(-3, 1.9, 2); bGeos.push(base);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, h = i === 4 ? 3.2 : 6.5 + (i % 2) * 1.2;
    const p = new THREE.CylinderGeometry(0.42, 0.55, h, 7); p.translate(-3 + Math.cos(a) * 3, 2.5 + h / 2, 2 + Math.sin(a) * 3); bGeos.push(p);
    if (i < 3) { const cap = new THREE.BoxGeometry(1.3, 0.5, 1.3); cap.translate(-3 + Math.cos(a) * 3, 2.5 + h + 0.25, 2 + Math.sin(a) * 3); bGeos.push(cap); }
  }
  const lintel = new THREE.TorusGeometry(3, 0.32, 6, 24, Math.PI * 1.1); lintel.rotateX(Math.PI / 2); lintel.translate(-3, 9.6, 2); bGeos.push(lintel);
  const beacon = new THREE.Mesh(mergeGeometries(bGeos.map((x) => x.toNonIndexed())), bMat); beacon.castShadow = true; g.add(beacon);
  // Awakened beacon: a violet core beam wrapped in a gold sheath, plus a flare ring — hidden until the four seals burn.
  // Alpha-blended (not additive) so violet and gold stay saturated against a bright sky; the core darkens slightly toward its centre.
  const beamMat = (c0: string, c1: string, k: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uA: { value: new THREE.Color(c0) }, uB: { value: new THREE.Color(c1) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uFade;uniform vec3 uA,uB;varying vec2 vUv;
      void main(){float e=sin(vUv.x*3.14159);e*=e;float top=1.-smoothstep(.35,1.,vUv.y);float fl=.8+.2*sin(vUv.y*60.-uTime*4.+vUv.x*12.57);
        vec3 c=mix(uA,uB,vUv.y)*mix(1.15,.8,e);
        gl_FragColor=vec4(c,clamp(e*top*fl*uFade*${k.toFixed(2)},0.,1.));}`,
  });
  const core = beamMat('#6f4dff', '#5a36e6', 0.85), sheath = beamMat('#f2c14e', '#d9a43a', 0.45);
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 220, 20, 1, true), core); beamCore.position.set(-3, 9 + 110, 2);
  const beamSheath = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 220, 24, 1, true), sheath); beamSheath.position.copy(beamCore.position);
  const flare = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false, transparent: true, opacity: 0 }));
  flare.position.set(-3, 9.6, 2);
  for (const m of [beamCore, beamSheath]) { m.frustumCulled = false; m.renderOrder = 3; m.visible = false; }
  g.add(beamCore, beamSheath, flare);
  let lit = false, fade = 0;
  return {
    group: g,
    light(on: boolean, instant = false) { lit = on; if (instant) fade = on ? 1 : 0; },
    beaconWorld() { return shard.getWorldPosition(new THREE.Vector3()); },
    update(t: number, dt = 1 / 60) {
      fade = THREE.MathUtils.clamp(fade + (lit ? dt / 2.2 : -dt), 0, 1);
      for (const m of [core, sheath]) { m.uniforms.uFade.value = fade; m.uniforms.uTime.value = t; }
      beamCore.visible = beamSheath.visible = fade > 0.001;
      (flare.material as THREE.MeshBasicMaterial).opacity = fade * (0.55 + 0.25 * Math.sin(t * 2.2)); flare.scale.setScalar(1 + 0.08 * Math.sin(t * 1.4));
      shardMat.emissive.set(lit ? '#b98cff' : '#8e5cff'); shardMat.emissiveIntensity = 2.4 + fade * 0.8;
      g.position.y = ISLAND_POS.y + Math.sin(t * 0.25) * 0.8; g.rotation.y = Math.sin(t * 0.05) * 0.03;
      shard.rotation.y = t * 0.4; shard.position.y = 7.5 + Math.sin(t * 0.9) * 0.4;
      wfMat.uniforms.uTime.value = t;
      for (const c of g.children) if (c.userData.bob !== undefined) c.position.y += Math.sin(t * 0.6 + c.userData.bob) * 0.004;
    },
  };
}

/** The Wayfinder's lantern staff (follows his right hand) with a warm swaying lantern. */
export function makeLanternStaff(): { group: THREE.Group; update: (t: number, hand: THREE.Vector3, facing: number) => void } {
  const grp = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 0.75 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c79a4a', roughness: 0.35, metalness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb347', emissiveIntensity: 3.2, roughness: 0.2, transparent: true, opacity: 0.92 });
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 2.05, 8), wood); staff.position.y = 1.025; staff.castShadow = true; grp.add(staff);
  // Crook at the top.
  const crook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 6, 16, Math.PI * 1.1), wood); crook.position.set(0.16, 2.05, 0); crook.rotation.z = -0.05; grp.add(crook);
  const hang = new THREE.Group(); hang.position.set(0.32, 2.02, 0); grp.add(hang);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), brass); chain.position.y = -0.08; hang.add(chain);
  const cage = new THREE.Group(); cage.position.y = -0.3; hang.add(cage);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.09, 6), brass); cap.position.y = 0.13; cage.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.035, 6), brass); base.position.y = -0.12; cage.add(base);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 6), glass); cage.add(core);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.012), brass); const a = i / 6 * Math.PI * 2; b.position.set(Math.cos(a) * 0.083, 0, Math.sin(a) * 0.083); cage.add(b); }
  const light = new THREE.PointLight('#ffbf66', 2.4, 7, 2); cage.add(light);
  return {
    group: grp,
    update(t, hand, facing) {
      // Grip ~1.0 m up the staff, planted slightly ahead-right of the guide.
      grp.position.set(hand.x, hand.y - 1.0, hand.z); grp.rotation.y = facing - Math.PI / 2;
      hang.rotation.z = Math.sin(t * 1.4) * 0.08; hang.rotation.x = Math.sin(t * 1.1 + 1) * 0.05;
      (glass as THREE.MeshStandardMaterial).emissiveIntensity = 3 + Math.sin(t * 7) * 0.15 + Math.sin(t * 13) * 0.1;
    },
  };
}
