import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Shared wind time for foliage. */
export const foliageUniforms = { uTime: { value: 0 } };

let useA2C = false;
/** Enable MSAA alpha-to-coverage on leaf cards (Lite has antialias; High renders through the composer). */
export function configureFoliage(o: { a2c?: boolean }) { useA2C = !!o.a2c; }

/** Mip-boosted alpha. Lite uses MSAA A2C (cheap coverage). High (no MSAA) adds an fwidth edge so canopies don't jag. */
const LEAF_ALPHA_A2C = `#ifdef USE_ALPHATEST
  #ifdef USE_MAP
    diffuseColor.a*=1.+max(length(dFdx(vMapUv)),length(dFdy(vMapUv)))*24.;
  #endif
  if(diffuseColor.a<alphaTest) discard;
#endif`;
const LEAF_ALPHA_SOFT = `#ifdef USE_ALPHATEST
  #ifdef USE_MAP
    float cov=max(length(dFdx(vMapUv)),length(dFdy(vMapUv)));
    diffuseColor.a*=1.+cov*28.;
    float aw=fwidth(diffuseColor.a);
    diffuseColor.a=clamp((diffuseColor.a-alphaTest)/max(aw,.06)+.5,0.,1.);
  #endif
  if(diffuseColor.a<.08) discard;
#endif`;
const leafAlpha = () => useA2C ? LEAF_ALPHA_A2C : LEAF_ALPHA_SOFT;

function applyLeafAlpha(m: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) {
  if (m.map) {
    m.map.anisotropy = 8;
    m.map.minFilter = THREE.LinearMipmapLinearFilter;
    m.map.magFilter = THREE.LinearFilter;
    m.map.generateMipmaps = true;
    m.map.needsUpdate = true;
  }
  m.transparent = false;
  m.alphaToCoverage = useA2C;
  m.alphaTest = useA2C ? 0.18 : 0.32;
}


export type Kind = { parts: { geo: THREE.BufferGeometry; mat: THREE.Material; leaf: boolean }[]; height: number };

/** Bake each glTF scene (one tree / plant per scene) into merged geometry per material, ready for instancing. */
export function bakeKinds(g: GLTF, opts: { autumnLeaves?: boolean } = {}): Kind[] {
  const out: Kind[] = [];
  const matCache = new Map<string, THREE.Material>();
  for (const sc of g.scenes) {
    sc.updateMatrixWorld(true);
    const byMat = new Map<string, { geos: THREE.BufferGeometry[]; src: THREE.MeshStandardMaterial }>();
    sc.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const e = byMat.get(src.name) ?? { geos: [], src }; e.geos.push(geo); byMat.set(src.name, e);
    });
    const box = new THREE.Box3().setFromObject(sc);
    const parts: Kind['parts'] = [];
    for (const [name, e] of byMat) {
      const leaf = /leaves|leaf|flower/i.test(name);
      let mat = matCache.get(name);
      if (!mat) { mat = makeFoliageMaterial(e.src, leaf, false); matCache.set(name, mat); }
      parts.push({ geo: mergeGeometries(e.geos), mat, leaf });
    }
    out.push({ parts, height: box.max.y - box.min.y });
  }
  void opts;
  return out;
}

const autumnCache = new Map<THREE.Material, THREE.Material>();
/** Gold/amber recolour of a leaf material (keeps the alpha cut-out). */
export function autumnOf(mat: THREE.Material): THREE.Material {
  let a = autumnCache.get(mat);
  if (!a) { a = makeFoliageMaterial(mat as THREE.MeshStandardMaterial, true, true); autumnCache.set(mat, a); }
  return a;
}

