import type { Rect, StairTransition, MapConfig } from './mapConfig';
import { isInsideRect } from './collision';
import type { KartState } from '../../kart/kartState';
import { windowJumpHeight } from './windowJumps';
import { routeBankHeight, bankedCollisionRects } from './routeBanks';

export function carpetOuterRect(map: MapConfig): Rect {
  const { island, routeWidth } = map.carpet;
  return {
    x: island.x,
    z: island.z,
    width: island.width + routeWidth * 2,
    depth: island.depth + routeWidth * 2,
  };
}

export function collidableRects(map: MapConfig, levelId = 'ground'): readonly Rect[] {
  const level = map.levels?.find((candidate) => candidate.id === levelId);
  if (level) return map.routeBanks ? bankedCollisionRects(map, levelId, level.collisionRects) : level.collisionRects;
  if (!map.obstacles.length) return map.walls;
  return [...map.walls, ...map.obstacles.map((obstacle) => obstacle.rect)];
}

export function isOnCarpet(map: MapConfig, x: number, z: number): boolean {
  return isInsideRect(carpetOuterRect(map), x, z) && !isInsideRect(map.carpet.island, x, z);
}

export function routeSurfaceSpeedFactor(map: MapConfig, x: number, z: number): number {
  const shoulder = map.shoulder;
  if (!shoulder) return 1;
  if (map.driveableSurfaces) {
    if (!isOnRouteSurface(map, x, z)) return 1;
    const clearance = map.driveableSurfaces.reduce((best, rect) => {
      const margin = Math.min(rect.width / 2 - Math.abs(x - rect.x), rect.depth / 2 - Math.abs(z - rect.z));
      return Math.max(best, margin);
    }, -Infinity);
    return clearance < routeSurfaceWidth(map) * shoulder.widthFraction ? shoulder.speedFactor : 1;
  }
  if (!isOnCarpet(map, x, z)) return 1;
  const width = map.carpet.routeWidth * shoulder.widthFraction;
  const outer = carpetOuterRect(map);
  const island = map.carpet.island;
  const fastOuter: Rect = { ...outer, width: outer.width - width * 2, depth: outer.depth - width * 2 };
  const grassIsland: Rect = { ...island, width: island.width + width * 2, depth: island.depth + width * 2 };
  return isInsideRect(fastOuter, x, z) && !isInsideRect(grassIsland, x, z) ? 1 : shoulder.speedFactor;
}

export function isOnRouteSurface(map: MapConfig, x: number, z: number, levelId?: string): boolean {
  const surfaces = map.levels?.find((level) => level.id === levelId)?.driveableSurfaces;
  if (surfaces) return surfaces.some((surface) => isInsideRect(surface, x, z));
  if (map.driveableSurfaces) return map.driveableSurfaces.some((surface) => isInsideRect(surface, x, z));
  return isOnCarpet(map, x, z);
}

export function routeSurfaceWidth(map: MapConfig): number {
  return map.driveableWidth ?? map.carpet.routeWidth;
}

function elevationOnTransition(transition: StairTransition, x: number, z: number): number {
  const span = transition.axis === 'x' ? transition.rect.width : transition.rect.depth;
  const centre = transition.axis === 'x' ? transition.rect.x : transition.rect.z;
  const coordinate = transition.axis === 'x' ? x : z;
  const progress = Math.min(Math.max((coordinate - (centre - span / 2)) / span, 0), 1);
  return transition.fromHeight + (transition.toHeight - transition.fromHeight) * progress;
}

function stairTransitionAt(map: MapConfig, levelId: string, x: number, z: number): StairTransition | undefined {
  return map.stairTransitions?.find(
    (transition) => (transition.fromLevelId === levelId || transition.toLevelId === levelId) && isInsideRect(transition.rect, x, z),
  );
}

function targetSide(transition: StairTransition, x: number, z: number): boolean {
  const coordinate = transition.axis === 'x' ? x : z;
  const centre = transition.axis === 'x' ? transition.rect.x : transition.rect.z;
  return transition.toAt === 'max' ? coordinate >= centre : coordinate < centre;
}

export function updateKartStair(map: MapConfig, kart: KartState, previousX: number, previousZ: number): void {
  const active = map.stairTransitions?.find((stair) => stair.name === kart.stairTransitionId);
  const transition = active ?? map.stairTransitions?.find((stair) => canEnterStair(stair, kart, previousX, previousZ));
  if (!transition) return;
  kart.stairTransitionId = transition.name;
  const hasReachedTarget = targetSide(transition, kart.x, kart.z);
  kart.levelId = hasReachedTarget ? transition.toLevelId : transition.fromLevelId;
  if (!isInsideRect(transition.rect, kart.x, kart.z)) kart.stairTransitionId = null;
}

