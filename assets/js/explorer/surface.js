/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — procedural surface noise for large plain surfaces (painted steel, decks, canvas).
// No textures: the shader makes a 3D value noise from each point's position in the mesh's own space
// (metres), so the grain has the same size on every part, needs no UVs and stays on a part when it
// moves (explode, turning mounts). Two layers:
//   mottle — large soft patches (colour and gloss vary a little, like old paint),
//   grain  — fine speckle (gloss and a slight bump); it fades out where it would be smaller than a
//            pixel, so far views do not shimmer.
//   addSurfaceNoise(material, { mottle: 0.45, grain: 9, color: 0.05, rough: 0.12, bump: 0.004 })
//     mottle, grain: frequencies (1/metre); color: ± brightness; rough: ± roughness; bump: grain relief.
// Works with MeshStandardMaterial and MeshPhysicalMaterial. All noisy materials share one strength
// (SURFACE_NOISE.value, 0…1): ?noise=0 in the address turns it off to compare.
export const SURFACE_NOISE = { value: new URLSearchParams(location.search).get('noise') === '0' ? 0 : 1 };

const DEFAULTS = { mottle: .45, grain: 9, color: .05, rough: .12, bump: .004 };
const f = v => Number(v).toFixed(5);   // GLSL float literal

const NOISE_GLSL = `
uniform float egStrength;
varying vec3 vEgPos;
float egHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float egNoise(vec3 x) {
  vec3 i = floor(x), u = fract(x); u = u * u * (3.0 - 2.0 * u);
  return mix(mix(mix(egHash(i), egHash(i + vec3(1, 0, 0)), u.x), mix(egHash(i + vec3(0, 1, 0)), egHash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(egHash(i + vec3(0, 0, 1)), egHash(i + vec3(1, 0, 1)), u.x), mix(egHash(i + vec3(0, 1, 1)), egHash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}`;

function install(mat) {
  const o = mat.userData.noise;
  mat.onBeforeCompile = shader => {
    shader.uniforms.egStrength = SURFACE_NOISE;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEgPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEgPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float egMottle = egNoise(vEgPos * ${f(o.mottle)}) * 0.6 + egNoise(vEgPos * ${f(o.mottle * 2.7)} + 7.3) * 0.4;
        float egGrain = egNoise(vEgPos * ${f(o.grain)} + 3.1);
        float egFade = 1.0 - smoothstep(0.35, 1.2, length(fwidth(vEgPos * ${f(o.grain)})));
        diffuseColor.rgb *= 1.0 + egStrength * ${f(o.color)} * ((egMottle - 0.5) * 2.0 + (egGrain - 0.5) * egFade);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + egStrength * ${f(o.rough)} * ((egMottle - 0.5) * 1.4 + (egGrain - 0.5) * egFade), 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float egH = egGrain * egFade * egStrength * ${f(o.bump)};
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dFdx(egH) * r1 + dFdy(egH) * r2));
        }`);
  };
  mat.customProgramCacheKey = () => 'eg-noise:' + JSON.stringify(o);
  mat.needsUpdate = true;
  return mat;
}

export function addSurfaceNoise(mat, opts = {}) {
  mat.userData.noise = { ...DEFAULTS, ...opts };
  return install(mat);
}
// Material.clone() does not carry onBeforeCompile: the part registry calls this on its copies.
export function reapplySurfaceNoise(mat) { return mat.userData?.noise ? install(mat) : mat; }
