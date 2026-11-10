import * as THREE from 'three';
import { fromMap, heightAt, SPAWN } from './world';
import { triplanar } from './landmarks';
import { addRimFill } from './shading';
import type { GroundTex } from './terrain';

/** Optional Vale Warden (ported from the Page): a stationary clockwork/stone guard on the Iron Dome approach. */
export const WARDEN = fromMap(505, 525);
// Page tuning, mapped to our metres (Page wake 100 → ~22 m; melee/strike ring sized for our hero scale).
export const W_WAKE = 22, W_SLEEP = 30, W_MELEE = 3.6, W_STRIKE_R = 2.7, W_TELE = 1.25, W_RECOVER = 1.4, PLAYER_ATK_CD = 0.55, HP_MAX = 3, WARDEN_XP = 40;
export const RECOVERY_LINES = [
  'Wayfinder pulls you to safety.',
  'Seals, shrine, and XP endure — the Warden resets if still awake.',
  'Step carefully near Iron Dome.',
];
/** Safe recovery point: on the line back toward the meadow, well outside the wake radius. */
export function recoveryPoint() { const dx = SPAWN.x - WARDEN.x, dz = SPAWN.z - WARDEN.z, d = Math.hypot(dx, dz); return { x: WARDEN.x + dx / d * (W_SLEEP + 4), z: WARDEN.z + dz / d * (W_SLEEP + 4) }; }

