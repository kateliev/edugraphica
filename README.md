# Edugraphica

Interactive 3D models of ships, machines and places from history and science, published at
**[edugraphica.org](https://edugraphica.org)**. Each topic is a small microsite: a 3D model you can
turn, take apart and explore part by part, plus the story around it. For young people from about
7 to 21 and anyone curious, in **English** and **Bulgarian**.

## Topics

- **[Drazki](drazki/)** — the Bulgarian torpedo boat *Дръзки* (Schneider et Cie, 1907–1908).
  A 3D model built from the original builder's drawing, with 44 selectable parts: hull, boilers,
  triple-expansion engine, torpedo tubes, guns, conning tower, crew quarters and more. Set the speed
  (smoke, wake, engine and propeller move), turn the twin torpedo tube and fire, or open the cutaway
  to look inside like the museum's cutaway model. A second page tells the story of the night attack on
  the Ottoman cruiser *Hamidiye* on 21 November 1912.

## How it is built

A static site with no build step, served by GitHub Pages from `main`. 3D runs on
[three.js](https://threejs.org), loaded from a CDN. The interface and the 3D explorer come from
[youngsails.org](https://youngsails.org). Shared styles and code live in `assets/`; each microsite has
its own folder with its model, texts and theme. See [documentation/README.md](documentation/README.md)
for the structure and how to add a topic, and [documentation/drazki-sources.md](documentation/drazki-sources.md)
for the sources of the Drazki model.

Run it locally:

```bash
python tools/serve.py 8130
```

Then open <http://127.0.0.1:8130/>. Add `?lang=bg` for Bulgarian.

## License

© 2026 Vassil Kateliev · edugraphica.org

**Code** — including the procedural 3D models — is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE).
**Content** — text, descriptions, translations and images — is licensed
under [CC BY-NC-SA 4.0](LICENSE-CONTENT).

Free for personal, educational and classroom use.
Commercial use, including resale or placing this material behind a
paywall, requires written permission.
