import type { Rect } from '../shared/mapConfig';
import type { Landmark, ModelRef, ScatterSpec } from '../shared/view/themedScenery';

const FARM_DIRECTORY = 'models/farm-pack';
const NATURE_DIRECTORY = 'models/nature-pack';

const farm = (name: string): ModelRef => ({ directory: FARM_DIRECTORY, name });
const nature = (name: string): ModelRef => ({ directory: NATURE_DIRECTORY, name });

const BARNS = [farm('Barn'), farm('Big Barn'), farm('Small Barn'), farm('Open Barn')] as const;
const SILOS = [farm('Silo'), farm('Silo House')] as const;
const COOP = farm('ChickenCoop');
const WINDMILL = farm('Tower Windmill');
const COW = farm('Cow');
const HORSE = farm('Horse');
const TREES = [nature('Maple Trees'), nature('Birch Trees'), nature('Trees')] as const;
const BUSHES = nature('Bushes');
const FLOWERS = nature('Flower Bushes');

export const FARM_MODELS: readonly ModelRef[] = [...BARNS, ...SILOS, COOP, WINDMILL, COW, HORSE, ...TREES, BUSHES, FLOWERS];

export const FARM_SCATTER: ScatterSpec = {
  cellMeters: 24,
  fillShare: 0.8,
  groups: [
    { models: BARNS, weight: 2, clearanceMeters: 24, heightMeters: 11, maxFootprintMeters: 20, facesRoute: true },
    { models: SILOS, weight: 1, clearanceMeters: 20, heightMeters: 14, maxFootprintMeters: 9 },
    { models: [COOP], weight: 1, clearanceMeters: 16, heightMeters: 3.6, maxFootprintMeters: 6, facesRoute: true },
    { models: TREES, weight: 7, clearanceMeters: 11, heightMeters: 13, maxFootprintMeters: 11, splitVariants: true },
    { models: [BUSHES], weight: 4, clearanceMeters: 8, heightMeters: 3, maxFootprintMeters: 5, splitVariants: true },
    { models: [FLOWERS], weight: 2, clearanceMeters: 8, heightMeters: 2, maxFootprintMeters: 4, splitVariants: true },
  ],
};

export const FARM_LANDMARKS: readonly Landmark[] = [
  { model: WINDMILL, x: 10, z: 165, yawDegrees: 180, heightMeters: 24, maxFootprintMeters: 16 },
  { model: farm('Big Barn'), x: 205, z: -170, yawDegrees: 200, heightMeters: 16, maxFootprintMeters: 24 },
  { model: farm('Silo House'), x: 235, z: -170, yawDegrees: 180, heightMeters: 20, maxFootprintMeters: 12 },
  { model: farm('Open Barn'), x: -150, z: 170, yawDegrees: 0, heightMeters: 12, maxFootprintMeters: 18 },
];

/** Fields beside the route: ploughed, with furrows, and free of trees and buildings. */
export const FARM_FIELDS: readonly Rect[] = [
  { x: 110, z: 48, width: 140, depth: 100 },
  { x: -65, z: 82, width: 56, depth: 44 },
  { x: -40, z: -168, width: 200, depth: 40 },
];

/** Where the animals graze: pastures between the lanes. */
export interface Grazer {
  readonly model: ModelRef;
  readonly x: number;
  readonly z: number;
  readonly yawDegrees: number;
  readonly clip: 'Eating' | 'Idle' | 'Idle_2' | 'Walk';
  readonly heightMeters: number;
}

export const FARM_GRAZERS: readonly Grazer[] = [
  { model: COW, x: -170, z: 5, yawDegrees: 40, clip: 'Eating', heightMeters: 3.4 },
  { model: COW, x: -150, z: 32, yawDegrees: 200, clip: 'Idle', heightMeters: 3.4 },
  { model: COW, x: -168, z: 62, yawDegrees: 110, clip: 'Eating', heightMeters: 3.4 },
  { model: COW, x: -142, z: 82, yawDegrees: 300, clip: 'Idle_2', heightMeters: 3.4 },
  { model: COW, x: -175, z: 92, yawDegrees: 20, clip: 'Eating', heightMeters: 3.4 },
  { model: HORSE, x: -20, z: -85, yawDegrees: 70, clip: 'Eating', heightMeters: 4.4 },
  { model: HORSE, x: -35, z: -62, yawDegrees: 250, clip: 'Idle', heightMeters: 4.4 },
  { model: COW, x: -12, z: -60, yawDegrees: 150, clip: 'Idle_2', heightMeters: 3.4 },
];

export const FARM_PASTURE_FENCES: readonly Rect[] = [
  { x: -155, z: 48, width: 60, depth: 116 },
  { x: -25, z: -75, width: 58, depth: 58 },
];
