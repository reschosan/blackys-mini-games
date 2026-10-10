import type { Rect } from '../shared/mapConfig';
import { createCorridorCourse, type CorridorPoint } from '../shared/corridorCourse';

export const CITY_WIDTH = 30;

export const CITY_CORNERS: readonly CorridorPoint[] = [
  { x: 230, z: 0 },
  { x: 230, z: -160 },
  { x: 110, z: -160 },
  { x: 110, z: -70 },
  { x: -20, z: -70 },
  { x: -20, z: -160 },
  { x: -230, z: -160 },
  { x: -230, z: 160 },
  { x: -110, z: 160 },
  { x: -110, z: 70 },
  { x: 20, z: 70 },
  { x: 20, z: 160 },
  { x: 230, z: 160 },
];

const ROADWORKS_SEGMENTS = new Set([3, 5, 6, 9, 11]);

const COURSE = createCorridorCourse({ corners: CITY_CORNERS, width: CITY_WIDTH, obstacleSegments: ROADWORKS_SEGMENTS });

export const CITY_ROOM: Rect = { x: 0, z: 0, width: 580, depth: 420 };
export const CITY_SURFACES: readonly Rect[] = COURSE.surfaces;
export const CITY_BOUNDARIES: readonly Rect[] = COURSE.boundaries;
export const CITY_BARRIERS: readonly Rect[] = COURSE.obstacles;
export const CITY_WAYPOINTS: readonly CorridorPoint[] = COURSE.waypoints;
