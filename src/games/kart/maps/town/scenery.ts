import type { Rect } from '../shared/mapConfig';
import type { Landmark, ModelRef, ScatterSpec } from '../shared/view/themedScenery';

const TOWN_DIRECTORY = 'models/town-pack';
const NATURE_DIRECTORY = 'models/nature-pack';

const town = (name: string): ModelRef => ({ directory: TOWN_DIRECTORY, name });
const nature = (name: string): ModelRef => ({ directory: NATURE_DIRECTORY, name });

const HOUSES = [
  town('House-RSwoYSLblu'),
  town('House-k6tP5nFUd2'),
  town('House-vZ1CLbWmSx'),
  town('Houses-gEjAC1UvVU'),
  town('Houses-vCoDG5hFyI'),
  town('Storage House'),
  town('Business Building'),
  town('Tower House'),
  town('Wooden house tower'),
] as const;
const CASTLE = town('Castle');
const CASTLE_GATE = town('Castle Gate');
const TEMPLE = town('Wodden Temple');
const TOWN_CENTER = town('Town Center-76GTkSh4KM');
const MARKET = town('Village Market');
const WINDMILL = town('Windmill-jpHoi9xDLG');
const PORT = town('Port-4sE6lmhGPF');
const TOWERS = [town('Stone Tower'), town('Watch Tower-cMxuj2gt7D')] as const;
const OUTSKIRT_TREES = [nature('Pine Trees'), nature('Maple Trees')] as const;

export const TOWN_MODELS: readonly ModelRef[] = [...HOUSES, CASTLE, CASTLE_GATE, TEMPLE, TOWN_CENTER, MARKET, WINDMILL, PORT, ...TOWERS, ...OUTSKIRT_TREES];

/** The open square in the middle of the town: no houses are scattered here, the big buildings stand in it. */
export const TOWN_SQUARE: Rect = { x: -10, z: 0, width: 340, depth: 96 };

export const TOWN_SCATTER: ScatterSpec = {
  cellMeters: 15,
  fillShare: 0.9,
  groups: [
    { models: HOUSES, weight: 10, clearanceMeters: 5, heightMeters: 9, maxFootprintMeters: 13, facesRoute: true },
    { models: OUTSKIRT_TREES, weight: 2, clearanceMeters: 34, heightMeters: 16, maxFootprintMeters: 12, splitVariants: true },
  ],
};

export const TOWN_LANDMARKS: readonly Landmark[] = [
  { model: CASTLE, x: -105, z: 0, yawDegrees: 0, heightMeters: 46, maxFootprintMeters: 74 },
  { model: TEMPLE, x: -20, z: 0, yawDegrees: 90, heightMeters: 30, maxFootprintMeters: 44 },
  { model: TOWN_CENTER, x: 55, z: -2, yawDegrees: 0, heightMeters: 26, maxFootprintMeters: 40 },
  { model: MARKET, x: 125, z: 6, yawDegrees: 0, heightMeters: 16, maxFootprintMeters: 38 },
  { model: WINDMILL, x: 110, z: -170, yawDegrees: 20, heightMeters: 28, maxFootprintMeters: 18 },
  { model: PORT, x: -60, z: 168, yawDegrees: 180, heightMeters: 18, maxFootprintMeters: 50 },
  { model: CASTLE_GATE, x: -215, z: -3, yawDegrees: 90, heightMeters: 12, maxFootprintMeters: 40 },
  { model: TOWERS[0], x: -228, z: -158, yawDegrees: 0, heightMeters: 26, maxFootprintMeters: 14 },
  { model: TOWERS[1], x: -228, z: 158, yawDegrees: 90, heightMeters: 24, maxFootprintMeters: 14 },
  { model: TOWERS[0], x: 218, z: -158, yawDegrees: 180, heightMeters: 26, maxFootprintMeters: 14 },
  { model: TOWERS[1], x: 218, z: 158, yawDegrees: 270, heightMeters: 24, maxFootprintMeters: 14 },
];
