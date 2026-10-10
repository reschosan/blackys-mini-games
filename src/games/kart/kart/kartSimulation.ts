import type { DrivingConfig } from '../../../shared/config/driving';
import { KART_COLLIDER_RADIUS, KART_WALL_COLLIDER_RADIUS } from '../../../shared/config/kart';
import type { MapConfig } from '../maps/shared/mapConfig';
import type { InputFrame } from '../../../shared/input/actions';
import { resolveBodyVsBody, resolveBodyVsRects } from '../maps/shared/collision';
import { collidableRects, isOnRouteSurface, kartWorldHeightAt, routeSurfaceSpeedFactor, updateKartStair } from '../maps/shared/surface';
import { resolveWeightedKartPair } from './kartTackle';
import { stepKart, type KartDriveFactors, type KartState } from './kartState';
import { updateKartSurface } from '../maps/shared/surfaceZones';
import { updateWindowJump } from '../maps/shared/windowJumps';

function drivingForMap(config: DrivingConfig, map: MapConfig): DrivingConfig {
  if (!map.offroad) return config;
  return { ...config, offroadSpeedFactor: map.offroad.speedFactor, offroadAccelerationFactor: map.offroad.accelerationFactor };
}

export function stepAllKarts(
  baseConfig: DrivingConfig,
  map: MapConfig,
  karts: readonly KartState[],
  inputs: readonly InputFrame[],
  stepSeconds: number,
  driveFactors: readonly KartDriveFactors[] = [],
  collisionActive: readonly boolean[] = [],
): void {
  const config = drivingForMap(baseConfig, map);
  karts.forEach((kart, index) => stepKartOnMap(config, map, kart, inputs[index], stepSeconds, driveFactors[index]));

  for (let first = 0; first < karts.length; first += 1) {
    for (let second = first + 1; second < karts.length; second += 1) {
      if (collisionActive[first] === false || collisionActive[second] === false) continue;
      resolveKartPair(config, map, karts[first], karts[second], driveFactors[first], driveFactors[second]);
    }
  }
}

function stepKartOnMap(
  config: DrivingConfig,
  map: MapConfig,
  kart: KartState,
  input: InputFrame | undefined,
  stepSeconds: number,
  driveFactors?: KartDriveFactors,
): void {
  if (!input) return;
  const previousJumpId = kart.windowJumpId;
  if (updateWindowJump(map, kart, input, stepSeconds)) {
    if (map.windowJumps?.find((jump) => jump.id === (kart.windowJumpId ?? previousJumpId))?.optional) resolveKartWalls(config, map, kart);
    return;
  }
  kart.onCarpet = isOnRouteSurface(map, kart.x, kart.z, kart.levelId);
  kart.surfaceSpeedFactor = routeSurfaceSpeedFactor(map, kart.x, kart.z);
  updateKartSurface(map, kart);
  const previousX = kart.x;
  const previousZ = kart.z;
  stepKart(config, kart, input, stepSeconds, driveFactors);
  updateKartStair(map, kart, previousX, previousZ);
  resolveKartWalls(config, map, kart);
}

function bumpKarts(
  config: DrivingConfig,
  first: KartState,
  second: KartState,
  firstFactors: KartDriveFactors | undefined,
  secondFactors: KartDriveFactors | undefined,
): boolean {
  if (firstFactors?.massFactor === undefined && secondFactors?.massFactor === undefined) {
    return resolveBodyVsBody(first, second, KART_COLLIDER_RADIUS, config.kartRestitution, config.kartCollisionSpeedLoss);
  }
  return resolveWeightedKartPair(config, first, second, firstFactors, secondFactors, KART_COLLIDER_RADIUS);
}

function resolveKartPair(
  config: DrivingConfig,
  map: MapConfig,
  first: KartState | undefined,
  second: KartState | undefined,
  firstFactors: KartDriveFactors | undefined,
  secondFactors: KartDriveFactors | undefined,
): void {
  if (!first || !second || !shareCollisionHeight(map, first, second)) return;
  if (bumpKarts(config, first, second, firstFactors, secondFactors)) {
    resolveKartWalls(config, map, first);
    resolveKartWalls(config, map, second);
  }
}

function resolveKartWalls(config: DrivingConfig, map: MapConfig, kart: KartState): void {
  const radius = map.levels ? KART_WALL_COLLIDER_RADIUS : KART_COLLIDER_RADIUS;
  resolveBodyVsRects(kart, radius, collidableRects(map, kart.levelId), config.wallRestitution);
}

function shareCollisionHeight(map: MapConfig, a: KartState, b: KartState): boolean {
  if (a.windowJumpId !== null || b.windowJumpId !== null) return false;
  if (a.penaltySecondsLeft > 0 || b.penaltySecondsLeft > 0) return false;
  return a.levelId === b.levelId && Math.abs(kartWorldHeightAt(map, a) - kartWorldHeightAt(map, b)) <= KART_COLLIDER_RADIUS * 2;
}
