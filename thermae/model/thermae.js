/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Roman Thermae of Odessos (Varna) — procedural 3D model, prototype.
// Built to K. Vacheva's measured plans and her south-facade reconstruction (sources and the numbers used:
// documentation/varna-thermae-sources.md). The vault forms follow the museum's own reconstruction drawing.
// Everything above the walls is a reconstruction.
//
// Units: metres. Plan coordinates (x, z): x east of the axis of symmetry, z south of the outer face of the
// north wall (as measured on the plan). World: +x east, +y up (0 = the bath floor), +z south; Z = z − ZC,
// so the model's origin sits about in the middle of the building.
// The building is symmetrical: everything west of the axis is written once in half(s) and mirrored (s = ±1).
//
// Kept in mind for a later "drawing" look: plain solids with crisp edges (no bevels, no textures), and one
// material per kind of surface (walls, vault outside, vault inside, floors, stone, water, tiles), so an ink-line
// or flat-tone renderer can tell them apart.
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V3, UP, rnd, gridGeo } from '../../assets/js/explorer/geometry.js';
import { addSurfaceNoise } from '../../assets/js/explorer/surface.js';

const ZC = 34;   // plan z of the world origin
// Heights (bath floor = 0). South ground and the terrace from Vacheva 1985, plate I.2; spring = where a vault starts.
const H = {
  found: -4.5,   // foundations: walls start here, below the lowest ground
  street: .6,    // the north street (three steps down to the vestibules)
  south: -3.7,   // the ground in front of the south terrace
  shop: 5.6,     // shop walls
  vest: 8,       // vestibule vault spring
  bas: 10,       // basilica hall
  apo: 11,       // apodyteria
  fr: 16.5,      // frigidarium (groin vault, crown 21.5)
  tep: 12.5,     // tepidarium
  cal: 10,       // caldarium (crown 17.5, about 21 m above the south ground)
  sr: 4.8,       // the south rooms and their apses (cornice ≈ 4.6)
};
const LIFT = [0, 14, 0];   // exploded view: vaults and roofs lift off

// Plan ground height at z: the town slopes down to the south (to the sea).
export const groundAt = z => z <= 0 ? H.street : z <= 61.2 ? H.street + (H.south - H.street) * z / 61.2 : Math.max(H.south - Math.max(0, z - 80) * .025, -9);

