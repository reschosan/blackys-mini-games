import type { Rect } from '../shared/mapConfig';
import { createCorridorCourse, type CorridorPoint } from '../shared/corridorCourse';

export const FARM_WIDTH = 24;

const FARM_CORNERS: readonly CorridorPoint[] = [
  { x: 200, z: 0 },
  { x: 200, z: -120 },
  { x: 110, z: -120 },
  { x: 110, z: -30 },
  { x: 20, z: -30 },
  { x: 20, z: -120 },
  { x: -70, z: -120 },
  { x: -70, z: -30 },
  { x: -200, z: -30 },
  { x: -200, z: 120 },
  { x: -110, z: 120 },
  { x: -110, z: 40 },
  { x: -20, z: 40 },
  { x: -20, z: 120 },
  { x: 200, z: 120 },
];

const HAY_BALE_SEGMENTS = new Set([7, 8, 13]);

const COURSE = createCorridorCourse({ corners: FARM_CORNERS, width: FARM_WIDTH, obstacleSegments: HAY_BALE_SEGMENTS });

export const FARM_ROOM: Rect = { x: 0, z: 0, width: 560, depth: 400 };
export const FARM_SURFACES: readonly Rect[] = COURSE.surfaces;
export const FARM_BOUNDARIES: readonly Rect[] = COURSE.boundaries;
export const FARM_BARRIERS: readonly Rect[] = COURSE.obstacles;
export const FARM_WAYPOINTS: readonly CorridorPoint[] = COURSE.waypoints;
