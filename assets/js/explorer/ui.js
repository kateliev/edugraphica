/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica explorer — panels, info card, toolbar, labels, picking, camera moves.
// All visible text comes from the i18n dictionaries passed in:
//   S = /i18n/<lang>/common.json (UI words), W = <site>/i18n/<lang>/site.json (microsite name),
//   M = <site>/i18n/<lang>/<ns>.json (model title, part names and texts), G = glossary language names.
import * as THREE from 'three';
import { t, applyDom } from '../core/i18n.js';
import { siteHref } from '../core/sitenav.js';
import { clamp, deg } from './geometry.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI({ stage, registry, model, state, S, W, M, G, parts, groups, paints, lang }) {
  const { camera, controls, renderer } = stage;
  const canvas = renderer.domElement;
  const { PART, partObjs, pickables } = registry;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const card = $('card'), tip = $('tip'), listEl = $('partList'), labelsEl = $('labels');
  const name = id => M.parts?.[id]?.name || id;
  const gloss = id => G?.parts?.[id]?.name || '';

  applyDom([M, S]);
  // title with one accent letter (M.titleAccent = its index)
  const title = M.title || '', ai = M.titleAccent ?? -1;
  $('modelTitle').innerHTML = ai >= 0 && ai < title.length ? `${esc(title.slice(0, ai))}<span>${esc(title[ai])}</span>${esc(title.slice(ai + 1))}` : esc(title);
  document.title = [M.pageTitle || title, t(S, 'site.name')].join(' · ');
  $('partCount').textContent = t(S, 'ui.partsCount', { n: parts.length });

  /* ---------------- parts list ---------------- */
  for (const g of groups) {
    const h = document.createElement('div'); h.className = 'grp eyebrow-label'; h.textContent = t(M, `groups.${g}`); listEl.appendChild(h);
    for (const p of parts.filter(p => p.group === g)) {
      const b = document.createElement('button'); b.className = 'pbtn' + (p.sub ? ' sub' : ''); b.dataset.id = p.id; b.setAttribute('aria-pressed', 'false');
      b.textContent = name(p.id);
      b.addEventListener('click', () => choose(p.id, true));
      b.addEventListener('mouseenter', () => { state.hover = p.id; registry.applyLook(); });
      b.addEventListener('mouseleave', () => { state.hover = null; registry.applyLook(); });
      listEl.appendChild(b);
    }
  }
  /* ---------------- phone sheets ----------------
     On phones the parts list and the info card are drop-down sheets of the same kind:
     closed at start, opened by their buttons (or by choosing a part), one at a time. */
  const PHONE = matchMedia('(max-width: 820px)');
  const sheets = { parts: $('parts'), cardPanel: $('cardPanel') };
  function openSheet(id) {   // id = 'parts' | 'cardPanel' | null (close all)
    for (const [k, el] of Object.entries(sheets)) el.classList.toggle('open', k === id);
    document.querySelectorAll('.sheet-toggles [data-sheet]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.sheet === id)));
  }
  document.querySelectorAll('.sheet-toggles [data-sheet]').forEach(b => { b.onclick = () => openSheet(sheets[b.dataset.sheet].classList.contains('open') ? null : b.dataset.sheet); });
  document.querySelectorAll('.sheet-close').forEach(b => { b.onclick = () => openSheet(null); });
  // choosing a part (list, model, label): select it, and on phones show its card
  function choose(id, focus) { select(id, focus); if (id && PHONE.matches) openSheet('cardPanel'); }

  /* ---------------- info card ---------------- */
  const specHtml = (rows, cls = '') => rows?.length ? `<dl class="spec ${cls}">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
  const factHtml = f => f ? `<div class="callout"><div class="eyebrow-label">${esc(t(S, 'ui.didYouKnow'))}</div><p>${esc(f)}</p></div>` : '';
  function overviewCard() {
    const o = M.overview || {};
    card.innerHTML = `
      <div class="eyebrow"><span class="chip">${esc(o.chip)}</span><span class="count">${esc(o.badge)}</span></div>
      <h2>${esc(o.heading)}</h2>
      <p>${esc(o.text)}</p>
      ${specHtml(o.spec, 'ov-more')}
      ${factHtml(o.fact)}
      <p class="note ov-more">${esc(o.hint)}</p>
      <div class="row"><button class="btn primary" id="tour">${esc(t(S, 'ui.startTour'))}</button>
        ${o.link ? `<a class="btn" href="${esc(siteHref(o.link.href, lang))}">${esc(o.link.label)}</a>` : ''}</div>`;
    $('tour').onclick = () => select(parts[0].id, true);
  }
  function partCard(id) {
    const p = PART[id], s = M.parts?.[id] || {};
    card.innerHTML = `
      <div class="eyebrow"><span class="chip">${esc(t(M, `groups.${p.group}`))}</span><span class="count">${p.index + 1} / ${parts.length}</span></div>
      <h2>${esc(name(id))}</h2><div class="gloss" lang="${esc(G?._lang || '')}">${esc(gloss(id))}</div>
      <p>${esc(s.text)}</p>${specHtml(s.spec)}${factHtml(s.fact)}${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      <div class="row">
        <button class="btn" id="prev" aria-label="${esc(t(S, 'ui.prevAria'))}">${esc(t(S, 'ui.prev'))}</button>
        <button class="btn" id="focus">${esc(t(S, 'ui.zoom'))}</button>
        <button class="btn" id="next" aria-label="${esc(t(S, 'ui.nextAria'))}">${esc(t(S, 'ui.next'))}</button>
        <button class="btn" id="close" aria-label="${esc(t(S, 'ui.overviewAria'))}">${esc(t(S, 'ui.overview'))}</button>
      </div>
      <label class="check"><input type="checkbox" id="ghost" ${state.ghost ? 'checked' : ''}> ${esc(t(S, 'ui.fade'))}</label>`;
    $('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
    $('focus').onclick = () => focusOn(id); $('close').onclick = () => select(null);
    $('ghost').onchange = e => { state.ghost = e.target.checked; registry.applyLook(); };
  }
  function step(d) { const i = state.selected ? PART[state.selected].index : -1; select(parts[(i + d + parts.length) % parts.length].id, true); }
  function select(id, focus) {
    state.selected = id;
    for (const b of listEl.querySelectorAll('.pbtn')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    if (id) { model.onSelect?.(id); partCard(id); listEl.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }); if (focus) focusOn(id); }
    else { model.onSelect?.(null); overviewCard(); }
    registry.applyLook();
  }

  /* ---------------- camera ---------------- */
  let tween = null, userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  function moveTo(pos, target) { tween = { t: 0, dur: reduceMotion ? .001 : .9, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target }; }
  function focusOn(id) {
    const box = new THREE.Box3();
    model.root.updateMatrixWorld(true);
    for (const o of partObjs[id] || []) box.expandByObject(o);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, .12 * Math.sqrt(stage.scale));
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.y < .12) { dir.y = .25; dir.normalize(); }
    moveTo(c.clone().addScaledVector(dir, clamp(r / Math.sin(deg(camera.fov / 2)) * 1.05, controls.minDistance * 1.1, controls.maxDistance * .45)), c);
  }
  // Home view, pulled back on tall narrow screens so the whole model fits between the header and the toolbar.
  function homeView() {
    const a = camera.aspect, k = a < 1 ? clamp(.95 / a, 1, 2.3) : 1;
    const tg = model.home.target.clone(); if (a < 1) tg.y -= (model.home.tallDrop ?? .75) * .2;   // small drop: the phone header is taller than the toolbar
    return { pos: tg.clone().add(model.home.pos.clone().sub(model.home.target).multiplyScalar(k)), target: tg };
  }
  const resetView = () => { const h = homeView(); moveTo(h.pos, h.target); };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!userMoved && !tween) { const hv = homeView(); camera.position.copy(hv.pos); controls.target.copy(hv.target); }
  }
  addEventListener('resize', resize);
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function tweenStep(dt) {
    if (!tween) return;
    tween.t += dt / tween.dur; const k = ease(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
  }

  /* ---------------- toolbar ---------------- */
  // On phones the toolbar folds into rows and the footer under it may wrap; the CSS keeps
  // the toolbar above the footer and the sheets above the toolbar with these heights.
  const toolbarEl = document.querySelector('.toolbar'), footEl = $('siteFoot'), appEl = $('app');
  new ResizeObserver(() => appEl.style.setProperty('--toolbar-h', `${toolbarEl.offsetHeight}px`)).observe(toolbarEl);
  if (footEl) new ResizeObserver(() => appEl.style.setProperty('--foot-h', `${footEl.offsetHeight}px`)).observe(footEl);
  const press = (el, on) => el.setAttribute('aria-pressed', String(on));

  // The model's own controls go in front of the standard buttons (Explode, Labels …).
  const ctl = {}, slot = $('explode');
  for (const c of model.controls || []) {
    const label = t(M, c.label);
    if (c.type === 'range') {
      const box = document.createElement('div'); box.className = 'ctl-range';
      box.innerHTML = `<label for="ctl-${c.id}" class="eyebrow-label"><span>${esc(label)}</span> <output id="ctl-${c.id}-out" for="ctl-${c.id}"></output></label>
        <input id="ctl-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.value}">`;
      const input = box.querySelector('input'), out = box.querySelector('output');
      const set = v => { c.set(v); out.textContent = c.format ? c.format(v) : String(v); out.title = out.textContent; };
      input.addEventListener('input', e => set(+e.target.value));
      ctl[c.id] = { el: box, set: v => { input.value = v; set(+input.value); }, value: () => +input.value };
      toolbarEl.insertBefore(box, slot); set(c.value);
    } else if (c.type === 'toggle') {
      const b = Object.assign(document.createElement('button'), { className: 'tg', id: `ctl-${c.id}`, textContent: label });
      if (c.title) b.title = t(M, c.title);
      let on = !!c.value; press(b, on);
      const set = v => { on = v; press(b, on); c.set(on); };
      b.onclick = () => set(!on);
      ctl[c.id] = { el: b, set, value: () => on };
      toolbarEl.insertBefore(b, slot); if (on) c.set(on);
    } else if (c.type === 'button') {
      const b = Object.assign(document.createElement('button'), { className: 'btn primary', id: `ctl-${c.id}`, textContent: label });
      if (c.title) b.title = t(M, c.title);
      b.onclick = () => c.run();
      ctl[c.id] = { el: b, refresh: () => { b.disabled = c.enabled ? !c.enabled() : false; } };
      toolbarEl.insertBefore(b, slot);
    }
  }
  const refreshControls = () => { for (const k in ctl) ctl[k].refresh?.(); };
  refreshControls();

  $('explode').onclick = e => { state.explodeTarget = state.explodeTarget ? 0 : 1; press(e.currentTarget, !!state.explodeTarget); };
  $('labelsBtn').onclick = e => { state.labels = !state.labels; press(e.currentTarget, state.labels); labelsEl.hidden = !state.labels; };
  $('spin').onclick = e => { controls.autoRotate = !controls.autoRotate; press(e.currentTarget, controls.autoRotate); };
  $('reset').onclick = resetView;
  function setMode(m) {
    state.mode = m; press($('sceneWater'), m === 'water'); press($('sceneStudio'), m === 'studio');
    stage.setMode(m, getComputedStyle(document.documentElement).getPropertyValue('--stage').trim());
    if (m === 'studio') { model.root.position.set(0, 0, 0); model.root.rotation.set(0, 0, 0); }
    model.onMode?.(m);
  }
  $('sceneWater').onclick = () => setMode('water'); $('sceneStudio').onclick = () => setMode('studio');
  const themeWatch = () => { if (state.mode === 'studio') setMode('studio'); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', themeWatch);
  new MutationObserver(themeWatch).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const swEl = $('swatches');
  paints.forEach(([key, c], i) => {
    const b = document.createElement('button'), label = t(M, `colours.${key}`);
    b.style.background = c; b.title = label; b.setAttribute('aria-label', label); press(b, i === 0);
    b.onclick = () => { registry.paint(c); swEl.querySelectorAll('button').forEach(x => press(x, x === b)); };
    swEl.appendChild(b);
  });

  // Scene colour presets (stage palettes, names in M.looks): swatches of sky over sea beside Water/Studio.
  if (stage.palettes.length > 1) {
    const lk = Object.assign(document.createElement('div'), { className: 'sw', id: 'looks' });
    lk.setAttribute('role', 'group'); lk.setAttribute('aria-label', t(S, 'ui.look'));
    for (const p of stage.palettes) {
      const b = document.createElement('button'), label = t(M, `looks.${p.key}`);
      b.style.background = `linear-gradient(180deg, ${p.top}, ${p.horizon} 54%, ${p.shallow} 56%, ${p.deep})`;
      b.title = label; b.setAttribute('aria-label', label); press(b, p === stage.palette);
      b.onclick = () => { stage.setPalette(p.key); lk.querySelectorAll('button').forEach(x => press(x, x === b)); };
      lk.appendChild(b);
    }
    document.querySelector('.toolbar .seg').after(lk);
  }

  /* ---------------- 3D labels ---------------- */
  labelsEl.hidden = true;
  const labelItems = parts.filter(p => p.label).map(p => {
    const el = document.createElement('button'); el.className = 'lbl'; el.innerHTML = `<i></i><span>${esc(name(p.id))}</span>`;
    el.onclick = () => choose(p.id, true); labelsEl.appendChild(el);
    return { id: p.id, el };
  });
  const _box = new THREE.Box3(), _v = new THREE.Vector3();
  function updateLabels() {
    if (!state.labels) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const it of labelItems) {
      const hidden = model.labelHidden?.(it.id, state);
      if (!hidden && !model.anchor?.(it.id, _v)) { _box.makeEmpty(); for (const o of partObjs[it.id] || []) _box.expandByObject(o); _box.getCenter(_v); }
      if (!hidden) _v.project(camera);
      const vis = !hidden && _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      it.el.style.display = vis ? '' : 'none';
      if (vis) it.el.style.transform = `translate(${(_v.x * .5 + .5) * w - 5}px, ${(-_v.y * .5 + .5) * h}px) translateY(-50%)`;
    }
  }

  /* ---------------- picking and hover ---------------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null, pending = null;
  const clipped = (h) => [].concat(h.object.material).some(m => m.clippingPlanes?.some(pl => pl.distanceToPoint(h.point) < 0));
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(pickables, false)) {
      const id = h.object.userData.part; if (!id || !h.object.visible) continue;
      if (clipped(h)) continue;   // cut away: click through to what is behind
      // with other parts faded, click through them to the highlighted one
      if (state.ghost && state.selected && id !== state.selected && [].concat(h.object.material).some(m => m.transparent && m.opacity < .3 && !m.userData.helper)) continue;
      return id;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) <= 6) choose(pick(e), false); });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pending = e; });
  canvas.addEventListener('pointerleave', () => { state.hover = null; tip.style.opacity = 0; registry.applyLook(); });
  function processHover() {
    if (!pending) return; const e = pending; pending = null;
    if (e.buttons) { tip.style.opacity = 0; return; }
    const id = pick(e);
    if (id !== state.hover) { state.hover = id; registry.applyLook(); }
    canvas.style.cursor = id ? 'pointer' : 'grab';
    if (id) { const r = canvas.getBoundingClientRect(); tip.textContent = name(id); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.style.opacity = 1; }
    else tip.style.opacity = 0;
  }
  addEventListener('keydown', e => {
    if (e.target.matches('input, select')) return;
    if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') { if (PHONE.matches && Object.values(sheets).some(el => el.classList.contains('open'))) openSheet(null); else select(null); }
  });

  resize();
  overviewCard();
  const api = { select, focusOn, resetView, setMode, updateLabels, processHover, tweenStep, controls: ctl, refreshControls };
  model.bindUI?.(api);
  return api;
}
