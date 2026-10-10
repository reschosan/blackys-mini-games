import { ALL_MAP_ITEMS } from '../shared/mapItemSets';
import type { MapSettings, MapPlacement } from '../shared/mapSettings';

export const FAMILY_HOUSE_MAP = {
  name: 'Einfamilienhaus',
  lapCount: 1,
  mapItems: ALL_MAP_ITEMS,
  itemNames: { yarn: 'Wollknäuel', vacuum: 'Staubsauger', gravity: 'Lavalampe', cowpat: 'Kaugummi' },
  itemLooks: {
    gravity: { style: 'runes', color: 0xff6b3d, accent: 0xffe08a },
    cowpat: { style: 'heap', color: 0xff7ab8, accent: 0xff7ab8 },
  },
  placements: [
    { type: 'boostField', id: 'house-ground-nitro', level: 0, meter: 250 },
    { type: 'boostField', id: 'house-first-nitro', level: 1, meter: 435 },
    { type: 'boostField', id: 'house-second-nitro', level: 2, meter: 200 },
    { type: 'surfaceZone', kind: 'carpet', level: 0, meter: 280, length: 10, width: 6 },
    { type: 'surfaceZone', kind: 'carpet', level: 1, meter: 600, length: 10, width: 6 },
    { type: 'surfaceZone', kind: 'carpet', level: 2, meter: 140, length: 10, width: 6 },
    { type: 'itemBoxes', level: 0, meter: 21, items: ['random'] },
    { type: 'itemBoxes', level: 0, meter: 243.6, items: ['random'] },
    { type: 'itemBoxes', level: 0, meter: 488.4, items: ['random'] },
    { type: 'itemBoxes', level: 1, meter: 22.66, lateralMeters: -0.92, items: ['random'] },
    { type: 'itemBoxes', level: 1, meter: 427.08, items: ['random'] },
    { type: 'itemJump', id: 'hobby-item-ramp', level: 1, meter: 190.09, item: 'random' },
    { type: 'itemBoxes', level: 2, meter: 127.34, lateralMeters: -3, items: ['random'] },
    { type: 'itemBoxes', level: 2, meter: 66.69, items: ['random'] },
    { type: 'itemBoxes', level: 2, meter: 275.54, items: ['random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

export const FAMILY_HOUSE_APPEARANCE: HouseAppearance = {
  textureSize: 256,
  anisotropy: 4,
  road: { color: 0xa47b55, tileMeters: 6, roughness: 0.8, bumpScale: 0.025 },
  wall: { color: 0xe2ded3, tileMeters: 6, roughness: 0.93, bumpScale: 0.015 },
  ceiling: { color: 0xf1ece2, tileMeters: 8, roughness: 1, bumpScale: 0.008 },
  garden: { color: 0x71864e, tileMeters: 5, roughness: 1, bumpScale: 0.03 },
  terrace: { color: 0xa2947d, tileMeters: 6, roughness: 0.9, bumpScale: 0.025 },
};

export interface HouseSurfaceStyle {
  readonly color: number;
  readonly tileMeters: number;
  readonly roughness: number;
  readonly bumpScale: number;
}

export interface HouseAppearance {
  readonly textureSize: number;
  readonly anisotropy: number;
  readonly road: HouseSurfaceStyle;
  readonly wall: HouseSurfaceStyle;
  readonly ceiling: HouseSurfaceStyle;
  readonly garden: HouseSurfaceStyle;
  readonly terrace: HouseSurfaceStyle;
}

/** Metres per model unit of the house model and the height above which its walls are cut away in top views. */
export const HOUSE_MODEL_SCALE = 60;
export const HOUSE_WALL_CUTAWAY_HEIGHT = 6;
