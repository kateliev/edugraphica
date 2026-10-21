# Drazki — sources and modelling notes

Facts, figures and drawings behind the Drazki microsite (`drazki/`): the 3D model
(`drazki/model/drazki.js`), the part texts (`drazki/i18n/*/ship.json`) and the
story page (`drazki/i18n/*/story.json`).

## Sources

| Source | Used for |
|---|---|
| *Torpedo-boats and slipway for the Bulgarian Government, constructed by Messrs. Schneider and Co., Creusot and Chalon-sur-Saône* — general arrangement published in *Engineering* (c. 1908). Wikimedia Commons: [Drazki_type_torpedo-boad.jpg](https://commons.wikimedia.org/wiki/File:Drazki_type_torpedo-boad.jpg) | Hull profile, deck plan, two sections (Fig. 4, Fig. 5); length 38.000 m, beam 4.400 m, draught ≈ 1.33 m, 2.63 m to the propeller tip; positions of every deck item |
| Cutaway builder's model, Naval Museum, Varna. Commons: [Drazki_model_Varna_IMG_151402320crw.jpg](https://commons.wikimedia.org/wiki/File:Drazki_model_Varna_IMG_151402320crw.jpg), [Drazki_model_Varna_IMG_151412004.jpg](https://commons.wikimedia.org/wiki/File:Drazki_model_Varna_IMG_151412004.jpg) | Boiler and engine layout, cowls (red inside), nets, spare torpedoes, galley box, dinghy, the cutaway idea |
| Museum ship photos (Commons: *Drazki_port_P190724.jpg*, *Drazki_deck_154432905_HDR.jpg*, *Drazki_deck_154439947.jpg*, *Drazki_deck_154041144.jpg*, *Museum_ship_Daring_(Дръзки)_(23504784269).jpg*, *Drazki-VNmuseum.jpg*) | Colours (grey, red bottom, white boot-top, red-brown deck), nameplate, bow-tube cap, anchor davit, twin-tube turntable and "spoon", galley stove, skylight deck lights |
| V. Draganov, "„Дръзки" в трето измерение – дигитална реконструкция" (Morski vestnik, 9 Nov 2025): [PDF](https://morskivestnik.com/compass/news/2025/112025/images/Drazki-digital_09112025.pdf); summary on [maritime.bg](https://www.maritime.bg/144716/) | An Autodesk Inventor reconstruction based on the 1972 *Modelist-Konstruktor* drawings, French archive drawings and museum photos. It includes the French midship section "Coupe au Maître" of the Schneider 38 m torpilleurs No 315…: beam 4.400 m, depth 2.750 m, draught 1.220 m, a wooden rubbing strake 0.40 m above the waterline, an elliptical lower hull and tumblehome topsides. Engineering Fig. 5 gives the same draught (1.220); the 1.330 on the Engineering profile is the depth of the rudder foot. The text says the Bulgarian boats differ from French type 315 mainly in machinery and deck openings. |
| Museum ship photos supplied by the owner (2026-10-20): starboard side by the funnels; inside the conning tower | One 47 mm gun only, on a small sponson on the starboard side between the funnels, just forward of the cowl, with the rail net bulging round it. Engineering (1908), navypedia and the CAD reconstruction have two 47 mm guns; since 2026-10-21 the model follows them (owner) and the text says the museum ship has one. Conning tower inside: three fan-shaped front windows with hinged armour flaps, the main wheel on the front wall, the binnacle (two iron balls, brass bars) aft of it, red floor. |
| [navypedia: Druzki class](https://navypedia.org/ships/bulgaria/bu_dd_drzki.htm) | 97.5 t; 38.0 × 4.40 × 1.30 m (2.40 max); 1 shaft, 1 VTE, 2 Normand boilers, 1950 hp, 26 kn; 11 t coal, 500 nm at 16 kn; 2 × 47/50 M1902; 1 twin 450 mm tube + 1 bow 450 mm tube; crew 27–32; later changes (1919, 1924, 1934, 1942) |
| [Wikipedia (en): Bulgarian torpedo boat Drazki](https://en.wikipedia.org/wiki/Bulgarian_torpedo_boat_Drazki) | Sister ships, 1912 attack (00:43, ≈ 32 miles, ≈ 100 m, Dobrev, Kupov), 1942 magazine explosion, museum ship (Strogi carries Drazki's gun and funnel) |
| [Уикипедия (bg): Дръзки (миноносец)](https://bg.wikipedia.org/wiki/Дръзки_(миноносец)) | Bulgarian terms, Kupov's rank (мичман I ранг), Hamidiye casualties (8 killed, ≈ 30 wounded), Vaptsarov 1930–1931 |
| [Varna Eye: Engagement by the Druzki](https://www.varnaeye.com/history/engagement-by-the-druzki/) | Departure 22:30, sighting ≈ 00:30, attack signal 00:40, distances (Letyashti 500–600 m, Drazki 50–60 m), breach ≈ 10 m², shell fragment through the funnel, Kupov at the 1957 opening |
| [Naval Museum Varna](https://museummaritime-bg.com/en/expositions/the-drazki-battleship-museum/), [visit.varna.bg](https://visit.varna.bg/en/dryzki.html) | The hole in the **second** funnel, museum opening 21 Nov 1957 |
| [FOTW: Bulgarian naval ensign](https://www.fotw.info/flags/bg~1908.html), [Wikipedia: List of Bulgarian flags](https://en.wikipedia.org/wiki/List_of_Bulgarian_flags) | Ensign 1879–1944: white–green–red with a red canton (half the hoist) and a golden crowned lion |
| [Naval ensign of Bulgaria (1878–1944).svg](https://commons.wikimedia.org/wiki/File:Naval_ensign_of_Bulgaria_(1878%E2%80%931944).svg) — Wikimedia Commons, public domain | The flag picture on the model: rasterised to `drazki/model/ensign.png` (1024 × 618) |

## Where sources disagree

- **Launch date**: 10 Aug 1907 (navypedia) vs. "August 1900" (Wikipedia infobox). The site says "built 1907–1908".
- **Torpedo tubes**: 450 mm (navypedia, museum) vs. 460 mm (Wikipedia). The site uses 450 mm.
- **Drazki's firing distance**: ≈ 100 m (Wikipedia, museum) vs. 50–60 m (Varna Eye, bg Wikipedia). The texts say "about 100 metres, some accounts say only 50 or 60".
- **Bulgarian casualties**: one wounded on Smeli (bg Wikipedia) vs. one killed (Varna Eye). The texts only say Smeli was hit and damaged.
- **Armament after 1934**: 37 mm guns *added* (navypedia) vs. 47 mm *replaced* (Wikipedia). The texts follow navypedia.
- **Hamidiye's repairs**: some pages say she was out "for the rest of the war"; she was back at sea in early 1913. The texts say "spent weeks under repair".

## Numbers used in the model (measured off the 1908 drawing)

Units: metres. `xa` = distance forward of the stern; height above the waterline.

| Item | Position / size |
|---|---|
| Hull | LOA 38.0, beam 4.4, keel 1.33 below WL from xa 13 to 33.5; counter stern bottom 0.5 above WL at xa 0 |
| Deck crown | 1.12 (stern) → 1.5 (amidships) → 1.97 (forecastle at xa 27.3) → 1.86 (stem) |
| Section | egg-shaped (Fig. 5): widest ≈ 0.5 above WL amidships; rounded deck edge; turtle-back forecastle forward of xa 26.6 |
| Rudder | hung outboard aft of the stern, xa −0.85 … +0.25, WL+0.3 … −1.4 |
| Propeller | xa 0.95, shaft axis 1.3 below WL, Ø ≈ 1.8 (tip ≈ 2.2–2.3 below WL), 3 blades |
| Shaft | engine crank (xa 10.4, −0.78) to propeller; leaves the hull at ≈ xa 7; bracket at xa 2.1 |
| Boilers | aft xa 17.3–19.7 (fires forward), forward xa 22.6–25.0 (fires aft); stokehold between |
| Funnels | xa 19.4 (second / aft, with the shell hole) and 22.9 (first); Ø 0.84; top 3.95 above WL; rake 4° |
| Engine | 3 cylinders at xa 13.2 / 12.2 / 11.1 (HP / IP / LP) |
| Conning tower | xa 26.0–27.75, top 3.25 above WL |
| Mast | xa 25.45, top ≈ 11.4 above WL, rake 2.5° |
| Twin tube | turntable at xa 10.9; two 5.5 m tubes side by side, **facing opposite ways** (navypedia: "angled to opposite sides"), so a turned mount aims one tube to each side; axis ≈ 2.5 above WL |
| Bow tube | xa 32.6 to the stem, axis 1.42 above WL |
| Guns | two 47 mm, one each side, opposite each other at xa 24.88; each stands half on the hull side, half on a perforated wing 0.3 wide (edge − 0.1), xa 22.7–25.85, both trained forward (CAD reconstruction, Draganov 2025; owner 2026-10-21: the perspective CAD view looked staggered, the owner set them opposite). The builder's drawing has the forward gun on the boiler casing at xa 24.45 and one aft at xa 2.35 |
| Engine telegraph | inside the conning tower, port forward corner beside the wheel (owner) |
| Searchlight | on the forecastle at xa 29.35 |
| Bulkheads | xa 4.0, 9.6, 16.8, 25.6, 28.2, 35.2 |
| Funnel casings | aft xa 17.0–20.15, 1.8 wide, top 1.98 above WL; forward xa 21.85–24.3; the stokehold hatch and the ventilator stand in the gap (CAD plan, Draganov 2025) |
| Engine-room skylight | xa 12.62–17.05, 1.8 wide, top 1.84 (a step below the aft casing, which it butts onto). Flat hatches from aft: 0.98 m (3 + 3 deck lights), 0.78 m (2 + 2, spaced out), 0.6 m (2 + 2, close together), each 1.5 m wide; V-handle hatch (0.7 × 0.66, three deck lights) in the forward starboard corner; a second one on the deck at xa 12.24, starboard, V pointing inboard (CAD plan, measured at ≈ 40 px/m). The CAD shows the skylight ≈ 0.15 m to starboard of the centreline, and the model follows it (its starboard side stands 0.15 m out past the aft casing) |
| Ventilator | plain round pipe Ø 0.84 with a quarter bend, a short lip and a rolled rim (owner's notes) |

## Approximations and choices

- Hull curves are monotone splines fitted to the drawing; no offsets table has been published.
- The model shows the boat **as built (1908–1912)**: two 47 mm guns, three tubes, no minesweeping gear, no depth-charge rails.
- Colours follow the museum ship today; the 1912 colour scheme is not documented. The sea uses a darker "Black Sea" palette (`stage.palette` in the model).
- Propeller diameter, the exact shape of the cowls, the interior furniture and the anchor type are estimates.
- The museum ship is the hull of the sister ship **Strogi** with Drazki's funnel, gun and fittings.
- Bulgarian naval terms in `drazki/i18n/bg/` should be checked by a naval historian or the Naval Museum before release.
