import { buildWalls, type MapLevel, type MapRoom, type Rect, type MapConfig } from '../shared/mapConfig';
import { HOUSE_DETAIL_COLLIDERS } from './colliders';
import { FAMILY_HOUSE_MAP, HOUSE_MODEL_SCALE } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';
import { HOUSE_GATES, HOUSE_ROUTE_NODES, housePoint, roomGate } from './route';

const SCALE = HOUSE_MODEL_SCALE;
const PLACEMENT_LEVELS: Readonly<Record<string, number>> = { ground: 0, first: 1, second: 2 };
const rect = (x: number, z: number, width: number, depth: number): Rect => ({ x: x * SCALE, z: z * SCALE, width: width * SCALE, depth: depth * SCALE });
const footprint = rect(0, -0.12, 2.65, 3.48);
const perimeter = buildWalls(footprint, 4);
const outside = rect(0, 1.99, 2.65, 0.74);
function outsideWalls(openings: readonly number[]): readonly Rect[] {
  const edges = [-1.325, ...openings.flatMap((x) => [x - 0.16, x + 0.16]), 1.325];
  const front = [];
  for (let index = 0; index < edges.length; index += 2) {
    const left = edges[index]!;
    const right = edges[index + 1]!;
    front.push(rect((left + right) / 2, 1.591, right - left, 0.102));
  }
  return [...perimeter.slice(0, 1), ...perimeter.slice(2), ...front, rect(0, 2.36, 2.65, 0.045)];
}
const room = (name: string, levelId: string, floorHeight: number, area: Rect): MapRoom => ({ name, levelId, floorHeight, rect: area, accentColor: 0x9b7258 });
const rooms = [
  room('Wohnzimmer', 'ground', 0, rect(-0.5, 1.03, 1.4, 1.12)),
  room('Arbeitszimmer', 'ground', 0, rect(0.83, 1.12, 0.85, 0.95)),
  room('Eingangshalle', 'ground', 0, rect(0, -0.9, 2.4, 1.8)),
  room('Treppenflur', 'first', SCALE, rect(-0.7, -0.65, 0.8, 2.1)),
  room('Kueche und Esszimmer', 'first', SCALE, rect(0.12, 1.05, 2.25, 1.05)),
  room('Hobbyzimmer', 'first', SCALE, rect(0.58, -1.05, 1.25, 1.55)),
  room('Oberer Flur', 'second', SCALE * 2, rect(-0.23, -0.65, 0.42, 1.5)),
  room('Kinderzimmer', 'second', SCALE * 2, rect(0.65, 0, 1.1, 0.85)),
  room('Schlafzimmer', 'second', SCALE * 2, rect(-0.55, 1.0, 1.35, 1.2)),
];

