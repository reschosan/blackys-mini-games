import type { Rect } from '../shared/mapConfig';
import { createCorridorCourse, type CorridorPoint } from '../shared/corridorCourse';

export const SPACE_WIDTH = 26;

export const SPACE_CORNERS: readonly CorridorPoint[] = [
  { x: 220, z: 40 },
  { x: 220, z: -35 },
  { x: 130, z: -35 },
  { x: 130, z: -125 },
  { x: 80, z: -125 },
  { x: 80, z: -35 },
  { x: 30, z: -35 },
  { x: 30, z: -125 },
  { x: -20, z: -125 },
  { x: -20, z: -35 },
  { x: -70, z: -35 },
  { x: -70, z: -125 },
  { x: -120, z: -125 },
  { x: -120, z: 35 },
  { x: -70, z: 35 },
  { x: -70, z: 125 },
  { x: -20, z: 125 },
  { x: -20, z: 35 },
  { x: 30, z: 35 },
  { x: 30, z: 125 },
  { x: 80, z: 125 },
  { x: 80, z: 35 },
  { x: 130, z: 35 },
  { x: 130, z: 125 },
  { x: 220, z: 125 },
];

const BARRIER_SEGMENTS = new Set([1, 2, 4, 6, 8, 10, 14, 16, 18, 20, 22, 23]);

const COURSE = createCorridorCourse({ corners: SPACE_CORNERS, width: SPACE_WIDTH, obstacleSegments: BARRIER_SEGMENTS });

export const SPACE_SURFACES: readonly Rect[] = COURSE.surfaces;
export const SPACE_BOUNDARIES: readonly Rect[] = COURSE.boundaries;
export const SPACE_BARRIERS: readonly Rect[] = COURSE.obstacles;
export const SPACE_WAYPOINTS: readonly CorridorPoint[] = COURSE.waypoints;

export const SPACE_ROOM: Rect = { x: 40, z: 0, width: 560, depth: 400 };