export function createThermae({ registry }) {
  // The explorer builds the model before the stage, which switches three.js to sRGB colour management.
  // Switch it here already, so the colours below are read as the sRGB values they are (else they come out pale).
  THREE.ColorManagement.legacyMode = false;
  const root = new THREE.Group();

  /* =====================================================================
     MATERIALS
     ===================================================================== */
  const cut = { cut: 'sec' };   // the section view clips these (registry.setCut)
  const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .9, side: THREE.DoubleSide, clipShadows: true, ...o }); m.userData = { ...cut }; return m; };
  const MAT = {
    wall: addSurfaceNoise(std('#e2cbb0'), { mottle: .45, color: .05, rough: .06, wave: 0, peel: 0 }),          // lime-plastered masonry (opus mixtum under it)
    vaultOut: addSurfaceNoise(std('#d4a183'), { mottle: .5, color: .06, rough: .06, wave: 0, peel: 0 }),      // the mortar skin over the vaults
    vaultIn: std('#f2ebe0', { roughness: .95 }),                                                               // plastered ceilings
    floor: std('#ebe7df', { roughness: .75, envMapIntensity: .45 }),                                           // marble (little sky in it: most floors are indoors)
    stone: addSurfaceNoise(std('#d8cdb9'), { mottle: .5, color: .05, rough: .06, wave: 0, peel: 0 }),         // dressed stone: terrace, steps, columns
    basin: std('#cfd9dc', { roughness: .4 }),                                                                  // grey-white marble of the pools
    water: std('#2f8cae', { roughness: .06, metalness: .05, transparent: true, opacity: .8, side: THREE.FrontSide }),
    tile: std('#b65f43', { roughness: .85 }),                                                                  // roof tiles
    paving: std('#cbbfa7', { roughness: 1 }),
  };

  /* =====================================================================
     BUCKETS: every piece goes into (part, material, role); one merged mesh each.
     role 'base' stays put; 'vault' and 'roof' lift in the exploded view and hide with Roofs off.
     ===================================================================== */
  const buckets = new Map();
  function prep(g) {
    const h = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal') h.deleteAttribute(k);
    if (!h.attributes.normal) h.computeVertexNormals();
    return h;
  }
  const put = (part, mat, role, g) => { const k = `${part}|${mat}|${role}`; (buckets.get(k) || buckets.set(k, []).get(k)).push(prep(g)); };

  // ---- geometry helpers (plan coordinates in, world out)
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const arc = (cx, cz, r, a0, a1, n = 32) => [...Array(n + 1)].map((_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; });
  const v2 = ([x, z]) => new THREE.Vector2(x, ZC - z);

  // Horizontal slab: a plan outline (with holes) from y0 to y1.
  function slab(part, mat, role, pts, y0, y1, holes = []) {
    const s = new THREE.Shape(pts.map(v2));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(v2)));
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    put(part, mat, role, g);
  }
  // Flat sheet facing up (water surfaces).
  function sheet(part, mat, pts, y) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(v2)));
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
    put(part, mat, 'base', g);
  }

  // An opening in a wall outline: u = centre along the wall, w = width, from y up h, then a round or
  // elliptical arch (ry) on top, or flat.
  function opening(u, w, y, h, arch, ry) {
    const p = new THREE.Path(), a = u - w / 2, b = u + w / 2;
    p.moveTo(a, y); p.lineTo(b, y); p.lineTo(b, y + h);
    if (arch) p.absellipse(u, y + h, w / 2, ry ?? w / 2, 0, Math.PI, false); else p.lineTo(a, y + h);
    p.lineTo(a, y);
    return p;
  }
  // Extrude an outline drawn in the wall's own plane (u along a→b, y up) and stand it on the line a→b.
  function placeWall(shape, ax, az, bx, bz, t) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 32 });
    g.translate(0, 0, -t / 2);
    g.rotateY(Math.atan2(-(bz - az), bx - ax)); g.translate(ax, 0, az - ZC);
    return g;
  }
  // Straight wall on its centre line a→b, thickness t, from y0 up to y1.
  // holes: [{ at, w, y = 0, h, arch, ry }] — at = plan x (wall along x) or z (wall along z) of the opening's centre.
  function W(ax, az, bx, bz, t, y1, holes = [], { y0 = H.found, part = 'walls', mat = 'wall' } = {}) {
    const L = Math.hypot(bx - ax, bz - az), alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const s = new THREE.Shape(); s.moveTo(0, y0); s.lineTo(L, y0); s.lineTo(L, y1); s.lineTo(0, y1); s.lineTo(0, y0);
    for (const o of holes) {
      const u = alongX ? (o.at - ax) * Math.sign(bx - ax) : (o.at - az) * Math.sign(bz - az);
      s.holes.push(opening(u, o.w, o.y ?? 0, o.h, o.arch, o.ry));
    }
    put(part, mat, 'base', placeWall(s, ax, az, bx, bz, t));
  }
  // Gable (lunette) wall closing the end of a vault: a half-ellipse a→b wide and `rise` high above the spring ys,
  // drawn to the outside of the vault shell; win = { w, y, h } an arched window in it.
  function gable(ax, az, bx, bz, t, ys, rise, win) {
    const L = Math.hypot(bx - ax, bz - az), s = new THREE.Shape(), m = .08;   // a little larger than the shell, so its edge does not flicker
    s.moveTo(-m, ys); s.lineTo(L + m, ys); s.absellipse(L / 2, ys, L / 2 + m, rise + m, 0, Math.PI, false);
    if (win) s.holes.push(opening(L / 2, win.w, win.y, win.h, true));
    put('walls', 'wall', 'roof', placeWall(s, ax, az, bx, bz, t));   // goes with the vaults (Roofs off, exploded view)
  }

  // Quads with explicit normals (curved walls, sloped roofs): non-indexed triangles.
  function quadsGeo(build) {
    const pos = [], nrm = [];
    const quad = (ps, ns) => {
      const nn = ns.isVector3 ? [ns, ns, ns, ns] : ns;
      const f = ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).dot(nn[0]) >= 0;
      for (const i of f ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { pos.push(ps[i].x, ps[i].y, ps[i].z); nrm.push(nn[i].x, nn[i].y, nn[i].z); }
    };
    build(quad);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  }
  const DOWN = new V3(0, -1, 0);
  // Curved wall: a ring sector round (cx, cz) between radii r0 < r1, plan angles a0…a1 (x = cx + r cos a,
  // z = cz + r sin a; 0…π = a half-circle bulging south), from y0 to y1.
  // wins: [{ a, w, y0, y1 }] window openings (a = centre angle, w = width on the inside face).
  function ringWall(part, mat, cx, cz, r0, r1, y0, y1, wins = [], a0 = 0, a1 = Math.PI, seg = 48) {
    put(part, mat, 'base', quadsGeo(quad => {
      const P = (r, a, y) => new V3(cx + r * Math.cos(a), y, cz + r * Math.sin(a) - ZC);
      const rad = a => new V3(Math.cos(a), 0, Math.sin(a)), tan = a => new V3(-Math.sin(a), 0, Math.cos(a));
      for (let i = 0; i < seg; i++) {
        const s0 = a0 + (a1 - a0) * i / seg, s1 = a0 + (a1 - a0) * (i + 1) / seg, am = (s0 + s1) / 2;
        const w = wins.find(o => Math.abs(am - o.a) * r0 < o.w / 2);
        for (const [ya, yb] of w ? [[y0, w.y0], [w.y1, y1]] : [[y0, y1]]) {
          quad([P(r0, s0, ya), P(r0, s1, ya), P(r0, s1, yb), P(r0, s0, yb)], [rad(s0).negate(), rad(s1).negate(), rad(s1).negate(), rad(s0).negate()]);
          quad([P(r1, s0, ya), P(r1, s1, ya), P(r1, s1, yb), P(r1, s0, yb)], [rad(s0), rad(s1), rad(s1), rad(s0)]);
          quad([P(r0, s0, yb), P(r1, s0, yb), P(r1, s1, yb), P(r0, s1, yb)], UP);
          quad([P(r0, s0, ya), P(r1, s0, ya), P(r1, s1, ya), P(r0, s1, ya)], DOWN);
          quad([P(r0, s0, ya), P(r1, s0, ya), P(r1, s0, yb), P(r0, s0, yb)], tan(s0).negate());
          quad([P(r0, s1, ya), P(r1, s1, ya), P(r1, s1, yb), P(r0, s1, yb)], tan(s1));
        }
      }
    }));
  }
  // Six-sided solid from 8 corners (bottom 4, then top 4, same order): sloped roofs, steps.
  function hexa(part, mat, role, c) {
    const [a, b, cc, d, e, f, g, h] = c, mid = c.reduce((s, p) => s.add(p), new V3()).multiplyScalar(1 / 8);
    put(part, mat, role, quadsGeo(quad => {
      for (const fc of [[a, b, cc, d], [e, f, g, h], [a, b, f, e], [b, cc, g, f], [cc, d, h, g], [d, a, e, h]]) {
        const n = fc[1].clone().sub(fc[0]).cross(fc[2].clone().sub(fc[0])).normalize();
        const out = fc.reduce((s, p) => s.add(p), new V3()).multiplyScalar(.25).sub(mid);
        quad(fc, n.dot(out) < 0 ? n.negate() : n);
      }
    }));
  }
  const W3 = (x, y, z) => new V3(x, y, z - ZC);
  // Sloped roof over a plan rectangle: the top face goes from yA at the x0 (axis 'x') or z0 (axis 'z') edge to yB.
  function roof(part, x0, z0, x1, z1, yA, yB, axis, th = .3) {
    const y = (x, z) => axis === 'x' ? yA + (yB - yA) * (x - x0) / (x1 - x0) : yA + (yB - yA) * (z - z0) / (z1 - z0);
    const cs = rect(x0, z0, x1, z1);
    hexa(part, 'tile', 'roof', [...cs.map(([x, z]) => W3(x, y(x, z) - th, z)), ...cs.map(([x, z]) => W3(x, y(x, z), z))]);
  }
  // Steps between two levels over a plan rectangle; `up` = the side the steps climb towards ('+x', '-x', '+z', '-z').
  function steps(part, x0, z0, x1, z1, yLow, yHigh, up) {
    const n = Math.max(1, Math.round((yHigh - yLow) / .19));
    for (let i = 0; i < n; i++) {
      const f0 = i / n, top = yLow + (yHigh - yLow) * (i + 1) / n;
      const r = up === '+x' ? [x0 + (x1 - x0) * f0, z0, x1, z1] : up === '-x' ? [x0, z0, x1 - (x1 - x0) * f0, z1]
        : up === '+z' ? [x0, z0 + (z1 - z0) * f0, x1, z1] : [x0, z0, x1, z1 - (z1 - z0) * f0];
      slab(part, 'stone', 'base', rect(...r), yLow - .3, top);
    }
  }

  // ---- vaults (shells with a plastered inside and a mortar outside)
  // Barrel vault: axis 'x' (runs east–west, span across z) or 'z'; c = plan centre of the span, half = half-span,
  // a0…a1 = extent along the axis, ys = spring, t = shell; rise = half for a round vault.
  function barrel(part, axis, c, half, a0, a1, ys, t, rise = half, ends = [true, true]) {
    const pt = (al, ang, h, r) => { const ac = c + h * Math.cos(ang), y = ys + r * Math.sin(ang); return axis === 'x' ? [al, y, ac - ZC] : [ac, y, al - ZC]; };
    put(part, 'vaultIn', 'vault', gridGeo(1, 32, (u, v) => pt(a0 + (a1 - a0) * u, Math.PI * v, half, rise), [0, -1, 0]));
    put(part, 'vaultOut', 'vault', gridGeo(1, 32, (u, v) => pt(a0 + (a1 - a0) * u, Math.PI * v, half + t, rise + t), [0, 1, 0]));
    [a0, a1].forEach((al, i) => {   // the shell's end faces (arch rings)
      if (!ends[i]) return;
      const sg = i ? 1 : -1, hint = axis === 'x' ? [sg * Math.sign(a1 - a0), 0, 0] : [0, 0, sg * Math.sign(a1 - a0)];
      put(part, 'wall', 'vault', gridGeo(32, 1, (u, v) => pt(al, Math.PI * u, half + v * t, rise + v * t), hint));
    });
  }
  // Groin vault over nb bays along x (x0…x1), span 2r across z centred on cz: two barrels crossing in each bay.
  // Each bay is four webs; a web belongs to the barrel whose arch it rests on, and webs meet on the diagonals.
  function groin(part, x0, x1, nb, cz, r, ys, t) {
    const w = (x1 - x0) / nb / 2;
    for (let b = 0; b < nb; b++) {
      const bx = x0 + w * (2 * b + 1);
      for (const [k, mat, hint] of [[0, 'vaultIn', [0, -1, 0]], [t, 'vaultOut', [0, 1, 0]]]) {
        const R = r + k, Wd = w + k;
        for (const sx of [1, -1]) put(part, mat, 'vault', gridGeo(32, 6, (u, v) => {   // webs of the long barrel (east and west)
          const th = Math.PI * u, c = Math.abs(Math.cos(th));
          return [bx + sx * (Wd * c + v * Wd * (1 - c)), ys + R * Math.sin(th), cz + R * Math.cos(th) - ZC];
        }, hint));
        for (const sz of [1, -1]) put(part, mat, 'vault', gridGeo(32, 6, (u, v) => {   // webs of the cross barrel (north and south)
          const ph = Math.PI * u, c = Math.abs(Math.cos(ph));
          return [bx + Wd * Math.cos(ph), ys + R * Math.sin(ph), cz + sz * (R * c + v * R * (1 - c)) - ZC];
        }, hint));
      }
    }
  }
  // Half-dome over a south apse (centre cx, cz on the chord): radius r, height rv above the spring ys.
  function semidome(part, cx, cz, r, rv, ys, t) {
    for (const [k, mat, hint] of [[0, 'vaultIn', [0, -1, 0]], [t, 'vaultOut', [0, 1, 0]]])
      put(part, mat, 'vault', gridGeo(32, 12, (u, v) => {
        const ph = Math.PI * u, a = Math.PI / 2 * v, R = r + k;
        return [cx + R * Math.cos(a) * Math.cos(ph), ys + (rv + k) * Math.sin(a), cz + R * Math.cos(a) * Math.sin(ph) - ZC];
      }, hint));
    put(part, 'wall', 'vault', gridGeo(32, 1, (u, v) => {   // the arch face towards the room
      const ph = Math.PI * u; return [cx + (r + v * t) * Math.cos(ph), ys + (rv + v * t) * Math.sin(ph), cz - ZC];
    }, [0, 0, -1]));
  }
  // Pool sunk in the floor (the floor slab leaves a hole for it): marble basin and water.
  function pool(pts, curved) {
    const d = .9;
    slab('pools', 'basin', 'base', pts, -d - .2, -d);
    if (curved) ringWall('pools', 'basin', curved.cx, curved.cz, curved.r - .14, curved.r, -d, 0, [], 0, Math.PI, 32);
    const n = pts.length;
    for (let i = 0; i < n; i++) {   // straight sides: thin walls just inside the edge
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n], L = Math.hypot(bx - ax, bz - az);
      if (curved && L < 1.5) continue;
      W(ax, az, bx, bz, .14, 0, [], { y0: -d, part: 'pools', mat: 'basin' });
    }
    sheet('pools', 'water', pts, -.25);
  }

  /* =====================================================================
     PLAN — central parts (on the axis)
     ===================================================================== */
  const PITCH = 4.8, SHOPS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(k => k * PITCH);   // dividers of the 12 north shops
  const shopMid = [...Array(12)].map((_, i) => -28.8 + PITCH * (i + .5));

  // north facade with the shop doors; the wall behind the shops, with windows into the basilica above their roofs
  W(-31.2, .4, 31.2, .4, .8, H.shop, shopMid.map(x => ({ at: x, w: 2.2, y: H.street, h: 2.4 })));
  W(-31.2, 6, 31.2, 6, 1.4, H.bas, shopMid.map(x => ({ at: x, w: 1.6, y: 7, h: 1.2, arch: true })));
  for (const x of SHOPS) W(x, .8, x, 5.3, .6, H.shop);
  slab('shops', 'floor', 'base', rect(-28.8, .8, 28.8, 5.3), H.street - .3, H.street);
  roof('shops', -31.2, -.6, 31.2, 5.3, 5.85, 6.9, 'z');

  // basilica hall (B) to the frigidarium (F): three arches
  W(-16.5, 20.5, 16.5, 20.5, 1.8, H.fr, [{ at: 0, w: 6, h: 6, arch: true }, { at: -10.5, w: 3.6, h: 5, arch: true }, { at: 10.5, w: 3.6, h: 5, arch: true }]);
  slab('basilica', 'floor', 'base', rect(-28.8, 6.7, 28.8, 19.6), -.3, 0);
  barrel('basilica', 'x', 13.15, 6.45, -30, 30, H.bas, .9);

  // frigidarium (F) to the tepidarium (T): two arches
  W(-16.5, 32.3, 16.5, 32.3, 1.8, H.fr, [{ at: -8.25, w: 4, h: 4.5, arch: true }, { at: 8.25, w: 4, h: 4.5, arch: true }]);
  const fPool = s => rect(s * 13.9, 22.6, s * 16.2, 30.2), tPool = s => rect(s * 13.9, 35.4, s * 16.2, 42.4);
  slab('frigidarium', 'floor', 'base', rect(-16.5, 21.4, 16.5, 31.4), -.3, 0, [fPool(-1), fPool(1)]);
  slab('tepidarium', 'floor', 'base', rect(-16.5, 33.2, 16.5, 43.2), -.3, 0, [tPool(-1), tPool(1)]);
  for (const s of [-1, 1]) { pool(fPool(s)); pool(tPool(s)); }
  groin('frigidarium', -16.5, 16.5, 3, 26.4, 5, H.fr, .8);
  for (const [z, t] of [[20.5, 1.8], [32.3, 1.8]]) for (const bx of [-11, 0, 11])   // the frigidarium's lunettes, windows over the lower roofs
    gable(bx - 5.5, z, bx + 5.5, z, t, H.fr, 5.8, { w: 3.6, y: H.fr + .4, h: 1.6 });
  barrel('tepidarium', 'x', 38.2, 5, -17.1, 17.1, H.tep, .8);

  // tepidarium to the caldarium (C) and the south rooms
  W(-21.7, 44.1, 21.7, 44.1, 1.8, H.tep, [{ at: -5, w: 3.4, h: 4, arch: true }, { at: 5, w: 3.4, h: 4, arch: true },
    { at: -15.5, w: 2, h: 2.8, arch: true }, { at: 15.5, w: 2, h: 2.8, arch: true }]);
  // caldarium: main floor, apse with the semicircular pool, the arch into the apse
  slab('caldarium', 'floor', 'base', rect(-7.5, 44.1, 7.5, 60), -.3, 0);
  slab('caldarium', 'floor', 'base', [...arc(0, 60, 6.5, 0, Math.PI), ...arc(0, 60, 5.5, Math.PI, 0)], -.3, 0);
  pool(arc(0, 60, 5.5, 0, Math.PI), { cx: 0, cz: 60, r: 5.5 });
  W(-8.7, 60.6, 8.7, 60.6, 1.2, H.cal, [{ at: 0, w: 13, h: 4.6, arch: true, ry: 4.7 }]);
  ringWall('walls', 'wall', 0, 60, 6.5, 7.8, H.found, 4.6, [...Array(6)].map((_, i) => ({ a: Math.PI * (i + .5) / 6, w: 1.6, y0: .7, y1: 3.9 })));
  semidome('caldarium', 0, 60, 6.5, 4.7, 4.6, .7);
  barrel('caldarium', 'z', 0, 7.5, 44.1, 60.6, H.cal, .9);
  gable(-8.7, 44.1, 8.7, 44.1, 1.8, H.cal, 8.4);
  gable(-8.7, 60.6, 8.7, 60.6, 1.2, H.cal, 8.4, { w: 5, y: H.cal + 1, h: 2 });

  // praefurnium: the furnace corridor under the south terrace, round the three apses (Vacheva 1985: 101 m long)
  const ae = R => Math.asin(7.3 / R);
  const terrace = [[-50.5, 60.6], [-42, 60.6], [-42, 58], [42, 58], [42, 60.6], [50.5, 60.6], [50.5, 67.3],
    ...arc(35.25, 60, 10.4, ae(10.4), Math.PI - ae(10.4), 24), ...arc(0, 60, 12.2, ae(12.2), Math.PI - ae(12.2), 32),
    ...arc(-35.25, 60, 10.4, ae(10.4), Math.PI - ae(10.4), 24), [-50.5, 67.3]];
  slab('praefurnium', 'stone', 'base', terrace, H.found, -.05);
  for (const s of [-1, 1]) steps('praefurnium', s < 0 ? -56.5 : 50.5, 61.4, s < 0 ? -50.5 : 56.5, 64.6, H.south, -.05, s < 0 ? '+x' : '-x');

  /* =====================================================================
     PLAN — each half (s = −1 west, +1 east)
     ===================================================================== */
  const ground = groundAt;
  function half(s) {
    const X = x => s * x, R = (x0, z0, x1, z1) => rect(X(x0), z0, X(x1), z1);
    const at = (x, o) => ({ ...o, at: X(x) });

    // vestibule (V′): entrance from the north street, three steps down, then into the basilica and the apodyterium
    W(X(-40.7), .4, X(-31.2), .4, .8, H.vest, [at(-36, { w: 3, y: H.street, h: 3.2, arch: true })]);
    W(X(-40), .4, X(-40), 20.5, 1.4, H.vest, [{ at: 14, w: 2.4, h: 3, arch: true }]);
    W(X(-30), .4, X(-30), 20.5, 2.4, H.bas, [{ at: 13, w: 4, h: 4.5, arch: true }]);
    slab('vestibules', 'floor', 'base', R(-39.3, .8, -31.2, 9), H.street - .3, H.street);
    steps('vestibules', Math.min(X(-39.3), X(-31.2)), 9, Math.max(X(-39.3), X(-31.2)), 10.2, 0, H.street, '-z');
    slab('vestibules', 'floor', 'base', R(-39.3, 10.2, -31.2, 19.6), -.3, 0);
    barrel('vestibules', 'z', X(-35.25), 4.05, .4, 20.5, H.vest, .8);
    // gables are as wide as the outside of their vault, so they close its end
    gable(X(-40.1), .4, X(-30.4), .4, .8, H.vest, 4.85, { w: 2.2, y: H.vest + .5, h: 1 });
    gable(X(-40.1), 20.5, X(-30.4), 20.5, 1.8, H.vest, 4.85);
    gable(X(-30), 5.8, X(-30), 20.5, 2.4, H.bas, 7.35, { w: 3, y: 12.6, h: 1.2 });   // basilica end, window over the vestibule roof

    // basilica / vestibule to the apodyterium
    W(X(-40.7), 20.5, X(-16.5), 20.5, 1.8, H.apo, [at(-36, { w: 3, h: 3.5, arch: true })]);

    // apodyterium (A′): changing room; west wall with a door from the street passage and windows over the shop roofs
    W(X(-38.5), 20.5, X(-38.5), 44.1, 2, H.apo, [{ at: 28, w: 2.6, h: 3.2, arch: true }, { at: 24.5, w: 2, y: 7.2, h: 1.6, arch: true }, { at: 38.5, w: 2, y: 7.2, h: 1.6, arch: true }]);
    slab('apodyteria', 'floor', 'base', R(-37.5, 21.4, -21.7, 43.2), -.3, 0);
    slab('apodyteria', 'floor', 'base', R(-21.7, 29.75, -16.5, 36.75), -.3, 0);   // the passage through the piers to the cold and warm rooms
    barrel('apodyteria', 'x', 32.3, 10.9, X(-38.5), X(-21.1), H.apo, 1);
    gable(X(-38.5), 20.4, X(-38.5), 44.2, 2, H.apo, 11.9, { w: 6, y: H.apo + 1, h: 3 });   // the big west lunette (museum drawing)
    gable(X(-21.1), 20.4, X(-21.1), 44.2, 1.2, H.apo, 11.9);
    // labrum: the fountain basin in the middle of the apodyterium (Vacheva 2008: a marble tray under it)
    labrum(X(-29.6), 32.3);

    // the massive piers between the apodyterium and the frigidarium / tepidarium, with the passage
    W(X(-19.1), 20.5, X(-19.1), 44.1, 5.2, H.fr, [{ at: 33.25, w: 7, h: 5, arch: true }]);
    gable(X(-17.1), 20.6, X(-17.1), 32.2, 1.2, H.fr, 5.8);   // frigidarium end lunette
    gable(X(-17.1), 32.4, X(-17.1), 44, 1.2, H.tep, 5.8);    // tepidarium end

    // south rooms: north wall with doors from the apodyterium
    W(X(-42), 44.1, X(-21.7), 44.1, 1.8, H.apo, [at(-35.5, { w: 2.4, h: 3, arch: true }), at(-25, { w: 2.4, h: 3, arch: true })]);
    W(X(-41), 43.2, X(-41), 60.6, 2, H.sr);                                                  // west outer wall
    W(X(-29.75), 44.1, X(-29.75), 60.6, 1.5, H.sr, [{ at: 52, w: 1.6, h: 2.4 }]);
    W(X(-19.75), 44.1, X(-19.75), 60.6, 1.5, H.sr, [{ at: 52, w: 1.6, h: 2.4 }]);
    W(X(-30.5), 60.6, X(-8.7), 60.6, 1.2, H.sr);                                             // south wall (the apse of I′ is open)
    // caldarium side walls: a wide opening into a niche with a rectangular pool
    W(X(-8.1), 44.1, X(-8.1), 60.6, 1.2, H.cal, [{ at: 53.75, w: 10, h: 6 }]);
    W(X(-11.25), 44.1, X(-11.25), 60.6, 1.5, H.cal);
    W(X(-10.5), 48.2, X(-8.7), 48.2, .9, H.cal); W(X(-10.5), 59.3, X(-8.7), 59.3, .9, H.cal);
    const nPool = R(-10.4, 48.9, -7.6, 58.6);
    slab('caldarium', 'floor', 'base', R(-10.5, 48.65, -7.5, 58.85), -.3, 0, [nPool]);
    pool(nPool);
    slab('caldarium', 'tile', 'roof', R(-12, 44.1, -7.5, 60.6), H.cal, H.cal + .4);
    // the heated rooms I′, II′, III′ (I′ with the big apse and six windows)
    slab('heatedRooms', 'floor', 'base', R(-40, 44.6, -30.5, 60), -.3, 0);
    slab('heatedRooms', 'floor', 'base', arc(X(-35.25), 60, 4.75, 0, Math.PI), -.3, 0);
    slab('heatedRooms', 'floor', 'base', R(-29, 44.6, -20.5, 60), -.3, 0);
    slab('heatedRooms', 'floor', 'base', R(-19, 44.6, -12, 60), -.3, 0);
    ringWall('walls', 'wall', X(-35.25), 60, 4.75, 6, H.found, H.sr, [...Array(6)].map((_, i) => ({ a: Math.PI * (i + .5) / 6, w: 1.3, y0: .7, y1: 3.9 })));
    semidome('heatedRooms', X(-35.25), 60, 4.75, 4.75, H.sr, .6);
    barrel('heatedRooms', 'z', X(-35.25), 4.75, 44.1, 60, H.sr, .6, 4.75, [true, false]);
    barrel('heatedRooms', 'z', X(-24.75), 4.25, 44.1, 60.6, H.sr, .6);
    barrel('heatedRooms', 'z', X(-15.5), 3.5, 44.1, 60.6, H.sr, .6);
    gable(X(-29.6), 60.6, X(-19.9), 60.6, 1.2, H.sr, 4.85);
    gable(X(-19.6), 60.6, X(-11.4), 60.6, 1.2, H.sr, 4.1);

    // shops along the side street, two passages into the building (with steps up to the bath floor)
    const DIV = [7.9, 12.6, 15.4, 21, 26.5, 29.5, 35.3, 40.8], ends = [2.2, ...DIV, 43.5];
    const inner = z => z < 20.5 ? -40.7 : -39.5, PASS = [[12.6, 15.4], [26.5, 29.5]];
    const doors = [];
    for (let i = 0; i < ends.length - 1; i++) {
      const z0 = ends[i], z1 = ends[i + 1], zc = (z0 + z1) / 2, fy = ground(zc), pass = PASS.some(([a]) => a === z0);
      doors.push(pass ? { at: zc, w: 2.4, y: fy, h: 2.8, arch: true } : { at: zc, w: 2, y: fy, h: 2.4 });
      if (pass) {
        slab('shops', 'paving', 'base', R(-45.7, z0, inner(zc), z1), fy - .3, fy);
        steps('shops', ...(s < 0 ? [-43.2, z0 + .3, inner(zc), z1 - .3] : [-inner(zc), z0 + .3, 43.2, z1 - .3]), fy, 0, s < 0 ? '+x' : '-x');
      } else slab('shops', 'floor', 'base', R(-45.7, z0, inner(zc), z1), fy - .3, fy);
    }
    W(X(-46.1), 2.2, X(-46.1), 43.5, .8, H.shop, doors);
    W(X(-46.5), 2.2, X(-40.7), 2.2, .8, H.shop);
    for (const z of DIV) W(X(-45.7), z, X(inner(z)), z, .6, H.shop);
    W(X(-46.5), 43.5, X(-39.5), 43.5, .8, H.shop);
    roof('shops', ...(s < 0 ? [-47.1, 1.6, -40, 20.5, 5.85, 6.9] : [40, 1.6, 47.1, 20.5, 6.9, 5.85]), 'x');
    roof('shops', ...(s < 0 ? [-47.1, 20.5, -39.5, 44.1, 5.85, 6.9] : [39.5, 20.5, 47.1, 44.1, 6.9, 5.85]), 'x');

    // latrine in the south-west (south-east) corner, at the level of the side street, with stone benches
    const ly = ground(52);
    W(X(-46.1), 43.5, X(-46.1), 60.5, .8, ly + 5, [{ at: 52, w: 2, y: ly, h: 2.4 }]);
    W(X(-46.5), 60.1, X(-42), 60.1, .8, ly + 5);
    slab('latrines', 'floor', 'base', R(-45.7, 43.9, -42, 59.7), ly - .3, ly);
    for (const r of [R(-45.7, 44.6, -45.1, 51), R(-45.7, 53, -45.1, 59.7), R(-45.1, 59.1, -42, 59.7), R(-45.1, 43.9, -42, 44.5)])
      slab('latrines', 'stone', 'base', r, ly, ly + .45);
    slab('latrines', 'tile', 'roof', R(-46.7, 43.1, -41.6, 60.5), ly + 5, ly + 5.35);
  }
  // fountain basin on a foot (used in the apodyteria)
  function labrum(x, z) {
    const foot = new THREE.CylinderGeometry(.32, .42, .85, 20); foot.translate(x, .42, z - ZC);
    const bowl = new THREE.CylinderGeometry(1.15, .55, .32, 32); bowl.translate(x, 1.0, z - ZC);
    put('pools', 'basin', 'base', foot); put('pools', 'basin', 'base', bowl);
    const w = new THREE.CircleGeometry(1.05, 32); w.rotateX(-Math.PI / 2); w.translate(x, 1.12, z - ZC);
    put('pools', 'water', 'base', w);
  }
  half(-1); half(1);

  // north portico on the street (Vacheva 2008: stylobate with column bases 0.60 m for shafts of 0.48 m, 3.20 m apart)
  slab('portico', 'stone', 'base', rect(-40.7, -4.8, 40.7, -3.3), H.found, H.street + .3);
  slab('portico', 'paving', 'base', rect(-40.7, -3.3, 40.7, 0), H.found, H.street + .05);   // a step above the street (and the terrain)
  for (let x = -38.4; x <= 38.4 + 1e-6; x += 3.2) {
    const base = new THREE.BoxGeometry(.6, .3, .6); base.translate(x, H.street + .45, -4.05 - ZC);
    const shaft = new THREE.CylinderGeometry(.21, .24, 3.7, 16); shaft.translate(x, H.street + .6 + 1.85, -4.05 - ZC);
    const cap = new THREE.BoxGeometry(.62, .28, .62); cap.translate(x, H.street + 4.44, -4.05 - ZC);
    for (const g of [base, shaft, cap]) put('portico', 'stone', 'base', g);
  }
  slab('portico', 'stone', 'base', rect(-40.7, -4.45, 40.7, -3.65), H.street + 4.58, H.street + 4.9);   // architrave
  roof('portico', -40.7, -4.9, 40.7, 0, 5.3, 5.75, 'z');

  /* =====================================================================
     MESHES, PARTS
     ===================================================================== */
  const groups = new Map(), lifted = [];
  for (const [k, geos] of buckets) {
    const [part, mat, role] = k.split('|');
    const gk = `${part}|${role}`;
    if (!groups.has(gk)) groups.set(gk, new THREE.Group());
    groups.get(gk).add(new THREE.Mesh(mergeBufferGeometries(geos), MAT[mat]));
  }
  for (const [gk, g] of groups) {
    const [part, role] = gk.split('|'), up = role !== 'base';
    registry.add(root, part, g, { off: up ? LIFT : [0, 0, 0], shadow: true });
    if (up) lifted.push(g);
  }

  /* =====================================================================
     PEOPLE FOR SCALE (1.70 m): simple figures in tunics
     ===================================================================== */
  const secPlanes = [new THREE.Plane(new V3(-1, 0, 0), 1e5)];   // section: keeps x ≤ constant (1e5 = everything)
  const people = new THREE.Group(); root.add(people);
  {
    const COLS = ['#f1ece0', '#e6d6b2', '#b4573f', '#6e86a3', '#d3ad55'], skin = [], cloth = COLS.map(() => []);
    const FIG = [[-20, 10, 0], [-8, 15, 0], [5, 12, 0], [18, 9, 0], [-30, 26, 0], [-25, 38, 0], [-33, 34, 0], [30, 30, 0], [24, 40, 0],
      [-6, 25, 0], [4, 28, 0], [-3, 37, 0], [9, 40, 0], [-3, 50, 0], [2, 55, 0], [5, 47.5, 0], [-35, 52, 0], [-24, 50, 0], [36, 14, 0],
      [-25, 64.5, 0], [20, 65, 0], [36, 70.2, 0], [-20, -1.8, H.street], [6, -2.5, H.street], [25, -7, H.street], [-10, -9, H.street],
      [-12, 78, H.south], [14, 81, H.south], [-50.5, 10, ground(10)], [-51, 30, ground(30)], [51, 22, ground(22)]];
    const part = (g, x, y, z, list, yaw) => { g.rotateY(yaw); g.translate(x, y, z); list.push(prep(g)); };
    FIG.forEach(([x, z, y], i) => {
      const Z = z - ZC, yaw = rnd() * 6.28, c = cloth[i % COLS.length];
      for (const d of [-1, 1]) part(new THREE.CylinderGeometry(.06, .055, .52, 6).translate(d * .09, .26, 0), x, y, Z, skin, yaw);
      part(new THREE.CylinderGeometry(.19, .27, .78, 12).translate(0, .52 + .39, 0), x, y, Z, c, yaw);        // tunic
      part(new THREE.CylinderGeometry(.15, .19, .2, 12).translate(0, 1.4, 0), x, y, Z, c, yaw);               // shoulders
      for (const d of [-1, 1]) part(new THREE.CylinderGeometry(.045, .05, .58, 6).translate(d * .23, 1.12, 0), x, y, Z, c, yaw);   // arms
      part(new THREE.CylinderGeometry(.05, .05, .1, 8).translate(0, 1.53, 0), x, y, Z, skin, yaw);
      part(new THREE.SphereGeometry(.105, 14, 10).translate(0, 1.6, 0), x, y, Z, skin, yaw);
    });
    const pm = color => new THREE.MeshStandardMaterial({ color, roughness: .8, clippingPlanes: secPlanes, clipShadows: true });
    const add = (list, color) => { const m = new THREE.Mesh(mergeBufferGeometries(list), pm(color)); m.castShadow = m.receiveShadow = true; people.add(m); };
    add(skin, '#c4946f'); cloth.forEach((l, i) => add(l, COLS[i]));
  }

  /* =====================================================================
     CONTROLS, LABELS, API
     ===================================================================== */
  registry.setCut({ sec: secPlanes });
  let roofsOn = true;
  const controls = [
    { id: 'roofs', type: 'toggle', label: 'controls.roofs', title: 'controls.roofsTitle', value: true, set: on => { roofsOn = on; for (const g of lifted) g.visible = on; } },
    { id: 'section', type: 'toggle', label: 'controls.section', title: 'controls.sectionTitle', value: false, set: on => { secPlanes[0].constant = on ? 0 : 1e5; } },
    { id: 'people', type: 'toggle', label: 'controls.people', title: 'controls.peopleTitle', value: true, set: on => { people.visible = on; } },
  ];

  // label spots: [plan x, plan z, height with the roofs on, height with them off]
  const SPOT = {
    portico: [-14, -4.1, 6.4, 6.4], shops: [-16.8, 3, 7.4, 2.6], vestibules: [-35.25, 12, 13, 2.5], basilica: [0, 13.15, 17.6, 2.5],
    apodyteria: [-29.6, 32.3, 23, 2.5], frigidarium: [0, 26.4, 22.6, 2.5], tepidarium: [-6, 38.2, 18.5, 2.5], caldarium: [0, 52, 18.6, 2.5],
    heatedRooms: [-24.75, 52.5, 10.2, 2.5], pools: [0, 63, 1, 1], praefurnium: [-21, 66.5, .4, .4], latrines: [-44.2, 52, ground(52) + 5.6, ground(52) + 2],
  };
  function anchor(id, out) {
    const p = SPOT[id]; if (!p) return false;
    out.set(p[0], roofsOn ? p[2] : p[3], p[1] - ZC).applyMatrix4(root.matrixWorld); return true;
  }

  // the town around the baths and the paved streets: added to the stage scenery (hidden in the Studio)
  function attach(stage) { stage.scenery.add(createSite()); }

  return {
    root, waterline: { x0: 0, x1: 0, hb: [0, 0] }, floorY: H.found,
    home: { pos: new V3(-112, 74, 128), target: new V3(0, 4, 4), tallDrop: 12 },   // from the south-west: the south terrace and the west side
    stage: { scale: 14, ground: { y: -9.2 }, view: { minDistance: 2, maxDistance: 700 }, shadowMap: 4096, scenery: false,
      palette: { sunDir: [-5, 6.5, 5], sunI: 1.45, hemiI: .32, envI: .45, exposure: .92, horizon: '#d3dde2', mid: '#93bfdc', top: '#3f86c2',
        hemiSky: '#e6e3da', hemiGround: '#6f6047', envGround: '#7d6d52', ground: '#9a9670' } },
    shadowSize: 72,
    motion: { heave: 0, roll: 0, pitch: 0 },
    controls, update() {}, anchor, attach,
  };
}

