import { isOnLevel, type MapConfig } from '../maps/shared/mapConfig';
import { KART_WALL_COLLIDER_RADIUS } from '../../../shared/config/kart';
import { buildCentreline, type Centreline } from '../race/routeProgress';
import { circleVsAabb, rectToAabb, type Aabb } from '../maps/shared/collision';
import { collidableRects, isOnRouteSurface } from '../maps/shared/surface';

interface AiGuidePoint {
  readonly x: number;
  readonly z: number;
  readonly levelId: string;
}

export interface AiGuideLine {
  readonly points: readonly AiGuidePoint[];
  readonly centreline: Centreline;
}

interface GuideNode extends AiGuidePoint {
  x: number;
  z: number;
  readonly normalX: number;
  readonly normalZ: number;
  readonly sourceX: number;
  readonly sourceZ: number;
  readonly cutX: number;
  readonly cutZ: number;
  cutFactor: number;
  spacing: number;
}

const LANE_MULTIPLIERS = [-1.5, -0.5, 0.5, 1.5] as const;
const cache = new WeakMap<MapConfig, AiGuideLine[]>();

export function clearAiGuideLines(map: MapConfig): void {
  cache.delete(map);
}

export function aiGuideLine(map: MapConfig, slot: number): AiGuideLine {
  let lines = cache.get(map);
  if (!lines) {
    lines = buildAiGuideLines(map);
    cache.set(map, lines);
  }
  return lines[Math.min(Math.max(slot, 0), LANE_MULTIPLIERS.length - 1)]!;
}

/** Space a guide line keeps from an obstacle: the kart's radius plus the map's reserve for a kart
 *  that maps its lane a little loosely at speed. */
function laneObstacleRadius(map: MapConfig): number {
  return KART_WALL_COLLIDER_RADIUS + (map.aiGuideSpacing?.obstacleClearance ?? 0);
}

function safeSpacing(map: MapConfig, point: AiGuidePoint, normalX: number, normalZ: number, obstacles: readonly Aabb[]): number {
  const preferred = map.aiGuideSpacing?.preferred ?? Math.min(3, map.driveableWidth / 8);
  const minimum = map.aiGuideSpacing?.minimum ?? Math.min(0.4, preferred);
  for (let spacing = preferred; spacing >= minimum; spacing -= 0.2) {
    const safe = LANE_MULTIPLIERS.every((lane) => {
      const x = point.x + normalX * lane * spacing;
      const z = point.z + normalZ * lane * spacing;
      return isOnRouteSurface(map, x, z, point.levelId) && obstacles.every((obstacle) => !circleVsAabb(x, z, laneObstacleRadius(map), obstacle));
    });
    if (safe) return spacing;
  }
  return minimum;
}

function apexPoint(map: MapConfig, source: readonly AiGuidePoint[], index: number, obstacles: readonly Aabb[]): AiGuidePoint {
  const point = source[index]!;
  const previous = source[index - 1];
  const next = source[index + 1];
  const isGate = map.checkpoints.some((gate) => gate.routeNodeIndex === index);
  if (!map.routeNodes || isGate || !isOnLevel(previous, point.levelId) || !isOnLevel(next, point.levelId)) return point;
  const inX = point.x - previous.x;
  const inZ = point.z - previous.z;
  const outX = next.x - point.x;
  const outZ = next.z - point.z;
  const inLength = Math.hypot(inX, inZ);
  const outLength = Math.hypot(outX, outZ);
  if (inLength < 20 || outLength < 20) return point;
  const turn = Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ);
  if (Math.abs(turn) < 0.55 || Math.abs(turn) > 2.2) return point;
  for (let cut = 7; cut >= 2; cut -= 2) {
    const candidate = {
      ...point,
      x: point.x - (inX / inLength) * cut + (outX / outLength) * cut,
      z: point.z - (inZ / inLength) * cut + (outZ / outLength) * cut,
    };
    if (!isOnRouteSurface(map, candidate.x, candidate.z, point.levelId)) continue;
    if (obstacles.every((obstacle) => !circleVsAabb(candidate.x, candidate.z, KART_WALL_COLLIDER_RADIUS + 2, obstacle))) return candidate;
  }
  return point;
}

