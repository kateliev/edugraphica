/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Edugraphica — site-wide settings shared by the landing page and every microsite.
// This file is the single source of truth for: the site identity, the languages,
// and the list of microsites with their pages (used by the landing page and the navigation).

export const SITE = {
  name: 'Edugraphica',
  domain: 'edugraphica.org',
  repo: 'https://github.com/kateliev/edugraphica',
  owner: 'Vassil Kateliev',
  ownerUrl: 'https://github.com/kateliev',
  // Licences (see LICENSE, LICENSE-CONTENT and the README): code = all JavaScript, including the
  // procedural 3D models; content = texts, part descriptions, translations, data files, images.
  licenses: {
    code: { name: 'PolyForm Noncommercial', url: 'https://polyformproject.org/licenses/noncommercial/1.0.0' },
    content: { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  },
  // E-mail kept in two pieces so the address never appears whole in the HTML or the
  // repository; sitenav.js joins it in the browser and builds the mailto link only on use.
  contact: ['vassil', 'kateliev.com'],
};

// Languages.
//   ready:   complete strings; picked automatically from the browser language.
//   partial: some strings (missing ones fall back to English); selectable in the menu.
//   neither: listed in the menu as "soon" and disabled. ?lang=xx still forces it for testing.
export const LANGS = [
  { code: 'en', label: 'English', ready: true },
  { code: 'bg', label: 'Български', ready: true },
];
export const DEFAULT_LANG = 'en';

// Second language shown in small type next to part names (a glossary aid).
// English readers see the Bulgarian term; everyone else sees the English term.
export const glossFor = lang => (lang === 'en' ? 'bg' : 'en');

// Microsites. Each one is a folder at the site root (<id>/) with its own pages,
// strings (<id>/i18n/<lang>/*.json) and theme (<id>/site.css).
//   pages:  the microsite's tabs, in order. `path` is relative to the microsite folder.
//           Tab labels come from <id>/i18n/<lang>/site.json → nav.<page id>.
//   ready:  false = planned; not shown on the landing page.
//   card:   picture on the landing page (relative to the site root).
export const MICROSITES = [
  {
    id: 'drazki', path: 'drazki/', ready: true, card: 'drazki/card.jpg',
    pages: [
      { id: 'ship', path: '' },
      { id: 'story', path: 'story/' },
    ],
  },
];
