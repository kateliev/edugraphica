/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — procedural surface finish for large plain surfaces (painted steel, decks, canvas).
// No textures: the shader makes 3D value noise from each point's position in the mesh's own space
// (metres), so the pattern has the same size on every part, needs no UVs and stays on a part when it
// moves (explode, turning mounts). Layers, all quiet on their own:
//   mottle — large soft patches: the gloss varies, the colour only a little (old paint, touch-ups);
//   wave   — gentle waviness of the plating about a metre across: it only tilts the normal, so it
//            shows as a slow wobble in reflections and highlights, never as a texture;
//   dent   — the same at hand size, for funnels, tubes and fittings smaller than a wave;
//   streak — faint vertical weathering streaks (darker, duller) on upright faces only;
//   peel   — fine "orange peel" of brushed paint, seen in highlights close up; where it would be
//            smaller than a pixel it turns into a little extra roughness instead, so nothing shimmers.
// The tilts use the noise's exact gradient (not screen-space derivatives), so they stay smooth.
//   addSurfaceNoise(material, { mottle: .4, color: .03, rough: .1, wave: .16, waveFreq: 1.1, dent: 0, dentFreq: 5,
//                               streak: 0, streakFreq: 9, peel: .012, peelFreq: 90, peelRough: .05 })
//     mottle, …Freq: frequencies (1/metre); color: ± brightness; rough: ± roughness; streak: how much a
//     streak darkens; wave, dent, peel: strength of the tilt (about the slope in radians at the steepest);
//     peelRough: roughness the peel leaves when far. The wave eases to 40 % when far, so a whole ship
//     does not look mottled. Streaks run along the mesh's own y axis (up for most parts).
// Works with MeshStandardMaterial and MeshPhysicalMaterial. All materials share one strength
// (SURFACE_NOISE.value, 0…1): ?noise=0 in the address turns it off to compare.
import * as THREE from 'three';

export const SURFACE_NOISE = { value: new URLSearchParams(location.search).get('noise') === '0' ? 0 : 1 };
// Strength of the tilts alone (wave, dent, peel): a low sun shows them gently, a high one too clearly,
// so each scene palette sets its own (palette.relief, applied by the explorer).
export const SURFACE_RELIEF = { value: 1 };

const DEFAULTS = { mottle: .4, color: .03, rough: .1, wave: .16, waveFreq: 1.1, dent: 0, dentFreq: 5, streak: 0, streakFreq: 9, peel: .012, peelFreq: 90, peelRough: .05 };

const NOISE_GLSL = `
uniform float egStrength, egRelief;
uniform vec4 egA, egB, egC;   // (mottle, color, rough, peelRough), (wave, waveFreq, dent, dentFreq), (streak, streakFreq, peel, peelFreq)
varying vec3 vEgPos, vEgN0, vEgN1, vEgN2, vEgNrm;
float egHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
// value noise in 0…1 (x) and its gradient (yzw); quintic blending keeps the gradient smooth across cells
vec4 egNoiseD(vec3 x) {
  vec3 i = floor(x), w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0), du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
  float a = egHash(i), b = egHash(i + vec3(1, 0, 0)), c = egHash(i + vec3(0, 1, 0)), d = egHash(i + vec3(1, 1, 0));
  float e = egHash(i + vec3(0, 0, 1)), g = egHash(i + vec3(1, 0, 1)), h = egHash(i + vec3(0, 1, 1)), k = egHash(i + vec3(1, 1, 1));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
float egFadeAt(float freq) { return 1.0 - smoothstep(0.25, 0.8, length(fwidth(vEgPos)) * freq); }   // 1 while the pattern is bigger than a pixel`;

// The settings are uniforms, not numbers written into the shader, so every material with surface noise
// shares one shader (per three.js variant): fewer shaders to compile when the page opens.
function install(mat) {
  const o = mat.userData.noise, V = (a, b, c, d) => ({ value: new THREE.Vector4(a, b, c, d) });
  const u = { egA: V(o.mottle, o.color, o.rough, o.peelRough), egB: V(o.wave, o.waveFreq, o.dent, o.dentFreq), egC: V(o.streak, o.streakFreq, o.peel, o.peelFreq) };
  mat.onBeforeCompile = shader => {
    shader.uniforms.egStrength = SURFACE_NOISE; shader.uniforms.egRelief = SURFACE_RELIEF; Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEgPos, vEgN0, vEgN1, vEgN2, vEgNrm;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEgPos = transformed; vEgNrm = objectNormal;
        vEgN0 = normalMatrix[0]; vEgN1 = normalMatrix[1]; vEgN2 = normalMatrix[2];   // mesh space → view space for the tilts`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float egMottle = egNoiseD(vEgPos * egA.x).x * 0.65 + egNoiseD(vEgPos * egA.x * 2.6 + 7.3).x * 0.35;
        float egPeelFade = egFadeAt(egC.w);
        float egStreak = 0.0;
        if (egC.x > 0.0) {   // long thin noise along y: streaks; only on faces that stand upright
          float sf = egC.y;
          float s = egNoiseD(vEgPos * vec3(sf, sf * 0.06, sf) + 2.0).x * 0.6 + egNoiseD(vEgPos * vec3(sf * 2.3, sf * 0.12, sf * 2.3) + 9.0).x * 0.4;
          egStreak = smoothstep(0.5, 0.85, s) * smoothstep(0.35, 0.85, 1.0 - abs(normalize(vEgNrm).y)) * egFadeAt(sf * 2.3) * egC.x;
        }
        diffuseColor.rgb *= (1.0 + egStrength * egA.y * (egMottle - 0.5) * 2.0) * (1.0 - egStrength * egStreak);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + egStrength * (egA.z * (egMottle - 0.5) * 2.0 + egA.w * (1.0 - egPeelFade) + egStreak * 1.5), 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 egG = (egNoiseD(vEgPos * egB.y + 1.7).yzw + 0.45 * egNoiseD(vEgPos * egB.y * 2.3 + 11.0).yzw) * egB.x * egFadeAt(egB.y * 2.3)
                     * (1.0 - 0.6 * smoothstep(0.012, 0.05, length(fwidth(vEgPos)) * egB.y))
                   + egNoiseD(vEgPos * egB.w + 3.3).yzw * egB.z * egFadeAt(egB.w)
                   + egNoiseD(vEgPos * egC.w + 5.0).yzw * egC.z * egPeelFade;
          egG = mat3(vEgN0, vEgN1, vEgN2) * egG * egStrength * egRelief;
          normal = normalize(normal - (egG - dot(egG, normal) * normal));
        }`);
  };
  mat.customProgramCacheKey = () => 'eg-noise5';
  mat.needsUpdate = true;
  return mat;
}

export function addSurfaceNoise(mat, opts = {}) {
  mat.userData.noise = { ...DEFAULTS, ...opts };
  return install(mat);
}
// Material.clone() does not carry onBeforeCompile: the part registry calls this on its copies.
export function reapplySurfaceNoise(mat) { return mat.userData?.noise ? install(mat) : mat; }
