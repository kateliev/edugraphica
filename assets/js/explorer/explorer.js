/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — entry point (ported from the youngsails.org boat explorer). A page calls:
//   startExplorer({ site: 'drazki', ns: 'ship', createModel, parts, groups, paints? })
// Strings: /i18n/<lang>/common.json (UI words) and /<site>/i18n/<lang>/<ns>.json (title, overview,
// groups, parts, controls). createModel({ registry, M, t }) must return:
//   { root, waterline:{x0,x1,hb[]}, floorY, home:{pos,target,tallDrop?}, update(time, dt),
//     onExplode?(), anchor?(id, v3), redraw?(), controls?[], stage?{}, motion?{}, shadowSize?,
//     labelHidden?(id, state), onSelect?(id), onMode?(mode), bindUI?(ui), attach?(stage) }
//   controls:  toolbar controls the model adds (ui.js → buildControls):
//              { id, type:'range', min, max, step, value, label, format(v) → string, set(v) }
//              { id, type:'toggle', label, value, set(on) }      { id, type:'button', label, run(), enabled?() }
//              label = key in the model strings M.
//   stage:     options for createStage (scale, view, shadowMap …) — see stage.js.
//   motion:    gentle motion on the water { heave (m), pitch, roll (rad) }; defaults suit a dinghy.
//   shadowSize (optional): half-size in metres of the sun's shadow box (default 4).
//   home.tallDrop (optional): how far the camera target drops on tall (phone) screens (default 0.75 m).
import * as THREE from 'three';
import { pickLang, pickGloss, loadStrings, loadRaw, t } from '../core/i18n.js';
import { SITE } from '../core/config.js';
import { createStage } from './stage.js';
import { createRegistry } from './registry.js';
import { createUI } from './ui.js';
import { displayFont } from './geometry.js';
import { SURFACE_NOISE, SURFACE_RELIEF } from './surface.js';

