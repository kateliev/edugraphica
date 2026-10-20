/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — part registry.
// Every mesh belongs to exactly one part id. The registry gives each part its own
// material copies so a part can glow (hover/selection) or fade on its own, keeps
// the pick list, moves parts apart for the exploded view and clips the cutaway.
import * as THREE from 'three';
import { UP } from './geometry.js';

// partsMeta: [{ id, group, off:[x,y,z], swing?, sub?, parent?, label? }] — see <microsite>/model/parts.js
//   parent: id of the part this one is a detail of. Selecting the detail keeps the parent
//           half-visible; selecting the parent keeps its details visible.
export function createRegistry(partsMeta, state) {
  const PART = Object.fromEntries(partsMeta.map((p, i) => [p.id, { ...p, index: i }]));
  const partObjs = {}, partMats = {}, matCache = {}, pickables = [], explodables = [];
  const ACC = new THREE.Color('#ff6a1a'), BLACK = new THREE.Color(0);
  let pivot = null;          // optional group that turns as a whole (explode offsets follow it)
  let cutMap = null;         // cutaway: { key: planes[] } for materials with userData.cut = key

  // Give every mesh under obj the part id and a per-part material.
  // Call again for groups whose children are rebuilt at runtime (ropes, helpers).
  function adopt(id, obj, o = {}) {
    const cache = (matCache[id] ||= new Map());
    const swap = mt => {
      if (!cache.has(mt)) {
        const c = mt.clone();
        c.userData = { ...mt.userData, baseOpacity: mt.opacity, baseTransparent: mt.transparent, baseDepthWrite: mt.depthWrite,
          baseEmissive: mt.emissive?.clone(), baseEmissiveIntensity: mt.emissiveIntensity };   // lamps and fires keep their own glow
        if (c.userData.cut) c.clippingPlanes = cutMap?.[c.userData.cut] || [];
        cache.set(mt, c); (partMats[id] ||= []).push(c);
      }
      return cache.get(mt);
    };
    obj.traverse(m => {
      if (!m.isMesh && !m.isLine) return;
      m.userData.part = id;
      if (!m.userData.adopted) {
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
        if (!o.noPick && m.isMesh) pickables.push(m);
        if (o.helper) m.renderOrder = 5; else if (m.isMesh) { m.castShadow = o.shadow !== false; m.receiveShadow = true; }
        m.userData.adopted = true;
      }
    });
    for (let i = pickables.length - 1; i >= 0; i--) if (!pickables[i].parent) pickables.splice(i, 1);   // drop rebuilt meshes
  }
  function reg(id, obj, o = {}) {
    const P = PART[id]; if (!P) { console.warn('unknown part', id); return obj; }
    adopt(id, obj, o);
    (partObjs[id] ||= []).push(obj);
    explodables.push({ obj, base: obj.position.clone(), off: new THREE.Vector3(...(o.off || P.off || [0, 0, 0])), swing: o.swing ?? !!P.swing });
    return obj;
  }
  const add = (parent, id, obj, o) => { parent.add(obj); return reg(id, obj, o); };
  const offsetOf = id => new THREE.Vector3(...(PART[id].off || [0, 0, 0])).multiplyScalar(state.explode);
  // The base (assembled) position of an object changed at runtime (e.g. a turning mount).
  function rebase(obj) { const ex = explodables.find(e => e.obj === obj); if (ex) ex.base.copy(obj.position); }

  function applyExplode() {
    for (const ex of explodables) {
      const off = ex.off.clone().multiplyScalar(state.explode);
      if (ex.swing && pivot) off.applyAxisAngle(UP, -pivot.rotation.y);   // offsets are given in the model frame; swing parts sit inside the pivot
      ex.obj.position.copy(ex.base).add(off);
    }
  }

  // Hover and selection glow; with state.ghost the unselected parts fade out.
  function applyLook() {
    const sel = state.selected, hov = state.hover, selPart = sel && PART[sel];
    for (const id in partMats) {
      const P = PART[id], hl = id === sel || id === hov;
      const keepParent = selPart?.parent === id;                    // a detail is selected: keep its parent half-visible
      const isChild = sel && P.parent === sel;                       // the parent is selected: keep its details
      const fade = state.ghost && sel && !hl && !isChild;
      for (const m of partMats[id]) {
        if (m.userData.helper) { m.opacity = hl ? (id === hov && id !== sel ? .55 : .85) : 0; continue; }
        if (m.emissive) {
          if (hl) { m.emissive.copy(ACC); m.emissiveIntensity = id === sel ? .42 : .28; }
          else { m.emissive.copy(m.userData.baseEmissive || BLACK); m.emissiveIntensity = m.userData.baseEmissive ? m.userData.baseEmissiveIntensity : 0; }
        }
        const tr = fade || m.userData.baseTransparent;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = fade ? (keepParent ? .45 : .1) * (m.userData.baseOpacity ?? 1) : m.userData.baseOpacity;
        m.depthWrite = fade ? false : m.userData.baseDepthWrite;
      }
    }
  }
  function paint(color) { for (const id in partMats) for (const m of partMats[id]) if (m.userData.paint) m.color.set(color); }

  // Cutaway: clip every material marked userData.cut = key with map[key] (a list of planes; the model
  // sets material.clipIntersection to choose "inside all planes" or "inside any"). null = whole model.
  function setCut(map) {
    cutMap = map || null;
    for (const id in partMats) for (const m of partMats[id]) if (m.userData.cut) { m.clippingPlanes = cutMap?.[m.userData.cut] || []; m.needsUpdate = true; }
  }

  return { PART, partObjs, partMats, pickables, reg, adopt, add, rebase, offsetOf, applyExplode, applyLook, paint, setCut, setPivot: p => { pivot = p; } };
}
