import type { ItemConfig } from '../../../shared/config/items';
import { KART_COLLIDER_RADIUS } from '../../../shared/config/kart';
import { applyStunHit } from './itemHit';
import type { KartState } from '../kart/kartState';
import type { MapConfig } from '../maps/shared/mapConfig';
import { resolveBodyVsRects } from '../maps/shared/collision';
import { collidableRects, followStairs, kartWorldHeightAt, routeElevationAt } from '../maps/shared/surface';

export type HairballKind = 'hairball' | 'yarn';

/** Yarn is the map-specific, bigger, many-times-bouncing sibling of the hairball. */
const RADIUS_BY_KIND: Readonly<Record<HairballKind, number>> = { hairball: 0.25, yarn: 0.45 };

export interface Hairball {
  readonly kind: HairballKind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  readonly ownerIndex: number;
  levelId: string;
  elevation?: number;
  distanceTraveled: number;
  bouncesRemaining: number;
}

export function spawnHairball(state: KartState, ownerIndex: number, items: ItemConfig, map?: MapConfig, kind: HairballKind = 'hairball'): Hairball {
  const forwardX = Math.cos(state.yaw);
  const forwardZ = Math.sin(state.yaw);
  const spawnOffset = KART_COLLIDER_RADIUS + RADIUS_BY_KIND[kind];
  return {
    kind,
    x: state.x + forwardX * spawnOffset,
    z: state.z + forwardZ * spawnOffset,
    vx: forwardX * items[kind].speedMetersPerSecond,
    vz: forwardZ * items[kind].speedMetersPerSecond,
    ownerIndex,
    levelId: state.levelId,
    ...(map ? { elevation: kartWorldHeightAt(map, state) } : {}),
    distanceTraveled: 0,
    bouncesRemaining: items[kind].maxBounces,
  };
}

function applyHairballHit(kart: KartState, items: ItemConfig, hairball: Hairball): void {
  const sideOfImpact = hairball.vx * -Math.sin(kart.yaw) + hairball.vz * Math.cos(kart.yaw);
  const impactSideSign = sideOfImpact >= 0 ? 1 : -1;
  applyStunHit(kart, items[hairball.kind], impactSideSign, items.leaderStunBonusSeconds);
}

/** Advances every airborne hairball, removing it once it either exceeds its range or hits the
 *  first eligible (non-owner) kart within `HIT_RADIUS`, or runs out of allowed bounces. Mutates
 *  `hairballs` in place. Purely `stepSeconds`-driven, no randomness involved. */
export function stepHairballs(hairballs: Hairball[], items: ItemConfig, map: MapConfig, karts: readonly KartState[], stepSeconds: number): void {
  for (let index = hairballs.length - 1; index >= 0; index -= 1) {
    const hairball = hairballs[index]!;
    advanceHairball(hairball, stepSeconds);
    followStairs(map, hairball, hairball.vx, hairball.vz);

    if (hairball.distanceTraveled >= items[hairball.kind].rangeMeters || bounceLeavesHairballSpent(hairball, items, map)) {
      hairballs.splice(index, 1);
      continue;
    }

    const hitIndex = karts.findIndex((kart, kartIndex) => kartIndex !== hairball.ownerIndex && hairballTouchesKart(hairball, kart, map));
    if (hitIndex === -1) continue;

    applyHairballHit(karts[hitIndex]!, items, hairball);
    hairballs.splice(index, 1);
  }
}

function advanceHairball(hairball: Hairball, stepSeconds: number): void {
  hairball.x += hairball.vx * stepSeconds;
  hairball.z += hairball.vz * stepSeconds;
  hairball.distanceTraveled += Math.hypot(hairball.vx, hairball.vz) * stepSeconds;
}

function bounceLeavesHairballSpent(hairball: Hairball, items: ItemConfig, map: MapConfig): boolean {
  const body = { x: hairball.x, z: hairball.z, velocityX: hairball.vx, velocityZ: hairball.vz };
  if (!resolveBodyVsRects(body, RADIUS_BY_KIND[hairball.kind], collidableRects(map, hairball.levelId), items[hairball.kind].bounceRestitution)) return false;
  hairball.x = body.x;
  hairball.z = body.z;
  hairball.vx = body.velocityX;
  hairball.vz = body.velocityZ;
  if (hairball.bouncesRemaining === 0) return true;
  hairball.bouncesRemaining -= 1;
  return false;
}

function hairballTouchesKart(hairball: Hairball, kart: KartState, map: MapConfig): boolean {
  if (kart.levelId !== hairball.levelId) return false;
  const dx = kart.x - hairball.x;
  const dz = kart.z - hairball.z;
  const dy = kartWorldHeightAt(map, kart) - (hairball.elevation ?? routeElevationAt(map, hairball.x, hairball.z, hairball.levelId));
  const hitRadius = KART_COLLIDER_RADIUS + RADIUS_BY_KIND[hairball.kind];
  return dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius;
}
