// Every knob of the Builderland generator. The Build panel is generated from this list.
import { DEFAULT_TIME, LANTERN_GLOW } from './tokens.js';

export const LAND_PARAMS = [
  // Land
  { group: 'Land', key: 'size', label: 'Extra land', type: 'range', min: 0, max: 40, step: 1, default: 6 },
  { group: 'Land', key: 'hills', label: 'Hills', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
  { group: 'Land', key: 'ponds', label: 'Ponds', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  { group: 'Land', key: 'ruins', label: 'Ruins', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  { group: 'Land', key: 'fringe', label: 'Forest edge', type: 'toggle', default: true },
  { group: 'Land', key: 'mascot', label: 'Mascot', type: 'select', options: ['panda', 'great tree', 'none'], default: 'panda' },
  { group: 'Land', key: 'pose', label: 'Panda pose', type: 'select', options: ['pencil', 'laptop', 'wave'], default: 'pencil' },
  { group: 'Land', key: 'scarf', label: 'Panda scarf', type: 'color', default: '#E4572E' },
  // Life
  { group: 'Life', key: 'roads', label: 'Road reach', type: 'range', min: 0, max: 4, step: 1, default: 2 },
  { group: 'Life', key: 'cars', label: 'Cars', type: 'range', min: 0, max: 40, step: 1, default: 24 },
  { group: 'Life', key: 'people', label: 'People', type: 'range', min: 0, max: 240, step: 1, default: 90 },
  { group: 'Life', key: 'avatars', label: 'Builders walk their plots', type: 'toggle', default: true },
  { group: 'Life', key: 'parks', label: 'Parks', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
  { group: 'Life', key: 'capybaras', label: 'Hot spring capybaras', type: 'toggle', default: true },
  { group: 'Life', key: 'cats', label: 'Cats on roofs', type: 'toggle', default: true },
  // Signs: the surfaces themselves are edited in Build → Signs
  { group: 'Signs', key: 'blimp', label: 'Blimp (premium slot)', type: 'toggle', default: true },
  { group: 'Signs', key: 'bunting', label: 'Bunting across streets', type: 'toggle', default: true },
  // Nature
  { group: 'Nature', key: 'season', label: 'Season', type: 'select', options: ['spring', 'summer', 'autumn', 'winter'], default: 'summer' },
  { group: 'Nature', key: 'trees', label: 'Trees', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
  { group: 'Nature', key: 'treeSize', label: 'Tree size', type: 'range', min: 0.5, max: 1.8, step: 0.05, default: 1 },
  { group: 'Nature', key: 'flowers', label: 'Flowers', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
  { group: 'Nature', key: 'bushes', label: 'Bushes', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
  { group: 'Nature', key: 'mushrooms', label: 'Mushrooms', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
  { group: 'Nature', key: 'ambient', label: 'Petals, leaves & fireflies', type: 'toggle', default: true },
  // Light
  { group: 'Light', key: 'time', label: 'Time of day', type: 'range', min: 0, max: 1, step: 0.01, default: DEFAULT_TIME },
  { group: 'Light', key: 'sun', label: 'Sun angle', type: 'range', min: 0, max: 360, step: 1, default: 326 },
  { group: 'Light', key: 'lanterns', label: 'Lanterns', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
  { group: 'Light', key: 'lanternColor', label: 'Lantern glow', type: 'color', default: LANTERN_GLOW },
  // Drawing
  { group: 'Drawing', key: 'style', label: 'Style', type: 'select', options: ['moebius', 'ink'], default: 'moebius' },
  { group: 'Drawing', key: 'line', label: 'Line weight', type: 'range', min: 0.6, max: 2.5, step: 0.05, default: 1.3 },
  { group: 'Drawing', key: 'wobble', label: 'Hand wobble', type: 'range', min: 0, max: 3, step: 0.05, default: 1.3 },
  { group: 'Drawing', key: 'hatch', label: 'Hatching', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  { group: 'Drawing', key: 'grain', label: 'Paper grain', type: 'range', min: 0, max: 0.25, step: 0.01, default: 0.09 },
];

/** Fills in defaults and clamps every value to its schema. */
function applySchema(schema, params = {}) {
  const out = Object.fromEntries(schema.map((p) => [p.key, p.default]));
  for (const p of schema) {
    const v = params?.[p.key];
    if (v === undefined || v === null) continue;
    if (p.type === 'range') out[p.key] = Math.min(p.max, Math.max(p.min, +v));
    else if (p.type === 'toggle') out[p.key] = !!v;
    else if (p.type === 'select') out[p.key] = p.options.includes(v) ? v : p.default;
    else out[p.key] = String(v);
  }
  return out;
}

export const landParams = (p) => applySchema(LAND_PARAMS, p);

/** Seasonal palettes: grass, leaves, flowers, ground tint and what falls from the sky. */
export const SEASONS = {
  spring: {
    grass: ['#86B062', '#8FB86A', '#7FA85B', '#97BD70'], leaf: ['#5C8B45', '#6A9A4C', '#F2B5C8', '#F7C9D6', '#E9A3BA'],
    flower: ['#F4A6B8', '#F7D35C', '#FFFFFF', '#B69CF0', '#F7C6D3'], lip: '#6E9A4E', falling: ['#F7C9D6', '#FFFFFF', '#F4A6B8'],
  },
  summer: {
    grass: ['#7EA457', '#86AC5E', '#77A052', '#8DB063', '#80A85A'], leaf: ['#4F7F3E', '#5C8B45', '#3F6E3A', '#6A9A4C', '#557F40'],
    flower: ['#F4A6B8', '#F7D35C', '#FFFFFF', '#E4572E', '#B69CF0', '#F2994A', '#F7C6D3'], lip: '#5E8A45', falling: ['#FFF3B0'],
  },
  autumn: {
    grass: ['#A3A45A', '#ADA862', '#989952', '#B3A865'], leaf: ['#D9823B', '#C8612F', '#E8A83E', '#B5542C', '#8C9A44'],
    flower: ['#F2994A', '#E4572E', '#F7D35C', '#B5542C'], lip: '#8C8A48', falling: ['#D9823B', '#E8A83E', '#C8612F'],
  },
  winter: {
    grass: ['#EEF2F3', '#E6ECEE', '#F4F7F7', '#DDE6E9'], leaf: ['#3F6E5A', '#4A7A66', '#365F4E'],
    flower: ['#FFFFFF', '#CFE3EA'], lip: '#C9D6DA', falling: ['#FFFFFF'],
  },
};
