/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica — site navigation (site mark, the microsite's tabs, language menu) and site footer.
// Every page has <nav id="siteNav" class="site-nav panel"></nav> and calls
//   mountSiteNav({ site: '<microsite id>', current: '<page id>' })   on a microsite page
//   mountSiteNav({})                                                   on the landing page (no tabs)
// Tabs come from MICROSITES (config.js), labels from <site>/i18n/<lang>/site.json → nav.<page id>.
import { MICROSITES, LANGS, DEFAULT_LANG, SITE } from './config.js';
import { ROOT, pickLang, loadStrings, setLang, t } from './i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>';

// The site mark as HTML: one place, so every page shows the same words.
export const siteMark = () => 'Edu<b>graphica</b>';

// Link to a path under the site root that keeps the chosen language.
export function siteHref(path, lang) {
  const u = new URL(path, ROOT);
  if (lang && lang !== DEFAULT_LANG) u.searchParams.set('lang', lang);
  return u.pathname + u.search;
}

export async function mountSiteNav({ site, current } = {}) {
  const lang = pickLang();
  const [S, W] = await Promise.all([loadStrings('common', lang), site ? loadStrings('site', lang, site) : {}]);
  mountSiteFoot(S);
  const el = document.getElementById('siteNav');
  if (!el) return { S, W, lang };

  const ms = MICROSITES.find(m => m.id === site);
  const tabs = (ms?.pages || []).map(p => {
    const cur = p.id === current ? ' aria-current="page"' : '';
    return `<a class="site-tab"${cur} data-page="${p.id}" href="${siteHref(ms.path + p.path, lang)}">${esc(t(W, `nav.${p.id}`))}</a>`;
  }).join('');

  const options = LANGS.map(l => {
    const usable = l.ready || l.partial || l.code === lang;
    const note = l.ready ? '' : l.partial ? ` (${t(S, 'nav.partial')})` : ` (${t(S, 'nav.soon')})`;
    return `<option value="${l.code}" lang="${l.code}" ${l.code === lang ? 'selected' : ''} ${usable ? '' : 'disabled'}>${l.code.toUpperCase()} · ${esc(l.label)}${esc(note)}</option>`;
  }).join('');

  el.setAttribute('aria-label', t(S, 'nav.aria'));
  el.innerHTML = `
    <a class="site-mark" href="${siteHref('', lang)}" title="${esc(t(S, 'nav.home'))}">${siteMark()}</a>
    ${tabs ? `<div class="site-tabs">${tabs}</div>` : ''}
    <label class="site-lang" title="${esc(t(S, 'ui.language'))}">${GLOBE}
      <select aria-label="${esc(t(S, 'ui.language'))}">${options}</select>
      <span class="site-lang-code" aria-hidden="true">${lang.toUpperCase()}</span>
    </label>`;
  el.querySelector('select').addEventListener('change', e => setLang(e.target.value));
  return { S, W, lang };
}

// Site footer: copyright (owner's GitHub profile), domain, code and content licences, source repository, e-mail.
// Any page with <footer id="siteFoot" class="site-foot"></footer> gets it. Words come from common.json → foot;
// mountSiteNav passes its strings, a page without navigation (404) lets the footer load them.
export async function mountSiteFoot(S) {
  const el = document.getElementById('siteFoot');
  if (!el) return;
  S ??= await loadStrings('common', pickLang());
  const lic = (key, l) => esc(t(S, key)).replace('{l}', `<a href="${l.url}" rel="license">${esc(l.name)}</a>`);
  const sep = '<span aria-hidden="true">·</span>';
  el.innerHTML = `<span>© <a href="${SITE.ownerUrl}" rel="author">${esc(SITE.owner)}</a></span>${sep}<span>${SITE.domain}</span>`
    + `${sep}<span>${lic('foot.code', SITE.licenses.code)}</span>${sep}<span>${lic('foot.content', SITE.licenses.content)}</span>`
    + `${sep}<a href="${SITE.repo}">GitHub</a>`
    + `${sep}<a class="site-foot-mail" href="#"></a>`;
  // the address is joined only here, and the mailto link only when the link is used
  const mail = el.querySelector('.site-foot-mail'), addr = () => SITE.contact.join('@');
  mail.textContent = addr();
  const arm = () => { mail.href = 'mailto:' + addr(); };
  for (const ev of ['pointerdown', 'focus', 'keydown']) mail.addEventListener(ev, arm, { once: true });
}
