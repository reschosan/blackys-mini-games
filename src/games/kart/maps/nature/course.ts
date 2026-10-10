import type { Rect } from '../shared/mapConfig';
import { createCorridorCourse, type CorridorPoint } from '../shared/corridorCourse';

export const NATURE_WIDTH = 26;

export const NATURE_CORNERS: readonly CorridorPoint[] = [
  { x: 230, z: 0 },
  { x: 230, z: -90 },
  { x: 190, z: -90 },
  { x: 190, z: -180 },
  { x: 80, z: -180 },
  { x: 80, z: -130 },
  { x: -80, z: -130 },
  { x: -80, z: -180 },
  { x: -190, z: -180 },
  { x: -190, z: -90 },
  { x: -230, z: -90 },
  { x: -230, z: 90 },
  { x: -190, z: 90 },
  { x: -190, z: 180 },
  { x: -80, z: 180 },
  { x: -80, z: 130 },
  { x: 80, z: 130 },
  { x: 80, z: 180 },
  { x: 190, z: 180 },
  { x: 190, z: 90 },
  { x: 230, z: 90 },
];

const LOG_SEGMENTS = new Set([2, 3, 5, 7, 8, 10, 12, 13, 15, 17, 18, 20]);
const LOG_DISTANCE_FROM_SEGMENT_START = new Map([[20, 30]]);

const COURSE = createCorridorCourse({
  corners: NATURE_CORNERS,
  width: NATURE_WIDTH,
  obstacleSegments: LOG_SEGMENTS,
  obstacleDistanceFromSegmentStart: LOG_DISTANCE_FROM_SEGMENT_START,
});

export const NATURE_SURFACES: readonly Rect[] = COURSE.surfaces;
export const NATURE_BOUNDARIES: readonly Rect[] = COURSE.boundaries;
export const NATURE_LOGS: readonly Rect[] = COURSE.obstacles;
export const NATURE_WAYPOINTS: readonly CorridorPoint[] = COURSE.waypoints;
