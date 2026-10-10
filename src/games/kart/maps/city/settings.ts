import { DEFAULT_SHOULDER, surfaceStyle } from '../shared/mapDefaults';
import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import { CITY_WIDTH } from './course';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const CITY_MAP = {
  name: 'Großstadt bei Nacht',
  lapCount: 2,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Kabelknäuel', vacuum: 'Magnetstrahl', gravity: 'Schwebefeld', cowpat: 'Ölfleck' },
  itemLooks: {
    yarn: { shape: 'cable', color: 0x1a2230, accent: 0x2fd6ff, ownerTint: 0.15 },
    vacuum: { style: 'stripes', color: 0x2fd6ff, accent: 0xff4fd8 },
    gravity: { style: 'forcefield', color: 0x2fd6ff, accent: 0xff4fd8 },
    cowpat: { style: 'oil', color: 0x0b0a14, accent: 0x7a4dff },
  },
  shoulder: DEFAULT_SHOULDER,
  aiPaceFactors: { hard: 0.9, medium: 0.89, easy: 0.88 },
  aiOffCourseMeters: CITY_WIDTH / 2,
  skyColor: 0x070a1f,
  lighting: { hemisphereSky: 0x7f8cff, hemisphereGround: 0x1a1a2e, hemisphereIntensity: 1.5, sunColor: 0x9fb0ff, sunIntensity: 0.9 },
  placements: [
    { type: 'boostField', id: 'city-start-nitro', level: 0, meter: 50 },
    { type: 'itemBoxes', level: 0, meter: 80, items: ['random', 'random'] },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 140, length: 8 },
    { type: 'boostField', id: 'city-avenue-nitro', level: 0, meter: 220 },
    { type: 'itemJump', id: 'city-ramp-jump', level: 0, meter: 300, item: 'random' },
    { type: 'itemBoxes', level: 0, meter: 520, items: ['random', 'random'] },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 545, length: 8 },
    { type: 'itemBoxes', level: 0, meter: 760, items: ['random', 'random'] },
    { type: 'boostField', id: 'city-west-nitro', level: 0, meter: 850 },
    { type: 'itemBoxes', level: 0, meter: 900, items: ['random', 'random'] },
    { type: 'itemJump', id: 'city-overpass-jump', level: 0, meter: 1000, item: 'random' },
    { type: 'itemBoxes', level: 0, meter: 1080, items: ['random', 'random'] },
    { type: 'boostField', id: 'city-south-nitro', level: 0, meter: 1190 },
    { type: 'itemBoxes', level: 0, meter: 1290, items: ['random', 'random'] },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 1300, length: 8 },
    { type: 'itemBoxes', level: 0, meter: 1520, items: ['random', 'random'] },
    { type: 'surfaceZone', kind: 'puddle', level: 0, meter: 1590, length: 8 },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const CITY_APPEARANCE = {
  ground: surfaceStyle({ color: 0x1b1e2e, tileMeters: 18, textureSize: 256, roughness: 0.8 }),
  route: surfaceStyle({ color: 0x3a3e52, tileMeters: 8, textureSize: 256, roughness: 0.55 }),
  kerb: surfaceStyle({ color: 0x59607a, tileMeters: 6, textureSize: 256, roughness: 0.7 }),
  kerbHeightMeters: 1.4,
  glowLeft: 0x2fd6ff,
  glowRight: 0xff4fd8,
  centreDashes: { color: 0xf0e6a0, spacingMeters: 10, lengthMeters: 4, widthMeters: 0.6, cornerClearanceMeters: 16, obstacleClearanceMeters: 14 },
  barrier: { color: 0x8f96a8, stripeColor: 0xf2b21a, beacon: 0xff3b30, height: 2.2 },
  parkGrid: { spacingMeters: 14, widthMeters: 0.45, colors: [0x2fd6ff, 0xff4fd8] },
  skyline: {
    cellMeters: 30,
    fillShare: 0.85,
    clearanceMeters: 20,
    minHeight: 28,
    maxHeight: 90,
    minFootprint: 14,
    maxFootprint: 22,
    windowColor: 0xffe7a1,
    windowColorCool: 0x8fe9ff,
  },
} as const;
