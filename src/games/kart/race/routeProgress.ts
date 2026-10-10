import type { MapConfig } from '../maps/shared/mapConfig';

interface CentrelineSegment {
  readonly startX: number;
  readonly startZ: number;
  readonly deltaX: number;
  readonly deltaZ: number;
  readonly lengthSquared: number;
  readonly distanceAtStart: number;
  /** Signed angle (radians) the path turns by at the end of this segment, going into the next one -
   *  the corner's actual, fixed sharpness and direction, independent of where along the segment
   *  something is sampled. Positive turns left (counter-clockwise), negative turns right. */
  readonly turnAngleAtEnd: number;
  readonly fromLevelId: string;
  readonly toLevelId: string;
}

export interface Centreline {
  readonly segments: readonly CentrelineSegment[];
  readonly totalLength: number;
  readonly closed: boolean;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** A point-to-point race ends on the last segment: there is no turn after it. */
function isFinishSegment(map: MapConfig, index: number, segmentCount: number): boolean {
  return map.raceFormat === 'pointToPoint' && index === segmentCount - 1;
}

export function buildCentreline(map: MapConfig): Centreline {
  const points = map.routeNodes ?? map.waypoints.map((point) => ({ ...point, levelId: 'ground' }));
  const headings: number[] = [];
  const raw: {
    startX: number;
    startZ: number;
    deltaX: number;
    deltaZ: number;
    lengthSquared: number;
    distanceAtStart: number;
    fromLevelId: string;
    toLevelId: string;
  }[] = [];
  let distanceAtStart = 0;

  const segmentCount = map.raceFormat === 'pointToPoint' ? points.length - 1 : points.length;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = points[index];
    const to = points[index + 1] ?? points[0];
    if (!from || !to) continue;

    const deltaX = to.x - from.x;
    const deltaZ = to.z - from.z;
    raw.push({
      startX: from.x,
      startZ: from.z,
      deltaX,
      deltaZ,
      lengthSquared: deltaX * deltaX + deltaZ * deltaZ,
      distanceAtStart,
      fromLevelId: from.levelId,
      toLevelId: to.levelId,
    });
    headings.push(Math.atan2(deltaZ, deltaX));
    distanceAtStart += Math.hypot(deltaX, deltaZ);
  }

  const segments: CentrelineSegment[] = raw.map((segment, index) => ({
    ...segment,
    turnAngleAtEnd: isFinishSegment(map, index, raw.length) ? 0 : normalizeAngle((headings[(index + 1) % headings.length] ?? 0) - (headings[index] ?? 0)),
  }));

  return { segments, totalLength: distanceAtStart, closed: map.raceFormat !== 'pointToPoint' };
}

const centrelineCache = new WeakMap<MapConfig, Centreline>();

export function centrelineOf(map: MapConfig): Centreline {
  const cached = centrelineCache.get(map);
  if (cached) return cached;
  const built = buildCentreline(map);
  centrelineCache.set(map, built);
  return built;
}

export interface RoutePoint {
  readonly x: number;
  readonly z: number;
  readonly levelId?: string;
}

