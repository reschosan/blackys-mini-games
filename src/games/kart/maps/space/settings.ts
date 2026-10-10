import { DEFAULT_SHOULDER, surfaceStyle } from '../shared/mapDefaults';
import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import { SPACE_WIDTH } from './course';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const SPACE_MAP = {
  name: 'Mondbasis',
  lapCount: 2,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Meteorit', vacuum: 'Traktorstrahl', gravity: 'Schwerkraftblase', cowpat: 'Mondschleim' },
  itemLooks: {
    yarn: { shape: 'cannonball', color: 0x6e625a, accent: 0x6e625a, ownerTint: 0.15 },
    vacuum: { style: 'stripes', color: 0x7dffb2, accent: 0xffffff },
    cowpat: { style: 'oil', color: 0x12301a, accent: 0x6dff6d },
  },
  shoulder: DEFAULT_SHOULDER,
  aiPaceFactors: { hard: 0.905, medium: 0.908, easy: 0.903 },
  aiOffCourseMeters: SPACE_WIDTH / 2,
  skyColor: 0x03050f,
  placements: [
    { type: 'boostField', id: 'space-launch-nitro', level: 0, meter: 40 },
    { type: 'surfaceZone', kind: 'moondust', level: 0, meter: 285, length: 24 },
    { type: 'surfaceZone', kind: 'moondust', level: 0, meter: 1010, length: 30 },
    { type: 'surfaceZone', kind: 'moondust', level: 0, meter: 1350, length: 24 },
    { type: 'itemBoxes', level: 0, meter: 420, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 700, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 840, items: ['random', 'random'] },
    { type: 'itemJump', id: 'space-crater-item-jump', level: 0, meter: 945, item: 'random' },
    { type: 'itemBoxes', level: 0, meter: 1190, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1330, items: ['random', 'random'] },
    { type: 'itemBoxes', level: 0, meter: 1610, items: ['random', 'random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const SPACE_APPEARANCE = {
  ground: surfaceStyle({ color: 0x8a8378, tileMeters: 28 }),
  route: surfaceStyle({ color: 0x7f8aa0, tileMeters: 8, textureSize: 256, roughness: 0.75 }),
  hull: surfaceStyle({ color: 0xa9b4c6, tileMeters: 6, textureSize: 256, roughness: 0.6 }),
  hazard: surfaceStyle({ color: 0xf2b21a, roughness: 0.7 }),
  rail: surfaceStyle({ color: 0xb4bfd0, tileMeters: 6, textureSize: 256, roughness: 0.55, height: 1.3, glowLeft: 0x2fd6ff, glowRight: 0xff4fd8 }),
  centreDashes: { color: 0x7ee8ff, spacingMeters: 9, lengthMeters: 3.4, widthMeters: 0.55, cornerClearanceMeters: 14, obstacleClearanceMeters: 12 },
  shoulderRubble: { color: 0x6b6f7a, spacingMeters: 3, radiusMeters: 0.5 },
  craters: { cellMeters: 34, fillShare: 0.38, minimumRadius: 2.2, maximumRadius: 8, clearanceMeters: 3, groundColor: 0x4d4a44, rimColor: 0xa39d90 },
} as const;