function buildAiGuideLines(map: MapConfig): AiGuideLine[] {
  const source = map.routeNodes ?? map.waypoints.map((point) => ({ ...point, levelId: 'ground' }));
  const closed = map.raceFormat !== 'pointToPoint';
  const obstaclesByLevel = new Map<string, readonly Aabb[]>();
  const nodes: GuideNode[] = source.map((point, index) => {
    const previous = source[index - 1] ?? (closed ? (source[source.length - 1] ?? point) : point);
    const next = source[index + 1] ?? (closed ? (source[0] ?? point) : point);
    const inX = point.x - previous.x;
    const inZ = point.z - previous.z;
    const outX = next.x - point.x;
    const outZ = next.z - point.z;
    const inLength = Math.hypot(inX, inZ);
    const outLength = Math.hypot(outX, outZ);
    const normalX = (inLength ? -inZ / inLength : 0) + (outLength ? -outZ / outLength : 0);
    const normalZ = (inLength ? inX / inLength : 0) + (outLength ? outX / outLength : 0);
    const length = Math.hypot(normalX, normalZ) || 1;
    const unitX = normalX / length;
    const unitZ = normalZ / length;
    let obstacles = obstaclesByLevel.get(point.levelId);
    if (!obstacles) {
      obstacles = collidableRects(map, point.levelId).map(rectToAabb);
      obstaclesByLevel.set(point.levelId, obstacles);
    }
    const apex = apexPoint(map, source, index, obstacles);
    return {
      ...apex,
      sourceX: point.x,
      sourceZ: point.z,
      cutX: apex.x - point.x,
      cutZ: apex.z - point.z,
      cutFactor: apex.x === point.x && apex.z === point.z ? 0 : 1,
      normalX: unitX,
      normalZ: unitZ,
      spacing: safeSpacing(map, apex, unitX, unitZ, obstacles),
    };
  });
  fitGuideSegments(map, nodes, obstaclesByLevel);
  return LANE_MULTIPLIERS.map((multiplier) => {
    const points = nodes.map((node) => ({
      x: node.x + node.normalX * multiplier * node.spacing,
      z: node.z + node.normalZ * multiplier * node.spacing,
      levelId: node.levelId,
    }));
    return { points, centreline: buildCentreline({ ...map, routeNodes: points }) };
  });
}

function fitGuideSegments(map: MapConfig, nodes: GuideNode[], obstaclesByLevel: ReadonlyMap<string, readonly Aabb[]>): void {
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1]!;
    const to = nodes[index]!;
    if (from.levelId !== to.levelId) continue;
    const obstacles = obstaclesByLevel.get(from.levelId)!;
    shrinkSpacingUntilSafe(map, from, to, obstacles);
    if (!guideSegmentSafe(map, from, to, obstacles) && (from.cutFactor > 0 || to.cutFactor > 0)) {
      reduceCornerCut(map, [from, to], obstacles);
      index = 0;
    }
  }
}

function shrinkSpacingUntilSafe(map: MapConfig, from: GuideNode, to: GuideNode, obstacles: readonly Aabb[]): void {
  const minimum = map.aiGuideSpacing?.minimum ?? 0.4;
  while (!guideSegmentSafe(map, from, to, obstacles) && (from.spacing > minimum || to.spacing > minimum)) {
    from.spacing = Math.max(minimum, from.spacing - 0.2);
    to.spacing = Math.max(minimum, to.spacing - 0.2);
  }
}

function reduceCornerCut(map: MapConfig, nodes: readonly GuideNode[], obstacles: readonly Aabb[]): void {
  for (const node of nodes) {
    node.cutFactor = Math.max(0, Math.round((node.cutFactor - 0.15) * 100) / 100);
    node.x = node.sourceX + node.cutX * node.cutFactor;
    node.z = node.sourceZ + node.cutZ * node.cutFactor;
    node.spacing = safeSpacing(map, node, node.normalX, node.normalZ, obstacles);
  }
}

function guideSegmentSafe(map: MapConfig, from: GuideNode, to: GuideNode, obstacles: readonly Aabb[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    for (const lane of LANE_MULTIPLIERS) {
      const x = from.x + (to.x - from.x) * t + lane * (from.normalX * from.spacing * (1 - t) + to.normalX * to.spacing * t);
      const z = from.z + (to.z - from.z) * t + lane * (from.normalZ * from.spacing * (1 - t) + to.normalZ * to.spacing * t);
      if (!isOnRouteSurface(map, x, z, from.levelId) || obstacles.some((obstacle) => circleVsAabb(x, z, laneObstacleRadius(map), obstacle))) return false;
    }
  }
  return true;
}
