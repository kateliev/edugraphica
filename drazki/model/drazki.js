/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Drazki — procedural 3D model of the Bulgarian torpedo boat Дръзки (Schneider et Cie, 1907–1908).
//
// Sources (see documentation/drazki-sources.md):
//   * Builder's general arrangement, "Torpedo-boats and slipway for the Bulgarian Government,
//     constructed by Messrs. Schneider and Co., Creusot and Chalon-sur-Saône" (Engineering, c. 1908):
//     profile, deck plan and two sections; length 38.000 m, beam 4.400 m, draught 1.220 m (Fig. 5),
//     depth 2.750 m, 1.33 m to the rudder foot, 2.63 m to the propeller tip. Positions below are measured off that drawing.
//   * navypedia.org: 97.5 t, 1 shaft, 1 triple-expansion engine, 2 Normand boilers, 1950 hp, 26 kn,
//     11 t coal, 2 × 47 mm guns, 1 twin 450 mm tube + 1 bow 450 mm tube, crew 27–32.
//   * The museum ship in Varna and the cutaway builder's model in the Naval Museum, Varna (photos):
//     colours, conning tower, funnels, cowls, galley stove, twin-tube "spoon", nets, dinghy.
//   * French midship section "Coupe au Maître", torpilleurs No 315… (Schneider 38 m type), in V. Draganov,
//     "Дръзки в трето измерение", Morski vestnik, 9 Nov 2025: the lower hull is an ellipse (PL 2), the
//     topsides tumble home to a crowned deck (QU ≈ 3.3, deck edge ≈ ±1.80 m at 1.36 m); rubbing strake 0.40 m above WL.
// Hull lines are fitted to these drawings; there are no published offsets.
//
// Units: metres. xa = distance forward of the stern (0 … 38). World: +x bow, +y up (0 = waterline),
// +z starboard. The model's origin is amidships (xa = 19).
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V3, UP, clamp, smooth, deg, rnd, mono, canvasTex, tube, polyCurve, displayFont, pillowGeo, roundRect } from '../../assets/js/explorer/geometry.js';
import { addSurfaceNoise } from '../../assets/js/explorer/surface.js';

export const DIMS = { length: 38, beam: 4.4, draught: 1.22, propTip: 2.3 };

