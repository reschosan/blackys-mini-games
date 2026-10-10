import type { Rect } from './mapConfig';

export interface CorridorPoint {
  readonly x: number;
  readonly z: number;
}

export interface CorridorSpec {
  readonly corners: readonly CorridorPoint[];
  readonly width: number;
  readonly obstacleSegments: ReadonlySet<number>;
  readonly obstacleDistanceFromSegmentStart?: ReadonlyMap<number, number>;
}

export interface CorridorCourse {
  readonly surfaces: readonly Rect[];
  readonly boundaries: readonly Rect[];
  readonly obstacles: readonly Rect[];
  readonly waypoints: readonly CorridorPoint[];
}

const OBSTACLE_LENGTH = 16;
const OBSTACLE_THICKNESS = 6;
const OBSTACLE_OFFSET_FROM_CENTRE = 5;
const CHICANE_LEAD_METERS = 25;
const CHICANE_LATERAL_METERS = 8;

interface Segment {
  readonly from: CorridorPoint;
  readonly to: CorridorPoint;
  readonly length: number;
  readonly dx: number;
  readonly dz: number;
  readonly nx: number;
  readonly nz: number;
}

function segmentAt(corners: readonly CorridorPoint[], index: number): Segment {
  const from = corners[index]!;
  const to = corners[(index + 1) % corners.length]!;
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const dx = (to.x - from.x) / length;
  const dz = (to.z - from.z) / length;
  return { from, to, length, dx, dz, nx: -dz, nz: dx };
}

/** Which side of the centre line a segment's obstacle sits on: alternating, so a chicane flips sides. */
function obstacleSide(index: number): 1 | -1 {
  return index % 2 === 0 ? 1 : -1;
}

function obstacleDistance(spec: CorridorSpec, index: number, length: number): number {
  return spec.obstacleDistanceFromSegmentStart?.get(index) ?? length / 2;
}

/** The point of one rail loop at a corner: the corner pushed out along both adjoining normals. */
function railCorner(spec: CorridorSpec, index: number, side: -1 | 1): CorridorPoint {
  const { corners, width } = spec;
  const previous = segmentAt(corners, (index + corners.length - 1) % corners.length);
  const next = segmentAt(corners, index);
  const normalX = previous.nx === next.nx ? next.nx : previous.nx + next.nx;
  const normalZ = previous.nz === next.nz ? next.nz : previous.nz + next.nz;
  const corner = corners[index]!;
  return { x: corner.x + (side * normalX * width) / 2, z: corner.z + (side * normalZ * width) / 2 };
}

function railBetween(point: CorridorPoint, next: CorridorPoint): Rect {
  return {
    x: (point.x + next.x) / 2,
    z: (point.z + next.z) / 2,
    width: Math.abs(point.x - next.x) + (point.x === next.x ? 2 : 0),
    depth: Math.abs(point.z - next.z) + (point.z === next.z ? 2 : 0),
  };
}

function railLoop(spec: CorridorSpec, side: -1 | 1): Rect[] {
  const points = spec.corners.map((_, index) => railCorner(spec, index, side));
  return points.map((point, index) => railBetween(point, points[(index + 1) % points.length]!));
}

function surfaceOf(spec: CorridorSpec, index: number): Rect {
  const { from, to } = segmentAt(spec.corners, index);
  return {
    x: (from.x + to.x) / 2,
    z: (from.z + to.z) / 2,
    width: Math.abs(to.x - from.x) + spec.width,
    depth: Math.abs(to.z - from.z) + spec.width,
  };
}

function obstacleOf(spec: CorridorSpec, index: number): Rect {
  const { from, length, dx, dz, nx, nz } = segmentAt(spec.corners, index);
  const side = obstacleSide(index);
  const distance = obstacleDistance(spec, index, length);
  return {
    x: from.x + dx * distance + nx * side * OBSTACLE_OFFSET_FROM_CENTRE,
    z: from.z + dz * distance + nz * side * OBSTACLE_OFFSET_FROM_CENTRE,
    width: dx === 0 ? OBSTACLE_LENGTH : OBSTACLE_THICKNESS,
    depth: dz === 0 ? OBSTACLE_LENGTH : OBSTACLE_THICKNESS,
  };
}

/** The corner itself, or - on obstacle segments - the corner followed by a chicane around the obstacle. */
function waypointsOf(spec: CorridorSpec, index: number): CorridorPoint[] {
  const corner = spec.corners[index]!;
  if (!spec.obstacleSegments.has(index)) return [corner];
  const { from, length, dx, dz, nx, nz } = segmentAt(spec.corners, index);
  const side = obstacleSide(index);
  const point = (distance: number, lateral: number): CorridorPoint => ({
    x: from.x + dx * distance + nx * lateral,
    z: from.z + dz * distance + nz * lateral,
  });
  const distance = obstacleDistance(spec, index, length);
  return [corner, point(distance - CHICANE_LEAD_METERS, 0), point(distance, -side * CHICANE_LATERAL_METERS), point(distance + CHICANE_LEAD_METERS, 0)];
}

/** Builds a closed corridor course from its corner points: driveable surfaces, two rail loops,
 *  obstacles on the chosen segments and the AI waypoints around them. */
export function createCorridorCourse(spec: CorridorSpec): CorridorCourse {
  const indices = spec.corners.map((_, index) => index);
  return {
    surfaces: indices.map((index) => surfaceOf(spec, index)),
    boundaries: [...railLoop(spec, -1), ...railLoop(spec, 1)],
    obstacles: indices.filter((index) => spec.obstacleSegments.has(index)).map((index) => obstacleOf(spec, index)),
    waypoints: indices.flatMap((index) => waypointsOf(spec, index)),
  };
}