export interface NearestCentrelinePoint extends RoutePoint {
  readonly distanceAlong: number;
  /** Straight-line distance from the queried point to this point on the centreline. */
  readonly lateralOffset: number;
  readonly headingAtPoint: number;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** The point on the centreline closest to (x, z): its distance along the lap, how far off the
 *  line (x, z) actually is, and which way the path points there. The "invisible line" the AI
 *  orients itself on. */
export function nearestCentrelinePoint(
  centreline: Centreline,
  x: number,
  z: number,
  levelId?: string,
  segmentRange?: { readonly first: number; readonly last: number },
): NearestCentrelinePoint {
  let best: NearestCentrelinePoint = { x, z, distanceAlong: 0, lateralOffset: Number.POSITIVE_INFINITY, headingAtPoint: 0 };

  for (const [index, segment] of centreline.segments.entries()) {
    if (!isSegmentCandidate(segment, index, levelId, segmentRange)) continue;
    const candidate = projectOntoSegment(segment, x, z);
    if (candidate.lateralOffset < best.lateralOffset) best = candidate;
  }

  return best;
}

function isSegmentCandidate(
  segment: CentrelineSegment,
  index: number,
  levelId: string | undefined,
  segmentRange: { readonly first: number; readonly last: number } | undefined,
): boolean {
  if (segmentRange && (index < segmentRange.first || index >= segmentRange.last)) return false;
  return levelId === undefined || segment.fromLevelId === levelId || segment.toLevelId === levelId;
}

function projectOntoSegment(segment: CentrelineSegment, x: number, z: number): NearestCentrelinePoint {
  const toPointX = x - segment.startX;
  const toPointZ = z - segment.startZ;
  const projection = segment.lengthSquared === 0 ? 0 : clamp01((toPointX * segment.deltaX + toPointZ * segment.deltaZ) / segment.lengthSquared);
  const pointX = segment.startX + segment.deltaX * projection;
  const pointZ = segment.startZ + segment.deltaZ * projection;
  return {
    x: pointX,
    z: pointZ,
    distanceAlong: segment.distanceAtStart + Math.hypot(segment.deltaX, segment.deltaZ) * projection,
    lateralOffset: Math.hypot(x - pointX, z - pointZ),
    headingAtPoint: Math.atan2(segment.deltaZ, segment.deltaX),
  };
}

/** Point on the centreline reached by walking `lookaheadDistance` forward from the point on the
 *  path closest to (x, z); wraps around the lap. Used as the AI's steering target. */
export function targetPointAhead(centreline: Centreline, x: number, z: number, lookaheadDistance: number, levelId?: string): RoutePoint {
  const distanceAlong = nearestCentrelinePoint(centreline, x, z, levelId).distanceAlong;
  const targetDistance = centreline.closed
    ? (distanceAlong + lookaheadDistance) % centreline.totalLength
    : Math.min(distanceAlong + lookaheadDistance, centreline.totalLength);
  return pointAtDistance(centreline, targetDistance);
}

function pointAtDistance(centreline: Centreline, distance: number): RoutePoint {
  for (const segment of centreline.segments) {
    const segmentLength = Math.hypot(segment.deltaX, segment.deltaZ);
    if (distance > segment.distanceAtStart + segmentLength) continue;
    const t = segmentLength === 0 ? 0 : clamp01((distance - segment.distanceAtStart) / segmentLength);
    return { x: segment.startX + segment.deltaX * t, z: segment.startZ + segment.deltaZ * t, levelId: t < 0.5 ? segment.fromLevelId : segment.toLevelId };
  }

  const last = centreline.segments[centreline.segments.length - 1];
  if (!last) return { x: 0, z: 0 };
  return { x: last.startX + last.deltaX, z: last.startZ + last.deltaZ, levelId: last.toLevelId };
}

export function distanceAlongLap(
  centreline: Centreline,
  x: number,
  z: number,
  levelId?: string,
  segmentRange?: { readonly first: number; readonly last: number },
): number {
  return nearestCentrelinePoint(centreline, x, z, levelId, segmentRange).distanceAlong;
}

export interface UpcomingCorner {
  /** Distance left to travel along the path before reaching the corner. */
  readonly distance: number;
  /** The corner's fixed, signed turn angle (radians) - positive turns left, negative turns right -
   *  independent of how far away it is. */
  readonly angle: number;
}

/** The next corner ahead of `distanceAlong` (the end of whichever segment that distance falls on)
 *  and how sharp it actually is - a fixed property of the map geometry, not a heuristic reading
 *  that depends on how far ahead something happens to be sampled. */
export function nextCornerAhead(centreline: Centreline, distanceAlong: number): UpcomingCorner {
  if (centreline.totalLength <= 0) return { distance: Number.POSITIVE_INFINITY, angle: 0 };
  const wrapped = ((distanceAlong % centreline.totalLength) + centreline.totalLength) % centreline.totalLength;

  for (const segment of centreline.segments) {
    const segmentLength = Math.hypot(segment.deltaX, segment.deltaZ);
    const segmentEnd = segment.distanceAtStart + segmentLength;
    if (wrapped > segmentEnd) continue;
    return { distance: segmentEnd - wrapped, angle: segment.turnAngleAtEnd };
  }

  const last = centreline.segments[centreline.segments.length - 1];
  if (!last) return { distance: Number.POSITIVE_INFINITY, angle: 0 };
  return { distance: centreline.totalLength - wrapped, angle: last.turnAngleAtEnd };
}
