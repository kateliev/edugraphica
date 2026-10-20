/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica — story / text page renderer (any microsite). A page calls:
//   startArticle({ site: 'drazki', ns: 'story', current: 'story', figures: { name: (el, A, lang) => {} } })
// All text comes from <site>/i18n/<lang>/<ns>.json:
//   { pageTitle, chip, title, titleAccent?, lead,
//     sections: [{ heading, paragraphs: [], fact?, figure? }],    figure = key into `figures`
//     facts?: { heading, spec: [[k, v]] }, timeline?: { heading, items: [[time, text]] },
//     cta?: { heading, text, label, href },                        href relative to the site root
//     sources?: { heading, items: [[label, url]] }, figureText?: { <figure>: {…} } }
// Layout: assets/css/article.css. Page markup: #siteNav, #article, #siteFoot.
import { mountSiteNav, siteHref } from '../core/sitenav.js';
import { loadStrings, t } from '../core/i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function startArticle({ site, ns, current, figures = {} }) {
  const { S, W, lang } = await mountSiteNav({ site, current });
  document.documentElement.lang = lang;
  const A = await loadStrings(ns, lang, site);
  document.title = [A.pageTitle, W.name, t(S, 'site.name')].filter(Boolean).join(' · ');
  const title = A.title || '', ai = A.titleAccent ?? -1;
  const titleHtml = ai >= 0 && ai < title.length ? `${esc(title.slice(0, ai))}<span>${esc(title[ai])}</span>${esc(title.slice(ai + 1))}` : esc(title);
  const spec = rows => rows?.length ? `<dl class="spec">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';

  const sections = (A.sections || []).map((s, i) => `
    <section class="article-section panel" id="s${i + 1}">
      <h2><span class="num">${i + 1}</span>${esc(s.heading)}</h2>
      ${(s.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}
      ${s.figure ? `<figure class="article-figure" data-figure="${esc(s.figure)}"><div></div>${A.figureText?.[s.figure]?.caption ? `<figcaption>${esc(A.figureText[s.figure].caption)}</figcaption>` : ''}</figure>` : ''}
      ${s.fact ? `<div class="callout"><div class="eyebrow-label">${esc(t(S, 'ui.didYouKnow'))}</div><p>${esc(s.fact)}</p></div>` : ''}
    </section>`).join('');

  const aside = [
    A.facts ? `<div class="article-card panel"><h3>${esc(A.facts.heading)}</h3>${spec(A.facts.spec)}</div>` : '',
    A.timeline ? `<div class="article-card panel"><h3>${esc(A.timeline.heading)}</h3><ol class="timeline">${A.timeline.items.map(([tm, tx]) => `<li><time>${esc(tm)}</time><span>${esc(tx)}</span></li>`).join('')}</ol></div>` : '',
    A.cta ? `<div class="article-card panel article-cta"><h3>${esc(A.cta.heading)}</h3><p>${esc(A.cta.text)}</p><a class="btn primary" href="${esc(siteHref(A.cta.href, lang))}">${esc(A.cta.label)}</a></div>` : '',
  ].join('');

  document.getElementById('article').innerHTML = `
    <header class="article-head panel"><span class="chip">${esc(A.chip)}</span><h1>${titleHtml}</h1><p class="lead">${esc(A.lead)}</p></header>
    <div class="article-cols"><div class="article-main">${sections}</div><aside class="article-aside">${aside}</aside></div>
    ${A.sources ? `<div class="article-sources panel"><h3>${esc(A.sources.heading)}</h3><ul>${A.sources.items.map(([l, u]) => `<li>${u ? `<a href="${esc(u)}" rel="noopener">${esc(l)}</a>` : esc(l)}</li>`).join('')}</ul></div>` : ''}`;

  for (const f of document.querySelectorAll('[data-figure]')) figures[f.dataset.figure]?.(f.firstElementChild, A, lang);
  return { S, W, A, lang };
}
