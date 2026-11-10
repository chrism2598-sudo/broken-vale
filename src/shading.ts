import * as THREE from 'three';

/**
 * Stylised fill + rim on a standard material: a hemisphere-tinted ambient fill (sky above, warm/violet bounce below)
 * and a Fresnel rim so silhouettes read against bright skies and inside shadows.
 */
export function addRimFill(mat: THREE.MeshStandardMaterial, o: { fill?: number; rim?: number; rimColor?: string; sky?: string; ground?: string } = {}) {
  const fill = o.fill ?? 0.12, rim = o.rim ?? 0.35;
  const rc = new THREE.Color(o.rimColor ?? '#bcd3e6'), sky = new THREE.Color(o.sky ?? '#d4e2f2'), gr = new THREE.Color(o.ground ?? '#6b5a4a');
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vN = normalize(normal); vec3 wN = inverseTransformDirection(vN, viewMatrix);
  float fr = pow(1. - clamp(dot(vN, normalize(vViewPosition)), 0., 1.), 3.);
  vec3 hemi = mix(vec3(${gr.r.toFixed(3)},${gr.g.toFixed(3)},${gr.b.toFixed(3)}), vec3(${sky.r.toFixed(3)},${sky.g.toFixed(3)},${sky.b.toFixed(3)}), wN.y * .5 + .5);
  totalEmissiveRadiance += diffuseColor.rgb * hemi * ${fill.toFixed(3)} + vec3(${rc.r.toFixed(3)},${rc.g.toFixed(3)},${rc.b.toFixed(3)}) * fr * ${rim.toFixed(3)}; }`);
  };
  mat.customProgramCacheKey = () => `rimfill-${fill}-${rim}-${o.rimColor}-${o.sky}-${o.ground}`;
  mat.needsUpdate = true;
}
