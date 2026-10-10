import { isOnLevel, type RouteNode, type MapConfig } from './mapConfig';
import { t } from '../../../../shared/i18n';

export interface RoutePose {
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
}

export function routeDistanceAt(map: MapConfig, segment: number, pose: RoutePose): number {
  const nodes = map.routeNodes ?? [];
  let distance = 0;
  for (let index = 1; index <= segment; index += 1) distance += Math.hypot(nodes[index]!.x - nodes[index - 1]!.x, nodes[index]!.z - nodes[index - 1]!.z);
  const a = nodes[segment];
  const b = nodes[segment + 1];
  if (!a || !b) return distance;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  return distance + Math.max(0, Math.min(length, ((pose.x - a.x) * dx + (pose.z - a.z) * dz) / (length || 1)));
}

export function routeSection(map: MapConfig, nextCheckpoint: number): { first: number; last: number } {
  return {
    first: map.checkpoints[Math.max(0, nextCheckpoint - 1)]?.routeNodeIndex ?? 0,
    last: map.checkpoints[nextCheckpoint]?.routeNodeIndex ?? (map.routeNodes?.length ?? 1) - 1,
  };
}

function segmentDistance(a: RouteNode, b: RouteNode, pose: RoutePose): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((pose.x - a.x) * dx + (pose.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  const distance = Math.hypot(pose.x - a.x - dx * t, pose.z - a.z - dz * t);
  const heading = pose.yaw === undefined ? 0 : Math.max(0, -Math.cos(Math.atan2(dz, dx) - pose.yaw));
  return distance + heading;
}

export function currentRouteSegment(map: MapConfig, levelId: string, nextCheckpoint: number, pose: RoutePose): number {
  const { first, last } = routeSection(map, nextCheckpoint);
  const nodes = map.routeNodes ?? [];
  let best = first;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = Math.max(0, first - 2); index < last; index += 1) {
    const a = nodes[index];
    const b = nodes[index + 1];
    if (!isOnLevel(a, levelId) || !isOnLevel(b, levelId)) continue;
    const candidate = segmentDistance(a, b, pose);
    if (candidate < distance) {
      best = index;
      distance = candidate;
    }
  }
  return best;
}

export function routeDrivingHint(map: MapConfig, pose: RoutePose & { readonly levelId: string }, nextCheckpoint: number): string | null {
  const nodes = map.routeNodes;
  if (!nodes) return null;
  const current = currentRouteSegment(map, pose.levelId, nextCheckpoint, pose);
  if (isOffRoute(nodes[current], nodes[current + 1], pose, map.driveableWidth ?? 4.5)) return t().race.backToRoute;
  const { last } = routeSection(map, nextCheckpoint);
  let distance = 0;
  let previous = pose;
  for (let index = current; index <= last; index += 1) {
    const a = nodes[index];
    const b = nodes[index + 1];
    const c = nodes[index + 2];
    if (!a || !b || b.levelId !== pose.levelId) break;
    distance += Math.hypot(b.x - previous.x, b.z - previous.z);
    previous = b;
    const hint = turnHint(a, b, c, distance);
    if (hint) return hint;
  }
  return t().race.straightOn;
}

function isOffRoute(a: RouteNode | undefined, b: RouteNode | undefined, pose: RoutePose, width: number): boolean {
  return a !== undefined && b !== undefined && segmentDistance(a, b, pose) > width * 2;
}

function turnHint(a: RouteNode, b: RouteNode, c: RouteNode | undefined, distance: number): string | null {
  if (!c || c.levelId !== b.levelId) return null;
  const angle = Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x);
  const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (Math.abs(turn) < 0.2) return null;
  return turn > 0 ? t().race.turnRight(Math.round(distance)) : t().race.turnLeft(Math.round(distance));
}
