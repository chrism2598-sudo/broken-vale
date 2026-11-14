import * as THREE from 'three';
import { heightAt, creekX, creekHalf, pathX, TRAIL, PATH_BEND, TRACK, WORN, STREAM, POOL, type P2 } from './world';

const B = PATH_BEND, f3 = (v: number) => v.toFixed(3);
/** M26 · GLSL distance to a polyline (track / stream). */
const polyD = (name: string, pts: P2[]) => `float ${name}(vec2 p){ float d=1e4; ${pts.slice(1).map((b, i) => { const a = pts[i]; return `{ vec2 a=vec2(${a.x.toFixed(2)},${a.z.toFixed(2)}), b=vec2(${b.x.toFixed(2)},${b.z.toFixed(2)}); vec2 ab=b-a; float u=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.); d=min(d,length(p-a-ab*u)); }`; }).join(' ')} return d; }`;

export type GroundTex = { diff: THREE.Texture; nor: THREE.Texture; arm: THREE.Texture };

/** Heightfield terrain with a splat-blended PBR ground (grass / dirt path / rock + creek bed), built on MeshStandardMaterial. */
export function makeTerrain(size: number, seg: number, sets: { grass: GroundTex; path: GroundTex; rock: GroundTex; bed: GroundTex }): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const all = [sets.grass, sets.path, sets.rock, sets.bed];
  for (const s of all) for (const t of [s.diff, s.nor, s.arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  for (const s of all) s.diff.colorSpace = THREE.SRGBColorSpace;
  mat.onBeforeCompile = (sh) => {
    const u = sh.uniforms as Record<string, THREE.IUniform>;
    const names = ['G', 'P', 'R', 'B'];
    all.forEach((s, i) => { u['t' + names[i] + 'd'] = { value: s.diff }; u['t' + names[i] + 'n'] = { value: s.nor }; u['t' + names[i] + 'a'] = { value: s.arm }; });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal);');
    const decl = names.map(n => `uniform sampler2D t${n}d; uniform sampler2D t${n}n; uniform sampler2D t${n}a;`).join('\n');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
${decl}
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}
float creekX(float z){return -50.+7.*sin(z/21.)+4.*sin(z/8.5+1.3)+2.*sin(z/4.1+.4);}
float creekHalf(float z){return 2.6+.9*sin(z/13.+2.1)+.5*sin(z/5.3);}
float pathX0(float z){float t=max(0.,-z);return 1.2*sin(z/9.)*smoothstep(0.,10.,t)-.0105*t*t-.25*t;}
float pathX(float z){float t=max(0.,-z);if(t<=${f3(B.t0)})return pathX0(z);float u=min(1.,(t-${f3(B.t0)})/${f3(B.L)}),u2=u*u,u3=u2*u;return (2.*u3-3.*u2+1.)*${f3(B.x0)}+(u3-2.*u2+u)*${f3(B.L * B.m0)}+(-2.*u3+3.*u2)*${f3(B.x1)}+(u3-u2)*${f3(B.L * B.m1)}+max(0.,t-${f3(B.t0 + B.L)})*${f3(B.m1)};}
${polyD('trackD', TRACK)}
${polyD('wornD', WORN)}
${polyD('streamD', STREAM)}
float pathM(vec2 p){if(p.y>22.)return 0.;float d=abs(p.x-pathX(p.y));float w=1.25+.35*sin(p.y*.37)+(p.y< -40.?.4:0.);w*=.85+.3*vn(p*.6);
 w*=.85+.35*vn(p*.35); return (1.-smoothstep(w*.3,w*1.6,d))*smoothstep(26.,16.,p.y)*(p.y< -92.?smoothstep(-100.,-92.,p.y):1.);}
float trailM(vec2 p){ float d=1e4; ${TRAIL.slice(1).map((b, i) => { const a = TRAIL[i]; return `{ vec2 a=vec2(${a.x.toFixed(1)},${a.z.toFixed(1)}), b=vec2(${b.x.toFixed(1)},${b.z.toFixed(1)}); vec2 ab=b-a; float u=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.); d=min(d,length(p-a-ab*u)); }`; }).join(' ')}
  return 1.-smoothstep(1.55+.2*vn(p*.5),2.55+.15*vn(p*.8),d); }
vec4 W4; float SNOW; vec2 UVg; vec2 UVp; vec2 UVr; vec2 UVb;
`)
      .replace('#include <map_fragment>', `
{ vec2 p=vWP.xz; float slope=1.-clamp(vWN.y,0.,1.);
  float dc=abs(p.x-creekX(p.y)); float bed=1.-smoothstep(creekHalf(p.y)*.9,creekHalf(p.y)+1.6,dc); bed=max(bed,max(1.-smoothstep(1.1,2.6,streamD(p)),1.-smoothstep(${f3(POOL.r - 0.3)},${f3(POOL.r + 1.6)},length(p-vec2(${f3(POOL.x)},${f3(POOL.z)})))));
  float tm=trailM(p); float pm=max(max(pathM(p),tm),max((1.-smoothstep(.75+.25*vn(p*.7),1.8,trackD(p)))*.9,(1.-smoothstep(.4+.2*vn(p*1.3),1.1,wornD(p)))*.75)); // M26: the quarry track // M22b: a hard packed cut, not a soft dirt tint
  float alt=vWP.y; float macro=vn(p*.011), macro2=vn(p*.043+3.1);
  float rock=smoothstep(.2,.42,slope+.14*(macro2-.5)+smoothstep(18.,45.,alt)*.22*(.6+.8*macro));
  float n=vn(p*.08);
  W4=vec4(1.,pm,rock,bed); W4.x=max(0.,1.-pm-rock-bed);
  W4=pow(W4+vec4(.0001),vec4(2.)); W4.y=max(W4.y,tm*tm); W4/=dot(W4,vec4(1.));
  UVg=p/3.2; UVp=p/2.6; UVr=p/4.; UVb=p/2.2;
  float dist=length(vWP-cameraPosition);
  // Grass: two-scale sampling + macro colour variation (lush / sun-dried / shaded), greener far out where blades fade.
  vec3 cg=mix(texture2D(tGd,UVg).rgb,texture2D(tGd,UVg*.23+.37).rgb,.45)*mix(.82,1.12,n);
  cg=mix(cg,vec3(dot(cg,vec3(.3,.59,.11)))*vec3(.62,.95,.34)*1.35,.55);
  vec3 lush=vec3(.21,.33,.09), dry=vec3(.42,.43,.16), deep=vec3(.13,.22,.07);
  vec3 tone=mix(mix(lush,dry,smoothstep(.55,.85,macro)),deep,smoothstep(.6,.9,macro2)*.6);
  tone=mix(tone,vec3(.2,.27,.12),smoothstep(12.,40.,alt)); // cooler alpine meadow
  float far=smoothstep(18.,90.,dist);
  cg=mix(cg*mix(vec3(1.),tone/vec3(.24,.33,.11),.35),tone*(.8+.4*vn(p*.9))*(.85+.3*n),far*.8);
  // M22 · break up the mid-distance lawn: dark grass clumps, sun-dried tussock patches and bare trodden earth.
  float clump=vn(p*.55)*.6+vn(p*1.7)*.4; cg*=mix(.7,1.14,clump);
  cg=mix(cg,cg*vec3(1.32,1.12,.55),smoothstep(.6,.82,vn(p*.09+5.))*.55);
  cg=mix(cg,vec3(.26,.2,.13)*(.8+.4*n),smoothstep(.74,.9,vn(p*.06+11.))*smoothstep(.45,.75,vn(p*.7))*.6);
  // Rock: de-tiled (rotated second sample + macro breakup).
  vec2 rp=mat2(.8,-.6,.6,.8)*p/11.+.5;
  vec3 cr=mix(texture2D(tRd,UVr).rgb,texture2D(tRd,rp).rgb,smoothstep(.3,.7,vn(p*.07)))*mix(.75,1.15,macro2);
  cr=mix(cr,vec3(dot(cr,vec3(.33)))*vec3(.95,.97,1.02),.35);
  vec3 cp=texture2D(tPd,UVp).rgb, cb=texture2D(tBd,UVb).rgb*mix(1.,.55,smoothstep(1.,0.,dc-creekHalf(p.y)*.4));
  // Snow caps: above ~44 m on gentler faces, ragged by noise.
  SNOW=smoothstep(44.,56.,alt+10.*(macro2-.5)+6.*(vn(p*.2)-.5))*smoothstep(.45,.75,vWN.y);
  diffuseColor.rgb*= cg*W4.x+cp*W4.y+cr*W4.z+cb*W4.w;
  // M22b · packed, slightly rutted earth on the Greycrown trail so the switchback reads from the cairn.
  { vec3 packed=mix(cp,vec3(.30,.20,.12),.42)*mix(vec3(1.),vec3(.82,.7,.52),vn(p*1.15));
    packed=mix(packed,packed*vec3(.62,.55,.42),1.-smoothstep(.35,1.15,1.-tm)); // darker rut down the centre
    packed=mix(packed,mix(cp,cr,.4)*vec3(.9,.84,.72),smoothstep(.55,.95,vn(p*2.1))*.35); // worn stone flecks
    diffuseColor.rgb=mix(diffuseColor.rgb,packed,smoothstep(.12,.75,tm)); }
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.93,.97),SNOW);
}`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
{ vec3 a=texture2D(tGa,UVg).rgb*W4.x+texture2D(tPa,UVp).rgb*W4.y+texture2D(tRa,UVr).rgb*W4.z+texture2D(tBa,UVb).rgb*W4.w;
  roughnessFactor*=a.g; float wet=W4.w; roughnessFactor=mix(roughnessFactor,.25,wet*.7); roughnessFactor=mix(roughnessFactor,.6,SNOW); diffuseColor.rgb*=mix(1.,a.r,.75*(1.-SNOW)); }`)
      .replace('#include <normal_fragment_maps>', `
{ vec3 tn=(texture2D(tGn,UVg).xyz*W4.x+texture2D(tPn,UVp).xyz*W4.y+texture2D(tRn,UVr).xyz*W4.z+texture2D(tBn,UVb).xyz*W4.w)*2.-1.;
  tn.xy*=1.15*(1.-.8*SNOW); vec3 N=normalize(vWN); vec3 T=normalize(vec3(1.,0.,0.)-N*N.x); vec3 B=normalize(cross(T,N));
  vec3 wn=normalize(T*tn.x+B*tn.y+N*tn.z); normal=normalize((viewMatrix*vec4(wn,0.)).xyz); }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  void creekX; void creekHalf; void pathX;
  return mesh;
}
