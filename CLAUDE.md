# Edugraphica — notes for Claude and other agents

**Start every session by reading `.claude/memory/MEMORY.md`.** It is the project memory: goal, history,
plan and open tasks. It is local to the owner's machine and gitignored; if it is missing, rely on this
file, the README and `documentation/README.md`.

Keep the memory current: when you finish meaningful work, update `history.md` and `roadmap.md` there
(absolute dates, short entries).

## Conventions

- Static site for GitHub Pages, **no build step**. Plain ES modules; three.js from the import map in each 3D page (pinned `three@0.147.0`). Do not add a bundler without asking the owner.
- Test through the local server (`python tools/serve.py 8130`, no-cache headers), never `file://`.
- **One look across the site.** Shared CSS/JS in `assets/` is the single source of truth. Style cascade: `tokens.css` + `base.css` (all pages) → one layout file (`explorer.css`, `article.css`, `landing.css`) → `<microsite>/site.css` (that microsite and its sub-pages only). A microsite re-themes itself by overriding tokens in its `site.css`, never by editing `assets/`.
- Navigation and footer come only from `assets/js/core/sitenav.js`; every page has `<nav id="siteNav" class="site-nav panel">` and `<footer id="siteFoot" class="site-foot">`.
- **Microsites** are listed in `MICROSITES` (`assets/js/core/config.js`) with their pages; the landing page and the tabs are built from it.
- **All visible text in JSON**: site-wide in `i18n/<lang>/`, per microsite in `<microsite>/i18n/<lang>/`. English is the source and fallback; Bulgarian is complete and must stay complete (`python tools/i18n_check.py`).
- Audience 7–21+: plain, clear sentences, not childish. Bulgarian texts use Bulgarian naval terms; flag doubtful terms for the owner.
- Facts must come from sources; record them in `documentation/<topic>-sources.md`, and say in the text when sources disagree.
- 3D models: realistic but clean, "Zwift-like" (not boxy, not over-detailed). Build to drawings, measure, and verify visually from several angles.
- Every first-party JS file starts with the `/*! edugraphica.org … PolyForm` header; every JSON string file has a `_license` key.
- Commit or push only when the owner asks.
