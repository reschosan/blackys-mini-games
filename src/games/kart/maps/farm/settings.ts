import { DEFAULT_SHOULDER, surfaceStyle } from '../shared/mapDefaults';
import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import { FARM_WIDTH } from './course';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const FARM_MAP = {
  name: 'Bauernhof',
  lapCount: 2,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Heuballen', vacuum: 'Heugebläse', gravity: 'Hühnerschwarm', cowpat: 'Kuhfladen' },
  itemLooks: {
    yarn: { shape: 'bale', color: 0xd9b24a, accent: 0x8c6b2a, ownerTint: 0.25 },
    vacuum: { style: 'stripes', color: 0xe8c85a, accent: 0xfff4cf },
    gravity: { style: 'swarm', color: 0xfff0a0, accent: 0xf2b21a },
    cowpat: { style: 'heap', color: 0x6b4423, accent: 0x6b4423 },
  },
  shoulder: DEFAULT_SHOULDER,
  aiPaceFactors: { hard: 0.9, medium: 0.89, easy: 0.88 },
  aiOffCourseMeters: FARM_WIDTH / 2,
  skyColor: 0x9fd3f2,
  lighting: { hemisphereSky: 0xcfe8ff, hemisphereGround: 0x6b5a3c, hemisphereIntensity: 2, sunColor: 0xfff1d0, sunIntensity: 1.4 },
  placements: [
    { type: 'boostField', id: 'farm-yard-nitro', level: 0, meter: 40 },
    { type: 'itemJump', id: 'farm-ramp-jump', level: 0, meter: 130, item: 'random' },
    { type: 'surfaceZone', kind: 'mud', level: 0, meter: 330, length: 20 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 520, length: 8 },
    { type: 'boostField', id: 'farm-meadow-nitro', level: 0, meter: 975 },
    { type: 'surfaceZone', kind: 'mud', level: 0, meter: 1060, length: 20 },
    { type: 'itemJump', id: 'farm-hay-jump', level: 0, meter: 1210, item: 'random' },
    { type: 'boostField', id: 'farm-mill-nitro', level: 0, meter: 1320 },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 1345, length: 8 },
    { type: 'itemBoxes', level: 0, meter: 60, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 250, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 430, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 620, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1000, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1160, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1470, items: ['random', 'random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const FARM_APPEARANCE = {
  ground: surfaceStyle({ color: 0x78a84a, tileMeters: 16, textureSize: 256 }),
  route: surfaceStyle({ color: 0xb08f62, tileMeters: 10, textureSize: 256 }),
  fenceHeightMeters: 1.6,
  haybale: { color: 0xd9b24a, bandColor: 0x8c6b2a, length: 7, radius: 1.6 },
  furrows: { color: 0x6b4a2b, spacingMeters: 3 },
} as const;