const groundWalls = [
  rect(0.275, 1.035, 0.04, 1.01),
  rect(0.63, 0.582, 0.28, 0.04),
  rect(1.19, 0.582, 0.1, 0.04),
  rect(0.617, 0.378, 0.04, 0.398),
  rect(0.622, 0.174, 0.244, 0.04),
  rect(0.07775, -0.1, 0.5725, 0.14),
  rect(0.90925, -0.1, 0.6585, 0.14),
  rect(0.012, -0.57, 0.04, 0.2),
  rect(0.012, -0.125, 0.04, 0.21),
  rect(-1.22, 0.95, 0.06, 1.3),
  rect(-0.66, 1.516, 0.11, 0.04),
  rect(0.355, 0.55, 0.01, 0.1),
  rect(0.508, 0.55, 0.01, 0.1),
];
const groundFurniture = [
  rect(-0.23042, 1.02943, 0.24243, 0.60002),
  rect(-0.72723, 0.96836, 0.37001, 0.23618),
  rect(0.18277, 0.98479, 0.14001, 0.53001),
  rect(-1.1014, 0.70896, 0.18056, 0.17334),
];
const firstWalls = [
  rect(-0.20035, -1.28, 0.08077, 1.16),
  rect(-0.20035, -0.32, 0.08077, 0.16),
  rect(0.72, -0.27, 1.05, 0.055),
  rect(-1.27, 0.97, 0.055, 1.35),
  rect(-0.505, 0.22, 0.04, 0.035),
  rect(-0.076, -0.224, 0.035, 0.06),
];
const firstFurniture: readonly Rect[] = [
  { x: 33.766, z: 62.062, width: 28.2, depth: 18 },
  { x: 13.966, z: 62.662, width: 9, depth: 8.4 },
  { x: 49.366, z: 62.062, width: 9, depth: 8.4 },
  { x: 26.266, z: 71.362, width: 8.4, depth: 9 },
  { x: 38.266, z: 70.162, width: 8.4, depth: 9 },
  { x: 26.866, z: 52.162, width: 8.4, depth: 9 },
  { x: 38.866, z: 55.162, width: 8.4, depth: 9 },
  { x: -24.134, z: 35.698, width: 36, depth: 14.546 },
  { x: -61.298, z: 57.498, width: 14.546, depth: 36 },
  { x: -54.61, z: 88.81, width: 18.02, depth: 2.326 },
  { x: -17.46, z: 88.81, width: 17.88, depth: 2.326 },
];
const secondWalls = [
  rect(0.05, -0.95, 0.035, 0.65),
  rect(0.05, -0.1775, 0.035, 0.455),
  rect(0.05, 0.8975, 0.035, 1.095),
  rect(0.65, -0.596, 1.2, 0.035),
  rect(0.65, 0.309, 1.2, 0.04),
  rect(-0.77, 0.064, 0.85, 0.04),
];
const secondFurniture: readonly Rect[] = [
  rect(0.835, -0.16, 0.72, 0.48),
  { x: -55.25, z: 62.21, width: 31.5, depth: 29.5 },
  { x: -44.234, z: 12.898, width: 36, depth: 14.546 },
];
const LEVEL_WALLS: Readonly<Record<string, readonly Rect[]>> = {
  ground: [...outsideWalls([-0.45, 0.95]), ...groundWalls],
  first: [...outsideWalls([-0.6, 1.06]), ...firstWalls],
  second: [...perimeter, ...secondWalls],
};
const stairArea = rect(-0.85, -0.35, 0.65, 1.1);
const stairOpening = rect(-0.85, -0.34, 0.65, 1.38);
const stairRails = [rect(-1.185, -0.35, 0.02, 1.1), rect(-0.515, -0.35, 0.02, 1.1)];
const cutouts = (height: number, areas: readonly Rect[]) => areas.map((area) => ({ rect: area, minHeight: height + 0.1, maxHeight: height + SCALE + 2 }));
const levels: readonly MapLevel[] = [
  {
    id: 'ground',
    name: 'Erdgeschoss',
    floorHeight: 0,
    ceilingHeight: SCALE,
    collisionRects: [...LEVEL_WALLS.ground!, ...groundFurniture],
    modelSource: { centreX: 3.85, floorY: -1.255, minX: 2.45, maxX: 5.3 },
    driveableSurfaces: [footprint, outside],
    modelCutouts: cutouts(0, [
      stairOpening,
      rect(-0.45, 1.6, 0.32, 0.3),
      rect(0.95, 1.6, 0.32, 0.3),
      rect(0.9, 0.58, 0.32, 0.1),
      rect(-0.35, -0.1, 0.24, 0.28),
      rect(0.43, -0.1, 0.3, 0.28),
      rect(0.43, 0.174, 0.3, 0.15),
      rect(-0.35, -0.68, 0.24, 0.2),
      rect(0.012, -0.35, 0.12, 0.24),
      rect(0.43, 0.56, 0.15, 0.16),
    ]),
  },
  {
    id: 'first',
    name: '1. Obergeschoss',
    floorHeight: SCALE,
    ceilingHeight: SCALE * 2,
    collisionRects: [...LEVEL_WALLS.first!, ...firstFurniture],
    modelSource: { centreX: 1.04, floorY: -0.5527, minX: -0.4, maxX: 2.45 },
    driveableSurfaces: [footprint, outside],
    modelCutouts: cutouts(SCALE, [
      stairOpening,
      rect(-0.6, 1.6, 0.32, 0.3),
      rect(1.06, 1.6, 0.32, 0.3),
      rect(0.06, -0.27, 0.24, 0.18),
      rect(-0.2, -0.55, 0.14, 0.3),
    ]),
  },
  {
    id: 'second',
    name: '2. Obergeschoss',
    floorHeight: SCALE * 2,
    ceilingHeight: SCALE * 3,
    collisionRects: [...LEVEL_WALLS.second!, ...secondFurniture],
    modelSource: { centreX: -1.885, floorY: 0.11, minX: -3.3, maxX: -0.4 },
    driveableSurfaces: [footprint],
    modelCutouts: cutouts(SCALE * 2, [stairOpening, rect(0.04, -0.45, 0.15, 0.24), rect(0.05, 0.2, 0.12, 0.3), rect(-0.24, 0.064, 0.24, 0.12)]),
  },
];

