/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Drazki — the far shore of Varna Bay behind the ship. Not a 3D object: a painted band on a ring
// that moves with the camera (like the sky), so zooming never brings it closer. Its foot stands on
// the sea a few kilometres away, so the water hides the part of the band below the sea line.
// The picture is a loose impression of the coast seen from the bay, south (left) to north (right):
// the Avren plateau ending at Cape Galata with its pale cliffs, the port at the head of the bay,
// the town climbing to the flat-topped Franga plateau, then the wooded coast towards Golden Sands.
// Colours come from the stage palette (palette.shore), so the shore is redrawn when they change.
import * as THREE from 'three';
import { mono, deg } from '../../assets/js/explorer/geometry.js';

const ARC = 230, CENTRE = -122;     // degrees round the camera; the middle is behind the ship in the home view
const TOP = 6, BOTTOM = -.8;        // the band, in degrees above the sea line
export const SHORE = {              // default colours (sRGB); a palette may override any of them
  far: '#7f9590', plateau: '#2b4532', near: '#18301f', lit: '#5d8150', litA: .35, shade: '#08140c', shadeA: .45,
  town: '#d6cfbd', roof: '#8f5446', cliff: '#bcb093', haze: 0,
};

// Ridge profiles: s = 0…1 along the arc (left to right as seen from the ship), heights in degrees
// above the sea; mono() keeps the flat plateau tops flat.
const RIDGES = {
  far: [[0, 0], [.04, .5], [.09, 1.1], [.13, .9], [.19, 1.5], [.25, 1.3], [.31, 1.8], [.37, 1.6], [.43, 2.1], [.48, 1.9], [.53, 2.5],
    [.6, 2.2], [.66, 2.6], [.72, 2.1], [.78, 1.8], [.84, 2.0], [.9, 1.3], [.95, .6], [1, 0]],
  avren: [[0, 0], [.03, .3], [.06, 1.5], [.08, 2], [.12, 2.1], [.17, 2.15], [.19, 1.75], [.21, 1.7], [.23, 2.05], [.3, 2.15], [.34, 2.05],
    [.37, 1.6], [.395, .9], [.415, .3], [.425, 0]],
  franga: [[.41, 0], [.44, .5], [.47, .9], [.5, 1.6], [.52, 2.4], [.545, 2.65], [.6, 2.7], [.64, 2.6], [.66, 2.2], [.68, 2.6], [.74, 2.7],
    [.78, 2.5], [.81, 2], [.84, 1.75], [.88, 1.85], [.92, 1.5], [.96, .8], [1, 0]],
  galata: [[.02, 0], [.06, .4], [.1, .8], [.14, .7], [.18, 1.05], [.23, .95], [.28, 1.2], [.33, 1], [.37, .8], [.395, .5], [.41, .25], [.42, 0]],
  coast: [[.43, 0], [.46, .15], [.5, .35], [.54, .55], [.57, .8], [.6, 1], [.63, .9], [.67, 1.2], [.72, 1.1], [.76, 1.35], [.81, 1.15],
    [.86, 1.25], [.91, .85], [.96, .45], [1, 0]],
};

