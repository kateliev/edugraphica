/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica — landing page: one card per ready microsite (MICROSITES in config.js).
// Card words come from each microsite's own <site>/i18n/<lang>/site.json (name, tagline, card).
import { MICROSITES } from '../core/config.js';
import { mountSiteNav, siteHref } from '../core/sitenav.js';
import { loadStrings, applyDom, t, ROOT } from '../core/i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function startLanding() {
  const { S, lang } = await mountSiteNav({});
  document.documentElement.lang = lang;
  applyDom(S);
  document.title = `${t(S, 'site.name')} · ${t(S, 'site.tagline')}`;
  const sites = MICROSITES.filter(m => m.ready);
  const words = await Promise.all(sites.map(m => loadStrings('site', lang, m.id)));
  document.getElementById('sites').innerHTML = sites.map((m, i) => {
    const W = words[i];
    return `<a class="site-card panel" href="${esc(siteHref(m.path, lang))}">
      ${m.card ? `<img src="${esc(new URL(m.card, ROOT).pathname)}" alt="" loading="lazy">` : ''}
      <div class="body"><h2>${esc(W.name)}</h2><p class="tagline">${esc(W.tagline)}</p><p>${esc(W.card)}</p>
        <div class="row"><span class="btn primary">${esc(t(S, 'site.explore'))}</span></div></div></a>`;
  }).join('');
}
