import { buildWalls, HEADING_NORTH, type Rect, type MapConfig } from '../../src/games/kart/maps/shared/mapConfig';
import { configFieldsFromSettings, type MapPlacement, type MapSettings } from '../../src/games/kart/maps/shared/mapSettings';
import { withMapPlacements } from '../../src/games/kart/maps/shared/mapPlacements';

export type { ItemBoxSpawn, MapConfig } from '../../src/games/kart/maps/shared/mapConfig';

const RING_ROUTE_WIDTH = 30;

const RING_MAP = {
  name: 'Ring-Testkarte',
  aiOffCourseMeters: RING_ROUTE_WIDTH / 2,
  placements: [
    { type: 'boostField', id: 'ring-nitro', level: 0, meter: 50 },
    { type: 'surfaceZone', kind: 'carpet', level: 0, meter: 175, length: 16 },
    { type: 'itemBoxes', level: 0, meter: 21.5, items: ['random'] },
    { type: 'itemBoxes', level: 0, meter: 119.5, items: ['random'] },
    { type: 'itemBoxes', level: 0, meter: 209.5, items: ['random'] },
    { type: 'itemBoxes', level: 0, meter: 307.5, items: ['random'] },
  ] satisfies readonly MapPlacement[],
} satisfies MapSettings;

const ROOM: Rect = { x: 0, z: 0, width: 176, depth: 136 };
const ISLAND: Rect = { x: 0, z: 0, width: 72, depth: 56 };
const WALL_THICKNESS = 1;

/** A ring of `routeWidth` around `island` as four strips; the north and south ones span the whole outer width. */
export function ringSurfaces(island: Rect, routeWidth: number): readonly Rect[] {
  const outerWidth = island.width + routeWidth * 2;
  const outerDepth = island.depth + routeWidth * 2;
  const northSouthOffset = (island.depth + routeWidth) / 2;
  const westEastOffset = (island.width + routeWidth) / 2;
  return [
    { x: island.x, z: island.z - northSouthOffset, width: outerWidth, depth: routeWidth },
    { x: island.x, z: island.z + northSouthOffset, width: outerWidth, depth: routeWidth },
    { x: island.x - westEastOffset, z: island.z, width: routeWidth, depth: outerDepth },
    { x: island.x + westEastOffset, z: island.z, width: routeWidth, depth: outerDepth },
  ];
}

export const RING_TEST_MAP: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(RING_MAP),
    room: ROOM,
    wallHeight: 3,
    wallThickness: WALL_THICKNESS,
    driveableSurfaces: ringSurfaces(ISLAND, RING_ROUTE_WIDTH),
    driveableWidth: RING_ROUTE_WIDTH,
    walls: buildWalls(ROOM, WALL_THICKNESS),
    obstacles: [
      { name: 'Sofa', rect: { x: 0, z: -16, width: 44, depth: 16 }, height: 1.6 },
      { name: 'Couchtisch', rect: { x: 0, z: 16, width: 28, depth: 14 }, height: 0.9 },
      { name: 'Regal', rect: { x: 74, z: -40, width: 12, depth: 10 }, height: 2.4 },
    ],
    checkpoints: [
      { ax: 36, az: 0, bx: 66, bz: 0 },
      { ax: 0, az: -28, bx: 0, bz: -58 },
      { ax: -36, az: 0, bx: -66, bz: 0 },
      { ax: 0, az: 28, bx: 0, bz: 58 },
    ],
    waypoints: [
      { x: 51, z: 0 },
      { x: 51, z: -43 },
      { x: 0, z: -43 },
      { x: -51, z: -43 },
      { x: -51, z: 0 },
      { x: -51, z: 43 },
      { x: 0, z: 43 },
      { x: 51, z: 43 },
    ],
    startPositions: [
      { x: 44, z: 14, yaw: HEADING_NORTH },
      { x: 58, z: 14, yaw: HEADING_NORTH },
      { x: 44, z: 28, yaw: HEADING_NORTH },
      { x: 58, z: 28, yaw: HEADING_NORTH },
    ],
  },
  RING_MAP.placements,
);