/* =====================================================================
   THE SITE: terrain sloping to the south, streets, houses of Odessos, cypresses
   ===================================================================== */
function createSite() {
  const g = new THREE.Group();
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...o });

  // terrain: grid lines on the building's outline; under the building it stays just below the floors
  // (so the section view shows ground, not a pit), and drops with the slope where that is lower
  const lines = (a, b, fine, near) => {
    const s = new Set(near);
    for (let v = a; v <= b; v += 10) s.add(Math.round(v * 100) / 100);
    for (let v = fine[0]; v <= fine[1]; v += 1.5) s.add(Math.round(v * 100) / 100);
    return [...s].sort((p, q) => p - q);
  };
  const xs = lines(-400, 400, [-75, 75], [-50.5, -46.5, 46.5, 50.5]), zs = lines(-380, 460, [-60, 110], [0, 61.2, 67.3]);
  const pos = [], idx = [], nx = xs.length;
  const under = (x, z) => Math.abs(x) < 46.5 && z > 0 && z < 61.2;
  for (const z of zs) for (const x of xs) pos.push(x, under(x, z) ? Math.min(groundAt(z), -.35) : groundAt(z), z - ZC);
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, mat('#a39d74')); terrain.receiveShadow = true; g.add(terrain);

  // streets: the decumanus along the north side, the side streets along the slope
  const pave = mat('#c9bea6');
  const north = new THREE.Mesh(new THREE.PlaneGeometry(600, 8.2).rotateX(-Math.PI / 2).translate(0, H.street + .03, -8.9 - ZC), pave); north.receiveShadow = true; g.add(north);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(gridGeo(1, 40, (u, v) => { const z = -13 + 88 * v; return [s * (46.5 + 9.5 * u), groundAt(z) + .04, z - ZC]; }, [0, 1, 0]), pave);
    st.receiveShadow = true; g.add(st);
  }

  // houses: whitewashed walls, tiled hip roofs, on a loose grid of blocks, clear of the baths and the streets
  const walls = [], roofs = [];
  for (let gx = -230; gx <= 230; gx += 24) for (let gz = -170; gz <= 280; gz += 22) {
    if (Math.abs(gx) < 78 && gz > -26 && gz < 98) continue;
    if (gz > -22 && gz < 2) continue;
    if (rnd() < .2) continue;
    const w = 9 + rnd() * 8, d = 8 + rnd() * 7, h = 3.4 + rnd() * 3.2, x = gx + (rnd() - .5) * 4, z = gz + (rnd() - .5) * 4, y = groundAt(z) - .6, rh = 2 + rnd();
    walls.push(new THREE.BoxGeometry(w, h + .6, d).translate(x, y + (h + .6) / 2, z - ZC));
    roofs.push(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(w * 1.08, rh, d * 1.08).translate(x, y + h + .6 + rh / 2, z - ZC));
  }
  const house = new THREE.Mesh(mergeBufferGeometries(walls.map(b => b.toNonIndexed())), mat('#e7dcc6', { roughness: .95 }));
  const tiles = new THREE.Mesh(mergeBufferGeometries(roofs.map(b => b.toNonIndexed())), mat('#b15c41', { roughness: .85 }));
  for (const m of [house, tiles]) { m.castShadow = m.receiveShadow = true; g.add(m); }

  // cypresses (the museum drawing has them by the north-east corner)
  const trees = [];
  for (const [x, z] of [[-44, -6], [44, -6], [-58, -2], [58, -2], [-62, 18], [62, 18], [-64, 40], [64, 40], [-30, 84], [30, 84], [0, 90], [-60, 74], [60, 74]]) {
    const y = groundAt(z);
    trees.push(new THREE.ConeGeometry(1, 7.5, 10).translate(x, y + 4.4, z - ZC).toNonIndexed());
    trees.push(new THREE.CylinderGeometry(.15, .18, .8, 6).translate(x, y + .4, z - ZC).toNonIndexed());
  }
  const tr = new THREE.Mesh(mergeBufferGeometries(trees), mat('#3d5a35', { roughness: .9 })); tr.castShadow = true; g.add(tr);
  return g;
}
