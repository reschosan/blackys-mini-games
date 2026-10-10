import type { Rect } from '../shared/mapConfig';
import type { Landmark, ModelRef, ScatterSpec } from '../shared/view/themedScenery';

const CITY_DIRECTORY = 'models/city-pack';
const city = (name: string): ModelRef => ({ directory: CITY_DIRECTORY, name });

const STREETLIGHT = city('Streetlight');
const TV_TOWER = city('TV Tower');
const SIGNS = city('Cyberpunk Signs');
const ANTENNA = city('Antenna');
const AIR_CONDITIONER = city('Air Conditioner');
const PLATFORM = city('Cyberpunk Platform');

export const CITY_MODELS: readonly ModelRef[] = [STREETLIGHT, TV_TOWER, SIGNS, ANTENNA, AIR_CONDITIONER, PLATFORM];

/** The open park in the middle of the city: no tower blocks, the TV tower and the signs stand here. */
export const CITY_PARK: Rect = { x: 0, z: 0, width: 440, depth: 104 };

/** Low platforms and units on the ground beside the avenues, between the street lamps and the tower blocks. */
export const CITY_SCATTER: ScatterSpec = {
  cellMeters: 22,
  fillShare: 0.35,
  groups: [
    { models: [PLATFORM], weight: 2, clearanceMeters: 6, heightMeters: 4, maxFootprintMeters: 12 },
    { models: [AIR_CONDITIONER], weight: 3, clearanceMeters: 6, heightMeters: 2.4, maxFootprintMeters: 5 },
  ],
};

export const CITY_LANDMARKS: readonly Landmark[] = [
  { model: TV_TOWER, x: 0, z: 0, yawDegrees: 0, heightMeters: 140, maxFootprintMeters: 22 },
  { model: SIGNS, x: -120, z: -34, yawDegrees: 0, heightMeters: 16, maxFootprintMeters: 24 },
  { model: SIGNS, x: 120, z: 34, yawDegrees: 180, heightMeters: 16, maxFootprintMeters: 24 },
  { model: SIGNS, x: -60, z: 36, yawDegrees: 160, heightMeters: 14, maxFootprintMeters: 20 },
  { model: SIGNS, x: 70, z: -36, yawDegrees: 20, heightMeters: 14, maxFootprintMeters: 20 },
  { model: ANTENNA, x: -150, z: 0, yawDegrees: 0, heightMeters: 60, maxFootprintMeters: 6 },
  { model: ANTENNA, x: 150, z: 0, yawDegrees: 0, heightMeters: 52, maxFootprintMeters: 6 },
];

export const CITY_STREETLIGHT = { model: STREETLIGHT, spacingMeters: 36, heightMeters: 9, maxFootprintMeters: 5, offsetOutsideMeters: 2.6 } as const;