export const FAMILY_HOUSE: MapConfig = withMapPlacements(
  {
    kind: 'house',
    ...configFieldsFromSettings(FAMILY_HOUSE_MAP),
    room: rect(0, 0.23, 2.8, 4.3),
    wallHeight: 4.5,
    wallThickness: 4,
    driveableWidth: 4.5,
    driveableSurfaces: [footprint, outside],
    levels: levels.map((level) => ({
      ...level,
      placementLevel: PLACEMENT_LEVELS[level.id]!,
      wallRects: LEVEL_WALLS[level.id]!,
      collisionRects: [...level.collisionRects, ...stairRails, ...(HOUSE_DETAIL_COLLIDERS[level.id] ?? [])],
    })),
    namedRooms: rooms,
    routeBanks: { flatHalfWidth: 5.6, width: 6, height: 1.5, wallHeight: 5, wallThickness: 0.4, gridSize: 1 },
    routeDividers: [
      { levelId: 'first', rect: { x: -1.2, z: -47.8, width: 0.4, depth: 52.8 } },
      { levelId: 'first', rect: { x: -5.5, z: -24, width: 8.2, depth: 0.4 } },
    ],
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 18, occlusionPadding: 0.75, minimumClearance: 4 },
    closedCeilings: true,
    routeAi: { reachDistance: 1.5, speedFactor: 1, cornerSpeed: 9, brakingMargin: 1 },
    aiGuideSpacing: { preferred: 2, minimum: 0.4 },
    routeMarkings: { edgeWidth: 0.12, cornerRadius: 3, arrowSize: 1.8, arrowSpacing: 8, lookAheadDistance: 80, fadeDistance: 16 },
    jumpMarkings: { approachLength: 14, stripeSpacing: 3, stripeDepth: 0.8, color: 0x56c4df },
    walls: perimeter,
    obstacles: [],
    routeNodes: HOUSE_ROUTE_NODES,
    waypoints: HOUSE_ROUTE_NODES.map(({ x, z }) => ({ x, z })),
    checkpoints: HOUSE_GATES,
    doorways: [
      { name: 'Garten zu Arbeitszimmer', fromRoom: 'Wohnzimmer', toRoom: 'Arbeitszimmer', levelId: 'ground', gate: HOUSE_GATES[2]! },
      { name: 'Arbeitszimmer zu Eingangshalle', fromRoom: 'Arbeitszimmer', toRoom: 'Eingangshalle', levelId: 'ground', gate: HOUSE_GATES[3]! },
      { name: 'Flur zu Hobbyzimmer', fromRoom: 'Treppenflur', toRoom: 'Hobbyzimmer', levelId: 'first', gate: roomGate('first', 5) },
      { name: 'Hobbyzimmer zu Kueche', fromRoom: 'Hobbyzimmer', toRoom: 'Kueche und Esszimmer', levelId: 'first', gate: roomGate('first', 12) },
      { name: 'Flur zu Kinderzimmer', fromRoom: 'Oberer Flur', toRoom: 'Kinderzimmer', levelId: 'second', gate: HOUSE_GATES[10]! },
      { name: 'Flur zu Schlafzimmer', fromRoom: 'Oberer Flur', toRoom: 'Schlafzimmer', levelId: 'second', gate: roomGate('second', 10) },
    ],
    stairTransitions: [
      {
        name: 'Treppe EG zu OG',
        fromLevelId: 'ground',
        toLevelId: 'first',
        rect: stairArea,
        fromHeight: SCALE,
        toHeight: 0,
        axis: 'z',
        toAt: 'min',
        sideWalls: stairRails,
      },
      {
        name: 'Treppe OG zu Dachgeschoss',
        fromLevelId: 'first',
        toLevelId: 'second',
        rect: stairArea,
        fromHeight: SCALE * 2,
        toHeight: SCALE,
        axis: 'z',
        toAt: 'min',
        sideWalls: stairRails,
      },
    ],
    startPositions: [
      { ...housePoint(-1.05, 1.44), yaw: 0, levelId: 'ground' },
      { ...housePoint(-1.05, 1.51), yaw: 0, levelId: 'ground' },
      { ...housePoint(-1.12, 1.44), yaw: 0, levelId: 'ground' },
      { ...housePoint(-1.12, 1.51), yaw: 0, levelId: 'ground' },
    ],
    raceFormat: 'pointToPoint',
    finishArea: { rect: { x: -31.5, z: 84, width: 4, depth: 24 }, levelId: 'second' },
  },
  FAMILY_HOUSE_MAP.placements,
);