export function createDrazki({ registry, M, t }) {
  const { add, adopt, PART } = registry;
  const LOA = 38, XOFF = 19, X = xa => xa - XOFF;

  /* =====================================================================
     HULL LINES
     Each station is two quarter super-ellipses: from the keel out to the widest
     point (exponent PL: round bilge amidships, V forward) and from there up and
     in to the deck centre (exponent QU: flat cambered deck amidships, round
     "turtle-back" on the forecastle). All curves are monotone splines in xa.
     ===================================================================== */
  const B = mono([[0, 0], [.25, .62], [.8, 1.06], [1.8, 1.47], [3.2, 1.8], [5, 2.02], [7, 2.14], [9.5, 2.2], [20, 2.2], [23.5, 2.15], [27, 1.95], [30, 1.66], [33, 1.24], [35.5, .8], [37.2, .36], [38, 0]]);
  const KEEL = mono([[0, .02], [1, -.2], [2.5, -.48], [4.2, -.77], [6.5, -1.08], [9, -1.19], [12, -1.22], [33.5, -1.22], [35.5, -1.17], [37, -1.03], [37.7, -.88], [38, -.75]]);
  const ZM = mono([[0, .8], [3, .62], [7, .5], [12, .5], [24, .5], [29, .55], [33, .72], [38, 1.0]]);
  const TOP = mono([[0, 1.2], [4, 1.27], [10, 1.4], [16, 1.48], [24, 1.53], [25.9, 1.55], [26.5, 1.76], [27.3, 1.97], [30, 1.98], [33, 1.92], [38, 1.86]]);
  const PL = mono([[0, 2.0], [6, 2.1], [12, 2.0], [24, 2.0], [30, 1.8], [35, 1.6], [38, 1.45]]);
  const QU = mono([[0, 3.6], [24, 3.3], [25.9, 3.3], [26.6, 3.0], [27.4, 2.7], [38, 2.5]]);
  const sec = xa => ({ b: Math.max(B(xa), 0), k: KEEL(xa), zm: ZM(xa), top: TOP(xa), pl: PL(xa), qu: QU(xa) });
  const FC = 26.6;   // forecastle break: the turtle-back starts here

  // Half-breadth of the hull at xa and height y (0 outside the hull).
  function hb(xa, y) {
    const s = sec(xa); if (s.b <= 0 || y <= s.k || y >= s.top) return 0;
    if (y < s.zm) { const u = (s.zm - y) / (s.zm - s.k); return s.b * Math.pow(1 - Math.pow(u, s.pl), 1 / s.pl); }
    const u = (y - s.zm) / (s.top - s.zm); return s.b * Math.pow(1 - Math.pow(u, s.qu), 1 / s.qu);
  }
  // Height of the deck surface at xa, |w| from the centreline.
  function deckY(xa, w) {
    const s = sec(xa), r = clamp(Math.abs(w) / Math.max(s.b, 1e-3), 0, 1);
    return s.zm + (s.top - s.zm) * Math.pow(1 - Math.pow(r, s.qu), 1 / s.qu);
  }
  // Deck edge: where the rounded side turns into the deck (slope 28°).
  const EDGE_SLOPE = Math.tan(deg(28));
  function edgeAngle(s) { const H = s.top - s.zm, au = 2 / s.qu; return Math.atan(1 / Math.pow(EDGE_SLOPE * s.b / Math.max(H, 1e-3), 1 / (2 - au))); }
  function edge(xa) {
    const s = sec(xa); if (s.b < 1e-3) return { w: 0, h: s.top };
    const fe = edgeAngle(s), au = 2 / s.qu;
    return { w: s.b * Math.pow(Math.cos(fe), au), h: s.zm + (s.top - s.zm) * Math.pow(Math.sin(fe), au) };
  }
  // Outward normal of the hull side at xa, height y (side = ±1).
  function hullNormal(xa, y, side) {
    const e = .02, dx = (hb(xa + e, y) - hb(xa - e, y)) / (2 * e), dy = (hb(xa, y + e) - hb(xa, y - e)) / (2 * e);
    return new V3(-dx, -dy, 1).normalize().multiply(new V3(1, 1, side));
  }
  const onHull = (xa, y, side, out = 0) => { const n = hullNormal(xa, y, side); return { p: new V3(X(xa), y, side * hb(xa, y)).addScaledVector(n, out), n }; };
  // Narrowest half-breadth over a box (xa0…xa1, y0…y1): furniture placed inside stays inside the hull.
  function fitW(xa0, xa1, y0, y1) { let m = Infinity; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) m = Math.min(m, hb(xa0 + (xa1 - xa0) * i / 6, y0 + (y1 - y0) * j / 6)); return m; }

  // Section sample: side (keel → deck edge) and deck (edge → centre), each resampled by arc length.
  const NS = 30, ND = 12, secCache = new Map();
  function resample(pts, n) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1], out = []; let j = 0;
    for (let i = 0; i < n; i++) {
      const d = tot * i / (n - 1); while (j < L.length - 2 && L[j + 1] < d) j++;
      const f = tot > 0 ? clamp((d - L[j]) / Math.max(L[j + 1] - L[j], 1e-9), 0, 1) : 0;
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
    }
    return out;
  }
  function section(xa) {
    const key = xa.toFixed(4); if (secCache.has(key)) return secCache.get(key);
    const s = sec(xa), H = s.top - s.zm, D = s.zm - s.k, al = 2 / s.pl, au = 2 / s.qu;
    const lo = [], side = [], deck = [];
    for (let i = 0; i <= 90; i++) { const f = i / 90 * Math.PI / 2; lo.push([s.b * Math.pow(Math.sin(f), al), s.zm - D * Math.pow(Math.cos(f), al)]); }
    const fe = s.b < 1e-3 ? Math.PI / 2 : edgeAngle(s);
    const up = f => [s.b * Math.pow(Math.cos(f), au), s.zm + H * Math.pow(Math.sin(f), au)];
    for (let i = 1; i <= 70; i++) side.push(up(fe * i / 70));
    for (let i = 0; i <= 70; i++) deck.push(up(fe + (Math.PI / 2 - fe) * i / 70));
    const r = { side: resample(lo.concat(side), NS), deck: resample(deck, ND) };
    secCache.set(key, r); return r;
  }
  // Grid surface over stations × section points; winding fixed so normals point out of the hull.
  function surfaceGeo(stations, pick, side, uvFn) {
    const rows = stations.map(xa => pick(section(xa))), n = rows[0].length, pos = [], uv = [], idx = [];
    stations.forEach((xa, i) => rows[i].forEach(([w, h]) => { pos.push(X(xa), h, side * w); uv.push(...uvFn(xa, side * w, h)); }));
    for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    // winding check at a well-shaped quad in the middle
    const i = stations.length >> 1, j = n >> 1, P = k => new V3(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]);
    const a = i * n + j, nrm = P(a + n).sub(P(a)).cross(P(a + 1).sub(P(a)));
    const out = new V3(0, P(a).y - ZM(stations[i]), P(a).z);
    if (nrm.dot(out) < 0) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp; } }
    g.computeVertexNormals();
    return g;
  }
  const stationsMain = [...Array(96)].map((_, i) => { const t = i / 95; return FC * (.55 * t + .45 * (1 - Math.cos(Math.PI * t / 2))); });
  const stationsFwd = [...Array(56)].map((_, i) => { const t = i / 55; return FC + (LOA - FC) * (.55 * t + .45 * Math.sin(Math.PI * t / 2)); });

  /* =====================================================================
     TEXTURES AND MATERIALS
     ===================================================================== */
  const noiseTex = canvasTex(256, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 110 + rnd() * 145; im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
  }, false);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  const GREY = '#737e87', RED = '#a8341f';
  // Hull paint: red below the waterline, white boot-top, grey topsides; faint plate seams.
  // v maps height: v = (h + 2.6) / 5.2.
  const hullTex = canvasTex(2048, 1024, (c, W, H) => {
    const yOf = h => (1 - (h + 2.6) / 5.2) * H;
    c.fillStyle = GREY; c.fillRect(0, 0, W, H);
    c.fillStyle = RED; c.fillRect(0, yOf(0), W, H);
    c.fillStyle = '#f1f0ea'; c.fillRect(0, yOf(.1), W, yOf(-.01) - yOf(.1));
    c.globalAlpha = .1; c.strokeStyle = '#1b2228'; c.lineWidth = 2;
    for (let i = 1; i < 16; i++) { const x = i / 16 * W + (i % 2) * 22; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (const h of [1.65, 1.05, .45, -.55, -1.15]) { c.beginPath(); c.moveTo(0, yOf(h)); c.lineTo(W, yOf(h)); c.stroke(); }
    c.globalAlpha = .06; c.fillStyle = '#000';
    for (let i = 0; i < 2400; i++) c.fillRect(rnd() * W, rnd() * H, 2, 2);
    c.globalAlpha = 1;
  });
  const deckTex = canvasTex(2048, 512, (c, W, H) => {
    c.fillStyle = '#8b3a2b'; c.fillRect(0, 0, W, H);
    c.globalAlpha = .14; c.strokeStyle = '#2a0f0a'; c.lineWidth = 2;
    for (let i = 1; i < 19; i++) { const x = i / 19 * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let j = 1; j < 8; j++) { const y = j / 8 * H; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.globalAlpha = .08; c.fillStyle = '#000'; for (let i = 0; i < 3000; i++) c.fillRect(rnd() * W, rnd() * H, 2, 2);
    c.globalAlpha = 1;
  });
  const fcTex = canvasTex(1024, 512, (c, W, H) => {
    c.fillStyle = GREY; c.fillRect(0, 0, W, H);
    c.globalAlpha = .1; c.strokeStyle = '#1b2228'; c.lineWidth = 2;
    for (let i = 1; i < 6; i++) { const x = i / 6 * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let j = 1; j < 6; j++) { const y = j / 6 * H; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.globalAlpha = 1;
  });
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, ...o });
  const cutMat = (m, key) => { m.userData.cut = key; m.clipIntersection = true; m.clipShadows = true; return m; };
  const MAT = {
    grey: std(GREY, { roughness: .5, metalness: .3 }),
    greyLight: std('#a6aeb5', { roughness: .5, metalness: .25 }),
    dark: std('#2b3036', { roughness: .6 }),
    black: std('#15181c', { roughness: .7 }),
    steel: std('#b9c0c6', { metalness: .9, roughness: .3 }),
    iron: std('#45484d', { metalness: .2, roughness: .7, envMapIntensity: .4 }),
    brass: std('#c9a24a', { metalness: 1, roughness: .3 }),
    bronze: std('#a8743a', { metalness: 1, roughness: .35 }),
    copper: std('#b8673c', { metalness: .9, roughness: .35 }),
    wood: std('#9a6a3e', { roughness: .7 }),
    woodLight: std('#c8a273', { roughness: .7, envMapIntensity: .45 }),
    canvas: std('#d6c7a2', { roughness: .95 }),
    redPaint: std('#b8281d', { roughness: .6, side: THREE.BackSide }),
    shaft: std('#0c0d0f', { roughness: 1, side: THREE.BackSide, envMapIntensity: 0 }),   // inside of ducts
    void: std('#050506', { roughness: 1, envMapIntensity: 0, side: THREE.DoubleSide }),  // the dark depth of a duct
    white: std('#efefe9', { roughness: .5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#1c2a36', roughness: .06, metalness: .1, clearcoat: 1 }),
    boiler: std('#3d4247', { roughness: .8, metalness: .05, envMapIntensity: .3 }),
    drum: std('#6a7178', { roughness: .45, metalness: .35, envMapIntensity: .45 }),
    engine: std('#2f4b3b', { roughness: .55, metalness: .1, envMapIntensity: .35 }),
    primer: std('#cdc5b6', { roughness: .9 }),
    mattress: std('#4d6680', { roughness: .95, envMapIntensity: .4 }),
    cushion: std('#7e2a2a', { roughness: .9, envMapIntensity: .4 }),
    coal: std('#18181a', { roughness: .95, bumpMap: noiseTex, bumpScale: .03, envMapIntensity: .3 }),
    fire: new THREE.MeshStandardMaterial({ color: '#2a0d00', emissive: '#ff6a1a', emissiveIntensity: 1 }),
    lampRed: new THREE.MeshStandardMaterial({ color: '#5a0c0c', emissive: '#ff2a1a', emissiveIntensity: .9 }),
    lampGreen: new THREE.MeshStandardMaterial({ color: '#0b4a1c', emissive: '#22e06a', emissiveIntensity: .9 }),
    lampWhite: new THREE.MeshStandardMaterial({ color: '#7d7d70', emissive: '#fff6d8', emissiveIntensity: .8 }),
  };
  MAT.fire.userData.fire = true;
  // Surface noise (assets/js/explorer/surface.js) so big plain surfaces do not look like plastic:
  // painted steel, the red-brown deck, matte interior machinery, the canvas boat cover.
  const NOISE = {
    paint: { mottle: .45, grain: 12, color: .05, rough: .12, bump: .004 },
    deck: { mottle: .35, grain: 12, color: .08, rough: .08, bump: .003 },
    inside: { mottle: .6, grain: 12, color: .07, rough: .1, bump: .003 },
    canvas: { mottle: .9, grain: 16, color: .08, rough: .08, bump: .003 },
  };
  for (const m of [MAT.grey, MAT.greyLight, MAT.white, MAT.dark, MAT.black]) addSurfaceNoise(m, NOISE.paint);
  for (const m of [MAT.boiler, MAT.engine, MAT.iron, MAT.primer]) addSurfaceNoise(m, NOISE.inside);
  addSurfaceNoise(MAT.canvas, NOISE.canvas);
  const hullMat = key => cutMat(addSurfaceNoise(new THREE.MeshStandardMaterial({ map: hullTex, roughness: .5, metalness: .3 }), NOISE.paint), key);
  const innerMat = key => cutMat(addSurfaceNoise(new THREE.MeshStandardMaterial({ color: '#a39b8d', roughness: .95, side: THREE.BackSide, envMapIntensity: .3 }), NOISE.inside), key);
  const bulkMat = key => cutMat(addSurfaceNoise(std('#b3ab9e', { roughness: .9, envMapIntensity: .3 }), NOISE.inside), key);

  /* ---------------- small geometry helpers ---------------- */
  const Q = new THREE.Quaternion(), E = new THREE.Euler(), M4 = new THREE.Matrix4();
  function tf(g, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
    const sv = Array.isArray(s) ? new V3(...s) : new V3(s, s, s);
    g.applyMatrix4(M4.compose(new V3(...p), Q.setFromEuler(E.set(...r)), sv)); return g;
  }
  function cylGeo(a, b, r, seg = 12, r2 = r, open = false) {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, open);
    g.applyMatrix4(M4.compose(a.clone().addScaledVector(d, .5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new V3(1, 1, 1)));
    return g;
  }
  function mergeGeos(list) {
    return mergeBufferGeometries(list.map(g => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      if (!n.attributes.normal) n.computeVertexNormals();
      return n;
    }), false);
  }
  const mesh = (g, m) => new THREE.Mesh(g, m);
  const group = (...c) => { const g = new THREE.Group(); c.forEach(o => g.add(o)); return g; };
  // Shape in plan (x = world x, y = −z) extruded upward from y0.
  function extrudeUp(shape, y0, height, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, bevel ? { depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20 } : { depth: height, bevelEnabled: false, curveSegments: 20 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); return g;
  }
  // Shape in section (x = z, y = height) extruded along the length from xa0 to xa1.
  function extrudeAlong(shape, xa0, xa1, bevel = 0) {
    const len = xa1 - xa0;
    const g = new THREE.ExtrudeGeometry(shape, bevel ? { depth: len - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 } : { depth: len, bevelEnabled: false, curveSegments: 18 });
    g.rotateY(Math.PI / 2); g.translate(X(xa0) + bevel, 0, 0); return g;   // after rotateY(π/2): shape x → −z, depth → +x
  }
  const rrShape = (x0, y0, x1, y1, r) => roundRect(x0, y0, x1, y1, r, r, r, r);
  // Chain: torus links along a curve through pts, every other link turned 90°.
  function chainLinks(pts, r = .045) {
    const curve = new THREE.CatmullRomCurve3(pts), L = curve.getLength(), n = Math.floor(L / (r * 2.6)), gs = [];
    for (let i = 0; i < n; i++) {
      const u = i / n, p = curve.getPointAt(u), tn = curve.getTangentAt(u);
      const lg = new THREE.TorusGeometry(r, r * .3, 5, 10); lg.scale(1.5, 1, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), tn).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), i % 2 ? Math.PI / 2 : 0));
      lg.applyMatrix4(M4.compose(p, q, new V3(1, 1, 1))); gs.push(lg);
    }
    return mergeGeos(gs);
  }
  // Superellipse ("squared oval") outline, centred on (cx, cy).
  function squircle(a, b, e = 4, n = 40, path = new THREE.Shape(), cx = 0, cy = 0) {
    for (let i = 0; i <= n; i++) {
      const t = i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const x = cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / e), y = cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
      i ? path.lineTo(x, y) : path.moveTo(x, y);
    }
    return path;
  }

  const root = new THREE.Group();

  /* =====================================================================
     HULL, DECK AND FORECASTLE
     ===================================================================== */
  const hullUV = (xa, z, h) => [xa / LOA, (h + 2.6) / 5.2];
  const deckUV = (xa, z) => [xa / LOA, .5 + z / 5];
  for (const side of [1, -1]) {
    for (const [st, key] of [[stationsMain, 'main'], [stationsFwd, 'fwd']]) {
      const g = surfaceGeo(st, s => s.side, side, hullUV);
      add(root, 'hull', mesh(g, hullMat(key)));
      add(root, 'hull', mesh(g, innerMat(key)), { noPick: true });
    }
    const gd = surfaceGeo(stationsMain, s => s.deck, side, deckUV);
    add(root, 'deck', mesh(gd, cutMat(addSurfaceNoise(new THREE.MeshStandardMaterial({ map: deckTex, roughness: .85 }), NOISE.deck), 'main')));
    add(root, 'deck', mesh(gd, innerMat('main')), { noPick: true });
    const gf = surfaceGeo(stationsFwd, s => s.deck, side, deckUV);
    add(root, 'forecastle', mesh(gf, cutMat(addSurfaceNoise(new THREE.MeshStandardMaterial({ map: fcTex, roughness: .55, metalness: .3 }), NOISE.paint), 'fwd')));
    add(root, 'forecastle', mesh(gf, innerMat('fwd')), { noPick: true });
  }

  // Stem bar: the steel bar along the bow, from the forefoot up to the deck.
  {
    const pts = [[35.6, KEEL(35.6) - .02], [36.8, KEEL(36.8) - .02], [37.6, KEEL(37.6) - .015], [37.97, -.72], [38.02, -.2], [38.02, 1.2], [38.03, TOP(38) - .02]].map(([x, y]) => new V3(X(x), y, 0));
    add(root, 'stem', tube(new THREE.CatmullRomCurve3(pts, false, 'centripetal', .4), .055, MAT.grey, 60));
  }

  // Bridge wings: two platforms of perforated steel plate, one on each side of the conning tower and the
  // forecastle, level with the top of the forecastle (CAD reconstruction, Draganov 2025; owner's notes).
  // They start flush with the back of the tower and keep their width forward; the outer edge stands out
  // over the hull side. Between them the plain forecastle deck forms an alley where the
  // hand winch stands. Perforated rib brackets carry the aft half of each wing; a half breakwater closes the
  // forward half down to the hull and curves in at the front.
  const PY = 2.0, WING = { xa0: 26.0, xa1: 29.6, yHull: 1.15, alley: .6, ct: .83, ctx: 27.58 };
  const wingOut = xa => hb(xa, WING.yHull) - .01;   // outer edge: over the hull side at yHull
  // Height where something standing at |z| = w meets the hull (on the side below the deck edge, else on the deck).
  const yUnder = (xa, w) => {
    const e = edge(xa); if (w <= e.w) return deckY(xa, w);
    let lo = ZM(xa), hi = e.h; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; hb(xa, m) > w ? lo = m : hi = m; }
    return lo;
  };
  {
    const g = new THREE.Group(), xs = []; for (let xa = WING.xa0; xa <= WING.xa1 + 1e-6; xa += .1) xs.push(xa);
    // perforated plate: round holes in staggered rows, about 6 cm apart (CAD close-ups)
    const gratTex = canvasTex(128, 128, (c, W) => {
      c.fillStyle = '#8d959c'; c.fillRect(0, 0, W, W); c.globalCompositeOperation = 'destination-out';
      for (let j = 0; j < 8; j++) for (let i = 0; i <= 8; i++) { c.beginPath(); c.arc((i + (j % 2) * .5) * W / 8, (j + .5) * W / 8, 4.2, 0, Math.PI * 2); c.fill(); }
    }, false);
    gratTex.wrapS = gratTex.wrapT = THREE.RepeatWrapping; gratTex.repeat.set(2, 2); gratTex.anisotropy = 8;
    const gm = new THREE.MeshStandardMaterial({ map: gratTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .6, metalness: .4 });
    const pm = MAT.grey.clone(); pm.side = THREE.DoubleSide;
    const ribs = [], bw = [];
    for (const sd of [1, -1]) {
      // plan outline: inner edge (stepping in at the front of the tower), front, outer edge back to the tower
      const pts = [[WING.xa0, WING.ct], [WING.ctx, WING.ct], [WING.ctx, WING.alley], [WING.xa1, WING.alley]];
      for (let i = xs.length - 1; i >= 0; i--) pts.push([xs[i], wingOut(xs[i])]);
      const sh = new THREE.Shape(); pts.forEach(([xa, z], i) => (i ? sh.lineTo(X(xa), -sd * z) : sh.moveTo(X(xa), -sd * z))); sh.closePath();
      const gg = new THREE.ShapeGeometry(sh); gg.rotateX(-Math.PI / 2); gg.translate(0, PY, 0);
      g.add(mesh(gg, gm));
      const rim = pts.concat([pts[0]]).map(([xa, z]) => new V3(X(xa), PY - .02, sd * z));
      g.add(tube(polyCurve(rim), .026, MAT.grey, rim.length * 2));
      // rib brackets under the aft half of the wing: steel plates with round lightening holes, from the hull
      // side and the deck edge up to the underside of the walking plate; they narrow to a point on the hull
      for (const xa of [26.1, 26.75, 27.4]) {
        const e = edge(xa), zo = wingOut(xa) - .02, zi = Math.max(e.w - .25, (xa < WING.ctx ? WING.ct : WING.alley) + .05);
        const yl = WING.yHull - .12, zh = hb(xa, yl), k = new THREE.Shape();
        k.moveTo(zi, PY - .03); k.lineTo(zo, PY - .03); k.lineTo(zh, yl); k.lineTo(e.w, e.h - .01); k.lineTo(zi, deckY(xa, zi) - .01); k.closePath();
        const zm = (zi + zo) / 2;
        for (const t of [.28, .52]) k.holes.push(new THREE.Path().absarc(zm + (zh - zm) * t, PY - .03 + (yl - PY + .03) * t, .045, 0, Math.PI * 2, true));
        const kg = new THREE.ExtrudeGeometry(k, { depth: .012, bevelEnabled: false });
        kg.rotateY(-Math.PI / 2); kg.translate(X(xa) + .006, 0, 0);   // shape x → +z after the turn
        if (sd < 0) kg.scale(1, 1, -1);
        ribs.push(kg);
      }
      // half breakwater: a plate along the outer edge of the forward half of the wing, from the walking plate
      // down to the hull side, curving in at the front to the edge of the alley, where it rises and leans forward
      const path = [];
      for (let xa = 27.9; xa < 29.45; xa += .1) path.push({ xa, z: wingOut(xa) + .006, u: 0 });
      const a = [29.45, wingOut(29.45) + .006], c = [29.95, wingOut(WING.xa1)], b = [30.0, WING.alley + .02];
      for (let i = 0; i <= 12; i++) { const u = i / 12; path.push({ xa: (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], z: (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1], u }); }
      const pos = [], idx = [], top = [];
      path.forEach(({ xa, z, u }, i) => {
        const yt = PY + .04 + .14 * u, lean = .05 * u;
        pos.push(X(xa), yUnder(xa, z) - .03, sd * z, X(xa) + lean, yt, sd * z); top.push(new V3(X(xa) + lean, yt, sd * z));
        if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
      });
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      bw.push(bg, tube(top, .02, MAT.grey, 40).geometry);
    }
    g.add(mesh(mergeGeos(ribs), pm));
    add(root, 'bridge', g);
    add(root, 'breakwater', mesh(mergeGeos(bw), pm));
  }
  // Hand winch on the forecastle in front of the conning tower, between the bridge wings (CAD reconstruction): two side frames
  // with long legs leaning towards the tower, the crank shaft on top with two waisted warping drums, and
  // under it a big gear wheel and a dark flywheel. Turn the cranks and the drums haul in the mooring ropes.
  {
    const g = new THREE.Group(), ys = .74, yg = .4, xs = -.04, xg = .03; g.position.set(X(28.7), deckY(28.7, 0) - .02, 0);
    const frame = [];
    for (const sd of [1, -1]) {
      const z = sd * .12;
      for (const dz of [-.025, .025]) frame.push(cylGeo(new V3(.36, 0, z + dz), new V3(xs, ys, z + dz), .022, 8));   // long legs
      frame.push(cylGeo(new V3(-.16, 0, z), new V3(xg - .02, yg + .02, z), .025, 8));                                 // back post
      frame.push(cylGeo(new V3(xg, yg, z), new V3(xs, ys, z), .03, 8));                                              // web between the bearings
      frame.push(tf(new THREE.BoxGeometry(.12, .02, .1), [.36, .01, z]), tf(new THREE.BoxGeometry(.12, .02, .1), [-.16, .01, z]));   // feet
      frame.push(tf(new THREE.CylinderGeometry(.045, .045, .06, 14), [xs, ys, z], [Math.PI / 2, 0, 0]), tf(new THREE.CylinderGeometry(.04, .04, .06, 14), [xg, yg, z], [Math.PI / 2, 0, 0]));
    }
    g.add(mesh(mergeGeos(frame), MAT.grey));
    const iron = [cylGeo(new V3(xs, ys, -.46), new V3(xs, ys, .46), .025, 10), cylGeo(new V3(xg, yg, -.26), new V3(xg, yg, .2), .022, 10)];
    iron.push(tf(new THREE.CylinderGeometry(.27, .27, .03, 40), [xg, yg, 0], [Math.PI / 2, 0, 0]));                  // big gear
    for (let i = 0; i < 36; i++) { const an = i / 36 * Math.PI * 2; iron.push(tf(new THREE.BoxGeometry(.03, .025, .03), [xg + Math.cos(an) * .28, yg + Math.sin(an) * .28, 0], [0, 0, an])); }
    iron.push(tf(new THREE.CylinderGeometry(.07, .07, .04, 18), [xs, ys, 0], [Math.PI / 2, 0, 0]));                  // pinion
    g.add(mesh(mergeGeos(iron), MAT.iron));
    // flywheel / brake drum on the gear shaft, outside the port frame
    g.add(mesh(mergeGeos([tf(new THREE.CylinderGeometry(.17, .17, .05, 32), [xg, yg, -.21], [Math.PI / 2, 0, 0]), tf(new THREE.TorusGeometry(.17, .022, 8, 32), [xg, yg, -.21])]), MAT.black));
    g.add(mesh(tf(new THREE.CylinderGeometry(.05, .05, .08, 14), [xg, yg, -.21], [Math.PI / 2, 0, 0]), MAT.steel));
    const drum = new THREE.LatheGeometry([[.1, -.08], [.075, -.05], [.06, 0], [.075, .05], [.1, .08]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    g.add(mesh(mergeGeos([-1, 1].map(sd => tf(drum.clone(), [xs, ys, sd * .25], [Math.PI / 2, 0, 0]))), MAT.bronze));
    for (const sd of [1, -1]) {   // crank handles at both ends, opposite each other
      const an = sd > 0 ? deg(35) : deg(215), arm = new V3(xs + Math.cos(an) * .2, ys + Math.sin(an) * .2, sd * .42);
      g.add(mesh(cylGeo(new V3(xs, ys, sd * .42), arm, .016, 8), MAT.iron));
      g.add(mesh(cylGeo(arm, arm.clone().add(new V3(0, 0, sd * .15)), .024, 10), MAT.wood));
    }
    add(root, 'winch', g);
  }

  // Watertight bulkheads: plates following the hull section.
  const BULKHEADS = [4.0, 9.6, 16.8, 25.6, 28.2, 35.2];
  function sectionShape(xa, inset = .02, yMax = Infinity) {
    const s = section(xa), raw = s.side.concat(s.deck.slice(1));
    const half = raw.map(([w, h], i) => {
      const a = raw[Math.max(i - 1, 0)], b = raw[Math.min(i + 1, raw.length - 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      return [Math.max(w - inset * ty / l, 0), Math.min(h + inset * tx / l, yMax)];   // move along the inward normal
    });
    const sh = new THREE.Shape(); half.forEach(([w, h], i) => (i ? sh.lineTo(w, h) : sh.moveTo(w, h)));
    for (let i = half.length - 2; i > 0; i--) sh.lineTo(-half[i][0], half[i][1]);
    return sh;
  }
  for (const xa of BULKHEADS) {
    const g = extrudeAlong(sectionShape(xa, .03, TOP(xa) - .03), xa - .012, xa + .012);
    add(root, 'bulkheads', mesh(g, bulkMat(xa > FC ? 'fwd' : 'main')));
  }
  // floor plates of the engine room and the stokehold (the engineers walk on them, the bilge is below)
  add(root, 'bulkheads', group(mesh(floorPlate(9.7, 16.7, -.95), MAT.iron), mesh(floorPlate(16.85, 25.55, -.98), MAT.iron)));

  // Portholes: brass rims and dark glass along the forecastle and the officers' cabin.
  {
    const g = new THREE.Group();
    const sets = { fwd: [[28.7, 1.42], [30.0, 1.45], [31.3, 1.48], [32.6, 1.52], [33.9, 1.56]], main: [[4.9, .82], [6.2, .8], [7.5, .78], [8.8, .76]] };
    for (const key in sets) {
      const rims = [], glass = [];
      for (const side of [1, -1]) for (const [xa, y] of sets[key]) {
        const { p, n } = onHull(xa, y, side, .012), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), n);
        const r = new THREE.TorusGeometry(.13, .028, 8, 20); r.applyMatrix4(M4.compose(p, q, new V3(1, 1, 1))); rims.push(r);
        const gl = new THREE.CircleGeometry(.12, 20); gl.applyMatrix4(M4.compose(p.clone().addScaledVector(n, -.004), q, new V3(1, 1, 1))); glass.push(gl);
      }
      g.add(mesh(mergeGeos(rims), cutMat(MAT.brass.clone(), key)), mesh(mergeGeos(glass), cutMat(MAT.glass.clone(), key)));
    }
    add(root, 'portholes', g);
  }

  // Name plate: the brass oval with ДРЪЗКИ on both sides of the bow (as on the museum ship).
  const plateTex = canvasTex(512, 256, () => {});
  function drawPlate() {
    const c = plateTex.image.getContext('2d'), W = 512, H = 256;
    c.clearRect(0, 0, W, H);
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f1d483'); gr.addColorStop(.5, '#b98b2e'); gr.addColorStop(1, '#e4c46d');
    c.fillStyle = gr; c.beginPath(); c.ellipse(W / 2, H / 2, W / 2 - 4, H / 2 - 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1c20'; c.beginPath(); c.ellipse(W / 2, H / 2, W / 2 - 26, H / 2 - 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e9c66c'; c.font = `700 112px ${displayFont()}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ДРЪЗКИ', W / 2, H / 2 + 6);
    plateTex.needsUpdate = true;
  }
  drawPlate();
  {
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      const { p, n } = onHull(35.25, 1.72, side, .02);
      const m = mesh(new THREE.PlaneGeometry(.95, .47), new THREE.MeshStandardMaterial({ map: plateTex, transparent: true, metalness: .6, roughness: .35, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.copy(p); m.lookAt(p.clone().add(n)); g.add(m);
    }
    add(root, 'nameplate', g);
  }

  /* =====================================================================
     DECK STRUCTURES: casings, skylight
     ===================================================================== */
  const CASE_TOP = 1.98, SKY_TOP = 1.84;
  {
    // boiler-room casing in two parts, one round each funnel base, well apart (CAD plan, Draganov 2025):
    // the aft part is square at its aft end, where the lower engine-room skylight butts onto it
    add(root, 'deck', mesh(mergeGeos([extrudeUp(roundRect(X(17.0), -.9, X(20.15), .9, .06, .32, .32, .06), 1.38, CASE_TOP - 1.38, .03),
      extrudeUp(rrShape(X(21.85), -.78, X(24.3), .78, .45), 1.38, CASE_TOP - 1.38, .03)]), MAT.grey));
    // stokehold hatch between the two parts, down on the deck: a low coaming and a lid
    const yh = deckY(21.55, 0) - .03;
    add(root, 'hatches', group(mesh(extrudeUp(rrShape(X(21.3), -.36, X(21.8), .36, .05), yh, .13), MAT.grey),
      mesh(extrudeUp(rrShape(X(21.27), -.39, X(21.83), .39, .06), yh + .13, .04, .015), MAT.greyLight)));
  }
  // Deck light: a round glass set flush in a hatch lid, in a brass ring.
  function deckLight(x, y, z, rims, glass, r = .07) {
    rims.push(tf(new THREE.TorusGeometry(r, .014, 6, 20), [x, y + .004, z], [Math.PI / 2, 0, 0]));
    glass.push(tf(new THREE.CircleGeometry(r - .004, 20), [x, y + .002, z], [-Math.PI / 2, 0, 0]));
  }
  // Small hatch with three deck lights and a V-shaped grab handle (CAD plan): the apex of the V points
  // to local −x; two lights stand outside the V level with the apex, the third between the arms.
  function vHatch(xa, z, y0, coaming, rotY) {
    const g = new THREE.Group(), L = .7, W = .66, yl = coaming + .035, rims = [], glass = [];
    g.add(mesh(extrudeUp(rrShape(-L / 2 + .03, -W / 2 + .03, L / 2 - .03, W / 2 - .03, .04), 0, coaming), MAT.grey));
    g.add(mesh(extrudeUp(rrShape(-L / 2, -W / 2, L / 2, W / 2, .05), coaming, .035, .01), MAT.grey));
    for (const [x, zz] of [[-.18, .16], [-.18, -.16], [.17, 0]]) deckLight(x, yl, zz, rims, glass);
    const h = .045, ax = -.15, ex = .31, ez = .21;   // the handle: a round bar on short feet
    const bar = [[ex, 0, ez], [ex, h, ez], [ax, h, 0], [ex, h, -ez], [ex, 0, -ez]].map(([x, y, zz]) => new V3(x, yl + y, zz));
    g.add(tube(polyCurve(bar), .012, MAT.iron, 24));
    g.add(mesh(cylGeo(new V3(ax, yl, 0), new V3(ax, yl + h, 0), .012, 8), MAT.iron));
    g.add(mesh(mergeGeos(rims), MAT.brass), mesh(mergeGeos(glass), MAT.glass));
    g.position.set(X(xa), y0, z); g.rotation.y = rotY;
    return g;
  }
  const ST = { xa0: 12.62, xa1: 17.05, hw: .9, z: .15 };   // the CAD plan has it 0.15 m to starboard of the centreline
  {
    // Engine-room skylight (CAD plan, Draganov 2025): a low casing that runs on into the aft boiler casing,
    // a step lower. On its top, from aft: three flat hatches as wide as the skylight, each a different length,
    // with round deck lights along their side edges (3 + 3, 2 + 2 spaced out, 2 + 2 close together);
    // then plain plate, with a small V-handle hatch in the forward starboard corner.
    const g = new THREE.Group(), rims = [], glass = [], lids = [], HW = .74, yl = SKY_TOP + .04;
    g.add(mesh(extrudeUp(roundRect(X(ST.xa0), -ST.hw, X(ST.xa1), ST.hw, .12, 0, 0, .12), 1.36, SKY_TOP - 1.36, .03), MAT.grey));
    const HATCHES = [{ xa: 12.67, L: .98, dx: [-.35, 0, .35] }, { xa: 13.76, L: .78, dx: [-.225, .225] }, { xa: 14.64, L: .6, dx: [-.1, .1] }];
    for (const { xa, L, dx } of HATCHES) {
      const xc = X(xa + L / 2);
      lids.push(extrudeUp(rrShape(X(xa), -HW, X(xa + L), HW, .05), SKY_TOP, .04, .012));
      for (const d of dx) for (const z of [-.6, .6]) deckLight(xc + d, yl, z, rims, glass);
    }
    g.add(mesh(mergeGeos(lids), MAT.grey), mesh(mergeGeos(rims), MAT.brass), mesh(mergeGeos(glass), MAT.glass));
    g.add(vHatch(16.07, .44, SKY_TOP, .03, 0));
    g.position.z = ST.z;
    add(root, 'skylight', g);
  }
  // The same small hatch on the deck, just aft of the skylight and under the twin tube, its V pointing inboard.
  add(root, 'hatches', vHatch(12.24, .71, deckY(12.24, .71) - .02, .14, -Math.PI / 2));

  /* =====================================================================
     FUNNELS AND THE SHELL HOLE
     ===================================================================== */
  const FUNNELS = [{ xa: 22.9, id: 'fwd' }, { xa: 19.4, id: 'aft' }];
  const FUN_R = .42, FUN_TOP = 3.95, FUN_RAKE = deg(4);
  const funnelGroups = [];
  for (const f of FUNNELS) {
    const g = new THREE.Group(), h = FUN_TOP - CASE_TOP + .05;
    g.position.set(X(f.xa), CASE_TOP - .05, 0); g.rotation.z = FUN_RAKE;
    g.add(mesh(tf(new THREE.CylinderGeometry(FUN_R, FUN_R, h - .24, 32, 1, true), [0, (h - .24) / 2, 0]), MAT.grey));
    g.add(mesh(tf(new THREE.CylinderGeometry(FUN_R + .006, FUN_R + .006, .24, 32, 1, true), [0, h - .12, 0]), MAT.black));
    g.add(mesh(tf(new THREE.CylinderGeometry(FUN_R - .01, FUN_R - .01, h, 32, 1, true), [0, h / 2, 0]), MAT.shaft));   // sooty inside
    g.add(mesh(tf(new THREE.CircleGeometry(FUN_R - .01, 32), [0, .3, 0], [-Math.PI / 2, 0, 0]), MAT.void));            // the uptake goes on down to the boiler: dark
    g.add(mesh(tf(new THREE.TorusGeometry(FUN_R, .025, 8, 40), [0, h, 0], [Math.PI / 2, 0, 0]), MAT.black));
    g.add(mesh(tf(new THREE.CylinderGeometry(FUN_R + .05, FUN_R + .16, .16, 32), [0, .07, 0]), MAT.grey));   // flared base
    // steam pipe up the back, whistle on the forward funnel
    g.add(mesh(cylGeo(new V3(-FUN_R - .07, .1, .12), new V3(-FUN_R - .07, h - .05, .12), .035, 10), MAT.copper));
    if (f.id === 'fwd') {
      g.add(mesh(cylGeo(new V3(FUN_R + .05, h - .5, 0), new V3(FUN_R + .05, h - .2, 0), .05, 14), MAT.brass));
      g.add(mesh(tf(new THREE.SphereGeometry(.06, 12, 8), [FUN_R + .05, h - .17, 0]), MAT.brass));
    }
    add(root, 'funnels', g);
    funnelGroups.push({ g, h });
  }
  // The shell hole: on 21 November 1912 a shell fragment pierced the second (aft) funnel.
  // The original funnel, with the hole, is on the museum ship today.
  const holeTex = canvasTex(256, 256, (c, W) => {
    c.clearRect(0, 0, W, W); c.translate(W / 2, W / 2);
    const jag = (r0, n, amp) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = r0 * (1 + (rnd() - .5) * amp); i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r * .8); } c.closePath(); };
    c.fillStyle = '#5c544b'; jag(W * .42, 26, .5); c.fill();     // bent, scorched metal
    c.fillStyle = '#2f2a25'; jag(W * .34, 22, .6); c.fill();
    c.fillStyle = '#050505'; jag(W * .25, 18, .7); c.fill();       // the hole
  });
  const shellHole = new THREE.Group();
  {
    const f = funnelGroups[1], a = deg(70), y = 1.15;   // on the starboard side, a little aft
    const m = mesh(new THREE.PlaneGeometry(.34, .34), new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, roughness: .9, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }));
    m.position.set(-Math.cos(a) * (FUN_R + .008), y, Math.sin(a) * (FUN_R + .008));
    m.lookAt(new V3(-Math.cos(a) * 2, y, Math.sin(a) * 2));
    shellHole.add(m);
    add(f.g, 'shellHole', shellHole);
  }

  /* =====================================================================
     VENTILATORS (cowls): they catch the wind and push air down to the
     boiler fires and the engine room. Red inside, as on the museum ship.
     ===================================================================== */
  // A plain round pipe of one width all the way: up from the deck, a quarter bend at the top, a short
  // straight lip and a rolled rim round the mouth (owner's notes).
  function cowl(xa, w, r, height, facing) {
    const g = new THREE.Group(), R = r * 1.2, lip = .1, y0 = deckY(xa, w) - .05, yc = height + R;
    g.add(mesh(tf(new THREE.CylinderGeometry(r, r, height, 32, 1, true), [0, height / 2, 0]), MAT.grey));
    g.add(mesh(tf(new THREE.CylinderGeometry(r + .04, r + .05, .1, 32), [0, .07, 0]), MAT.grey));   // flange on the deck
    const bend = tf(new THREE.TorusGeometry(R, r, 20, 24, Math.PI / 2), [R, height, 0], [0, 0, Math.PI / 2]);
    const mouth = tf(new THREE.CylinderGeometry(r, r, lip, 32, 1, true), [R + lip / 2, yc, 0], [0, 0, Math.PI / 2]);
    g.add(mesh(mergeGeos([bend, mouth]), MAT.grey), mesh(mergeGeos([bend.clone(), mouth.clone()]), MAT.redPaint));   // red inside
    g.add(mesh(tf(new THREE.TorusGeometry(r + .012, .032, 10, 40), [R + lip, yc, 0], [0, Math.PI / 2, 0]), MAT.grey));   // rolled rim
    // where the bend turns down the duct runs on into the ship out of sight: a dark void
    g.add(mesh(tf(new THREE.CircleGeometry(r * .99, 32), [0, height + .02, 0], [-Math.PI / 2, 0, 0]), MAT.void));
    g.position.set(X(xa), y0, w); g.rotation.y = facing;
    return g;
  }
  // One ventilator, on the starboard side by the stokehold hatch, its mouth turned inboard (to port).
  // As wide as the mouth of the old trumpet cowl.
  add(root, 'ventilators', cowl(21.55, 1.08, .42, 1.0, Math.PI / 2));

  /* =====================================================================
     MACHINERY: boilers, coal bunkers, engine, condenser, shaft, propeller, rudder
     ===================================================================== */
  // Two Normand water-tube boilers: a steam drum on top, two water drums below,
  // hundreds of thin tubes between them inside the casing, and the fire underneath.
  function boiler(xa0, xa1, fireFwd) {
    const g = new THREE.Group(), len = xa1 - xa0;
    const sh = new THREE.Shape(); sh.moveTo(-1.08, -.95); sh.lineTo(1.08, -.95); sh.lineTo(.78, .45); sh.bezierCurveTo(.72, .8, .32, .88, 0, .88); sh.bezierCurveTo(-.32, .88, -.72, .8, -.78, .45); sh.closePath();
    g.add(mesh(extrudeAlong(sh, xa0, xa1, .04), MAT.boiler));
    const drum = (r, y, z) => { const c = new THREE.CapsuleGeometry(r, len, 6, 20); c.rotateZ(Math.PI / 2); c.translate(X((xa0 + xa1) / 2), y, z); return c; };
    g.add(mesh(drum(.32, .95, 0), MAT.drum));
    g.add(mesh(mergeGeos([drum(.16, -.82, 1.02), drum(.16, -.82, -1.02)]), MAT.drum));
    // firing end: two doors with a glowing slot, a pressure gauge
    const xf = fireFwd ? X(xa1) + .04 : X(xa0) - .04, sx = fireFwd ? 1 : -1;
    for (const z of [-.42, .42]) {
      g.add(mesh(tf(new THREE.BoxGeometry(.05, .3, .36), [xf + sx * .02, -.25, z]), MAT.iron));
      const fm = MAT.fire.clone();
      g.add(mesh(tf(new THREE.BoxGeometry(.03, .06, .3), [xf + sx * .035, -.47, z]), fm));
    }
    g.add(mesh(tf(new THREE.CylinderGeometry(.07, .07, .03, 20), [xf + sx * .02, .45, 0], [0, 0, Math.PI / 2]), MAT.brass));
    // uptake to the funnel
    const fx = fireFwd ? xa1 - .35 : xa0 + .35;
    g.add(mesh(tf(new THREE.CylinderGeometry(.42, .55, .5, 24), [X(fx), 1.18, 0]), MAT.boiler));
    return g;
  }
  {
    const g = group(boiler(17.3, 19.7, true), boiler(22.6, 25.0, false));
    g.add(ladder(21.55, -.98, 1.4, .1));   // stokehold ladder, under the deck hatch
    add(root, 'boilers', g);
  }
  // Coal bunkers along both sides of the boiler rooms (11 t of coal when full).
  {
    const xa = 25.2, sh = s => {
      const p = new THREE.Shape(), yTop = deckY(xa, 1.3) - .06, pts = [];
      for (let i = 0; i <= 16; i++) { const y = -.86 + (yTop + .02 - -.86) * i / 16; pts.push([Math.max(hb(xa, y) - .05, 1.3), y]); }
      p.moveTo(s * 1.28, -.86); p.lineTo(s * 1.28, yTop); for (let i = pts.length - 1; i >= 0; i--) p.lineTo(s * pts[i][0], pts[i][1]); p.closePath(); return p;
    };
    const m = cutMat(MAT.coal.clone(), 'main');
    add(root, 'coalBunkers', group(mesh(extrudeAlong(sh(1), 16.85, 25.55), m), mesh(extrudeAlong(sh(-1), 16.85, 25.55), m)));
  }
  function floorPlate(a, b, y, inset = .04) {
    const s = new THREE.Shape(), n = 24;
    for (let i = 0; i <= n; i++) { const xa = a + (b - a) * i / n, w = Math.max(hb(xa, y) - inset, .05); i ? s.lineTo(X(xa), -w) : s.moveTo(X(xa), -w); }
    for (let i = n; i >= 0; i--) { const xa = a + (b - a) * i / n, w = Math.max(hb(xa, y) - inset, .05); s.lineTo(X(xa), w); }
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
  }
  function ladder(xa, y0, y1, z) {
    const g = [];
    for (const dz of [-.22, .22]) g.push(cylGeo(new V3(X(xa) - .25, y0, z + dz), new V3(X(xa) + .15, y1, z + dz), .025, 8));
    for (let i = 1; i < 8; i++) { const f = i / 8; g.push(cylGeo(new V3(X(xa) - .25 + .4 * f, y0 + (y1 - y0) * f, z - .22), new V3(X(xa) - .25 + .4 * f, y0 + (y1 - y0) * f, z + .22), .018, 6)); }
    return mesh(mergeGeos(g), MAT.steel);
  }

  // Triple-expansion engine: steam works three times, in a small, a middle and a big cylinder.
  const ENG = { crankY: -.78, r: .2, rod: .78, cyls: [{ xa: 13.2, r: .2 }, { xa: 12.2, r: .3 }, { xa: 11.1, r: .44 }] };
  const engineMoving = [];
  let crankshaft;
  {
    const g = new THREE.Group();
    g.add(mesh(tf(new THREE.BoxGeometry(3.3, .42, 1.05), [X(12.15), -1.0, 0]), MAT.engine));                        // bedplate
    for (const xa of [10.55, 11.65, 12.7, 13.65]) for (const z of [-.36, .36]) g.add(mesh(cylGeo(new V3(X(xa), -.8, z), new V3(X(xa), .56, z * .8), .05, 10), MAT.engine));   // columns
    g.add(mesh(tf(new THREE.BoxGeometry(3.25, .1, .95), [X(12.15), .56, 0]), MAT.engine));                         // entablature
    ENG.cyls.forEach((c, i) => {
      g.add(mesh(tf(new THREE.CylinderGeometry(c.r + .04, c.r + .04, .72, 28), [X(c.xa), .96, 0]), MAT.engine));
      g.add(mesh(tf(new THREE.CylinderGeometry(c.r + .07, c.r + .07, .05, 28), [X(c.xa), 1.33, 0]), MAT.steel));   // cover
      g.add(mesh(tf(new THREE.BoxGeometry(.32, .55, .22), [X(c.xa), .96, .42 + c.r * .3]), MAT.engine));             // valve chest
      // moving parts: piston rod + crosshead (slides), connecting rod (swings)
      const rod = mesh(new THREE.CylinderGeometry(.035, .035, .62, 10), MAT.steel);
      const head = mesh(new THREE.BoxGeometry(.16, .1, .2), MAT.steel);
      const con = mesh(new THREE.CylinderGeometry(.04, .05, 1, 10), MAT.steel);
      g.add(rod, head, con);
      engineMoving.push({ x: X(c.xa), phase: i * Math.PI * 2 / 3, rod, head, con });
    });
    // crankshaft: turns with the propeller
    crankshaft = new THREE.Group(); crankshaft.position.set(0, ENG.crankY, 0);
    crankshaft.add(mesh(cylGeo(new V3(X(10.4), 0, 0), new V3(X(13.9), 0, 0), .075, 14), MAT.steel));
    ENG.cyls.forEach((c, i) => {
      const ph = i * Math.PI * 2 / 3, web = new THREE.Group(); web.rotation.x = ph;
      for (const dx of [-.12, .12]) web.add(mesh(tf(new THREE.BoxGeometry(.06, .36, .2), [X(c.xa) + dx, ENG.r / 2, 0]), MAT.iron));
      web.add(mesh(cylGeo(new V3(X(c.xa) - .12, ENG.r, 0), new V3(X(c.xa) + .12, ENG.r, 0), .055, 12), MAT.steel));
      crankshaft.add(web);
    });
    g.add(crankshaft);
    // main steam pipe from the boiler room, exhaust from the big cylinder to the condenser
    g.add(tube([new V3(X(16.75), 1.0, .3), new V3(X(15.2), 1.15, .35), new V3(X(13.6), 1.42, .2), new V3(X(13.2), 1.38, 0)], .07, MAT.copper, 30));
    g.add(ladder(10.0, -.95, 1.35, -.55));
    add(root, 'engine', g);
  }
  function updateEngine(theta) {
    crankshaft.rotation.x = theta;
    for (const m of engineMoving) {
      const a = theta + m.phase, py = ENG.crankY + ENG.r * Math.cos(a), pz = ENG.r * Math.sin(a);
      const cy = py + Math.sqrt(ENG.rod * ENG.rod - pz * pz);     // crosshead height
      m.head.position.set(m.x, cy, 0);
      m.rod.position.set(m.x, cy + .31, 0);
      const a3 = new V3(m.x, py, pz), b3 = new V3(m.x, cy, 0), d = b3.clone().sub(a3);
      m.con.position.copy(a3).addScaledVector(d, .5); m.con.scale.set(1, d.length(), 1);
      m.con.quaternion.setFromUnitVectors(UP, d.normalize());
    }
  }
  // Condenser: cold sea water in thin tubes turns the used steam back into water for the boilers.
  {
    const g = new THREE.Group(), c = new THREE.CapsuleGeometry(.3, 2.2, 8, 24); c.rotateZ(Math.PI / 2); c.translate(X(13.55), -.42, -1.0);
    g.add(mesh(c, MAT.drum));
    g.add(mesh(tf(new THREE.CylinderGeometry(.16, .16, .7, 18), [X(15.1), -.55, -.55]), MAT.engine));   // air pump
    g.add(tube([new V3(X(11.1), .62, -.35), new V3(X(11.4), .5, -.8), new V3(X(12.2), -.05, -1.0), new V3(X(12.6), -.15, -1.0)], .1, MAT.copper, 24));
    add(root, 'condenser', g);
  }
  // Shaft line: engine → stern tube → bracket → propeller.
  const PROP = { xa: .95, y: -1.3 }, SHAFT0 = { xa: 10.4, y: ENG.crankY };
  const shaftY = xa => SHAFT0.y + (PROP.y - SHAFT0.y) * (SHAFT0.xa - xa) / (SHAFT0.xa - PROP.xa);
  {
    const g = new THREE.Group();
    g.add(mesh(cylGeo(new V3(X(SHAFT0.xa), SHAFT0.y, 0), new V3(X(PROP.xa + .1), PROP.y, 0), .07, 14), MAT.steel));
    let xo = 9; while (xo > 2 && KEEL(xo) < shaftY(xo) - .05) xo -= .05;       // where the shaft leaves the hull
    g.add(mesh(cylGeo(new V3(X(xo + .4), shaftY(xo + .4), 0), new V3(X(xo - 1.1), shaftY(xo - 1.1), 0), .15, 18, .12), MAT.grey));
    const bx = 2.1, by = shaftY(bx);
    g.add(mesh(cylGeo(new V3(X(bx - .2), by, 0), new V3(X(bx + .2), shaftY(bx + .2), 0), .13, 16), MAT.grey));
    for (const sd of [1, -1]) g.add(mesh(cylGeo(new V3(X(bx), by, 0), new V3(X(bx + .15), KEEL(bx + .15) + .05, sd * .42), .05, 10), MAT.grey));
    g.add(mesh(tf(new THREE.BoxGeometry(.4, .3, .45), [X(10.05), SHAFT0.y + .02, 0]), MAT.engine));   // thrust block
    add(root, 'shaft', g);
  }
  // Propeller: three bronze blades, about 1.8 m across.
  const prop = new THREE.Group();
  {
    prop.position.set(X(PROP.xa), PROP.y, 0);
    const hub = new THREE.LatheGeometry([[0, -.2], [.14, -.16], [.16, .05], [.12, .2], [0, .32]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
    hub.rotateZ(Math.PI / 2); prop.add(mesh(hub, MAT.bronze));
    const blades = [], R = .9, P = 1.9;
    for (let k = 0; k < 3; k++) {
      const psi = k * Math.PI * 2 / 3;
      blades.push((() => {
        const nu = 10, nv = 6, pos = [], idx = [];
        for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
          const r = .14 + (R - .14) * i / nu, c = (j / nv - .5) * 2, w = (.34 * Math.pow(Math.sin(Math.PI * (.12 + .88 * i / nu)), .55) + .06) * (1 - .25 * i / nu);
          const al = Math.atan(P / (2 * Math.PI * r)), er = new V3(0, Math.cos(psi), Math.sin(psi)), et = new V3(0, -Math.sin(psi), Math.cos(psi));
          const cd = et.clone().multiplyScalar(Math.cos(al)).add(new V3(Math.sin(al), 0, 0));
          const skew = .08 * (i / nu) * (i / nu);
          const p = er.clone().multiplyScalar(r).addScaledVector(cd, c * w / 2 + skew);
          pos.push(p.x, p.y, p.z);
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
      })());
    }
    const bm = MAT.bronze.clone(); bm.side = THREE.DoubleSide;
    prop.add(mesh(mergeGeos(blades), bm));
    add(root, 'propeller', prop);
  }
  // Rudder: hung on the stern, behind the propeller (French torpedo-boat style).
  {
    const sh = new THREE.Shape(); sh.moveTo(.22, .04); sh.lineTo(-.82, .04); sh.lineTo(-.86, -1.2); sh.quadraticCurveTo(-.84, -1.38, -.62, -1.4); sh.lineTo(.08, -1.4); sh.quadraticCurveTo(.24, -1.38, .24, -1.2); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: .04, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 3, curveSegments: 10 });
    g.translate(X(0), 0, -.02);
    const rg = group(mesh(g, MAT.grey), mesh(cylGeo(new V3(X(.12), -.02, 0), new V3(X(.12), 1.0, 0), .065, 14), MAT.grey));
    add(root, 'rudder', rg);
  }

  /* =====================================================================
     WEAPONS
     ===================================================================== */
  // 450 mm torpedo: steel body, bronze war-head, two propellers turning opposite ways, tail fins.
  function torpedoGroup(mats = MAT) {
    const g = new THREE.Group(), L = 5.0, R = .225;
    const body = [[0, .05], [.12, .07], [.3, .08], [.7, .14], [1.25, R], [3.9, R]].map(([y, r]) => new THREE.Vector2(r, y));
    const nose = [[R, 3.9]]; for (let i = 1; i <= 10; i++) { const f = i / 10; nose.push([R * Math.sqrt(Math.max(1 - Math.pow(f, 1.6), 0)), 3.9 + 1.1 * f]); }
    const lb = new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...body], 24), ln = new THREE.LatheGeometry(nose.map(([r, y]) => new THREE.Vector2(r, y)), 24);
    for (const q of [lb, ln]) { q.rotateZ(-Math.PI / 2); q.translate(-L / 2, 0, 0); }
    g.add(mesh(lb, mats.steel), mesh(ln, mats.bronze));
    const fins = [];
    for (let k = 0; k < 4; k++) fins.push(tf(new THREE.BoxGeometry(.5, .2, .012), [-L / 2 + .55, Math.cos(k * Math.PI / 2) * .17, Math.sin(k * Math.PI / 2) * .17], [k * Math.PI / 2, 0, 0]));
    for (const dx of [.07, .17]) for (let k = 0; k < 4; k++) fins.push(tf(new THREE.BoxGeometry(.03, .26, .06), [-L / 2 + dx, 0, 0], [k * Math.PI / 4 + dx * 3, 0, 0]));
    g.add(mesh(mergeGeos(fins), mats.bronze));
    return g;
  }
  // Twin deck tube on a turntable. The two tubes lie side by side but face opposite ways
  // (navypedia: "one twin 450 mm tube, angled to opposite sides"): turn the turntable and one
  // tube points to each side, so the boat can fire at a target on either side.
  // TUBES[i].dir = +1 muzzle forward when the turntable is straight, −1 muzzle aft.
  const MOUNT = { xa: 10.9 }, TUBE = { x0: -2.75, x1: 2.75, r: .26, y: 1.08, z: .3 };
  const TUBES = [{ z: TUBE.z, dir: 1 }, { z: -TUBE.z, dir: -1 }];
  const mount = new THREE.Group();
  {
    const y0 = deckY(MOUNT.xa, 0) - .02;
    mount.position.set(X(MOUNT.xa), y0, 0);
    const perfTex = canvasTex(1024, 128, (c, W, H) => {
      c.fillStyle = '#8f989f'; c.fillRect(0, 0, W, H); c.fillStyle = '#2a2f34';
      for (let row = 0; row < 3; row++) for (let i = 0; i < 48; i++) { c.beginPath(); c.arc((i + (row % 2) * .5) / 48 * W, (row + 1) / 4 * H, 9, 0, Math.PI * 2); c.fill(); }
    });
    // fixed ring on the deck + the turning drum
    add(root, 'twinTubes', mesh(tf(new THREE.CylinderGeometry(1.0, 1.04, .12, 40), [X(MOUNT.xa), y0 + .06, 0]), MAT.grey));
    mount.add(mesh(tf(new THREE.CylinderGeometry(.92, .92, .5, 40, 1, true), [0, .37, 0]), new THREE.MeshStandardMaterial({ map: perfTex, roughness: .5, metalness: .4, side: THREE.DoubleSide })));
    mount.add(mesh(tf(new THREE.CylinderGeometry(.96, .96, .05, 40), [0, .64, 0]), MAT.grey));
    // cradle
    for (const dx of [-.55, .55]) mount.add(mesh(tf(new THREE.BoxGeometry(.14, .38, 1.1), [dx, .84, 0]), MAT.grey));
    for (const tb of TUBES) {
      // each tube is built muzzle-forward in its own group, which is turned round for the aft-facing one
      const tg = new THREE.Group(); tg.position.z = tb.z; tg.rotation.y = tb.dir > 0 ? 0 : Math.PI; mount.add(tg);
      const z = 0, x0 = TUBE.x0, x1 = TUBE.x1;
      tg.add(mesh(cylGeo(new V3(x0, TUBE.y, z), new V3(x1, TUBE.y, z), TUBE.r, 28), MAT.greyLight));
      const rings = []; for (const x of [x0 + .1, -.6, .6, x1 - .1]) rings.push(tf(new THREE.TorusGeometry(TUBE.r + .015, .03, 8, 28), [x, TUBE.y, z], [0, Math.PI / 2, 0]));
      tg.add(mesh(mergeGeos(rings), MAT.grey));
      // breech door with its locking wheel
      tg.add(mesh(tf(new THREE.CylinderGeometry(TUBE.r + .03, TUBE.r + .03, .08, 28), [x0 - .04, TUBE.y, z], [0, 0, Math.PI / 2]), MAT.grey));
      tg.add(mesh(tf(new THREE.TorusGeometry(.12, .015, 6, 20), [x0 - .12, TUBE.y, z], [0, Math.PI / 2, 0]), MAT.iron));
      // muzzle "spoon" (tube à cuiller): the upper half of the tube runs on for about 2 m as a shell whose
      // lower edges rise towards the tip, like a leaf; it guides the torpedo as it leaves (Bouclier drawing, CAD)
      const SL = 2.0, sr = TUBE.r + .02, nu = 24, nv = 16, pos = [], idx = [], edgeL = [], edgeR = [];
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, th = deg(95) - deg(75) * u * u, x = x1 + u * SL;
        for (let j = 0; j <= nv; j++) { const ph = -th + 2 * th * j / nv; pos.push(x, TUBE.y + sr * Math.cos(ph), z + sr * Math.sin(ph)); }
        edgeL.push(new V3(x, TUBE.y + sr * Math.cos(th), z - sr * Math.sin(th))); edgeR.push(new V3(x, TUBE.y + sr * Math.cos(th), z + sr * Math.sin(th)));
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const p0 = i * (nv + 1) + j; idx.push(p0, p0 + nv + 1, p0 + 1, p0 + 1, p0 + nv + 1, p0 + nv + 2); }
      const sp = new THREE.BufferGeometry(); sp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sp.setIndex(idx); sp.computeVertexNormals();
      const spm = MAT.greyLight.clone(); spm.side = THREE.DoubleSide; tg.add(mesh(sp, spm));
      tg.add(tube(edgeL.concat(edgeR.reverse()), .012, MAT.grey, 80));   // stiffening bead round the edge
    }
    // training hand-wheel
    mount.add(mesh(tf(new THREE.TorusGeometry(.16, .02, 6, 20), [-.2, .85, -.8], [0, 0, 0]), MAT.iron));
    add(root, 'twinTubes', mount);
  }
  // Bow tube: fixed in the stem, inside the forecastle; its cap shows on the bow.
  {
    const g = new THREE.Group(), y = 1.42;
    g.add(mesh(cylGeo(new V3(X(32.6), y, 0), new V3(X(37.85), y, 0), .27, 24), MAT.greyLight));
    g.add(mesh(cylGeo(new V3(X(37.85), y, 0), new V3(X(38.3), y, 0), .3, 28), MAT.grey));     // muzzle and cap
    g.add(mesh(tf(new THREE.CylinderGeometry(.31, .31, .05, 28), [X(38.32), y, 0], [0, 0, Math.PI / 2]), MAT.greyLight));
    g.add(mesh(tf(new THREE.CylinderGeometry(.3, .3, .1, 28), [X(32.55), y, 0], [0, 0, Math.PI / 2]), MAT.iron));   // breech
    g.add(mesh(tf(new THREE.TorusGeometry(.13, .016, 6, 20), [X(32.46), y, 0], [0, Math.PI / 2, 0]), MAT.brass));
    add(root, 'bowTube', g);
  }
  // Bow spar: a short pole over the bow tube, ending in a ball of chain (a fender for the bow).
  {
    const g = new THREE.Group(), a = new V3(X(36.7), TOP(36.7) + .1, 0), b = new V3(X(40.1), TOP(38) - .02, 0);
    g.add(mesh(cylGeo(a, b, .065, 14, .05), MAT.grey));
    for (const xa of [36.85, 37.6]) g.add(mesh(cylGeo(new V3(X(xa), deckY(xa, 0) - .03, 0), a.clone().lerp(b, (xa - 36.7) / 3.4), .045, 10), MAT.grey));   // crutches
    const links = [], c = b.clone().add(new V3(.12, -.04, 0));
    for (let i = 0; i < 46; i++) {
      const d = new V3(rnd() - .5, rnd() - .5, rnd() - .5).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), rnd() * Math.PI));
      const lg = new THREE.TorusGeometry(.045, .014, 5, 10); lg.scale(1.5, 1, 1); lg.applyMatrix4(M4.compose(c.clone().addScaledVector(d, .14 + rnd() * .04), q, new V3(1, 1, 1))); links.push(lg);
    }
    links.push(tf(new THREE.SphereGeometry(.14, 14, 10), c.toArray()));
    g.add(mesh(mergeGeos(links), MAT.iron));
    add(root, 'bowSpar', g);
  }
  // Spare torpedoes on deck, ready to load.
  const spareTorps = [];
  {
    const g = new THREE.Group();
    const place = (xa0, xa1, w) => {
      const y0 = deckY(xa0, w) + .3, y1 = deckY(xa1, w) + .3, tp = torpedoGroup();
      tp.position.set(X((xa0 + xa1) / 2), (y0 + y1) / 2, w); tp.rotation.z = Math.atan2(y1 - y0, xa1 - xa0);
      for (const xa of [xa0 + 1.1, xa1 - 1.1]) g.add(mesh(tf(new THREE.BoxGeometry(.12, .2, .5), [X(xa), deckY(xa, w) + .06, w]), MAT.wood));   // chocks
      g.add(tp); spareTorps.push(tp);
    };
    place(5.6, 10.6, 1.12);
    place(22.3, 27.3, -1.38);
    add(root, 'torpedo', g);
  }
  // Torpedo davit: a small crane that swings a torpedo up into the tube.
  {
    const e = edge(6.4), base = new V3(X(6.4), e.h - .05, e.w - .18), g = new THREE.Group();
    const pts = [[0, 0, 0], [0, 1.3, 0], [0, 2.05, -.2], [0, 2.35, -.65], [0, 2.3, -1.05]].map(([x, y, z]) => base.clone().add(new V3(x, y, z)));
    g.add(tube(new THREE.CatmullRomCurve3(pts), .06, MAT.grey, 30));
    g.add(mesh(tf(new THREE.CylinderGeometry(.1, .14, .12, 16), base.toArray()), MAT.grey));
    const tip = pts[4];
    g.add(mesh(cylGeo(tip, tip.clone().add(new V3(0, -.55, 0)), .008, 6), MAT.dark));
    g.add(mesh(tf(new THREE.TorusGeometry(.05, .012, 6, 12, Math.PI * 1.4), [tip.x, tip.y - .6, tip.z], [0, 0, Math.PI * .8]), MAT.iron));
    add(root, 'torpedoDavit', g);
  }
  // 47 mm Hotchkiss quick-firing gun on a pedestal (a gunner aims it with a shoulder piece).
  function gun47() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.LatheGeometry([[0, 0], [.32, 0], [.32, .05], [.2, .1], [.15, .78], [.18, .82], [0, .82]].map(([a, b]) => new THREE.Vector2(a, b)), 28), MAT.grey));
    const top = new THREE.Group(); top.position.y = .9; g.add(top);
    top.add(mesh(tf(new THREE.BoxGeometry(.24, .14, .34), [0, -.02, 0]), MAT.grey));                 // yoke
    top.add(mesh(cylGeo(new V3(-.3, .1, 0), new V3(.45, .1, 0), .09, 18), MAT.grey));                 // cradle
    top.add(mesh(cylGeo(new V3(.2, .1, 0), new V3(1.95, .1, 0), .042, 16, .032), MAT.iron));          // barrel
    top.add(mesh(tf(new THREE.BoxGeometry(.22, .16, .16), [-.38, .1, 0]), MAT.iron));                  // breech block
    top.add(tube([new V3(-.45, .06, .1), new V3(-.7, -.08, .16), new V3(-.82, -.2, .16)], .03, MAT.dark, 10));   // shoulder piece
    top.add(mesh(tf(new THREE.BoxGeometry(.5, .025, .025), [.0, .22, -.1]), MAT.dark));                // sight bar
    top.add(mesh(tf(new THREE.TorusGeometry(.08, .012, 6, 16), [-.15, -.05, -.22], [0, 0, 0]), MAT.iron));   // elevating wheel
    return g;
  }
  // The boat's one 47 mm gun stands on a small sponson on the starboard side, between the funnels just
  // forward of the cowl (museum ship). The rail and its net bulge out round the sponson, under the gun.
  const SPON = { xa: 22.35, sd: 1, r: .55 };
  { const e = edge(SPON.xa); SPON.y = e.h - .02; SPON.zc = e.w + .02; }
  {
    const g = new THREE.Group(), z = SPON.sd * SPON.zc, xs = X(SPON.xa);
    g.add(mesh(tf(new THREE.CylinderGeometry(SPON.r, SPON.r, .05, 40), [xs, SPON.y - .025, z]), MAT.grey));   // platform
    const rim = []; for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + Math.PI * i / 20; rim.push(new V3(xs + Math.sin(a) * SPON.r, SPON.y + .02, SPON.sd * (SPON.zc + Math.cos(a) * SPON.r))); }
    g.add(tube(rim, .025, MAT.grey, 30));
    for (const dx of [-.3, .3]) { const p = onHull(SPON.xa + dx, SPON.y - .55, SPON.sd).p; g.add(mesh(cylGeo(p, new V3(xs + dx, SPON.y - .05, z + SPON.sd * .35), .03, 8), MAT.grey)); }   // brackets
    const fg = gun47(); fg.position.set(xs, SPON.y, z); fg.rotation.y = -deg(40) * SPON.sd;
    g.add(fg);
    add(root, 'foreGun', g);
  }
  // Aft steering position: a wheel on the stern deck. Its barrel winds two chains that run along the
  // deck, over guide sheaves, to the quadrant on the rudder head: turn the wheel and the rudder turns.
  {
    const g = new THREE.Group(), xs = X(2.45), yd = deckY(2.45, 0) - .02, ya = yd + 1.0, yb = yd + .72;
    const cast = [];
    for (const sd of [1, -1]) for (const dx of [-.26, .26]) cast.push(cylGeo(new V3(xs + dx, yd, sd * .17), new V3(xs, ya - .08, sd * .1), .035, 8));
    cast.push(tf(new THREE.BoxGeometry(.24, .26, .3), [xs, ya, 0]), tf(new THREE.BoxGeometry(.7, .04, .42), [xs, yd + .02, 0]));
    cast.push(cylGeo(new V3(xs, yb, -.2), new V3(xs, yb, .2), .09, 18));                                          // chain barrel
    cast.push(cylGeo(new V3(xs - .1, ya, 0), new V3(xs - .3, ya, 0), .03, 10));                                    // axle
    g.add(mesh(mergeGeos(cast), MAT.grey));
    const w = new THREE.Group(); w.position.set(xs - .3, ya, 0); w.rotation.y = Math.PI / 2;
    const sp = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; sp.push(cylGeo(new V3(0, 0, 0), new V3(Math.cos(a) * .52, Math.sin(a) * .52, 0), .018, 6)); }
    w.add(mesh(new THREE.TorusGeometry(.42, .026, 8, 40), MAT.wood), mesh(mergeGeos(sp), MAT.wood), mesh(tf(new THREE.CylinderGeometry(.07, .07, .1, 16), [0, 0, 0], [Math.PI / 2, 0, 0]), MAT.brass));
    g.add(w);
    // rudder quadrant on the rudder head, pointing forward
    const xq = X(.12), yq = deckY(.3, 0) + .05, R = .5, qa = deg(45), quad = [];
    quad.push(tf(new THREE.CylinderGeometry(.08, .08, .1, 16), [xq, yq, 0]));
    for (const sd of [1, -1]) quad.push(cylGeo(new V3(xq, yq, 0), new V3(xq + R * Math.cos(qa), yq, sd * R * Math.sin(qa)), .025, 8));
    const arc = []; for (let i = 0; i <= 12; i++) { const a = -qa + 2 * qa * i / 12; arc.push(new V3(xq + R * Math.cos(a), yq, R * Math.sin(a))); }
    g.add(mesh(mergeGeos(quad), MAT.iron), tube(arc, .03, MAT.iron, 24));
    // chains and sheaves
    const chain = [], sheaves = [];
    for (const sd of [1, -1]) {
      const p0 = new V3(xs, yb - .09, sd * .16), p1 = new V3(xs - .02, yd + .1, sd * .2), p2 = new V3(X(1.25), deckY(1.25, .42) + .08, sd * .42);
      const p3 = new V3(xq + R * Math.cos(qa) + .02, yq, sd * (R * Math.sin(qa) + .02));
      chain.push(chainLinks([p0, p1, p1.clone().lerp(p2, .5).add(new V3(0, -.03, 0)), p2, p3], .02));
      for (const p of [p1, p2]) sheaves.push(tf(new THREE.CylinderGeometry(.065, .065, .05, 14), [p.x, p.y - .02, p.z]), tf(new THREE.BoxGeometry(.16, .04, .1), [p.x, p.y - .07, p.z]));
    }
    g.add(mesh(mergeGeos(chain), MAT.iron), mesh(mergeGeos(sheaves), MAT.dark));
    // bell-shaped pedestal to port of the wheel (museum ship, CAD): its use is not known
    const bell = new THREE.LatheGeometry([[0, 0], [.2, 0], [.2, .04], [.11, .14], [.1, .24], [.16, .42], [.17, .52], [.12, .72], [.08, .8], [.1, .86], [.2, .9], [.21, .96], [0, .97]].map(([r, h]) => new THREE.Vector2(r, h)), 28);
    g.add(mesh(tf(bell, [X(2.3), deckY(2.3, .6) - .02, -.6]), MAT.grey));
    add(root, 'aftWheel', g);
  }
  // Magazine below the conning tower: racks of 47 mm cartridges.
  {
    const g = new THREE.Group(), y = -.55;
    g.add(mesh(floorPlate(25.65, 28.15, y), MAT.wood));
    const shells = [], racks = [];
    for (const sd of [1, -1]) {
      const w = fitW(25.85, 27.95, y, y + 1.2) - .3;
      racks.push(tf(new THREE.BoxGeometry(2.1, 1.15, .5), [X(26.9), y + .6, sd * w]));
      for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) shells.push(cylGeo(new V3(X(26.05 + i * .155), y + .25 + j * .36, sd * (w - .27)), new V3(X(26.05 + i * .155), y + .25 + j * .36, sd * (w - .02)), .03, 8));
    }
    const rm = MAT.wood.clone(); g.add(mesh(mergeGeos(racks), rm), mesh(mergeGeos(shells), MAT.brass));
    add(root, 'magazine', g);
  }

  /* =====================================================================
     COMMAND AND NAVIGATION
     ===================================================================== */
  // Conning tower: a rounded box whose walls lean in a little, open at the back (door), with a low hood
  // in front over the steering gear and three squared-oval windows with wipers (CAD reconstruction,
  // Draganov 2025; museum ship).
  const CT = { xa0: 26.0, xa1: 27.55, hw: .8, rc: .26, t: .05, y0: 1.42, y1: 3.25, door: .32, lean: [.04, .05] };
  CT.xc = (CT.xa0 + CT.xa1) / 2;
  const ctScale = y => { const f = clamp((y - CT.y0) / (CT.y1 - CT.y0), 0, 1); return [1 - CT.lean[0] * f, 1 - CT.lean[1] * f]; };
  {
    const g = new THREE.Group(), x0 = X(CT.xa0), x1 = X(CT.xa1), xc = X(CT.xc);
    // plan outline (x along, y = −z) from one door post round the front to the other
    const outline = inset => {
      const a = x0 + inset, b = x1 - inset, h = CT.hw - inset, r = CT.rc - inset * .5, pts = [];
      const arc = (cx, cy, t0) => { for (let i = 0; i <= 8; i++) { const t = t0 + i / 8 * Math.PI / 2; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
      pts.push([a, -CT.door]); arc(a + r, -h + r, Math.PI); arc(b - r, -h + r, Math.PI * 1.5); arc(b - r, h - r, 0); arc(a + r, h - r, Math.PI / 2); pts.push([a, CT.door]);
      return pts;
    };
    const wall = new THREE.Shape();
    outline(0).concat(outline(CT.t).reverse()).forEach(([x, y], k) => (k ? wall.lineTo(x, y) : wall.moveTo(x, y))); wall.closePath();
    const wg = extrudeUp(wall, CT.y0, CT.y1 - CT.y0), p = wg.attributes.position;
    for (let k = 0; k < p.count; k++) { const [sx, sz] = ctScale(p.getY(k)); p.setX(k, xc + (p.getX(k) - xc) * sx); p.setZ(k, p.getZ(k) * sz); }
    wg.computeVertexNormals();
    const wm = MAT.grey.clone(); wm.side = THREE.DoubleSide;   // seen from inside through the door too
    g.add(mesh(wg, wm));
    const [tx, tz] = ctScale(CT.y1), L2 = (CT.xa1 - CT.xa0) / 2 * tx + .03, W2 = CT.hw * tz + .03;
    g.add(mesh(extrudeUp(rrShape(xc - L2, -W2, xc + L2, W2, CT.rc), CT.y1, .08, .03), MAT.grey));                    // roof
    g.add(mesh(extrudeUp(rrShape(x0 + .05, -CT.hw + .06, x1 - .05, CT.hw - .06, .2), CT.y0, .05), std('#9b2c22', { roughness: .7 })));   // floor, painted red
    // Hood in front: a block with a vertical face and a rounded top edge over the steering gear, with a
    // small inspection hatch (V-shaped straps) in its face (CAD reconstruction, Draganov 2025).
    {
      const HD = { L: .6, top: 2.62, hw: .45, bv: .05 }, p = new THREE.Shape(), r = .2, e = HD.bv;
      p.moveTo(x1 + e, 1.95); p.lineTo(x1 + HD.L - e, 1.95); p.lineTo(x1 + HD.L - e, HD.top - e - r);
      p.quadraticCurveTo(x1 + HD.L - e, HD.top - e, x1 + HD.L - e - r, HD.top - e); p.lineTo(x1 + e, HD.top - e + .02); p.closePath();
      const hg = new THREE.ExtrudeGeometry(p, { depth: 2 * (HD.hw - e), bevelEnabled: true, bevelThickness: e, bevelSize: e, bevelSegments: 3, curveSegments: 12 });
      hg.translate(0, 0, -(HD.hw - e));
      g.add(mesh(hg, MAT.grey));
      g.add(mesh(extrudeUp(rrShape(x1, -HD.hw - .03, x1 + HD.L + .03, HD.hw + .03, .08), PY - .01, .03), MAT.grey));   // foot flange
      const xh = x1 + HD.L + .002, yh = 2.27, hatch = [], fr = new THREE.Shape();
      roundRect(-.17, -.13, .17, .13, .05, .05, .05, .05, fr); fr.holes.push(roundRect(-.14, -.1, .14, .1, .03, .03, .03, .03, new THREE.Path()));
      const frame = new THREE.ExtrudeGeometry(fr, { depth: .02, bevelEnabled: false }); frame.rotateY(Math.PI / 2); frame.translate(xh, yh, 0); hatch.push(frame);
      hatch.push(tf(new THREE.BoxGeometry(.012, .2, .28), [xh + .006, yh, 0]));
      for (const sd of [1, -1]) {
        hatch.push(cylGeo(new V3(xh + .02, yh + .08, sd * .11), new V3(xh + .02, yh - .08, sd * .015), .012, 6));   // V straps
        hatch.push(tf(new THREE.BoxGeometry(.03, .04, .05), [xh + .02, yh + .09, sd * .11]));                        // hinges
      }
      g.add(mesh(mergeGeos(hatch), MAT.greyLight));
    }
    // Fan-shaped windows in brass frames (wide, arched top; narrow bottom): three in the front, one in each
    // side wall near the front. A wiper outside and a hinged armour flap inside, swung up (museum ship).
    const fan = (a, b, s = new THREE.Shape()) => {
      s.moveTo(-a, .55 * b); s.quadraticCurveTo(0, 1.3 * b, a, .55 * b); s.lineTo(.62 * a, -.8 * b); s.lineTo(.42 * a, -b); s.lineTo(-.42 * a, -b); s.lineTo(-.62 * a, -.8 * b); s.closePath();
      return s;
    };
    const yw = 2.9, [wx, wz] = ctScale(yw), rims = [], glass = [], glassIn = [], wipers = [], a = .17, b = .11, UPV = new V3(0, 1, 0);
    const ringGeo = () => { const s = fan(a + .035, b + .035); s.holes.push(fan(a, b)); return new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: false }); };
    const flapGeo = new THREE.ExtrudeGeometry(fan(a + .03, b + .03), { depth: .015, bevelEnabled: false }); flapGeo.translate(0, -1.01 * (b + .03), 0);
    // p: centre on the outer wall surface, n: outward normal (horizontal), tilt: which way the wiper hangs
    const win = (p, n, tilt) => {
      const t = UPV.clone().cross(n), basis = new THREE.Matrix4().makeBasis(t, UPV, n);
      const put = (geo, d) => geo.applyMatrix4(basis.clone().setPosition(p.clone().addScaledVector(n, d)));
      rims.push(put(ringGeo(), 0), put(ringGeo(), -CT.t - .03));
      glass.push(put(new THREE.ShapeGeometry(fan(a, b)), .008)); glassIn.push(put(new THREE.ShapeGeometry(fan(a, b)), -CT.t - .004));
      const piv = p.clone().addScaledVector(n, .03).addScaledVector(UPV, b - .005);
      wipers.push(cylGeo(piv, piv.clone().addScaledVector(UPV, -.147).addScaledVector(t, tilt * .085), .008, 6));
      wipers.push(cylGeo(piv.clone().addScaledVector(n, -.01), piv.clone().addScaledVector(n, .01), .016, 10));
      const flap = new THREE.Group(); flap.position.copy(p).addScaledVector(n, -CT.t - .03).addScaledVector(UPV, b + .03); flap.quaternion.setFromRotationMatrix(basis);
      const fm = mesh(flapGeo, MAT.grey); fm.rotation.x = deg(110); flap.add(fm); g.add(flap);
    };
    const xf = xc + (x1 - xc) * wx, xs = xc + (X(27.05) - xc) * wx;
    for (const zz of [-.37, 0, .37]) win(new V3(xf, yw, zz * wz), new V3(1, 0, 0), zz > 0 ? -1 : 1);
    for (const sd of [1, -1]) win(new V3(xs, yw, sd * CT.hw * wz), new V3(0, 0, sd), 1);
    const gi = MAT.glass.clone(); gi.side = THREE.BackSide;
    g.add(mesh(mergeGeos(rims), MAT.brass), mesh(mergeGeos(glass), MAT.glass), mesh(mergeGeos(glassIn), gi), mesh(mergeGeos(wipers), MAT.black));
    add(root, 'conningTower', g);
  }
  // Main steering wheel on the front wall of the conning tower; its shaft goes through the wall to the
  // steering gear under the hood.
  {
    const g = new THREE.Group(), y = 2.35, xw = X(CT.xc) + (CT.xa1 - CT.xc) * ctScale(y)[0] - CT.t;
    g.add(mesh(cylGeo(new V3(xw + .01, y, 0), new V3(xw - .24, y, 0), .035, 12), MAT.steel));
    g.add(mesh(tf(new THREE.CylinderGeometry(.1, .12, .06, 18), [xw - .02, y, 0], [0, 0, Math.PI / 2]), MAT.iron));   // bearing on the wall
    const w = new THREE.Group(); w.position.set(xw - .24, y, 0); w.rotation.y = Math.PI / 2;
    w.add(mesh(new THREE.TorusGeometry(.4, .024, 8, 40), MAT.iron));
    w.add(mesh(tf(new THREE.CylinderGeometry(.07, .07, .1, 16), [0, 0, 0], [Math.PI / 2, 0, 0]), MAT.brass));
    const sp = [], grips = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; sp.push(cylGeo(new V3(0, 0, 0), new V3(Math.cos(a) * .42, Math.sin(a) * .42, 0), .016, 6)); grips.push(cylGeo(new V3(Math.cos(a) * .42, Math.sin(a) * .42, 0), new V3(Math.cos(a) * .54, Math.sin(a) * .54, 0), .022, 8)); }
    w.add(mesh(mergeGeos(sp), MAT.iron), mesh(mergeGeos(grips), MAT.dark));
    g.add(w);
    add(root, 'wheel', g);
  }
  // Compass in its binnacle on the conning-tower floor, aft of the wheel, under the helmsman's eyes;
  // the two iron balls and the brass bars correct for the ship's own steel.
  {
    const g = new THREE.Group(), x = X(26.62), y = CT.y0 + .05, top = .82;
    g.add(mesh(new THREE.LatheGeometry([[0, 0], [.2, 0], [.2, .05], [.12, .12], [.1, .6], [.15, .66], [.15, top - .1], [0, top - .1]].map(([a, b]) => new THREE.Vector2(a, b)), 24), MAT.dark));
    g.add(mesh(new THREE.LatheGeometry([[0, top - .1], [.18, top - .1], [.2, top], [.18, top + .14], [.1, top + .2], [0, top + .2]].map(([a, b]) => new THREE.Vector2(a, b)), 24), MAT.brass));   // bowl and hood
    g.add(mesh(tf(new THREE.CircleGeometry(.1, 24), [-.1, top + .1, 0], [0, -Math.PI / 2 - deg(20), 0]), MAT.white));   // card, seen through the hood window
    for (const sd of [1, -1]) {
      g.add(mesh(tf(new THREE.SphereGeometry(.085, 16, 10), [0, top - .02, sd * .32]), MAT.black));
      g.add(mesh(cylGeo(new V3(0, top - .06, sd * .15), new V3(0, top - .06, sd * .26), .022, 6), MAT.dark));
      g.add(mesh(tf(new THREE.CylinderGeometry(.04, .04, .16, 14), [0, top + .15, sd * .17]), MAT.brass));   // Flinders bars
    }
    g.position.set(x, y, 0);
    add(root, 'compass', g);
  }
  // Engine telegraph: the officer moves the handle, a bell rings in the engine room, the engineers follow the order.
  const telegraphTex = canvasTex(256, 256, () => {});
  const telHandle = new THREE.Group();
  function drawTelegraph() {
    const c = telegraphTex.image.getContext('2d'), W = 256, o = M.telegraph || {};
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#f2ead7'; c.fillRect(0, 0, W, W);
    c.translate(W / 2, W / 2);
    const words = [o.full, o.half, o.slow, o.stop, o.astern].map(s => String(s || '').toUpperCase());
    const angs = [-1.25, -.78, -.35, 0, .9];
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, W * .46, 0, Math.PI * 2); c.stroke();
    c.font = `700 22px ${displayFont()}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    angs.forEach((a, i) => {
      c.save(); c.rotate(a); c.fillStyle = i === 3 ? '#b8281d' : '#1d1d1d'; c.fillText(words[i], 0, -W * .33); c.restore();
      c.save(); c.rotate(a + (i < 4 ? .2 : 0)); c.beginPath(); c.moveTo(0, -W * .46); c.lineTo(0, -W * .42); c.stroke(); c.restore();
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
    telegraphTex.needsUpdate = true;
  }
  drawTelegraph();
  {
    const g = new THREE.Group(), x = X(25.45), w = .58, y0 = deckY(25.45, w) - .02;
    g.position.set(x, y0, w);
    g.add(mesh(new THREE.LatheGeometry([[0, 0], [.14, 0], [.09, .06], [.06, .9], [.09, 1.0], [0, 1.0]].map(([a, b]) => new THREE.Vector2(a, b)), 20), MAT.brass));
    const head = mesh(tf(new THREE.CylinderGeometry(.24, .24, .16, 32), [0, 1.2, 0], [Math.PI / 2, 0, 0]), MAT.brass);
    g.add(head);
    for (const sd of [1, -1]) {
      const face = mesh(new THREE.CircleGeometry(.21, 32), new THREE.MeshStandardMaterial({ map: telegraphTex, roughness: .4 }));
      face.position.set(0, 1.2, sd * .082); if (sd < 0) face.rotation.y = Math.PI; g.add(face);
    }
    telHandle.position.set(0, 1.2, 0);
    telHandle.add(mesh(cylGeo(new V3(0, 0, 0), new V3(0, .32, 0), .022, 8), MAT.brass), mesh(tf(new THREE.SphereGeometry(.045, 12, 8), [0, .34, 0]), MAT.wood));
    for (const sd of [1, -1]) { const ptr = mesh(tf(new THREE.ConeGeometry(.02, .17, 3), [0, .1, sd * .09]), MAT.black); telHandle.add(ptr); }
    g.add(telHandle);
    add(root, 'telegraph', g);
  }
  // Mast with its signal yard, masthead light and rigging.
  const MAST = { xa: 25.45, rake: deg(2.5), h: 9.9 };
  const mastTop = new V3(), mastAt = hgt => new V3(X(MAST.xa) - Math.sin(MAST.rake) * hgt, 1.5 + Math.cos(MAST.rake) * hgt, 0);
  {
    const g = new THREE.Group(), base = mastAt(0); mastTop.copy(mastAt(MAST.h));
    g.add(mesh(cylGeo(base, mastTop, .095, 16, .05), MAT.greyLight));
    g.add(mesh(tf(new THREE.CylinderGeometry(.09, .09, .06, 16), mastTop.toArray()), MAT.greyLight));   // truck
    const yard = mastAt(7.1);
    g.add(mesh(cylGeo(yard.clone().add(new V3(0, 0, -1.6)), yard.clone().add(new V3(0, 0, 1.6)), .035, 10, .035), MAT.greyLight));
    const lines = [];
    const ln = (a, b) => lines.push(cylGeo(a, b, .011, 5));
    const shroudTop = mastAt(6.8);
    for (const sd of [1, -1]) for (const xa of [24.7, 25.4]) { const e = edge(xa); ln(shroudTop, new V3(X(xa), e.h + .02, sd * (e.w - .06))); }
    ln(mastAt(8.6), new V3(X(37.95), TOP(37.95) + .05, 0));        // forestay to the stem
    for (const sd of [1, -1]) ln(yard.clone().add(new V3(0, 0, sd * 1.55)), new V3(X(24.3), deckY(24.3, sd * 1.5) + .05, sd * 1.5));   // signal halyards
    g.add(mesh(mergeGeos(lines), MAT.dark));
    add(root, 'mast', g);
  }
  // Navigation lights: red on the left (port) side, green on the right (starboard), white on the mast.
  {
    const g = new THREE.Group();
    for (const sd of [1, -1]) {
      const z = sd * (CT.hw + .08), x = X(26.5), y = 2.95;
      g.add(mesh(tf(new THREE.BoxGeometry(.18, .24, .16), [x, y, z]), MAT.dark));
      g.add(mesh(tf(new THREE.CylinderGeometry(.065, .065, .16, 14), [x + .06, y, z]), sd > 0 ? MAT.lampGreen : MAT.lampRed));
    }
    const ml = mastAt(5.8).add(new V3(.13, 0, 0));
    g.add(mesh(tf(new THREE.BoxGeometry(.18, .26, .18), ml.toArray()), MAT.dark));
    g.add(mesh(tf(new THREE.CylinderGeometry(.07, .07, .18, 14), [ml.x + .05, ml.y, 0]), MAT.lampWhite));
    add(root, 'navLights', g);
  }
  // Naval ensign 1878–1944: the national tricolour with the crowned golden lion on a red canton.
  // Picture: ensign.png, rasterised from the public-domain "Naval ensign of Bulgaria (1878–1944).svg"
  // (Wikimedia Commons); proportions 939 × 566.
  const flagGeo = new THREE.PlaneGeometry(1.45, .874, 16, 8), flagBase = flagGeo.attributes.position.array.slice();
  {
    const tex = new THREE.TextureLoader().load(new URL('./ensign.png', import.meta.url).href); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    tex.repeat.x = -1; tex.offset.x = 1;   // the picture has the canton on the left; on the ship the hoist (staff) is at +x
    const g = new THREE.Group(), xs = X(.32), y0 = deckY(.32, 0) - .02;
    g.add(mesh(cylGeo(new V3(xs, y0, 0), new V3(xs, y0 + 3.0, 0), .035, 10, .025), MAT.wood));
    g.add(mesh(tf(new THREE.SphereGeometry(.05, 12, 8), [xs, y0 + 3.03, 0]), MAT.brass));
    const flag = mesh(flagGeo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .85 }));
    flag.position.set(xs - .745, y0 + 2.52, 0); g.add(flag);
    add(root, 'ensign', g);
  }

  /* =====================================================================
     DECK EQUIPMENT
     ===================================================================== */
  // Admiralty-pattern anchors stowed on the forecastle, chains led to the windlass.
  {
    const g = new THREE.Group();
    const anchor = () => {
      const a = new THREE.Group(), parts = [];
      parts.push(cylGeo(new V3(-.75, 0, 0), new V3(.6, 0, 0), .05, 10));                                      // shank
      parts.push(tf(new THREE.TorusGeometry(.42, .045, 8, 18, Math.PI), [-.33, 0, 0], [Math.PI / 2, 0, Math.PI / 2]));   // arms (crown)
      for (const sd of [1, -1]) parts.push(tf(new THREE.ConeGeometry(.17, .32, 4), [-.24, 0, sd * .44], [0, 0, -Math.PI / 2], [1, 1, .35]));   // flukes
      parts.push(cylGeo(new V3(.48, .05, -.06), new V3(-.55, .05, -.06), .035, 8));                           // stock, folded along the shank
      for (const x of [.48, -.55]) parts.push(tf(new THREE.SphereGeometry(.05, 10, 6), [x, .05, -.06]));
      parts.push(tf(new THREE.TorusGeometry(.09, .022, 6, 14), [.7, 0, 0], [Math.PI / 2, 0, 0]));            // ring
      a.add(mesh(mergeGeos(parts), MAT.black)); return a;
    };
    const chain = [];
    for (const sd of [1, -1]) {
      const xa = 32.85, w = .82, y = deckY(xa, w), slope = (deckY(xa, w + .05) - deckY(xa, w - .05)) / .1;
      const an = anchor(); an.position.set(X(xa), y + .07, sd * w); an.rotation.x = -sd * Math.atan(slope); g.add(an);
      const p0 = new V3(X(xa + .72), y + .08, sd * w), p1 = new V3(X(34.2), deckY(34.2, .5) + .05, sd * .5), p2 = new V3(X(34.62), deckY(34.62, .3) + .32, sd * .3), p3 = new V3(X(35.0), deckY(35.0, .3) + .1, sd * .3), p4 = new V3(X(35.15), deckY(35.15, .3) - .1, sd * .3);
      chain.push(chainLinks([p0, p1, p2, p3, p4]));
    }
    g.add(mesh(mergeGeos(chain), MAT.iron));
    add(root, 'anchors', g);
  }
  // Anchor davit (the curved crane at the bow lifts the anchor to its stowage) and the jackstaff on the stem.
  {
    const g = new THREE.Group(), xa = 35.9, e = edge(xa), base = new V3(X(xa), deckY(xa, e.w - .12), e.w - .12);
    const pts = [[0, 0, 0], [0, 1.4, 0], [.15, 2.05, -.05], [.55, 2.3, .1], [.85, 2.15, .3]].map(([x, y, z]) => base.clone().add(new V3(x, y, z)));
    g.add(tube(new THREE.CatmullRomCurve3(pts), .055, MAT.grey, 30));
    g.add(mesh(tf(new THREE.CylinderGeometry(.09, .13, .12, 14), base.toArray()), MAT.grey));
    const tip = pts[4];
    g.add(mesh(cylGeo(tip, tip.clone().add(new V3(0, -.5, 0)), .008, 6), MAT.dark));
    g.add(mesh(tf(new THREE.TorusGeometry(.05, .012, 6, 12, Math.PI * 1.4), [tip.x, tip.y - .55, tip.z], [0, 0, Math.PI * .8]), MAT.iron));
    const js = new V3(X(37.2), deckY(37.2, .16) - .02, .16);   // jackstaff beside the bow spar
    g.add(mesh(cylGeo(js, js.clone().add(new V3(0, 1.35, 0)), .03, 8, .02), MAT.wood));
    g.add(mesh(tf(new THREE.SphereGeometry(.04, 10, 6), [js.x, js.y + 1.37, js.z]), MAT.brass));
    add(root, 'anchors', g);
  }
  // Windlass: turn the handles (or a small steam engine) and the gypsy wheels haul in the chain.
  {
    const g = new THREE.Group(), xa = 34.68, y = deckY(xa, 0) - .02;
    g.position.set(X(xa), y, 0);
    for (const sd of [1, -1]) g.add(mesh(tf(new THREE.BoxGeometry(.5, .5, .06), [0, .25, sd * .5]), MAT.grey));
    g.add(mesh(cylGeo(new V3(0, .32, -.56), new V3(0, .32, .56), .07, 14), MAT.steel));
    for (const sd of [1, -1]) {
      g.add(mesh(tf(new THREE.CylinderGeometry(.19, .19, .1, 9), [0, .32, sd * .3], [Math.PI / 2, 0, 0]), MAT.iron));
      g.add(mesh(tf(new THREE.CylinderGeometry(.14, .14, .16, 18), [0, .32, sd * .13], [Math.PI / 2, 0, 0]), MAT.iron));
      g.add(mesh(cylGeo(new V3(0, .32, sd * .58), new V3(.05, .62, sd * .62), .025, 8), MAT.steel));
    }
    g.add(mesh(tf(new THREE.BoxGeometry(.7, .06, 1.1), [0, .02, 0]), MAT.grey));
    add(root, 'windlass', g);
  }
  // Bollards (bitts): the mooring ropes are made fast around them in figures of eight.
  {
    const gs = [];
    for (const [xa, w] of [[1.7, .74], [9.55, 1.62], [16.0, 1.62], [35.75, .5]]) for (const sd of [1, -1]) {
      const y = deckY(xa, w) - .02, z = sd * w;
      gs.push(tf(new THREE.BoxGeometry(.62, .05, .26), [X(xa), y + .02, z]));
      for (const dx of [-.17, .17]) { gs.push(tf(new THREE.CylinderGeometry(.08, .085, .32, 16), [X(xa) + dx, y + .18, z])); gs.push(tf(new THREE.CylinderGeometry(.105, .105, .04, 16), [X(xa) + dx, y + .35, z])); }
    }
    add(root, 'bollards', mesh(mergeGeos(gs), MAT.dark));
  }
  // Guard rails: iron stanchions bolted to the hull side just below the deck edge carry two thick ropes.
  // Along the middle of the ship a fishing-type net hangs from the top rope to the hull.
  // Stanchion z at xa: just outboard of the hull below the deck edge.
  const railZ = xa => { const e = edge(xa); return { yb: e.h - .16, w: hb(xa, e.h - .16) + .035, e }; };
  {
    const g = new THREE.Group(), stan = [], feet = [];
    const ropeTex = canvasTex(64, 16, (c, W, H) => {
      c.fillStyle = '#c2b089'; c.fillRect(0, 0, W, H); c.strokeStyle = '#86734e'; c.lineWidth = 4;
      for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * W / 4, 0); c.lineTo(i * W / 4 + W / 2, H); c.stroke(); }
    });
    ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
    const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: .95 });
    const netTex = canvasTex(256, 256, (c, W) => {
      c.clearRect(0, 0, W, W); c.strokeStyle = '#d2c9b0'; c.lineWidth = 2.5;
      const s = W / 8;
      for (let i = -8; i <= 16; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s + W, W); c.stroke(); c.beginPath(); c.moveTo(i * s, W); c.lineTo(i * s + W, 0); c.stroke(); }
    });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.anisotropy = 8;
    const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
    const sag = (pts, d) => { const out = []; pts.forEach((p, i) => { if (i) out.push(p.clone().lerp(pts[i - 1], .5).add(new V3(0, -d, 0))); out.push(p); }); return out; };
    for (const sd of [1, -1]) {
      const tops = [], mids = [], net = { pos: [], uv: [], idx: [] }; let wingDone = false;
      const xs = []; for (let xa = .7; xa < 37.3; xa += 1.25) xs.push(xa);
      for (const xa of xs) {
        const { yb, w, e } = railZ(xa);
        if (e.w < .25) continue;
        if (xa > WING.xa0 && xa < WING.xa1 + .35) {   // posts along the outer edge of the bridge wing
          if (wingDone) continue; wingDone = true;
          for (const x of [26.05, 26.95, 27.85, 28.75, 29.55]) {
            const z = sd * (wingOut(x) - .03), tp = new V3(X(x), PY + .92, z);
            stan.push(cylGeo(new V3(X(x), PY - .03, z), tp, .022, 8)); tops.push(tp.clone().add(new V3(0, -.04, 0))); mids.push(new V3(X(x), PY + .47, z));
          }
          continue;
        }
        if (sd === SPON.sd && Math.abs(xa - SPON.xa) < SPON.r + .2) {   // round the gun sponson
          for (const f of [-70, -25, 25, 70]) {
            const a = deg(f), R = SPON.r - .04, x = SPON.xa + Math.sin(a) * R, z = sd * (SPON.zc + Math.cos(a) * R);
            const tp = new V3(X(x), SPON.y + .92, z);
            stan.push(cylGeo(new V3(X(x), SPON.y, z), tp, .022, 8)); tops.push(tp.clone().add(new V3(0, -.04, 0))); mids.push(new V3(X(x), SPON.y + .47, z));
            const k = net.pos.length / 3; net.pos.push(X(x), SPON.y + .01, z, X(x), tp.y - .05, z); net.uv.push(x / .8, 0, x / .8, (tp.y - .06 - SPON.y) / .8);
            if (k) net.idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
          }
          continue;
        }
        const b = new V3(X(xa), yb, sd * w), tp = new V3(X(xa), e.h + .92, sd * w);
        stan.push(cylGeo(b, tp, .022, 8));
        feet.push(tf(new THREE.BoxGeometry(.09, .16, .04), [X(xa), yb + .06, sd * (w - .03)]), tf(new THREE.BoxGeometry(.09, .05, .05), [X(xa), e.h - .02, sd * (w - .02)]));
        tops.push(tp.clone().add(new V3(0, -.04, 0))); mids.push(new V3(X(xa), e.h + .47, sd * w));
        if (xa > 8.4 && xa < 25.6) {
          const k = net.pos.length / 3, y0 = e.h - .03, h = tp.y - .05 - y0;
          net.pos.push(X(xa), y0, sd * (e.w + .01), X(xa), tp.y - .05, sd * w); net.uv.push(xa / .8, 0, xa / .8, h / .8);
          if (k) net.idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
      }
      g.add(tube(sag(tops, .045), .021, ropeMat, tops.length * 8), tube(sag(mids, .04), .019, ropeMat, mids.length * 8));
      const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(net.pos, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(net.uv, 2)); ng.setIndex(net.idx); ng.computeVertexNormals();
      const nm = mesh(ng, netMat); nm.renderOrder = 3; g.add(nm);
    }
    g.add(mesh(mergeGeos(stan), MAT.steel), mesh(mergeGeos(feet), MAT.grey));
    add(root, 'rails', g, { shadow: false });
  }
  // Hatches: the way down to the crew's quarters, the officers' cabin and the engine room.
  {
    const gs = [], lids = [];
    const hatch = (xa, lx, lz, h = .3) => {
      const y = deckY(xa, 0) - .05;
      gs.push(extrudeUp(rrShape(X(xa) - lx / 2, -lz / 2, X(xa) + lx / 2, lz / 2, .06), y, h));
      lids.push(extrudeUp(rrShape(X(xa) - lx / 2 - .04, -lz / 2 - .04, X(xa) + lx / 2 + .04, lz / 2 + .04, .08), y + h, .05));
    };
    hatch(30.4, .8, .7, .3); hatch(9.2, .6, .6, .3);
    // officers' companion just aft of the twin tube: a wedge in side view (CAD reconstruction) – vertical
    // forward face, short rounded top, and a steep sloping aft face that carries two doors opening aft
    const y = deckY(7.15, .46) - .04, hw = .46, H = 1.05, xb = 6.85, xt = 7.3, xf = 7.6, bv = .025, prof = new THREE.Shape();
    prof.moveTo(X(xb), 0); prof.lineTo(X(xf), 0); prof.lineTo(X(xf), H - .12); prof.quadraticCurveTo(X(xf), H, X(xf) - .12, H);
    prof.lineTo(X(xt) + .06, H); prof.quadraticCurveTo(X(xt), H, X(xt) - .03, H - .07); prof.closePath();
    const cg = new THREE.ExtrudeGeometry(prof, { depth: 2 * (hw - bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 10 });
    cg.translate(0, y, -(hw - bv)); gs.push(cg);
    // the sloping face: from P0 at the deck to P1 under the top
    const P0 = new V3(X(xb), y, 0), P1 = new V3(X(xt) - .03, y + H - .07, 0), d = P1.clone().sub(P0), SL = d.length(); d.normalize();
    const n = new V3(-d.y, d.x, 0), phi = Math.atan2(d.y, d.x) - Math.PI / 2, doors = [], fit = [];
    const on = (t, out) => P0.clone().addScaledVector(d, t).addScaledVector(n, out + bv);
    for (const sd of [1, -1]) {
      const c = on(SL * .5, .012), c2 = on(SL * .5, .026);
      doors.push(tf(new THREE.BoxGeometry(.025, SL * .8, .37), [c.x, c.y, sd * .2], [0, 0, phi]));
      doors.push(tf(new THREE.BoxGeometry(.012, SL * .62, .25), [c2.x, c2.y, sd * .2], [0, 0, phi]));        // raised panel
      const hd = on(SL * .52, .045); fit.push(tf(new THREE.SphereGeometry(.025, 10, 8), [hd.x, hd.y, sd * .06]));   // handle
      for (const t of [.2, .8]) { const h0 = on(SL * t - .06, .03), h1 = on(SL * t + .06, .03); fit.push(cylGeo(h0.setZ(sd * .395), h1.setZ(sd * .395), .018, 8)); }   // hinges
    }
    const sill = on(.05, .02); fit.push(tf(new THREE.BoxGeometry(.06, .08, .84), [sill.x, sill.y, 0], [0, 0, phi]));
    add(root, 'hatches', group(mesh(mergeGeos(gs), MAT.grey), mesh(mergeGeos(lids), MAT.greyLight), mesh(mergeGeos(doors), MAT.greyLight), mesh(mergeGeos(fit), MAT.brass)));
  }
  // Ship's boat (a small dinghy) under a canvas cover, on chocks at the stern.
  {
    const g = new THREE.Group(), L = 3.3, xa0 = 3.0, w0 = -1.02, y0 = deckY(4.6, w0) + .52;
    const hbD = s => .62 * Math.pow(Math.max(1 - Math.pow((s - .42) / (s < .42 ? .62 : .58), 2), 0), .55) + (s < .1 ? .08 * (1 - s / .1) : 0);
    const dep = s => .42 + .06 * (1 - s);
    const hull = (u, v) => { const s = u, a = Math.PI * v; return [X(xa0) + s * L, y0 - Math.sin(a) * dep(s), w0 + Math.cos(a) * hbD(s)]; };
    const cover = (u, v) => { const s = u, a = Math.PI * v; return [X(xa0) + s * L, y0 + Math.sin(a) * .16 * Math.min(1, hbD(s) * 3), w0 + Math.cos(a) * hbD(s) * 1.02]; };
    const grid = (fn, nu, nv, flip) => {
      const pos = [], idx = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; flip ? idx.push(a, d, b, a, c, d) : idx.push(a, b, d, a, d, c); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    };
    const hm = MAT.white.clone(); hm.side = THREE.DoubleSide;
    g.add(mesh(grid(hull, 30, 12, false), hm));
    const cm = MAT.canvas.clone(); cm.side = THREE.DoubleSide;
    g.add(mesh(grid(cover, 30, 10, true), cm));
    g.add(tube([0, .25, .5, .75, 1].map(f => new V3(X(xa0) + f * L, y0 + .01, w0 + hbD(f) * 1.04)), .03, MAT.wood, 40));
    g.add(tube([0, .25, .5, .75, 1].map(f => new V3(X(xa0) + f * L, y0 + .01, w0 - hbD(f) * 1.04)), .03, MAT.wood, 40));
    for (const s of [.28, .7]) {
      const pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; pts.push(new V3(X(xa0) + s * L, y0 + Math.sin(a) * .17 * Math.min(1, hbD(s) * 3) + .01, w0 + Math.cos(a) * hbD(s) * 1.05)); }
      g.add(tube(pts, .025, MAT.dark, 20));
      g.add(mesh(tf(new THREE.BoxGeometry(.14, .5, 1.0), [X(xa0) + s * L, y0 - .5, w0]), MAT.wood));   // chocks
    }
    add(root, 'dinghy', g);
  }
  // Lifebuoys on the rails.
  {
    const tex = canvasTex(256, 32, (c, W, H) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f4f4ef' : '#d2321f'; c.fillRect(i * W / 8, 0, W / 8, H); } });
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ map: tex, roughness: .7 });
    for (const [xa, sd] of [[1.9, 1], [1.9, -1], [19.9, 1], [19.9, -1]]) {
      const { e, w } = railZ(xa), b = mesh(new THREE.TorusGeometry(.3, .065, 12, 32), m);
      b.position.set(X(xa), e.h + .5, sd * (w + .09)); b.rotation.y = 0; g.add(b);
    }
    add(root, 'lifebuoys', g);
  }

  /* =====================================================================
     LIFE ON BOARD
     ===================================================================== */
  // Crew quarters in the bow: bunks in two tiers, a mess table, lockers. Up to 30 men lived here
  // around the bow torpedo tube.
  {
    const g = new THREE.Group(), y = -.45;
    g.add(mesh(floorPlate(28.25, 35.15, y), MAT.wood));
    const frames = [], beds = [];
    for (const sd of [1, -1]) for (const xa of [29.2, 31.15, 33.1]) for (const tier of [0, 1]) {
      const yy = y + .38 + tier * .78, w = fitW(xa, xa + 1.8, yy - .05, yy + .25) - .36;
      if (w < .35) continue;
      frames.push(tf(new THREE.BoxGeometry(1.8, .08, .66), [X(xa + .9), yy, sd * w]));
      frames.push(tf(new THREE.BoxGeometry(1.8, .2, .04), [X(xa + .9), yy + .08, sd * (w - .33)]));
      beds.push(tf(pillowGeo(1.7, .12, .58), [X(xa + .9), yy + .1, sd * w]));
    }
    g.add(mesh(mergeGeos(frames), MAT.wood), mesh(mergeGeos(beds), MAT.mattress));
    // mess table and benches
    const tx = X(31.4);
    g.add(mesh(mergeGeos([tf(new THREE.BoxGeometry(1.5, .05, .55), [tx, y + .75, 0]),
      ...[[-.65, -.2], [-.65, .2], [.65, -.2], [.65, .2]].map(([dx, dz]) => tf(new THREE.BoxGeometry(.05, .72, .05), [tx + dx, y + .37, dz])),
      tf(new THREE.BoxGeometry(1.4, .05, .25), [tx, y + .42, .5]), tf(new THREE.BoxGeometry(1.4, .05, .25), [tx, y + .42, -.5])]), MAT.woodLight));
    g.add(mesh(tf(new THREE.SphereGeometry(.09, 12, 8), [tx, y + 1.6, 0]), MAT.lampWhite));
    g.add(ladder(30.4, y, deckY(30.4, 0) - .08, .0));
    add(root, 'crewQuarters', g);
  }
  // Officers' cabin (wardroom) at the stern: the commander and his officers ate, worked and slept here.
  {
    const g = new THREE.Group(), y = -.12;
    g.add(mesh(floorPlate(4.05, 9.55, y), MAT.woodLight));
    const sofas = [], cush = [];
    for (const sd of [1, -1]) {
      const xa = 6.6, w = fitW(5.1, 8.1, y, y + .95) - .35;
      sofas.push(tf(new THREE.BoxGeometry(3.0, .38, .6), [X(xa), y + .19, sd * w]));
      cush.push(tf(pillowGeo(2.9, .12, .56), [X(xa), y + .43, sd * w]), tf(pillowGeo(2.9, .5, .12), [X(xa), y + .7, sd * (w + .26)]));
    }
    g.add(mesh(mergeGeos(sofas), MAT.wood), mesh(mergeGeos(cush), MAT.cushion));
    g.add(mesh(mergeGeos([tf(new THREE.BoxGeometry(1.7, .05, .7), [X(6.6), y + .74, 0]), tf(new THREE.CylinderGeometry(.06, .12, .72, 12), [X(6.6), y + .36, 0])]), MAT.wood));
    g.add(mesh(tf(new THREE.BoxGeometry(.5, 1.3, .9), [X(9.25), y + .65, -.6]), MAT.wood));   // cupboard
    g.add(mesh(tf(new THREE.SphereGeometry(.09, 12, 8), [X(6.6), y + 1.25, 0]), MAT.lampWhite));
    g.add(ladder(7.15, y, deckY(7.15, 0) - .08, .2));
    add(root, 'wardroom', g);
  }
  // Galley: the cook's iron stove stands on deck in a small open shelter, so the heat and smoke stay outside.
  {
    const g = new THREE.Group(), x0 = X(17.15), x1 = X(18.0), y = CASE_TOP;
    const walls = [tf(new THREE.BoxGeometry(.04, 1.0, 1.0), [x1, y + .5, 0]), tf(new THREE.BoxGeometry(.85, 1.0, .04), [(x0 + x1) / 2, y + .5, .5]), tf(new THREE.BoxGeometry(.85, 1.0, .04), [(x0 + x1) / 2, y + .5, -.5]), tf(new THREE.BoxGeometry(.9, .04, 1.06), [(x0 + x1) / 2, y + 1.0, 0])];
    g.add(mesh(mergeGeos(walls), MAT.greyLight));
    g.add(mesh(tf(new THREE.BoxGeometry(.55, .55, .85), [x1 - .32, y + .3, 0]), MAT.black));
    g.add(mesh(tf(new THREE.BoxGeometry(.04, .2, .3), [x1 - .6, y + .3, -.2]), MAT.iron));
    const chimTex = canvasTex(64, 128, (c, W, H) => { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#e8e8e2' : '#8f979d'; c.fillRect(0, i * H / 6, W, H / 6); } });
    g.add(mesh(tf(new THREE.CylinderGeometry(.13, .13, .55, 18), [x1 - .3, y + 1.27, .2]), new THREE.MeshStandardMaterial({ map: chimTex, roughness: .6 })));
    add(root, 'galley', g);
  }

  /* =====================================================================
     SMOKE, WAKE AND THE TORPEDO RUN (not parts: they are effects)
     ===================================================================== */
  const puffTex = canvasTex(128, 128, (c, W) => { const gr = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, W); });
  const fx = new THREE.Group(); root.add(fx);
  const puffs = [...Array(140)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: '#3c3a38' })); s.visible = false; s.renderOrder = 4; fx.add(s); return { s, life: 0, max: 1, v: new V3(), grow: 1, base: .4, kind: 'smoke' }; });   // after the water (2) and the wake (3)
  let puffI = 0;
  function emit(p, v, life, size, grow, color, opacity, kind = 'smoke') {
    const q = puffs[puffI = (puffI + 1) % puffs.length];
    q.s.position.copy(p); q.v.copy(v); q.life = 0; q.max = life; q.base = size; q.grow = grow; q.kind = kind; q.op = opacity;
    q.s.material.color.set(color); q.s.visible = true; q.s.scale.setScalar(size);
  }
  // Wake: a shader over the water around the hull: bow wave, Kelvin wedge and the churned water astern.
  const WK = { x0: X(-40), x1: X(41), w: 56 };
  const wakeHB = [...Array(32)].map((_, i) => hb(1.5 + (LOA - 1.5) * i / 31, 0));
  const wakeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 0 }, uHB: { value: wakeHB }, uX0: { value: X(1.5) }, uX1: { value: X(LOA) }, uBow: { value: X(LOA) }, uStern: { value: X(.8) } },
    vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uSpeed, uHB[32], uX0, uX1, uBow, uStern; varying vec3 vL;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float hbAt(float x){ float f = clamp((x - uX0) / (uX1 - uX0), 0.0, 1.0) * 31.0; int i = int(floor(f)); int j = i + 1; if (j > 31) j = 31;
        float a = 0.0, b = 0.0; for (int k = 0; k < 32; k++) { if (k == i) a = uHB[k]; if (k == j) b = uHB[k]; } return mix(a, b, fract(f)); }
      void main(){
        float x = vL.x, z = abs(vL.z), sp = uSpeed;
        if (sp < 0.01) discard;
        vec2 q = vec2(x + uTime * (2.0 + 9.0 * sp), vL.z);
        float n = noise(q * 1.3) * 0.6 + noise(q * 3.7) * 0.4;
        float inHull = step(uX0, x) * step(x, uX1);
        float d = z - hbAt(x);
        float foam = 0.0;
        // water pushed aside along the hull, strongest at the bow
        float along = clamp((x - uStern) / (uBow - uStern), 0.0, 1.0);
        foam += inHull * (1.0 - smoothstep(0.0, 0.35 + 1.2 * sp * along, d)) * step(0.0, d) * (0.45 + 0.55 * along);
        // Kelvin wedge: two lines spreading at 19.5° from the bow
        float back = uBow - x, line = back * 0.354;
        foam += step(0.0, back) * (1.0 - smoothstep(0.0, 0.25 + back * 0.025, abs(z - line))) * exp(-back / 24.0) * 0.55;
        // churned water astern
        float ast = uStern - x;
        foam += step(0.0, ast) * (1.0 - smoothstep(0.6 + ast * 0.05, 1.6 + ast * 0.09, z)) * exp(-ast / 20.0) * 0.9;
        foam *= 0.35 + 0.65 * smoothstep(0.2, 0.8, n);
        if (inHull > 0.5 && d < 0.0) discard;
        float a = clamp(foam * (0.25 + 0.75 * sp), 0.0, 0.8) * smoothstep(0.0, 0.12, sp);
        gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a);
      }`,
  });
  const wakeGeo = new THREE.PlaneGeometry(WK.x1 - WK.x0, WK.w, 1, 1); wakeGeo.rotateX(-Math.PI / 2); wakeGeo.translate((WK.x0 + WK.x1) / 2, .02, 0);
  const wake = mesh(wakeGeo, wakeMat); wake.renderOrder = 3; root.add(wake);   // geometry in the model frame: the shader reads x and z directly

  // Torpedo launch: the torpedo slides out of the tube, drops into the sea and runs on its own.
  const shots = [];
  let reload = 0, nextTube = 0, train = 0, speed = 0;
  const shotMats = { steel: MAT.steel, bronze: MAT.bronze };
  function fire() {
    if (!canFire()) return;
    const tp = torpedoGroup(shotMats); fx.add(tp);
    const tb = TUBES[nextTube]; nextTube = 1 - nextTube;   // the two tubes fire in turn: one to each side
    mount.updateMatrix();
    const start = new V3(tb.dir * (TUBE.x1 - 2.5), TUBE.y, tb.z).applyMatrix4(mount.matrix);
    const dir = new V3(tb.dir, 0, 0).applyAxisAngle(UP, mount.rotation.y);
    tp.position.copy(start); tp.quaternion.setFromUnitVectors(new V3(1, 0, 0), dir);
    shots.push({ tp, t: 0, start, dir, pos: start.clone(), vy: 0, splashed: false });
    emit(start.clone().addScaledVector(dir, 3.2), dir.clone().multiplyScalar(2).add(new V3(0, .6, 0)), 1.0, .9, 1.6, '#ffffff', .8, 'puff');   // the powder charge puff
    reload = 5;
    onFireState();
  }
  const canFire = () => reload <= 0 && Math.abs(train) >= 30;
  let onFireState = () => {};
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt;
      if (s.t < .55) s.pos.copy(s.start).addScaledVector(s.dir, (s.t / .55) * 3.4);   // out of the tube
      else if (!s.splashed) {
        s.pos.addScaledVector(s.dir, 7 * dt); s.vy -= 9.8 * dt; s.pos.y += s.vy * dt;
        s.tp.quaternion.setFromUnitVectors(new V3(1, 0, 0), s.dir.clone().add(new V3(0, s.vy / 7, 0)).normalize());
        if (s.pos.y < -.25) {
          s.splashed = true; s.pos.y = -.25;
          for (let k = 0; k < 10; k++) emit(s.pos.clone().add(new V3((rnd() - .5) * 1.5, .2, (rnd() - .5) * 1.5)), new V3((rnd() - .5) * 2, 2 + rnd() * 2, (rnd() - .5) * 2), .9, .7, 1.8, '#ffffff', .9, 'splash');
        }
      } else {
        s.pos.addScaledVector(s.dir, 14 * dt); s.pos.y += (-.6 - s.pos.y) * Math.min(1, dt * 2);
        s.tp.quaternion.setFromUnitVectors(new V3(1, 0, 0), s.dir);
        if (rnd() < dt * 18) emit(new V3(s.pos.x - s.dir.x * 2.6, .05, s.pos.z - s.dir.z * 2.6), new V3(0, .05, 0), 2.6, .8, .7, '#ffffff', .75, 'bubble');
      }
      s.tp.position.copy(s.pos);
      if (s.t > 9) { fx.remove(s.tp); shots.splice(i, 1); }
    }
  }

  /* =====================================================================
     CUTAWAY
     The starboard side plating is cut away below the deck edge, like the
     cutaway builder's model in the Naval Museum in Varna.
     ===================================================================== */
  const P = (x, y, z, c) => new THREE.Plane(new V3(x, y, z), c);
  const cutLocal = { main: [P(0, 0, -1, 0), P(0, 1, 0, -1.2)], fwd: [P(0, 0, -1, 0), P(0, 1, 0, -1.6)] };
  const cutWorld = { main: cutLocal.main.map(p => p.clone()), fwd: cutLocal.fwd.map(p => p.clone()) };
  let cutaway = false;
  const interiorLights = new THREE.Group(); root.add(interiorLights);
  for (const [xa, y] of [[6.6, .9], [14.5, .7], [29.5, .9]]) { const l = new THREE.PointLight('#ffe7c4', 0, 9, 1.6); l.position.set(X(xa), y, -.3); interiorLights.add(l); }
  function setCutaway(on) {
    cutaway = on;
    registry.setCut(on ? cutWorld : null);
    for (const l of interiorLights.children) l.intensity = on ? .6 : 0;
  }

  /* =====================================================================
     WATERLINE, CONTROLS, API
     ===================================================================== */
  let wl0 = 0; while (KEEL(wl0) > -.01 && wl0 < 10) wl0 += .02;
  const waterline = { x0: X(wl0), x1: X(LOA), hb: [...Array(48)].map((_, i) => hb(wl0 + (LOA - wl0) * i / 47, 0)) };

  const fmt = (k, v) => t(M, k, v);
  const orderOf = v => v === 0 ? 'stop' : v < 10 ? 'slow' : v < 20 ? 'half' : 'full';
  const controls = [
    { id: 'speed', type: 'range', min: 0, max: 26, step: 1, value: 0, label: 'controls.speed',
      format: v => fmt('controls.speedFmt', { n: v, v, kmh: Math.round(v * 1.852), order: fmt(`orders.${orderOf(v)}`) }),
      set: v => { speed = v; } },
    { id: 'tubes', type: 'range', min: -90, max: 90, step: 5, value: 0, label: 'controls.tubes',
      format: v => v === 0 ? fmt('controls.ahead') : fmt('controls.turned', { a: Math.abs(v) }),
      set: v => { train = v; mount.rotation.y = -deg(v); onFireState(); } },
    { id: 'fire', type: 'button', label: 'controls.fire', title: 'controls.fireTitle', run: fire, enabled: canFire },
    { id: 'cutaway', type: 'toggle', label: 'controls.cutaway', title: 'controls.cutawayTitle', value: false, set: setCutaway },
  ];

  let theta = 0, propA = 0, smokeAcc = [0, 0], fireLive = null;
  const _v = new V3();
  function update(time, dt, state) {
    // cutaway planes follow the gently moving hull
    root.updateMatrixWorld();
    for (const k in cutLocal) cutLocal[k].forEach((p, i) => cutWorld[k][i].copy(p).applyMatrix4(root.matrixWorld));
    const sp = speed / 26;
    // engine and propeller: up to about 4 turns a second here (the real engine: ~6)
    const rps = sp * 4 + (speed > 0 ? .25 : 0);
    theta += dt * rps * Math.PI * 2; propA += dt * rps * Math.PI * 2;
    updateEngine(theta); prop.rotation.x = -propA;
    fireLive ||= registry.partMats.boilers.filter(m => m.userData.fire);
    for (const m of fireLive) if (state?.selected !== 'boilers' && state?.hover !== 'boilers') m.emissiveIntensity = .5 + sp * 1.6 + Math.sin(time * 13 + m.id) * .12 + Math.sin(time * 7.3) * .1;
    // telegraph handle: stop = upright, full ahead = leaning forward
    telHandle.rotation.z = -(speed === 0 ? 0 : speed < 10 ? .35 : speed < 20 ? .78 : 1.25);
    // flag
    const a = flagGeo.attributes.position, flutter = .06 + sp * .1;
    for (let i = 0; i < a.count; i++) { const x0 = flagBase[3 * i], d = (.725 - x0) / 1.45; a.setZ(i, Math.sin(d * 7 - time * (4 + sp * 6)) * flutter * d + Math.sin(d * 3 - time * 2.1) * .04 * d); }
    a.needsUpdate = true; flagGeo.computeVertexNormals();
    // smoke from both funnels: thin when stopped, thick and dark at full speed
    funnelGroups.forEach((f, i) => {
      smokeAcc[i] += dt * (1.5 + sp * 9);
      while (smokeAcc[i] > 1) {
        smokeAcc[i] -= 1;
        _v.set(0, f.h + .1, 0); f.g.localToWorld(_v); root.worldToLocal(_v);
        emit(_v.clone(), new V3(-1.2 - sp * 9 + rnd() * .4, 1.3 + rnd() * .5 - sp * .5, (rnd() - .5) * .5 + .4), 3.4 + rnd(), .7 + sp * .3, 2 + sp * 3, sp > .5 ? '#2b2927' : '#5a5650', .38 + sp * .3);
      }
    });
    for (const q of puffs) {
      if (!q.s.visible) continue;
      q.life += dt; const f = q.life / q.max;
      if (f >= 1) { q.s.visible = false; continue; }
      q.s.position.addScaledVector(q.v, dt);
      if (q.kind === 'splash') q.v.y -= 5 * dt;
      q.s.scale.setScalar(q.base * (1 + q.grow * f));
      q.s.material.opacity = q.op * (f < .1 ? f / .1 : 1 - f);
    }
    wakeMat.uniforms.uTime.value = time; wakeMat.uniforms.uSpeed.value = sp;
    if (reload > 0) { reload -= dt; if (reload <= 0) onFireState(); }
    updateShots(dt);
  }

  // label anchors for parts whose bounding-box centre is a poor spot
  const anchors = {
    hull: () => new V3(X(14), .55, hb(14, .55) + .05),
    deck: () => new V3(X(13.5), deckY(13.5, 1.6) + .05, 1.6),
    forecastle: () => new V3(X(31), deckY(31, .9) + .05, .9),
    mast: () => mastAt(8.2),
    funnels: () => new V3(X(22.9) - .2, FUN_TOP - .25, .45),
    shellHole: () => { const v = new V3(); shellHole.children[0].getWorldPosition(v); root.worldToLocal(v); return v; },
    ensign: () => new V3(X(.32) - .745, deckY(.32, 0) + 2.52, 0),
    nameplate: () => onHull(35.25, 1.72, 1, .05).p,
    bulkheads: () => new V3(X(9.6), .3, .6),
    twinTubes: () => new V3(mount.position.x, mount.position.y + 1.4, 0),
    torpedo: () => new V3(X(8.1), deckY(8.1, 1.12) + .55, 1.12),
    bowTube: () => new V3(X(38.2), 1.42, 0),
    anchors: () => new V3(X(32.85), deckY(32.85, .82) + .15, .82),
  };
  function anchor(id, out) {
    const f = anchors[id]; if (!f) return false;
    out.copy(f()).add(registry.offsetOf(id)).applyMatrix4(root.matrixWorld); return true;
  }

  return {
    root, waterline, floorY: -2.28,
    home: { pos: new V3(44, 17, 27), target: new V3(1, 1.2, 0), tallDrop: 4 },   // starboard bow quarter: the whole ship fits between the side panels
    stage: { scale: 4.5, view: { minDistance: 3, maxDistance: 140 }, shadowMap: 4096,
      palette: { deep: '#061a22', shallow: '#0e3440', skyRefl: '#5d7886', seabed: '#041219', horizon: '#c6d2d8' } },   // the Black Sea: darker than the default
    shadowSize: 23,
    motion: { heave: .05, roll: .012, pitch: .004 },
    controls,
    update, anchor,
    labelHidden: (id, st) => PART[id]?.inside && !cutaway && (st?.explode ?? 0) < .5,
    onMode: m => { wake.visible = m === 'water'; },
    onExplode: () => {},
    attach: () => {},
    bindUI: ui => { onFireState = () => ui.refreshControls(); },
    redraw: () => { drawPlate(); drawTelegraph(); },
  };
}