/** Stone-and-timber construct with a copper heart; articulated arms for a readable overhead windup and slam. */
export function makeWarden(t: { rock: GroundTex; metal: GroundTex }) {
  const stone = triplanar(t.rock, 1.6, '#c9bca4', { sat: 0.6, gain: 1.15 });
  const copper = triplanar(t.metal, 1.2, '#d08a55', { metal: 0.75, rough: 0.55 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.85 }); addRimFill(wood, { fill: 0.2, rim: 0.25 });
  const mossM = new THREE.MeshStandardMaterial({ color: '#5f7d3a', roughness: 1 }); addRimFill(mossM, { fill: 0.25, rim: 0.2 });
  const coreMat = new THREE.MeshStandardMaterial({ color: '#40200e', emissive: '#ff8a3a', emissiveIntensity: 1.6, roughness: 0.4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffb36a', toneMapped: false });
  const blob = (r: number, d = 1) => { const g = new THREE.IcosahedronGeometry(r, d); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.12 * Math.sin(p.getX(i) * 7 + p.getY(i) * 5) * Math.sin(p.getZ(i) * 6); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; };
  const M = (g: THREE.BufferGeometry, m: THREE.Material) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; return x; };

  const root = new THREE.Group(); // positioned on the ground, yaw toward the player
  const body = new THREE.Group(); root.add(body); // bobs / kneels
  // Legs: stout stone pillars with copper knee bands and slab feet.
  for (const s of [-1, 1]) {
    const leg = M(new THREE.CylinderGeometry(0.34, 0.42, 1.3, 10), stone); leg.position.set(s * 0.5, 0.75, 0); body.add(leg);
    const knee = M(new THREE.TorusGeometry(0.4, 0.07, 6, 18).rotateX(Math.PI / 2), copper); knee.position.set(s * 0.5, 0.95, 0); body.add(knee);
    const foot = M(new THREE.BoxGeometry(0.7, 0.28, 0.95), stone); foot.position.set(s * 0.52, 0.14, 0.12); body.add(foot);
  }
  const torso = new THREE.Group(); torso.position.y = 1.45; body.add(torso); // leans back on windup, forward on slam
  const pelvis = M(new THREE.BoxGeometry(1.35, 0.42, 0.85), stone); pelvis.position.y = 0.05; torso.add(pelvis);
  const chest = M(new THREE.LatheGeometry([[0.62, 0], [0.86, 0.3], [0.98, 0.75], [0.95, 1.2], [0.78, 1.45], [0.5, 1.55]].map(([r, y]) => new THREE.Vector2(r, y)), 14), stone);
  chest.scale.set(1, 1, 0.78); chest.position.y = 0.2; torso.add(chest);
  for (const y of [0.55, 1.15]) { const band = M(new THREE.TorusGeometry(0.96, 0.06, 6, 28).rotateX(Math.PI / 2), copper); band.scale.set(1, 0.78, 1); band.position.y = y + 0.2; torso.add(band); }
  // Copper heart in a riveted ring.
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), coreMat); core.position.set(0, 1.0, 0.68); torso.add(core);
  const coreRing = M(new THREE.TorusGeometry(0.34, 0.07, 8, 20), copper); coreRing.position.copy(core.position); torso.add(coreRing);
  // Timber back-plates.
  for (let i = 0; i < 3; i++) { const pl = M(new THREE.BoxGeometry(1.2 - i * 0.2, 0.22, 0.12), wood); pl.position.set(0, 0.55 + i * 0.38, -0.7); pl.rotation.x = 0.12; torso.add(pl); }
  // Head: heavy slab with a glowing visor slit and a copper crest.
  const head = new THREE.Group(); head.position.set(0, 2.0, 0.12); head.scale.setScalar(1.3); torso.add(head);
  head.add(M(new THREE.BoxGeometry(0.72, 0.58, 0.62), stone));
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.08), eyeMat); visor.position.set(0, 0.04, 0.315); head.add(visor);
  const crest = M(new THREE.BoxGeometry(0.08, 0.32, 0.6), copper); crest.position.set(0, 0.42, -0.02); head.add(crest);
  // Arms: shoulder pivots so the windup raises both fists overhead.
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 1.12, 1.45, 0); torso.add(sh); arms.push(sh);
    sh.add(M(blob(0.4), stone));
    const pad = M(new THREE.BoxGeometry(0.75, 0.16, 0.7), wood); pad.position.set(s * 0.05, 0.36, 0); pad.rotation.z = -s * 0.25; sh.add(pad);
    const moss = M(blob(0.22, 0), mossM); moss.scale.set(1.4, 0.45, 1.2); moss.position.set(s * 0.05, 0.47, 0.05); sh.add(moss);
    const upper = M(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 10), stone); upper.position.y = -0.55; sh.add(upper);
    const elbow = M(new THREE.TorusGeometry(0.25, 0.06, 6, 16).rotateX(Math.PI / 2), copper); elbow.position.y = -1.0; sh.add(elbow);
    const fore = M(new THREE.CylinderGeometry(0.28, 0.22, 0.85, 10), stone); fore.position.y = -1.45; sh.add(fore);
    const fist = M(blob(0.42), stone); fist.scale.set(1, 1.1, 1); fist.position.y = -2.05; sh.add(fist);
  }
  const glow = new THREE.PointLight('#ff8a3a', 6, 6, 2); glow.position.set(0, 1.0, 1.0); torso.add(glow);

  // Strike zone: bright ground disc (edge ring + filling core that reaches the rim at impact), conformed to the terrain.
  const zoneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, uniforms: { uFill: { value: 0 }, uTime: { value: 0 }, uA: { value: 0 } },
    vertexShader: 'varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uFill,uTime,uA;varying vec2 vP;
      void main(){float r=length(vP)/${W_STRIKE_R.toFixed(2)};if(r>1.)discard;float edge=smoothstep(.86,.94,r)*(1.-smoothstep(.97,1.,r));
        float fill=(1.-smoothstep(uFill-.04,uFill,r))*.45;float hatch=step(.5,fract((vP.x+vP.y)*1.6-uTime*2.))*.12;
        vec3 c=mix(vec3(1.,.42,.1),vec3(1.,.85,.35),edge);gl_FragColor=vec4(c*1.6,(edge*.95+fill+hatch*(1.-r))*uA);}`,
  });
  const zoneGeo = new THREE.CircleGeometry(W_STRIKE_R, 40, 0, Math.PI * 2); zoneGeo.rotateX(-Math.PI / 2);
  const zbase = Float32Array.from(zoneGeo.attributes.position.array as Float32Array);
  const zone = new THREE.Mesh(zoneGeo, zoneMat); zone.visible = false; zone.renderOrder = 3; zone.frustumCulled = false;
  function placeZone(x: number, z: number) {
    const p = zoneGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(x + zbase[i * 3], z + zbase[i * 3 + 2]) + 0.06);
    p.needsUpdate = true; zone.position.set(x, 0, z);
  }
  // Dust ring on impact.
  const dust = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e9dcc0', transparent: true, opacity: 0, depthWrite: false }));
  dust.renderOrder = 3;

  root.position.set(WARDEN.x, heightAt(WARDEN.x, WARDEN.z), WARDEN.z);
  root.rotation.y = Math.atan2(SPAWN.x - WARDEN.x, SPAWN.z - WARDEN.z);
  const group = new THREE.Group(); group.add(root, zone, dust);

  // Hit spark: a star burst at the chest when struck.
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; { const x = sc.getContext('2d')!; const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.25, 'rgba(255,210,140,.8)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = gr; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 18 : 64; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); }
  const sparkTex = new THREE.CanvasTexture(sc); sparkTex.colorSpace = THREE.SRGBColorSpace;
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  spark.position.set(0, 1.55, 0.75); spark.visible = false; spark.renderOrder = 6; root.add(spark);
  let flash = 0, slam = 0, kneel = 0, dustT = 0, held = false;
  return {
    group,
    placeZone,
    hit(hold = false) { flash = hold ? 0.8 : 1; held = hold; },
    impact(x: number, z: number) { slam = 1; dustT = 1; dust.position.set(x, heightAt(x, z) + 0.08, z); },
    /** phase: 0 idle · 1 windup (k = 0..1 progress) · 2 recover · 3 dormant */
    update(time: number, dt: number, s: { phase: number; k: number; awake: boolean; face: number | null; zone: boolean }) {
      const dormant = s.phase === 3;
      kneel = THREE.MathUtils.clamp(kneel + (dormant ? dt : -dt) * 1.2, 0, 1);
      if (!held) flash = Math.max(0, flash - dt * 2.6); slam = Math.max(0, slam - dt * 2.2); dustT = Math.max(0, dustT - dt * 1.6);
      if (s.face !== null && !dormant) { let d = s.face - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * Math.min(1, dt * (s.phase === 1 ? 1.5 : 3)); }
      // Arm pose: rest (slight forward) → overhead on windup → slam down → settle.
      const up = s.phase === 1 ? THREE.MathUtils.smoothstep(s.k, 0, 0.75) : 0;
      const restX = dormant ? 0.15 : 0.18 + Math.sin(time * 1.1) * 0.05;
      const armX = THREE.MathUtils.lerp(restX, -2.75, up) + slam * 0.9;
      for (const [i, a] of arms.entries()) { a.rotation.x = armX; a.rotation.z = (i ? -1 : 1) * (0.12 + up * 0.18 - kneel * 0.05); }
      torso.rotation.x = -up * 0.22 + slam * 0.35 + kneel * 0.5;
      head.rotation.x = kneel * 0.55 - up * 0.15;
      body.position.y = (dormant ? 0 : Math.sin(time * 1.6) * 0.03) - kneel * 0.55 - slam * 0.12;
      const awakeGlow = dormant ? 0 : s.awake ? 1 : 0.55;
      coreMat.emissiveIntensity = 0.05 + awakeGlow * (1.4 + up * 2.5) + flash * 3; coreMat.emissive.set(flash > 0.3 ? '#fff0d0' : '#ff8a3a');
      eyeMat.color.set(dormant ? '#2a2018' : up > 0.2 ? '#ff5a2a' : '#ffb36a');
      glow.intensity = awakeGlow * (4 + up * 10) + flash * 8;
      stone.emissive.setRGB(flash * 0.5, flash * 0.36, flash * 0.22); wood.emissive.setRGB(flash * 0.45, flash * 0.28, flash * 0.15); mossM.emissive.setRGB(flash * 0.3, flash * 0.3, flash * 0.15);
      spark.visible = flash > 0.02; spark.material.opacity = Math.min(1, flash * 1.4); spark.scale.setScalar(0.8 + (1 - flash) * 2.6); spark.material.rotation = time * 3;
      torso.rotation.x -= flash * 0.3;
      root.position.x = WARDEN.x + (flash > 0 ? Math.sin(time * 70) * 0.06 * flash : 0);
      zone.visible = s.zone; zoneMat.uniforms.uFill.value = s.k; zoneMat.uniforms.uTime.value = time; zoneMat.uniforms.uA.value = 0.75 + 0.25 * Math.sin(time * 14 * (0.5 + s.k));
      (dust.material as THREE.MeshBasicMaterial).opacity = dustT * 0.6; dust.scale.setScalar(1 + (1 - dustT) * 3.2); dust.visible = dustT > 0;
    },
  };
}