function makeFoliageMaterial(src: THREE.MeshStandardMaterial, leaf: boolean, autumn: boolean): THREE.Material {
  const m = new THREE.MeshStandardMaterial({
    map: src.map, normalMap: leaf ? null : src.normalMap, color: src.color.clone(), roughness: leaf ? 0.82 : 0.95, metalness: 0,
    alphaTest: leaf ? 0.32 : 0, transparent: false, side: leaf ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.name = src.name + (autumn ? '_autumn' : '');
  if (!leaf) { if (m.map) m.map.anisotropy = 8; return m; }
  applyLeafAlpha(m);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = foliageUniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `vec3 transformed=vec3(position);
  #ifdef USE_INSTANCING
  vec3 ip=instanceMatrix[3].xyz;
  #else
  vec3 ip=vec3(0.);
  #endif
  float hh=max(0.,position.y);
  float sw=sin(uTime*1.3+ip.x*.13+ip.z*.11)*.5+sin(uTime*2.9+position.x*2.+position.z*1.7)*.18;
  transformed.x+=sw*.025*hh; transformed.z+=sw*.018*hh;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal=normalize(normal+vec3(0.,.6,0.));');
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
${autumn ? 'float L=dot(diffuseColor.rgb,vec3(.3,.59,.11)); diffuseColor.rgb=mix(vec3(.58,.34,.08),vec3(.96,.72,.22),smoothstep(.06,.55,L))*(.65+.85*L);' : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance+=diffuseColor.rgb*${autumn ? 'vec3(.16,.1,.02)' : 'vec3(.07,.1,.03)'};`)
      .replace('#include <alphatest_fragment>', leafAlpha());
  };
  m.customProgramCacheKey = () => (autumn ? 'leafA' : 'leafG') + (useA2C ? 'c' : '');
  return m;
}

/** One InstancedMesh per (kind, part); transforms are [x,y,z,scale,rotY]. */
export function instanceKind(kind: Kind, xf: number[][], o: { autumn?: boolean; shadows?: boolean } = {}): THREE.Group {
  const grp = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const part of kind.parts) {
    const mat = o.autumn && part.leaf ? autumnOf(part.mat) : part.mat;
    const im = new THREE.InstancedMesh(part.geo, mat, xf.length);
    xf.forEach((t, i) => { p.set(t[0], t[1], t[2]); q.setFromAxisAngle(up, t[4]); s.setScalar(t[3]); m4.compose(p, q, s); im.setMatrixAt(i, m4); });
    im.castShadow = o.shadows ?? true; im.receiveShadow = true;
    im.computeBoundingSphere();
    grp.add(im);
  }
  return grp;
}

export function kindTris(kind: Kind): number {
  return kind.parts.reduce((n, p) => n + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0);
}

/**
 * Impostor: render the tree once from the side into a texture (lit roughly like the scene), then draw far trees
 * as camera-facing (Y-axis) cards. Two triangles per tree instead of ~5k.
 */
export function bakeImpostor(renderer: THREE.WebGLRenderer, kind: Kind, autumn: boolean, sunDir: THREE.Vector3): THREE.Texture {
  const sc = new THREE.Scene();
  for (const p of kind.parts) sc.add(new THREE.Mesh(p.geo, autumn && p.leaf ? autumnOf(p.mat) : p.mat));
  sc.add(new THREE.HemisphereLight('#dfeaff', '#55603a', 1.6));
  const d = new THREE.DirectionalLight('#fff1d6', 2.4); d.position.set(-sunDir.x, sunDir.y, 1).multiplyScalar(10); sc.add(d);
  const box = new THREE.Box3(); for (const p of kind.parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!); }
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.55, h = box.max.y - box.min.y;
  const half = Math.max(w, h / 2) * 1.02;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  const cy = box.min.y + half; cam.position.set(0, cy, 30); cam.lookAt(0, cy, 0);
  const rt = new THREE.WebGLRenderTarget(256, 256, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevTM = renderer.toneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.toneMapping = prevTM;
  rt.texture.userData = { half, baseY: box.min.y, cy };
  return rt.texture;
}

