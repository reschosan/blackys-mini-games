import type { AiConfig } from '../../../../shared/config/ai';
import { rectToAabb, type Aabb } from '../../maps/shared/collision';
import { collidableRects } from '../../maps/shared/surface';
import type { MapConfig } from '../../maps/shared/mapConfig';
import { forwardSpeedOf, type KartState } from '../../kart/kartState';
import type { MapPoint2D } from './driverTypes';
import { clamp } from './steeringMath';

const obstacleAabbCache = new WeakMap<MapConfig, Map<string, readonly Aabb[]>>();

function obstacleAabbsOf(map: MapConfig, levelId: string): readonly Aabb[] {
  let cachedByLevel = obstacleAabbCache.get(map);
  if (!cachedByLevel) {
    cachedByLevel = new Map();
    obstacleAabbCache.set(map, cachedByLevel);
  }
  const cached = cachedByLevel.get(levelId);
  if (cached) return cached;
  const aabbs = collidableRects(map, levelId).map(rectToAabb);
  cachedByLevel.set(levelId, aabbs);
  return aabbs;
}

function pushAwayFrom(config: AiConfig, fromX: number, fromZ: number, nearX: number, nearZ: number): MapPoint2D {
  const dx = fromX - nearX;
  const dz = fromZ - nearZ;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= config.avoidRadius * config.avoidRadius) return { x: 0, z: 0 };

  const distance = Math.sqrt(distanceSquared);
  if (distance === 0) return { x: 0, z: 0 };

  const pushStrength = ((config.avoidRadius - distance) / config.avoidRadius) * config.avoidStrength;
  return { x: (dx / distance) * pushStrength, z: (dz / distance) * pushStrength };
}

/** Pushes the steering target sideways, away from obstacles/karts found near a point a short
 *  distance ahead of the kart, so the AI curves around them instead of driving straight in. The
 *  probe reaches further out the faster the kart goes, so it still has time to react. */
export function avoidanceOffset(config: AiConfig, map: MapConfig, state: KartState, otherKarts: readonly MapPoint2D[]): MapPoint2D {
  const probeDistance = config.avoidLookaheadDistance + Math.max(forwardSpeedOf(state), 0) * config.avoidSpeedLookaheadSeconds;
  const probeX = state.x + Math.cos(state.yaw) * probeDistance;
  const probeZ = state.z + Math.sin(state.yaw) * probeDistance;

  let offsetX = 0;
  let offsetZ = 0;

  for (const aabb of obstacleAabbsOf(map, state.levelId)) {
    const pushed = pushAwayFrom(config, probeX, probeZ, clamp(probeX, aabb.minX, aabb.maxX), clamp(probeZ, aabb.minZ, aabb.maxZ));
    offsetX += pushed.x;
    offsetZ += pushed.z;
  }

  for (const kart of otherKarts) {
    const pushed = pushAwayFrom(config, probeX, probeZ, kart.x, kart.z);
    offsetX += pushed.x;
    offsetZ += pushed.z;
  }

  return { x: offsetX, z: offsetZ };
}

const MINIMUM_ESCAPE_DISTANCE_METERS = 0.5;

/** Unit direction that leads away from everything within `range` metres (walls, obstacles and
 *  karts, closer ones weigh more), or null if nothing is that close. Looking at all of them
 *  together, instead of only the nearest, lets a kart wedged in a corner find the way out. */
export function escapeDirection(map: MapConfig, state: KartState, otherKarts: readonly MapPoint2D[], range: number): MapPoint2D | null {
  let awayX = 0;
  let awayZ = 0;

  const addPushFrom = (x: number, z: number): void => {
    const dx = state.x - x;
    const dz = state.z - z;
    const distance = Math.max(Math.hypot(dx, dz), MINIMUM_ESCAPE_DISTANCE_METERS);
    if (distance >= range) return;
    awayX += dx / distance / distance;
    awayZ += dz / distance / distance;
  };

  for (const aabb of obstacleAabbsOf(map, state.levelId)) {
    addPushFrom(clamp(state.x, aabb.minX, aabb.maxX), clamp(state.z, aabb.minZ, aabb.maxZ));
  }
  for (const kart of otherKarts) {
    addPushFrom(kart.x, kart.z);
  }

  const length = Math.hypot(awayX, awayZ);
  return length < 1e-6 ? null : { x: awayX / length, z: awayZ / length };
}
