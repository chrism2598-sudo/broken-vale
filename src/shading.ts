import * as THREE from 'three';

// ---------- M21a · height fog + aerial perspective (every fogged material, built-in or patched) ----------
// Exp² fog whose density follows the air: the ray's average density between the camera height and the point
// (exponential fall-off with height), so the meadow floor holds a low haze while ridgelines read clear but blue;
// distance also desaturates before the fog colour lands (aerial perspective). Cheap: one varying + a few ALU ops.
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogH;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogH = cameraPosition.y + ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying float vFogH;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fA = 0.045, fH0 = max( cameraPosition.y - 1.0, 0.0 ), fH1 = max( vFogH - 1.0, 0.0 ), fDh = fH1 - fH0;
		float fAvg = abs( fDh ) < 0.05 ? exp( - fA * fH0 ) : ( exp( - fA * fH0 ) - exp( - fA * fH1 ) ) / ( fA * fDh );
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * ( 0.3 + 0.72 * fAvg ) );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	float fL = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fL ), fogFactor * 0.35 );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

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

/** Hero shading kinds. Skin/hair/cloth get a combined wrap + rim so Ilka doesn't read as flat plastic or a silhouette. */
export type HeroKind = 'skin' | 'hair' | 'cloth' | 'leather' | 'metal' | 'gold' | 'eye';

const WORLD_VARYING = {
  vertCommon: '#include <common>\nvarying vec3 vHW; varying vec3 vWN;',
  worldpos: '#include <worldpos_vertex>\nvHW=(modelMatrix*vec4(transformed,1.)).xyz; vWN=inverseTransformDirection(normalize(transformedNormal),viewMatrix);',
  fragCommon: '#include <common>\nvarying vec3 vHW; varying vec3 vWN;',
};

function heroBody(kind: HeroKind): { rough: string; emit: string } {
  const head = `{ vec3 vN=normalize(normal); vec3 wN=normalize(vWN); vec3 V=normalize(vViewPosition);
  float fr=pow(1.-clamp(dot(vN,V),0.,1.),2.4);
  vec3 hemi=mix(vec3(.36,.24,.16),vec3(.88,.91,.96),wN.y*.5+.5);`;
  if (kind === 'skin') return {
    rough: 'roughnessFactor=mix(roughnessFactor,.48,.35);',
    emit: `${head}
  vec3 sss=vec3(.66,.2,.08)*(fr*.7+(.5+.5*wN.y)*(.5+.5*wN.y)*.22);
  totalEmissiveRadiance+=diffuseColor.rgb*hemi*.26+sss*.9+vec3(.96,.78,.68)*fr*.18; }`,
  };
  if (kind === 'hair') return {
    rough: `float strand=.84+.16*sin(vHW.y*80.); diffuseColor.rgb*=strand; roughnessFactor=mix(roughnessFactor,.28,.5);`,
    emit: `${head}
  vec3 T=normalize(mix(vec3(0.,1.,0.),cross(wN,vec3(0.,1.,0.))+1e-4,.65));
  vec3 Ts=normalize(T+wN*.15); float aniso=pow(clamp(1.-dot(Ts,V)*dot(Ts,V),0.,1.),7.);
  totalEmissiveRadiance+=diffuseColor.rgb*hemi*.2+vec3(.78,.56,.3)*aniso*.55; }`,
  };
  if (kind === 'leather') return {
    rough: `float grain=.5+.5*sin(vHW.x*16.+vHW.y*14.); diffuseColor.rgb*=.91+.09*grain; roughnessFactor*=.9+.12*grain;`,
    emit: `{ vec3 vN=normalize(normal); vec3 wN=normalize(vWN); float fr=pow(1.-clamp(dot(vN,normalize(vViewPosition)),0.,1.),2.4);
  vec3 hemi=mix(vec3(.38,.26,.16),vec3(.86,.82,.74),wN.y*.5+.5);
  totalEmissiveRadiance+=diffuseColor.rgb*hemi*.26+vec3(.9,.82,.7)*fr*.22; }`,
  };
  return {
    rough: `float weave=.5+.5*sin(vHW.x*28.+vHW.y*24.); diffuseColor.rgb*=.94+.06*weave; roughnessFactor*=.92+.1*weave;`,
    emit: `${head}
  totalEmissiveRadiance+=diffuseColor.rgb*hemi*.32+vec3(.82,.90,.96)*fr*.38; }`,
  };
}

/** Skin wrap/SSS, fabric weave, hair anisotropic sheen, and a stronger rim/fill on dark cloth. */
export function styleHeroMaterial(mat: THREE.MeshStandardMaterial, kind: HeroKind) {
  if (kind === 'eye') { mat.roughness = 0.18; mat.metalness = 0; mat.envMapIntensity = 1.1; mat.needsUpdate = true; return; }
  if (kind === 'gold') { mat.roughness = 0.32; mat.metalness = 0.75; mat.envMapIntensity = 1.0; addRimFill(mat, { fill: 0.14, rim: 0.25, rimColor: '#f0e0b0' }); return; }
  if (kind === 'metal') { mat.roughness = 0.38; mat.metalness = 0.55; mat.envMapIntensity = 1.05; addRimFill(mat, { fill: 0.16, rim: 0.28, rimColor: '#e8eef2' }); return; }
  if (kind === 'skin') { mat.roughness = 0.54; mat.metalness = 0; mat.envMapIntensity = 0.45; }
  else if (kind === 'hair') { mat.roughness = 0.38; mat.metalness = 0; mat.envMapIntensity = 0.7; mat.side = THREE.FrontSide; }
  else if (kind === 'leather') { mat.roughness = 0.72; mat.metalness = 0.04; mat.envMapIntensity = 0.4; }
  else { mat.roughness = 0.76; mat.metalness = 0; mat.envMapIntensity = 0.5; }
  const { rough, emit } = heroBody(kind);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    if (!sh.vertexShader.includes('vHW')) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', WORLD_VARYING.vertCommon).replace('#include <worldpos_vertex>', WORLD_VARYING.worldpos);
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', WORLD_VARYING.fragCommon)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${rough}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${emit}`);
  };
  mat.customProgramCacheKey = () => 'hero-' + kind;
  mat.needsUpdate = true;
}

/** Classify a hero material: Universal Ranger outfits, or the older Ultimate Modular NPC rigs. */
export function heroKindFor(meshName: string, matName: string, colorKey?: string): HeroKind {
  if (colorKey === 'Casual_Legs/Skin') return 'leather';
  if (matName === 'Eye' || matName === 'MI_Eyes' || meshName === 'Eyes' || meshName === 'Face.001') return 'eye';
  if (matName === 'Gold') return 'gold';
  if (matName === 'Metal') return 'metal';
  if (matName === 'Hair' || matName === 'Eyebrows' || matName === 'MI_Hair_1' || matName === 'MI_Hair_2'
    || /Hair|Eyebrow|^Face$/.test(meshName) || (matName === 'White' && /Head/i.test(meshName))) return 'hair';
  if (matName === 'Skin' || matName === 'MI_Superhero_Female' || matName === 'MI_Superhero_Male'
    || matName === 'MI_Regular_Female' || matName === 'MI_Regular_Male') return 'skin';
  if (matName === 'Black' || matName === 'Brown' || matName === 'White') return 'leather';
  if (matName === 'MI_Ranger') return /Feet|Boot|Leg|Belt|Bracer|Pauldron/i.test(meshName) ? 'leather' : 'cloth';
  return 'cloth';
}