function canEnterStair(stair: StairTransition, kart: KartState, previousX: number, previousZ: number): boolean {
  if (!isInsideRect(stair.rect, kart.x, kart.z) || isInsideRect(stair.rect, previousX, previousZ)) return false;
  const side = targetSide(stair, kart.x, kart.z);
  const previousSide = targetSide(stair, previousX, previousZ);
  if (side !== previousSide) return false;
  const previous = stair.axis === 'x' ? previousX : previousZ;
  const centre = stair.axis === 'x' ? stair.rect.x : stair.rect.z;
  const span = stair.axis === 'x' ? stair.rect.width : stair.rect.depth;
  if (Math.abs(previous - centre) < span / 2) return false;
  return side ? kart.levelId === stair.toLevelId : kart.levelId === stair.fromLevelId;
}

/** Stairs can share one rect (ground to first and first to second), so a level inside it belongs to
 *  two of them. The height the body already has tells which one it is on; without a height, the
 *  direction of travel tells whether it goes up the next stair or down the previous one. */
function stairForBody(
  map: MapConfig,
  body: { readonly x: number; readonly z: number; readonly levelId: string; readonly elevation?: number },
  dirX: number,
  dirZ: number,
): StairTransition | undefined {
  const candidates =
    map.stairTransitions?.filter(
      (stair) => (stair.fromLevelId === body.levelId || stair.toLevelId === body.levelId) && isInsideRect(stair.rect, body.x, body.z),
    ) ?? [];
  if (body.elevation !== undefined) {
    const heightGap = (stair: StairTransition): number => Math.abs(elevationOnTransition(stair, body.x, body.z) - body.elevation!);
    return [...candidates].sort((a, b) => heightGap(a) - heightGap(b))[0];
  }
  const alongAxis = (stair: StairTransition): number => (stair.axis === 'x' ? dirX : dirZ);
  const movesToTarget = (stair: StairTransition): boolean => alongAxis(stair) < 0 === (stair.toAt === 'min');
  return candidates.find((stair) => (stair.fromLevelId === body.levelId) === movesToTarget(stair)) ?? candidates[0];
}

/** A free-flying thing (hairball, shell) follows the floor like a kart does: on a stair it takes the
 *  stair's height and changes level halfway; on maps with a raised side floor (route banks) it also
 *  rises with that floor. So it stays above the visible floor instead of flying through it. */
export function followStairs(
  map: MapConfig,
  body: { readonly x: number; readonly z: number; levelId: string; elevation?: number },
  dirX: number,
  dirZ: number,
): void {
  const stair = stairForBody(map, body, dirX, dirZ);
  if (!stair) {
    if (body.elevation !== undefined && map.routeBanks) body.elevation = kartElevationAt(map, { ...body, stairTransitionId: null });
    return;
  }
  body.levelId = targetSide(stair, body.x, body.z) ? stair.toLevelId : stair.fromLevelId;
  body.elevation = elevationOnTransition(stair, body.x, body.z);
}

export function kartElevationAt(map: MapConfig, kart: Pick<KartState, 'x' | 'z' | 'levelId' | 'stairTransitionId'>): number {
  const stair = map.stairTransitions?.find((transition) => transition.name === kart.stairTransitionId);
  if (stair) return elevationOnTransition(stair, kart.x, kart.z);
  const floor = map.levels?.find((level) => level.id === kart.levelId)?.floorHeight ?? routeElevationAt(map, kart.x, kart.z, kart.levelId);
  return floor + routeBankHeight(map, kart.levelId, kart.x, kart.z);
}

export type PositionedKart = Pick<KartState, 'x' | 'z'> &
  Partial<Pick<KartState, 'levelId' | 'stairTransitionId' | 'windowJumpId' | 'windowJumpElapsedSeconds' | 'penaltySecondsLeft'>>;

export function kartWorldHeightAt(map: MapConfig, kart: PositionedKart): number {
  return (
    kartElevationAt(map, { x: kart.x, z: kart.z, levelId: kart.levelId ?? 'ground', stairTransitionId: kart.stairTransitionId ?? null }) +
    windowJumpHeight(map, kart)
  );
}

type Ramp = NonNullable<MapConfig['ramps']>[number];

function rampElevationAt(ramp: Ramp, x: number, z: number): number {
  const span = ramp.axis === 'x' ? ramp.rect.width : ramp.rect.depth;
  const centre = ramp.axis === 'x' ? ramp.rect.x : ramp.rect.z;
  const coordinate = ramp.axis === 'x' ? x : z;
  const progress = Math.min(Math.max((coordinate - (centre - span / 2)) / span, 0), 1);
  return ramp.fromHeight + (ramp.toHeight - ramp.fromHeight) * progress;
}

export function routeElevationAt(map: MapConfig, x: number, z: number, levelId?: string): number {
  const transition = levelId === undefined ? undefined : stairTransitionAt(map, levelId, x, z);
  if (transition) return elevationOnTransition(transition, x, z);
  const ramp = levelId === undefined ? map.ramps?.find(({ rect }) => isInsideRect(rect, x, z)) : undefined;
  if (ramp) return rampElevationAt(ramp, x, z);
  const level = levelId === undefined ? undefined : map.levels?.find((candidate) => candidate.id === levelId);
  if (level) return level.floorHeight;
  return map.namedRooms?.find(({ rect }) => isInsideRect(rect, x, z))?.floorHeight ?? 0;
}
