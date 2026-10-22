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
| `stage` | options for the scene: `scale` (1 = dinghy, 4.5 = Drazki: scenery, fog, waves and shadows grow), camera `view` limits, `shadowMap`, `waterAlpha` (how opaque the sea is next to the model; default 0.56), `palette` (base sky, sea and light), `palettes` (scene colour presets; with two or more the toolbar shows swatches, names in `looks.<key>`), `scenery: false` (no default islands and clouds; the model adds its own backdrop to `stage.scenery` and recolours it with `stage.onPalette`), `ground: { y }` (a model on land, e.g. a building: no sea, a plain far ground at height `y` coloured `palette.ground`; the model adds its own terrain to `stage.scenery`; the toolbar's first scene button then reads `ui.site`) |
| `controls` | toolbar controls the model adds: `range` (slider with a readout), `toggle`, `button` |
| `update(time, dt, state)` | animation step |
| `anchor`, `labelHidden`, `onMode`, `bindUI`, `redraw` | optional hooks (label positions, hiding labels, scene changes, UI access, repaint after fonts load) |

Large plain surfaces get procedural **surface noise** from `assets/js/explorer/surface.js`:
`addSurfaceNoise(material, { mottle, color, rough, wave, waveFreq, dent, dentFreq, streak, streakFreq, peel, peelFreq, peelRough })`
adds soft gloss patches, a gentle waviness of the plating and smaller dents (seen only in highlights and
reflections), faint vertical weathering streaks on upright faces, and a fine orange peel that turns into roughness when it is smaller than a pixel. It is computed in the shader from the mesh's
own coordinates (no textures, no UVs). Add `?noise=0` to the address to compare without it;
`window.edugraphica.noise.value` (0…1) changes it live.

Register every mesh with `registry.add(parent, partId, object, options)`. Each part gets its own
material copies, so it can glow when selected and fade when another part is selected. Part ids must
match the keys under `parts` in the model's strings. A material with `userData.cut = '<key>'` is
clipped by the planes the model passes to `registry.setCut({ <key>: planes })` — this is how the
Drazki cutaway works. Keep the number of planes the same when the cut is closed (planes that clip
nothing), so switching it on and off never rebuilds the shaders.

**Exploded view.** Each part moves by its `off` from `parts.js`. `registry.setSpread([x, y, z])` adds a
radial move: every object also moves by that share of its own distance from the model's centre (Drazki:
20 % along the length), so the parts open fore and aft, not only upward. A part with `split: true` has a
copy on each side (two guns, two boats): each direct child of its object moves on its own, and `off[2]`
sends it out to its own side. `spread: 0` keeps a part out of the radial move (hull, decks, details that
ride on their parent).

**Speed.** Most of the load time is compiling shaders, and every shader counts: on a computer that has
not seen the page before, each one costs a few tenths of a second, and one built in the middle of a frame
costs far more. So the explorer compiles, in one batch before the first frame, only the shaders of what is
visible (`precompile` in `explorer.js`); the hidden groups (studio floor, cutaway, people) follow one at a
time in idle moments after the first view is on screen. Keep the number of different shaders low: surface
noise settings are uniforms, so all noisy materials share a shader. Things that change the shader of every
material — adding or removing fog or lights, changing the number of clipping planes — would force a
rebuild; change their values instead (the Studio pushes the fog out of reach rather than removing it).
Drazki hides everything below decks outside the cutaway (parts with `inside: true` and the inside face of
the hull plating). To test a first visit, make every shader new: add a random comment to
`THREE.ShaderChunk.common` before the model starts (the browser keeps compiled shaders between visits).

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
