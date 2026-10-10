import type { Rect } from '../shared/mapConfig';
import { createCorridorCourse, type CorridorPoint } from '../shared/corridorCourse';

export const TOWN_WIDTH = 20;

const TOWN_CORNERS: readonly CorridorPoint[] = [
  { x: 180, z: 0 },
  { x: 180, z: -130 },
  { x: 120, z: -130 },
  { x: 120, z: -60 },
  { x: 50, z: -60 },
  { x: 50, z: -130 },
  { x: -30, z: -130 },
  { x: -30, z: -60 },
  { x: -110, z: -60 },
  { x: -110, z: -130 },
  { x: -190, z: -130 },
  { x: -190, z: 130 },
  { x: -110, z: 130 },
  { x: -110, z: 60 },
  { x: -30, z: 60 },
  { x: -30, z: 130 },
  { x: 60, z: 130 },
  { x: 60, z: 70 },
  { x: 120, z: 70 },
  { x: 120, z: 130 },
  { x: 180, z: 130 },
];

const MARKET_STALL_SEGMENTS = new Set([5, 10, 13, 15]);

const COURSE = createCorridorCourse({ corners: TOWN_CORNERS, width: TOWN_WIDTH, obstacleSegments: MARKET_STALL_SEGMENTS });

export const TOWN_ROOM: Rect = { x: 0, z: 0, width: 520, depth: 380 };
export const TOWN_SURFACES: readonly Rect[] = COURSE.surfaces;
export const TOWN_BOUNDARIES: readonly Rect[] = COURSE.boundaries;
export const TOWN_BARRIERS: readonly Rect[] = COURSE.obstacles;
export const TOWN_WAYPOINTS: readonly CorridorPoint[] = COURSE.waypoints;
