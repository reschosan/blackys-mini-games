import type { RouteNode } from '../shared/mapConfig';
import { HOUSE_MODEL_SCALE } from './settings';

/** The race route through the house: one path per floor, in model units of the house, and the gates along it. */

export const housePoint = (x: number, z: number) => ({ x: x * HOUSE_MODEL_SCALE, z: z * HOUSE_MODEL_SCALE });

const groundPath = [
  [-1.05, 1.44],
  [-0.45, 1.44],
  [-0.45, 1.58],
  [-0.45, 1.99],
  [0.95, 1.99],
  [0.95, 1.38],
  [0.43, 1.38],
  [0.43, 0.8],
  [0.43, 0.4],
  [0.43, 0.07],
  [0.43, -0.2],
  [0.43, -0.35],
  [1, -0.35],
  [1, -1.43],
  [0.35, -1.43],
  [0.35, -1],
  [-0.35, -1],
  [-0.35, 0.3],
  [-0.85, 0.3],
  [-0.85, -0.8],
];
const firstPath = [
  [-0.85, -0.95],
  [-0.45, -1.43],
  [-0.45, -0.55],
  [-0.1, -0.55],
  [-0.1, -1.43],
  [0.35, -1.43],
  [1, -1.43],
  [1, -0.55],
  [0.3, -0.55],
  [0.06, -0.55],
  [0.06, -0.1],
  [0.0, 0.35],
  [0.0, 0.9],
  [0.05, 1.4],
  [1.06, 1.4],
  [1.06, 1.58],
  [1.06, 1.99],
  [-0.6, 1.99],
  [-0.6, 1.4],
  [-0.8, 1.4],
  [-0.8, 0.9],
  [-0.8, 0.5],
  [-0.8, 0.3],
  [-0.85, 0.3],
  [-0.85, -0.8],
];
const secondPath = [
  [-0.85, -0.95],
  [-0.85, -1.1],
  [-0.3, -1.1],
  [-0.24, -0.95],
  [-0.24, -0.48],
  [0.4, -0.45],
  [0.4, -0.1],
  [0.4, 0.2],
  [0.18, 0.2],
  [-0.24, 0.2],
  [-0.24, 0.35],
  [-0.13, 0.35],
  [-0.13, 0.8],
  [-0.45, 0.8],
  [-0.45, 1.4],
  [-0.6, 1.4],
];
export const HOUSE_ROUTE_NODES: readonly RouteNode[] = [
  ...groundPath.map(([x, z]) => ({ ...housePoint(x!, z!), levelId: 'ground' })),
  ...firstPath.map(([x, z]) => ({ ...housePoint(x!, z!), levelId: 'first' })),
  ...secondPath.map(([x, z]) => ({ ...housePoint(x!, z!), levelId: 'second' })),
];
function checkpoint(index: number, width = 24) {
  const node = HOUSE_ROUTE_NODES[index]!;
  const previous = HOUSE_ROUTE_NODES[Math.max(index - 1, 0)]!;
  const dx = index === 0 ? 1 : node.x - previous.x;
  const dz = index === 0 ? 0 : node.z - previous.z;
  const length = Math.hypot(dx, dz) || 1;
  const inset = index === 0 ? 0 : Math.min(8, length / 2);
  const x = node.x - (dx / length) * inset;
  const z = node.z - (dz / length) * inset;
  return {
    ax: x + ((dz / length) * width) / 2,
    az: z - ((dx / length) * width) / 2,
    bx: x - ((dz / length) * width) / 2,
    bz: z + ((dx / length) * width) / 2,
    levelId: node.levelId,
    routeNodeIndex: index,
  };
}
export function roomGate(levelId: string, localIndex: number) {
  const start = HOUSE_ROUTE_NODES.findIndex((node) => node.levelId === levelId);
  return checkpoint(start + localIndex);
}
const namedGate = (levelId: string, index: number, name: string) => ({ ...roomGate(levelId, index), name });
export const HOUSE_GATES = [
  namedGate('ground', 0, 'Start'),
  { ...namedGate('ground', 4, 'Garten'), ax: -5, bx: -5 },
  { ...namedGate('ground', 5, 'Arbeitszimmer'), az: 98.4, bz: 98.4 },
  { ...namedGate('ground', 10, 'Eingangshalle'), az: -6, bz: -6 },
  { ...namedGate('first', 0, '1. Obergeschoss'), ax: -72, bx: -30, az: -54, bz: -54 },
  namedGate('first', 5, 'Hobbyzimmer'),
  namedGate('first', 12, 'Kueche'),
  { ...namedGate('first', 17, 'Terrasse'), ax: 15, bx: 15 },
  { ...namedGate('first', 18, 'Zurueck ins Haus'), az: 98.4, bz: 98.4 },
  { ...namedGate('second', 0, '2. Obergeschoss'), ax: -72, bx: -30, az: -54, bz: -54 },
  { ...namedGate('second', 5, 'Kinderzimmer'), ax: 3, bx: 3, az: -39, bz: -15 },
  namedGate('second', 10, 'Schlafzimmer'),
  { ...namedGate('second', 14, 'Zielraum'), az: 66, bz: 66 },
  namedGate('second', 15, 'Ziel'),
];
