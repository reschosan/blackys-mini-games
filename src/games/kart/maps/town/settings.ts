import { DEFAULT_SHOULDER, surfaceStyle } from '../shared/mapDefaults';
import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import { TOWN_WIDTH } from './course';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const TOWN_MAP = {
  name: 'Mittelalterstadt',
  lapCount: 2,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Kanonenkugel', vacuum: 'Zauberwirbel', gravity: 'Schwebezauber', cowpat: 'Pferdeapfel' },
  itemLooks: {
    yarn: { shape: 'cannonball', color: 0x2b2f38, accent: 0x2b2f38, ownerTint: 0.2 },
    vacuum: { style: 'swirl', color: 0xc58cff, accent: 0xff9be0 },
    gravity: { style: 'runes', color: 0x9a6bff, accent: 0xffd36b },
    cowpat: { style: 'droppings', color: 0x5a3a1e, accent: 0x6f4a2a },
  },
  shoulder: DEFAULT_SHOULDER,
  aiPaceFactors: { hard: 0.9, medium: 0.89, easy: 0.88 },
  aiOffCourseMeters: TOWN_WIDTH / 2,
  skyColor: 0xa9c9e8,
  lighting: { hemisphereSky: 0xdfeaff, hemisphereGround: 0x5c5448, hemisphereIntensity: 2, sunColor: 0xffe9c4, sunIntensity: 1.3 },
  placements: [
    { type: 'boostField', id: 'town-gate-nitro', level: 0, meter: 60 },
    { type: 'itemJump', id: 'town-market-jump', level: 0, meter: 196, item: 'random' },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 300, length: 8 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 520, length: 8 },
    { type: 'itemJump', id: 'town-bridge-jump', level: 0, meter: 960, item: 'random' },
    { type: 'boostField', id: 'town-harbour-nitro', level: 0, meter: 1070 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 1105, length: 8 },
    { type: 'itemBoxes', level: 0, meter: 70, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 360, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 520, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 740, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1000, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1160, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1530, items: ['random', 'random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const TOWN_APPEARANCE = {
  ground: surfaceStyle({ color: 0x7a9a58, tileMeters: 16, textureSize: 256 }),
  route: surfaceStyle({ color: 0xb9b2a4, tileMeters: 6, textureSize: 256 }),
  wall: surfaceStyle({ color: 0xcfc6b4, tileMeters: 6, textureSize: 256 }),
  wallHeightMeters: 2.4,
  stall: { woodColor: 0x8a6238, awningColors: [0xc0392b, 0xe8e0cc, 0x2f6fb0], width: 8, depth: 4, height: 3.4 },
  banners: { colors: [0xb3202a, 0x1f4f9c, 0xe0b32a], spacingMeters: 40, heightMeters: 7 },
} as const;
