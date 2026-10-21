/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — part registry.
// Every mesh belongs to exactly one part id. The registry gives each part its own
// material copies so a part can glow (hover/selection) or fade on its own, keeps
// the pick list, moves parts apart for the exploded view and clips the cutaway.
import * as THREE from 'three';
import { UP } from './geometry.js';
import { reapplySurfaceNoise } from './surface.js';

// partsMeta: [{ id, group, off:[x,y,z], swing?, sub?, parent?, label?, split?, spread? }] — see <microsite>/model/parts.js
//   parent: id of the part this one is a detail of. Selecting the detail keeps the parent
//           half-visible; selecting the parent keeps its details visible.
//   split:  the part has a copy on each side (two guns, two boats): in the exploded view each direct
//           child of its object moves on its own, and off[2] is how far it moves outward, to its own side.
//   spread: how much of the radial spread (setSpread) the part takes (default 1; 0 = none).
export function createRegistry(partsMeta, state) {
  const PART = Object.fromEntries(partsMeta.map((p, i) => [p.id, { ...p, index: i }]));
  const partObjs = {}, partMats = {}, matCache = {}, pickables = [], explodables = [];
  const ACC = new THREE.Color('#ff6a1a'), BLACK = new THREE.Color(0);
  let pivot = null;          // optional group that turns as a whole (explode offsets follow it)
  let cutMap = null;         // cutaway: { key: planes[] } for materials with userData.cut = key
  // Radial spread of the exploded view: each object also moves away from the model's centre by
  // spread × its own centre (model frame), so the parts fan out fore and aft and to the sides, not only up.
  const spread = new THREE.Vector3();

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
        reapplySurfaceNoise(c);   // clone() drops the shader hook of surface noise
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
    const off = new THREE.Vector3(...(o.off || P.off || [0, 0, 0])), swing = o.swing ?? !!P.swing;
    for (const it of P.split ? obj.children : [obj]) explodables.push({ id, obj: it, base: it.position.clone(), off, swing, split: !!P.split, k: P.spread ?? 1, move: null, cur: new THREE.Vector3() });
    return obj;
  }
  const add = (parent, id, obj, o) => { parent.add(obj); return reg(id, obj, o); };
  // Where the part is now, relative to its assembled place (label anchors): the mean over its objects.
  function offsetOf(id) {
    const v = new THREE.Vector3(); let n = 0;
    for (const ex of explodables) if (ex.id === id) { v.add(ex.cur); n++; }
    return n ? v.divideScalar(n) : v;
  }
  // The base (assembled) position of an object changed at runtime (e.g. a turning mount).
  function rebase(obj) { const ex = explodables.find(e => e.obj === obj); if (ex) ex.base.copy(obj.position); }

  // Full exploded offset of one object, worked out once from where its centre is (in its parent's frame).
  const _b = new THREE.Box3(), _c = new THREE.Vector3();
  function moveOf(ex) {
    _b.setFromObject(ex.obj);
    if (_b.isEmpty()) _c.set(0, 0, 0); else { _b.getCenter(_c); ex.obj.parent?.worldToLocal(_c); }
    _c.sub(ex.obj.position).add(ex.base);   // the centre when assembled
    const m = ex.off.clone();
    if (ex.split) m.z = Math.abs(_c.z) > .15 ? Math.sign(_c.z) * ex.off.z : 0;
    return m.addScaledVector(_c.multiply(spread), ex.k);
  }
  function applyExplode() {
    for (const ex of explodables) {
      ex.move ||= moveOf(ex);
      const off = ex.cur.copy(ex.move).multiplyScalar(state.explode), d = off.clone();
      if (ex.swing && pivot) d.applyAxisAngle(UP, -pivot.rotation.y);   // offsets are given in the model frame; swing parts sit inside the pivot
      ex.obj.position.copy(ex.base).add(d);
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

  return { PART, partObjs, partMats, pickables, reg, adopt, add, rebase, offsetOf, applyExplode, applyLook, paint, setCut, setPivot: p => { pivot = p; },
    setSpread: ([x, y, z]) => { spread.set(x, y, z); for (const ex of explodables) ex.move = null; } };
}
