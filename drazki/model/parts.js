/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Drazki — part catalogue (structure only; names and texts are in drazki/i18n/<lang>/ship.json).
// Order = list order and tour order.
//   group   key into i18n "groups"
//   off     where the part moves in the exploded view (metres; +x bow, +y up, +z starboard)
//   label   shown when "Labels" is on
//   inside  below decks: its label shows only in the cutaway view
//   parent  the part this one is a detail of (see registry.js)

export const GROUPS = ['hull', 'machinery', 'weapons', 'command', 'deck', 'crew'];

export const PARTS = [
  // hull
  { id: 'hull', group: 'hull', off: [0, 0, 0], label: true },
  { id: 'forecastle', group: 'hull', off: [0, 1.2, 0], label: true },
  { id: 'deck', group: 'hull', off: [0, .6, 0] },
  { id: 'stem', group: 'hull', off: [1.2, 0, 0] },
  { id: 'breakwater', group: 'hull', off: [0, 1.8, 0] },
  { id: 'bulkheads', group: 'hull', off: [0, 0, 0], inside: true, label: true },
  { id: 'portholes', group: 'hull', off: [0, 0, 0] },
  { id: 'nameplate', group: 'hull', off: [1.2, 0, 0], label: true },
  // machinery
  { id: 'boilers', group: 'machinery', off: [0, 6.5, 0], inside: true, label: true },
  { id: 'coalBunkers', group: 'machinery', off: [0, 4.2, 0], inside: true },
  { id: 'engine', group: 'machinery', off: [0, 7, 0], inside: true, label: true },
  { id: 'condenser', group: 'machinery', off: [0, 5.2, -1.6], inside: true },
  { id: 'shaft', group: 'machinery', off: [0, -1.2, 0], label: true },
  { id: 'propeller', group: 'machinery', off: [-2.2, -1, 0], label: true },
  { id: 'rudder', group: 'machinery', off: [-3, 0, 0], label: true },
  { id: 'funnels', group: 'machinery', off: [0, 4.5, 0], label: true },
  { id: 'shellHole', group: 'machinery', off: [0, 0, 0], parent: 'funnels', sub: true, label: true },   // moves with its funnel
  { id: 'ventilators', group: 'machinery', off: [0, 3.2, 0] },
  { id: 'skylight', group: 'machinery', off: [0, 2.6, 0] },
  // weapons
  { id: 'twinTubes', group: 'weapons', off: [0, 3.4, 0], label: true },
  { id: 'bowTube', group: 'weapons', off: [3.5, 1.5, 0], label: true },
  { id: 'torpedo', group: 'weapons', off: [0, 2.4, 0], label: true },
  { id: 'torpedoDavit', group: 'weapons', off: [0, 2.2, 1.2] },
  { id: 'foreGun', group: 'weapons', off: [0, 3, 0], label: true },
  { id: 'aftGun', group: 'weapons', off: [-1, 3, 0], label: true },
  { id: 'magazine', group: 'weapons', off: [0, 5.5, 0], inside: true },
  // command and navigation
  { id: 'conningTower', group: 'command', off: [0, 3.2, 0], label: true },
  { id: 'wheel', group: 'command', off: [0, 3.2, 0] },
  { id: 'compass', group: 'command', off: [0, 4.4, 0] },
  { id: 'telegraph', group: 'command', off: [0, 2.6, 1] },
  { id: 'mast', group: 'command', off: [0, 5.5, 0], label: true },
  { id: 'searchlight', group: 'command', off: [0, 4.8, 0] },
  { id: 'navLights', group: 'command', off: [0, 3.6, 0] },
  { id: 'ensign', group: 'command', off: [-1.5, 2, 0], label: true },
  // deck equipment
  { id: 'anchors', group: 'deck', off: [0, 1.6, 0], label: true },
  { id: 'windlass', group: 'deck', off: [0, 1.9, 0] },
  { id: 'bollards', group: 'deck', off: [0, 1.2, 0] },
  { id: 'rails', group: 'deck', off: [0, 1, 0] },
  { id: 'hatches', group: 'deck', off: [0, 1.6, 0] },
  { id: 'dinghy', group: 'deck', off: [0, 2.6, -1.5], label: true },
  { id: 'lifebuoys', group: 'deck', off: [0, 1.4, 0] },
  // life on board
  { id: 'crewQuarters', group: 'crew', off: [0, 5.5, 0], inside: true, label: true },
  { id: 'wardroom', group: 'crew', off: [0, 5, 0], inside: true, label: true },
  { id: 'galley', group: 'crew', off: [0, 3, 0], label: true },
];
