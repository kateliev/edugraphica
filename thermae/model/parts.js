/*! edugraphica.org · © 2026 Vassil Kateliev
 *  PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0
 *  Commercial use requires permission. See README for permitted uses. */
// Roman Thermae of Odessos — part catalogue (structure only; names are in thermae/i18n/<lang>/thermae.json).
// Order = list order and tour order: the way a bather went, from the street to the hot room.
//   group   key into i18n "groups"
//   label   shown when "Labels" is on
// A room part is its floor and its vault; in the exploded view the vaults and roofs lift off
// (thermae.js gives them their own offset), the rest stays in place.

export const GROUPS = ['town', 'rooms', 'baths', 'service', 'structure'];

export const PARTS = [
  { id: 'portico', group: 'town', label: true },
  { id: 'shops', group: 'town', label: true },
  { id: 'vestibules', group: 'rooms', label: true },
  { id: 'basilica', group: 'rooms', label: true },
  { id: 'apodyteria', group: 'rooms', label: true },
  { id: 'frigidarium', group: 'baths', label: true },
  { id: 'tepidarium', group: 'baths', label: true },
  { id: 'caldarium', group: 'baths', label: true },
  { id: 'heatedRooms', group: 'baths', label: true },
  { id: 'pools', group: 'baths', label: true },
  { id: 'praefurnium', group: 'service', label: true },
  { id: 'latrines', group: 'service', label: true },
  { id: 'walls', group: 'structure' },
];