export async function startExplorer({ site, ns, createModel, parts, groups, paints = [] }) {
  const lang = pickLang(), glossLang = pickGloss(lang);
  document.documentElement.lang = lang;
  // Load the display font before the model draws names and decals onto canvases
  // (capped wait; model.redraw() repaints them again once all fonts are in).
  const fontReady = Promise.race([document.fonts?.load(`700 40px ${displayFont()}`).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
  const [S, W, M, G] = await Promise.all([loadStrings('common', lang), loadStrings('site', lang, site), loadStrings(ns, lang, site), loadRaw(ns, glossLang, site), fontReady]);
  if (G) G._lang = glossLang;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { explode: 0, explodeTarget: 0, selected: null, hover: null, ghost: true, mode: 'water', labels: false };
  const canvas = document.getElementById('scene');
  // Credit in a corner of the 3D view. It sits right after the canvas, so the part labels
  // and every panel draw over it; it takes no clicks (explorer.css → .scene-credit).
  const credit = Object.assign(document.createElement('div'), { className: 'scene-credit', textContent: SITE.domain });
  credit.setAttribute('aria-hidden', 'true');
  canvas.after(credit);
  const registry = createRegistry(parts, state);
  const model = createModel({ registry, M, t, lang });
  const stage = createStage(canvas, model.stage);
  const root = model.root;
  stage.scene.add(root);
  stage.setWaterline(model.waterline);
  stage.setFloor(model.floorY);
  if (model.shadowSize) stage.setShadowSize(model.shadowSize);
  model.attach?.(stage);
  stage.applyEnvI();   // the start palette's reflection strength, now that the model's materials are in the scene
  stage.onPalette(p => { SURFACE_RELIEF.value = p.relief; });   // how clearly the surface relief shows in this light

  const ui = createUI({ stage, registry, model, state, S, W, M, G, parts, groups, paints, lang });
  const mo = { heave: .012, pitch: .01, roll: .018, ...model.motion };   // roll = about the length (x), pitch = about the beam (z)

  const clock = new THREE.Clock();
  const { renderer, scene, camera, controls } = stage;
  function frame() {
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    if (state.mode === 'water' && !reduceMotion) {
      root.position.y = Math.sin(time * 1.3) * mo.heave;
      root.rotation.x = Math.sin(time * .9) * mo.roll + Math.sin(time * 2.1) * mo.roll * .28;
      root.rotation.z = Math.sin(time * .7 + 1) * mo.pitch;
    }
    root.updateMatrixWorld();
    stage.tick(time, root);
    model.update(reduceMotion ? 0 : time, reduceMotion ? 0 : dt, state);
    if (state.explode !== state.explodeTarget) {
      state.explode += (state.explodeTarget - state.explode) * (reduceMotion ? 1 : Math.min(1, dt * 3.2));
      if (Math.abs(state.explode - state.explodeTarget) < .002) state.explode = state.explodeTarget;
      registry.applyExplode(); model.onExplode?.(); registry.applyLook();
    }
    ui.tweenStep(dt);
    controls.update();
    ui.processHover();
    renderer.render(scene, camera);
    ui.updateLabels();
    requestAnimationFrame(frame);
  }
  precompile(renderer, scene, camera, shown);   // what the first frame shows
  document.getElementById('loading')?.remove();
  frame();
  // Then what is hidden now (studio floor, cutaway, people …), one hidden group at a time in idle moments
  // while the first view is on screen, so later switches do not stall and no single pause is long.
  // Groups that bring no new kind of material (the hidden smoke puffs) are skipped.
  const kind = m => [m.type, !!m.map, m.side, m.transparent, m.clippingPlanes?.length, m.customProgramCacheKey()].join();
  const seen = new Set(), hidden = [];
  scene.traverse(o => { if (o.material && shown(o)) seen.add(kind(o.material)); });
  scene.traverse(o => {
    if (o.visible || !shown(o.parent)) return;
    let fresh = false; o.traverse(c => { if (c.material && !seen.has(kind(c.material))) { seen.add(kind(c.material)); fresh = true; } });
    if (fresh) hidden.push(o);
  });
  const idle = f => (window.requestIdleCallback || setTimeout)(f, { timeout: 2000 });
  const warm = () => { const g = hidden.shift(); if (!g) return; precompile(renderer, scene, camera, o => under(o, g)); idle(warm); };
  setTimeout(() => idle(warm), 1000);
  document.fonts?.ready.then(() => model.redraw?.());

  // Handle for later stages (lessons, quizzes) and for debugging from the console.
  // noise: SURFACE_NOISE.value = 0…1 changes the surface noise live (or ?noise=0 in the address).
  window.edugraphica = { THREE, stage, registry, model, state, ui, strings: { S, W, M, G }, t, noise: SURFACE_NOISE };
  return window.edugraphica;
}

const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const under = (o, g) => { for (; o; o = o.parent) if (o === g) return true; return false; };

// Compile the shaders of the objects that pass take(object) in one batch, before they are drawn: a shader
// built in the middle of a frame costs far more (here about 1 s each, against a fraction of that in a batch).
// three r147's renderer.compile() keys each shader with the clipping state the last draw left behind, so
// objects are compiled in one round per clipping state, after a tiny off-screen draw that sets that state.
function precompile(renderer, scene, camera, take) {
  const mats = new Map(), groups = new Map();   // object → its material; "planes|intersection" → objects that take part
  scene.traverse(o => {
    const m = o.material; if (!m) return;
    mats.set(o, m);
    if (!take(o)) return;
    const k = m.clippingPlanes?.length ? `${m.clippingPlanes.length}|${m.clipIntersection}` : '';
    (groups.get(k) || groups.set(k, []).get(k)).push(o);
  });
  const rt = new THREE.WebGLRenderTarget(1, 1), probe = new THREE.Scene(), dot = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  dot.frustumCulled = false; probe.add(dot);
  const prime = m => { dot.material = m; renderer.setRenderTarget(rt); renderer.render(probe, camera); renderer.setRenderTarget(null); };
  for (const [k, list] of groups) {   // one round per clipping state; compile() skips objects without a material
    const m = mats.get(list[0]);
    prime(k ? new THREE.MeshBasicMaterial({ clippingPlanes: m.clippingPlanes, clipIntersection: m.clipIntersection }) : new THREE.MeshBasicMaterial());
    const set = new Set(list);
    for (const [o, mo] of mats) o.material = set.has(o) ? mo : null;
    renderer.compile(scene, camera);
  }
  for (const [o, m] of mats) o.material = m;
  rt.dispose(); dot.geometry.dispose();
}
