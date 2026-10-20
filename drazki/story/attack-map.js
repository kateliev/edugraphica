/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Drazki story — schematic of the night attack of 21 November 1912 (not to scale).
// Four torpedo boats come in one after another; each fires closer than the one before.
// Distances: Letyashti 500–600 m; Drazki ≈ 100 m (some accounts: 50–60 m). Words come from
// story.json → figureText.attackMap; colours from the site tokens, so the figure follows the theme.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function attackMap(el, A) {
  const L = A.figureText?.attackMap || {};
  const H = { x: 470, y: 190 };   // Hamidiye's centre
  const boat = (x, y, a, hl) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M-15 -3 L9 -3 Q16 0 9 3 L-15 3 Z" style="fill:${hl ? 'var(--accent)' : 'var(--ink)'}"/><rect x="-6" y="-1.6" width="3" height="3.2" style="fill:var(--panel-solid)"/></g>`;
  const ring = (r, label) => `<circle cx="${H.x}" cy="${H.y}" r="${r}" fill="none" style="stroke:var(--ink-2)" stroke-width="1" stroke-dasharray="3 5" opacity=".55"/><text x="${H.x}" y="${H.y - r - 5}" font-size="11" style="fill:var(--ink-2)" text-anchor="middle">${esc(label)}</text>`;
  // the four boats: where they fired from (angle round the cruiser, distance in px)
  const shots = [
    { ang: 218, d: 150, name: L.boats?.[0], dist: L.dist?.[0], ly: 70 },
    { ang: 196, d: 106, name: L.boats?.[1], dist: L.dist?.[1], ly: 150 },
    { ang: 172, d: 74, name: L.boats?.[2], dist: L.dist?.[2], ly: 230 },
    { ang: 146, d: 46, name: L.boats?.[3], dist: L.dist?.[3], ly: 300, hit: true },
  ];
  const rad = d => d * Math.PI / 180;
  let boats = '', tracks = '', labels = '';
  shots.forEach((s, i) => {
    const x = H.x + Math.cos(rad(s.ang)) * s.d, y = H.y + Math.sin(rad(s.ang)) * s.d;
    const tx = s.hit ? H.x + 46 : H.x + (i - 1) * 30 - 10, ty = s.hit ? H.y - 3 : H.y + (i % 2 ? 26 : -24);   // misses pass ahead or astern
    tracks += `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" style="stroke:${s.hit ? 'var(--accent)' : 'var(--ink-2)'}" stroke-width="${s.hit ? 2 : 1.3}" stroke-dasharray="${s.hit ? '6 4' : '3 4'}"/>`;
    boats += boat(x, y, s.ang + 180 - 25, s.hit);
    // names in a column on the left, with a thin leader line to each boat
    const lx = 250, ly = s.ly;
    labels += `<line x1="${lx + 6}" y1="${ly - 4}" x2="${x - 12}" y2="${y}" style="stroke:var(--ink-2)" stroke-width=".8" opacity=".6"/>`
      + `<text x="${lx}" y="${ly}" font-size="12.5" font-weight="700" text-anchor="end" style="fill:${s.hit ? 'var(--accent)' : 'var(--ink)'}">${i + 1}. ${esc(s.name)}</text>`
      + `<text x="${lx}" y="${ly + 15}" font-size="11" text-anchor="end" style="fill:var(--ink-2)">${esc(s.dist)}</text>`;
  });
  const cruiser = `<g transform="translate(${H.x} ${H.y})"><path d="M-62 -7 L50 -7 Q70 0 50 7 L-62 7 Q-68 0 -62 -7 Z" style="fill:var(--ink-2)"/>
    <rect x="-20" y="-3" width="6" height="6" rx="3" style="fill:var(--panel-solid)"/><rect x="-6" y="-3" width="6" height="6" rx="3" style="fill:var(--panel-solid)"/>
    <text x="0" y="-16" font-size="13" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${esc(L.hamidiye)}</text></g>`;
  const hit = `<g transform="translate(${H.x + 46} ${H.y - 3})"><path d="M0 -12 L3 -4 L12 -6 L5 1 L10 9 L1 5 L-4 12 L-4 3 L-12 2 L-5 -3 Z" style="fill:var(--accent)"/></g>
    <text x="${H.x + 64}" y="${H.y - 18}" font-size="12" font-weight="700" style="fill:var(--accent)">${esc(L.hit)}</text>`;
  const escorts = [[H.x + 70, H.y + 74, -15], [H.x + 96, H.y - 64, 10]].map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M-14 -3 L8 -3 Q14 0 8 3 L-14 3 Z" style="fill:var(--ink-2)" opacity=".8"/></g>`).join('');
  el.innerHTML = `<svg viewBox="0 0 640 340" role="img" aria-label="${esc(L.aria)}">
    <rect width="640" height="340" style="fill:var(--chip)"/>
    ${ring(150, '600 m')}${ring(104, '300 m')}${ring(44, '100 m')}
    ${tracks}${cruiser}${escorts}${boats}${hit}${labels}
    <text x="${H.x + 70}" y="${H.y + 98}" font-size="11" text-anchor="middle" style="fill:var(--ink-2)">${esc(L.escorts)}</text>
    <text x="18" y="28" font-size="12" font-weight="700" style="fill:var(--ink-2)">← ${esc(L.varna)}</text>
    <text x="622" y="326" font-size="11" text-anchor="end" style="fill:var(--ink-2)">${esc(L.notToScale)}</text>
  </svg>`;
}
