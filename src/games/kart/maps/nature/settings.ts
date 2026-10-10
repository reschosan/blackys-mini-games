import { DEFAULT_SHOULDER, surfaceStyle } from '../shared/mapDefaults';
import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import { NATURE_WIDTH } from './course';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const NATURE_MAP = {
  name: 'Naturpfad',
  lapCount: 2,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Wollknäuel', vacuum: 'Laubbläser', gravity: 'Schwebepilz', cowpat: 'Bärenhaufen' },
  itemLooks: {
    vacuum: { style: 'swirl', color: 0xd9a21b, accent: 0x6b8e23 },
    gravity: { style: 'runes', color: 0xe05a47, accent: 0xfff3d6 },
    cowpat: { style: 'droppings', color: 0x3b2a1a, accent: 0x4a3522 },
  },
  shoulder: DEFAULT_SHOULDER,
  aiPaceFactors: { hard: 0.89, medium: 0.88, easy: 0.875 },
  aiOffCourseMeters: NATURE_WIDTH / 2,
  skyColor: 0x86c8ef,
  placements: [
    { type: 'boostField', id: 'nature-meadow-nitro', level: 0, meter: 40 },
    { type: 'itemJump', id: 'nature-forest-item-jump', level: 0, meter: 405, item: 'random' },
    { type: 'boostField', id: 'nature-forest-nitro', level: 0, meter: 615 },
    { type: 'surfaceZone', kind: 'mud', level: 0, meter: 360, length: 20 },
    { type: 'surfaceZone', kind: 'mud', level: 0, meter: 992, length: 30 },
    { type: 'surfaceZone', kind: 'mud', level: 0, meter: 1455, length: 20 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 520, length: 8 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 1295, length: 8 },
    { type: 'itemBoxes', level: 0, meter: 50, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 455, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 830, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1395, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1780, items: ['random', 'random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const NATURE_APPEARANCE = {
  route: surfaceStyle({ color: 0xffffff, tileMeters: 6 }),
  bark: surfaceStyle({ colorLight: 0xb08a60, colorDark: 0xa07850, repeatAround: 4, textureSize: 256 }),
  ground: surfaceStyle({ color: 0xffffff, tileMeters: 12 }),
  flowerFields: { lengthMeters: 30, spacingMeters: 0.9, heightMeters: 1.0 },
  lawn: { spacingMeters: 0.5, tuftWidthMeters: 0.8, tuftHeightMeters: 0.4, color: 0x7fae52 },
  birds: {
    flocks: 16,
    birdsPerFlock: 2,
    bodyLengthMeters: 2.6,
    altitudeMeters: { min: 5, max: 10 },
    orbitRadiusMeters: { min: 10, max: 22 },
    speedMetersPerSecond: { min: 5, max: 8 },
    flapHertz: 3.2,
    bankRadians: 0.4,
    /** Songbird colors by species: sparrow, robin, blue tit and blackbird. Flocks take turns. */
    species: [
      { name: 'Spatz', back: 0x8b6b4a, belly: 0xd9cdb8, breast: 0xc2ad8c, beak: 0x4a4036, tail: 0x6b5238, wing: 0x7a5c3e },
      { name: 'Rotkehlchen', back: 0x7a6248, belly: 0xeee6d8, breast: 0xe0662f, beak: 0x2c2a28, tail: 0x66503a, wing: 0x6e563c },
      { name: 'Blaumeise', back: 0x5a8fc4, belly: 0xf1d94e, breast: 0xf1d94e, beak: 0x33322e, tail: 0x4a78a8, wing: 0x4f80b3 },
      { name: 'Amsel', back: 0x2b2a2e, belly: 0x3a393e, breast: 0x333237, beak: 0xf0a21a, tail: 0x26252a, wing: 0x26252a },
    ],
  },
} as const;