function impostorMaterial(tex: THREE.Texture): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.32, transparent: false, side: THREE.DoubleSide });
  applyLeafAlpha(m);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
  vec4 cW = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
  float sW = length((modelMatrix * instanceMatrix * vec4(1.,0.,0.,0.)).xyz);
  vec3 toC = cameraPosition - cW.xyz; toC.y = 0.; toC = normalize(toC + 1e-5);
  vec3 rightV = vec3(toC.z, 0., -toC.x);
  vec3 wp = cW.xyz + rightV * position.x * sW + vec3(0.,1.,0.) * position.y * sW;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.);
  gl_Position = projectionMatrix * mvPosition;`);
    // Darken the card bottom a touch (ground occlusion) so impostors sit in the meadow.
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(.8, 1.05, smoothstep(0., .5, vMapUv.y));')
      .replace('#include <alphatest_fragment>', leafAlpha());
  };
  m.customProgramCacheKey = () => 'impostor' + (useA2C ? 'c' : '');
  return m;
}

export type TreeInst = { k: number; autumn: boolean; x: number; y: number; z: number; s: number; ry: number };

/** All placed trees with distance LOD: full meshes near the player (under a triangle budget), impostor cards beyond. */
export class TreeField {
  group = new THREE.Group();
  private groups = new Map<string, { kind: Kind; full: THREE.InstancedMesh[]; card: THREE.InstancedMesh; list: TreeInst[]; tris: number }>();
  private last = new THREE.Vector2(1e9, 1e9);
  constructor(renderer: THREE.WebGLRenderer, kinds: Kind[], trees: TreeInst[], sunDir: THREE.Vector3, private opts: { nearR: number; triBudget: number; shadowR: number }) {
    for (const t of trees) {
      const key = `${t.k}${t.autumn ? 'a' : 'g'}`;
      let g = this.groups.get(key);
      if (!g) {
        const kind = kinds[t.k];
        const tex = bakeImpostor(renderer, kind, t.autumn, sunDir); const ud = tex.userData as { half: number; cy: number };
        const quad = new THREE.PlaneGeometry(ud.half * 2, ud.half * 2); quad.translate(0, ud.cy, 0);
        const count = trees.filter((q) => q.k === t.k && q.autumn === t.autumn).length;
        const card = new THREE.InstancedMesh(quad, impostorMaterial(tex), count); card.frustumCulled = false;
        const full = kind.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, t.autumn && p.leaf ? autumnOf(p.mat) : p.mat, count); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; return im; });
        g = { kind, full, card, list: [], tris: kindTris(kind) };
        this.groups.set(key, g); this.group.add(card, ...full);
      }
      g.list.push(t);
    }
  }
  /** Re-bucket when the player has moved a few metres. Returns full-mesh triangle count. */
  update(px: number, pz: number, force = false): number {
    if (!force && Math.hypot(px - this.last.x, pz - this.last.y) < 6) return -1;
    this.last.set(px, pz);
    const all: { g: ReturnType<TreeField['groups']['get']> & object; t: TreeInst; d: number }[] = [];
    for (const g of this.groups.values()) for (const t of g.list) all.push({ g, t, d: Math.hypot(t.x - px, t.z - pz) });
    all.sort((a, b) => a.d - b.d);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    const nFull = new Map<object, number>(), nCard = new Map<object, number>();
    let tris = 0;
    for (const { g, t, d } of all) {
      p.set(t.x, t.y, t.z); q.setFromAxisAngle(up, t.ry); s.setScalar(t.s); m4.compose(p, q, s);
      if (d < this.opts.nearR && tris + g.tris <= this.opts.triBudget) {
        const i = nFull.get(g) ?? 0; for (const im of g.full) im.setMatrixAt(i, m4); nFull.set(g, i + 1); tris += g.tris;
      } else {
        const i = nCard.get(g) ?? 0; g.card.setMatrixAt(i, m4); nCard.set(g, i + 1);
      }
    }
    for (const g of this.groups.values()) {
      const nf = nFull.get(g) ?? 0, nc = nCard.get(g) ?? 0;
      for (const im of g.full) { im.count = nf; im.instanceMatrix.needsUpdate = true; }
      g.card.count = nc; g.card.instanceMatrix.needsUpdate = true;
    }
    return tris;
  }
}
