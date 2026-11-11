import * as THREE from 'three';

/** M20b · day/night. tod ∈ [0,1): 0 = midnight, 0.25 ≈ sunrise, 0.5 = noon, 0.75 ≈ sunset. One full day = DAY_LEN real seconds. */
export const DAY_LEN = 720;
export const MORNING = 0.27;
export type Sky = { e: number; night: number; golden: number; sunDir: THREE.Vector3; moonDir: THREE.Vector3; sunFade: number };
const sv = new THREE.Vector3(), mv = new THREE.Vector3();
/** Sun height proxy e: > 0 above the horizon (the day is ~58% of the cycle). */
export function skyAt(tod: number, base: THREE.Vector3): Sky {
  const e = Math.sin(2 * Math.PI * (tod - 0.25)) + 0.25;
  const night = 1 - THREE.MathUtils.smoothstep(e, -0.3, 0.02);
  const golden = (1 - night) * (1 - THREE.MathUtils.smoothstep(e, 0.05, 0.5));
  const az0 = Math.atan2(base.x, base.z), az = az0 + (tod - 0.42) * 2 * Math.PI * 0.55;
  const y = THREE.MathUtils.clamp(0.55 * e, 0.035, 0.8), h = Math.sqrt(1 - y * y);
  sv.set(Math.sin(az) * h, y, Math.cos(az) * h);
  const maz = az0 + 2.4 + tod * 1.2, my = 0.62; mv.set(Math.sin(maz) * 0.785, my, Math.cos(maz) * 0.785).normalize();
  return { e, night, golden, sunDir: sv, moonDir: mv, sunFade: THREE.MathUtils.smoothstep(e, -0.04, 0.22) };
}
export const clockText = (tod: number) => { const m = Math.floor(tod * 24 * 60), hh = Math.floor(m / 60), mm = m % 60; return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm - (mm % 10)).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`; };
export const isNightTod = (tod: number) => skyAt(tod, new THREE.Vector3(0, 1, 0)).night > 0.6;

/** Night sky shell: deep blue gradient, hashed stars and a moon disc; fades in with uN (drawn behind everything, no fog). */
export function makeNightSky() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide, fog: false,
    uniforms: { uN: { value: 0 }, uMoon: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uN,uTime;uniform vec3 uMoon;varying vec3 vDir;
      float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){vec3 d=normalize(vDir);float y=d.y;
        vec3 c=mix(vec3(.10,.13,.24),vec3(.022,.035,.085),smoothstep(-.05,.55,y));
        vec3 g=floor(d*220.);float r=h(g);float st=step(.9965,r)*smoothstep(.0,.12,y);float tw=.6+.4*sin(uTime*2.+r*90.);
        c+=vec3(.85,.9,1.)*st*tw*(.5+.8*fract(r*37.));
        float md=dot(d,normalize(uMoon));c+=vec3(.92,.95,1.)*smoothstep(.9993,.9996,md)+vec3(.25,.32,.5)*pow(max(md,0.),60.)*.6;
        gl_FragColor=vec4(c,uN);}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), m); mesh.renderOrder = -1; mesh.frustumCulled = false; mesh.visible = false;
  return { mesh, set(n: number, moon: THREE.Vector3, t: number) { m.uniforms.uN.value = n; m.uniforms.uMoon.value.copy(moon); m.uniforms.uTime.value = t; mesh.visible = n > 0.01; } };
}
