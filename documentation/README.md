# Edugraphica — how the site is built

A static site for GitHub Pages with **no build step**: plain HTML, CSS and ES modules.
three.js comes from a CDN through an import map in each 3D page (pinned `three@0.147.0`).
The 3D explorer, the look and the interface come from [youngsails.org](https://youngsails.org)
(same author) and were made model-agnostic here.

## Folder map

```
index.html                 landing page: one card per microsite (from MICROSITES in config.js)
404.html                   "page not found" (root-absolute links; GitHub Pages serves it for any missing path)
CNAME, .nojekyll           GitHub Pages settings

assets/                    SHARED by every page — the single source of truth for look and behaviour
  css/tokens.css           colours, fonts, radii, spacing as CSS variables (light + dark); the only place fonts load
  css/base.css             reset + shared components: .panel .btn .tg .seg .chip .spec .callout .check, site nav, footer
  css/explorer.css         layout of 3D explorer pages
  css/article.css          layout of story / text pages
  css/landing.css          layout of the landing page
  js/core/config.js        SITE (name, owner, licences), LANGS, MICROSITES (+ their pages)
  js/core/i18n.js          language choice, string loading with English fallback, t(), applyDom()
  js/core/sitenav.js       navigation bar (site mark, microsite tabs, language menu) and the footer
  js/explorer/             reusable 3D explorer: stage.js, registry.js, ui.js, geometry.js, explorer.js
  js/pages/article.js      story page renderer;  js/pages/landing.js  landing cards
  icons/, fonts/, img/     shared files
i18n/<lang>/common.json    site-wide interface words (buttons, footer, errors)

<microsite>/               one folder per topic, e.g. drazki/
  index.html               main page (for Drazki: the 3D explorer)
  site.css                 the microsite's theme: overrides tokens for this microsite only
  card.jpg                 picture on the landing page
  model/                   3D model (parts.js = part list, <name>.js = geometry)
  i18n/<lang>/site.json    microsite name, tagline, landing-card text, tab labels
  i18n/<lang>/<ns>.json    one file per page (ship.json, story.json …)
  <page>/index.html        sub-pages (drazki/story/)

documentation/             this folder (public); documentation/private/ is gitignored
tools/serve.py             local preview server (no-cache);  tools/i18n_check.py  translation checker
```

Folder names at the root that are **not** microsites: `assets`, `i18n`, `documentation`, `tools`.

## One look, three levels of styling

Every page loads, in this order:

1. `assets/css/tokens.css` + `assets/css/base.css` — the whole site.
2. One layout file — `explorer.css`, `article.css` or `landing.css`.
3. `<microsite>/site.css` — this microsite and all its sub-pages, nothing else.

To change the look of **everything**, edit the tokens. To change **one microsite** (for example its
accent colour), override tokens in its `site.css`. Pages never restyle shared components and never use
raw colours. The navigation bar and the footer are built by `sitenav.js`, so they are the same everywhere.

## Text and languages

- All visible text is in JSON. English is the source and the fallback; a missing Bulgarian string shows in English.
- `?lang=bg` forces a language; the choice is saved (`localStorage` key `eg.lang`) and carried by every link.
- English pages show the Bulgarian part name in small type under each name, and Bulgarian pages show the English one (`glossFor` in config.js).
- Keys starting with `_` are notes for translators. Plurals: `{"one": "…", "other": "…"}`, chosen with `Intl.PluralRules` from `vars.n`.
- Check translations: `python tools/i18n_check.py -v`.

## The 3D explorer

A page calls

```js
startExplorer({ site: 'drazki', ns: 'ship', createModel, parts: PARTS, groups: GROUPS })
```

`createModel({ registry, M, t, lang })` builds the model and returns (see the header of `assets/js/explorer/explorer.js`):

| Field | Meaning |
|---|---|
| `root` | the THREE.Group of the model; metres; +x forward, +y up (0 = waterline), +z right (starboard) |
| `waterline` | `{x0, x1, hb[]}` footprint at the waterline, so the water is hidden inside the hull |
| `floorY`, `home` | studio floor height; home camera `{pos, target}` |
| `stage` | options for the scene: `scale` (1 = dinghy, 4.5 = Drazki: scenery, fog, waves and shadows grow), camera `view` limits, `shadowMap` |
| `controls` | toolbar controls the model adds: `range` (slider with a readout), `toggle`, `button` |
| `update(time, dt, state)` | animation step |
| `anchor`, `labelHidden`, `onMode`, `bindUI`, `redraw` | optional hooks (label positions, hiding labels, scene changes, UI access, repaint after fonts load) |

Register every mesh with `registry.add(parent, partId, object, options)`. Each part gets its own
material copies, so it can glow when selected and fade when another part is selected. Part ids must
match the keys under `parts` in the model's strings. A material with `userData.cut = '<key>'` is
clipped by the planes the model passes to `registry.setCut({ <key>: planes })` — this is how the
Drazki cutaway works.

## Adding a microsite

1. Create `<id>/` with `index.html` (copy `drazki/index.html`; change the imports, `site` and `ns`), `site.css`, `card.jpg`.
2. Add `<id>/i18n/en/site.json` (name, tagline, card, nav) and one JSON per page; then the Bulgarian files.
3. Add the microsite to `MICROSITES` in `assets/js/core/config.js` with its pages. The landing page and the tabs update by themselves.
4. Run `python tools/i18n_check.py` and test through `python tools/serve.py`.

## Running locally

```bash
python tools/serve.py 8130
```

Open <http://127.0.0.1:8130/>. Pages use ES modules and load JSON, so they do not work from `file://`.
Debug handle on 3D pages: `window.edugraphica` (stage, registry, model, state, ui).