export function createShore(stage) {
  const k = stage.scale, D = 600 * k;   // 2.7 km for Drazki: inside the water plane, beyond the fog
  const y0 = Math.tan(deg(BOTTOM)) * D, y1 = Math.tan(deg(TOP)) * D;
  const geo = new THREE.CylinderGeometry(D, D, y1 - y0, 192, 1, true, deg(CENTRE - ARC / 2), deg(ARC));
  geo.translate(0, (y0 + y1) / 2, 0);

  const W = Math.min(8192, stage.renderer.capabilities.maxTextureSize), H = 512;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  tex.repeat.x = -1; tex.offset.x = 1;   // seen from inside the ring: draw left to right as the viewer sees it
  tex.premultiplyAlpha = true;           // filtered edges blend with the colour, not with black …
  // Opaque with alpha-to-coverage: soft ridge lines, and drawn before every see-through part of the ship.
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, alphaTest: .02, alphaToCoverage: true });
  mat.onBeforeCompile = sh => {   // … and the colour is taken back out of the premultiplied texel here
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb /= max(diffuseColor.a, 1e-4);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.set(cam.position.x, 0, cam.position.z); mesh.updateMatrixWorld(); };
  stage.scenery.add(mesh);

  const px = s => s * W, py = e => (TOP - e) / (TOP - BOTTOM) * H;   // arc position, degrees → canvas pixels
  const pxDeg = W / ARC, pyDeg = H / (TOP - BOTTOM);

  function draw(pal) {
    const P = { ...SHORE, ...pal.shore }, g = canvas.getContext('2d');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const hz = (c, f) => '#' + new THREE.Color(c).lerp(new THREE.Color(pal.horizon), Math.min(1, f + P.haze)).getHexString();
    const rgba = (c, a) => { const o = new THREE.Color(c); return `rgba(${o.r * 255 | 0},${o.g * 255 | 0},${o.b * 255 | 0},${a})`; };
    // a ridge as a function of s, with tree-sized bumps (near) or gentle waves (far)
    const ridge = (pts, amp, freq) => {
      const f = mono(pts), ph = rnd() * 100, s0 = pts[0][0], s1 = pts[pts.length - 1][0];
      return s => {
        if (s <= s0 || s >= s1) return -1;
        const fade = Math.min(1, (s - s0) / .02, (s1 - s) / .02);
        return f(s) + amp * fade * (Math.sin(s * freq + ph) * .5 + Math.sin(s * freq * 2.7 + ph * 1.7) * .3 + Math.sin(s * freq * 7.1 + ph * .3) * .2);
      };
    };
    const span = fn => fn.span;
    const path = fn => {
      const [s0, s1] = span(fn);
      g.beginPath(); g.moveTo(px(s0), H);
      for (let x = Math.floor(px(s0)); x <= Math.ceil(px(s1)); x += 2) g.lineTo(x, py(Math.max(fn(x / W), BOTTOM - .2)));
      g.lineTo(px(s1), H); g.closePath();
    };
    // fill a ridge: colour fading into the low haze on the water; then light and shade by the slope
    // (light from the left), gullies under the rim, and a lit rim along the top
    const layer = (pts, amp, freq, col, haze, { gullies = 0, relief = 1, rim = 1 } = {}) => {
      const fn = ridge(pts, amp, freq); fn.span = [pts[0][0], pts[pts.length - 1][0]];
      const [s0, s1] = fn.span, depth = relief * .9 * pyDeg;
      path(fn);
      const gr = g.createLinearGradient(0, py(3), 0, py(0));
      gr.addColorStop(0, hz(col, haze)); gr.addColorStop(.7, hz(col, haze + .06)); gr.addColorStop(1, hz(col, haze + .28));
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      const lit = hz(P.lit, haze), shade = hz(P.shade, haze);
      for (let x = Math.floor(px(s0)); x <= Math.ceil(px(s1)); x += 3) {
        const s = x / W, e = fn(s); if (e <= 0) continue;
        const slope = (fn(s + .6 / ARC) - fn(s - .6 / ARC)) / 1.2;   // degrees up per degree along, over the hill, not the trees
        const l = Math.max(-1, Math.min(1, slope * 7)), y = py(e);
        const sg = g.createLinearGradient(0, y, 0, y + depth);
        sg.addColorStop(0, l > 0 ? rgba(lit, P.litA * l) : rgba(shade, P.shadeA * -l)); sg.addColorStop(1, rgba(l > 0 ? lit : shade, 0));
        g.fillStyle = sg; g.fillRect(x, y, 3, depth);
      }
      for (let i = 0; i < gullies; i++) {   // furrows down the faces: a shaded groove fanning out downhill, a lit spur beside it
        const s = s0 + rnd() * (s1 - s0), e = fn(s); if (e < .6) continue;
        const top = e - .12 - rnd() * .35, len = (.25 + rnd() * .7) * Math.min(1, e / 1.8), x = px(s), y = py(top), b = y + len * pyDeg;
        const w = 2 + rnd() * 6, lean = (rnd() - .5) * 6;
        for (const [dx, c, a] of [[0, shade, P.shadeA * (.1 + rnd() * .18)], [w * .9, lit, P.litA * (.08 + rnd() * .15)]]) {
          const sg = g.createLinearGradient(0, y, 0, b);
          sg.addColorStop(0, rgba(c, a)); sg.addColorStop(1, rgba(c, 0));
          g.fillStyle = sg; g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx + w * .5 + lean, b); g.lineTo(x + dx - w * .5 + lean, b); g.closePath(); g.fill();
        }
      }
      if (P.litA * rim > 0) {   // light catching the ridge line
        g.beginPath(); for (let x = Math.floor(px(s0)); x <= Math.ceil(px(s1)); x += 2) g.lineTo(x, py(fn(x / W)));
        g.strokeStyle = lit; g.lineJoin = 'round';
        for (const [w, a] of [[.22, .25], [.12, .45], [.05, .85]]) { g.lineWidth = w * pyDeg; g.globalAlpha = P.litA * rim * a; g.stroke(); }
        g.globalAlpha = 1;
      }
      g.restore();
      return fn;
    };
    const woods = (fn, n) => {   // dark and light flecks of tree crowns
      g.save(); path(fn); g.clip();
      const [s0, s1] = span(fn);
      for (let i = 0; i < n; i++) {
        const s = s0 + rnd() * (s1 - s0), e = rnd() * Math.max(fn(s), 0);
        g.fillStyle = rnd() < .5 ? rgba(hz(P.lit, .1), .22) : rgba(P.shade, .3);
        g.beginPath(); g.ellipse(px(s), py(e), 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    };

    g.clearRect(0, 0, W, H);
    layer(RIDGES.far, .05, 160, P.far, .45, { relief: .6, rim: .4 });
    layer(RIDGES.avren, .03, 260, P.plateau, .12, { gullies: 160 });
    layer(RIDGES.franga, .03, 240, P.plateau, .1, { gullies: 190 });
    const galata = layer(RIDGES.galata, .05, 900, P.near, .03, { relief: .6 });
    const coast = layer(RIDGES.coast, .05, 900, P.near, .03, { relief: .6 });
    woods(galata, 3000); woods(coast, 3000);

    // Cape Galata: pale limestone cliffs at the foot of the cape
    g.save(); path(galata); g.clip();
    for (let i = 0; i < 120; i++) {
      const s = .36 + rnd() * .06, top = Math.min(galata(s) * .6, .35) * (.5 + rnd() * .5);
      g.fillStyle = hz(P.cliff, .08 + rnd() * .15); g.fillRect(px(s), py(top), 2 + rnd() * 5, py(-.1) - py(top));
    }
    g.restore();

    // the town on the slope at the head of the bay, the cathedral, the port with a few masts
    const house = (s, e, w, h) => {
      const x = px(s), y = py(e), wp = w * pxDeg, hp = h * pyDeg, rh = Math.max(2, hp * .35);
      g.fillStyle = hz(P.town, .06 + rnd() * .14); g.fillRect(x, y - hp, wp, hp + 2);
      g.fillStyle = hz(P.roof, .06 + rnd() * .14); g.fillRect(x - 1, y - hp - rh, wp + 2, rh);
    };
    for (let i = 0; i < 520; i++) {
      const s = .425 + rnd() * .16, ground = s < .43 ? .05 : Math.max(coast(s), .05);
      const e = ground * Math.pow(rnd(), .8) * .92 * (s > .55 ? 1 - (s - .55) * 22 : 1);   // fewer houses towards the woods
      if (e < 0 || (rnd() < .35 && e > ground * .5)) continue;
      house(s, e, .1 + rnd() * .2, .05 + rnd() * .06);
    }
    { // the cathedral: a block with three domes and a bell tower
      const s = .487, e = coast(s) * .7, x = px(s), y = py(e), w = .5 * pxDeg, h = .16 * pyDeg;
      g.fillStyle = hz(P.town, .03); g.fillRect(x, y - h, w, h + 2);
      g.fillStyle = hz(P.roof, .02);
      for (const [f, r] of [[.25, .14], [.5, .2], [.75, .14]]) { g.beginPath(); g.ellipse(x + w * f, y - h, r * pxDeg * .5, r * pyDeg * .55, 0, Math.PI, 0); g.fill(); }
      g.fillStyle = hz(P.town, .03); g.fillRect(x - .1 * pxDeg, y - h * 1.9, .1 * pxDeg, h * 1.9);
      g.fillStyle = hz(P.roof, .02); g.beginPath(); g.moveTo(x - .12 * pxDeg, y - h * 1.9); g.lineTo(x - .05 * pxDeg, y - h * 2.5); g.lineTo(x + .02 * pxDeg, y - h * 1.9); g.fill();
    }
    g.fillStyle = hz(P.cliff, .1); g.fillRect(px(.415), py(.07), px(.03), py(-.1) - py(.07));   // quay wall
    g.strokeStyle = hz('#3a3530', .3); g.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) { const x = px(.418 + rnd() * .024); g.beginPath(); g.moveTo(x, py(.05)); g.lineTo(x, py(.35 + rnd() * .4)); g.stroke(); }

    // a thin pale beach line where the land meets the sea
    g.fillStyle = rgba(hz(P.cliff, .2), .6);
    g.fillRect(px(.02), py(.03), px(.35), py(-.04) - py(.03)); g.fillRect(px(.58), py(.03), px(.4), py(-.04) - py(.03));
    tex.needsUpdate = true;
  }
  stage.onPalette(draw);
  return mesh;
}
