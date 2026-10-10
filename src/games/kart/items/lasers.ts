import type { ItemConfig } from '../../../shared/config/items';
import type { InputFrame } from '../../../shared/input/actions';
import type { KartState } from '../kart/kartState';
import type { MapConfig } from '../maps/shared/mapConfig';
import { resolveBodyVsRects } from '../maps/shared/collision';
import { collidableRects, routeElevationAt } from '../maps/shared/surface';

const LASER_DOT_RADIUS = 0.2;

export interface LaserDot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  readonly ownerIndex: number;
  readonly levelId: string;
  secondsLeft: number;
}

export function spawnLaserDot(state: KartState, ownerIndex: number, items: ItemConfig): LaserDot {
  const forwardX = Math.cos(state.yaw);
  const forwardZ = Math.sin(state.yaw);
  return {
    x: state.x + forwardX * items.laser.spawnDistanceMeters,
    z: state.z + forwardZ * items.laser.spawnDistanceMeters,
    vx: forwardX * items.laser.speedMetersPerSecond,
    vz: forwardZ * items.laser.speedMetersPerSecond,
    ownerIndex,
    levelId: state.levelId,
    secondsLeft: items.laser.lifetimeSeconds,
  };
}

/** Moves each dot (bouncing off walls like a hairball) until its lifetime runs out. */
export function stepLaserDots(dots: LaserDot[], map: MapConfig, stepSeconds: number): void {
  for (let index = dots.length - 1; index >= 0; index -= 1) {
    const dot = dots[index]!;
    dot.secondsLeft -= stepSeconds;
    if (dot.secondsLeft <= 0) {
      dots.splice(index, 1);
      continue;
    }
    dot.x += dot.vx * stepSeconds;
    dot.z += dot.vz * stepSeconds;
    bounceOffWalls(dot, map);
  }
}

function bounceOffWalls(dot: LaserDot, map: MapConfig): void {
  const body = { x: dot.x, z: dot.z, velocityX: dot.vx, velocityZ: dot.vz };
  if (!resolveBodyVsRects(body, LASER_DOT_RADIUS, collidableRects(map, dot.levelId), 1)) return;
  dot.x = body.x;
  dot.z = body.z;
  dot.vx = body.velocityX;
  dot.vz = body.velocityZ;
}

export function laserDotElevation(map: MapConfig, dot: LaserDot): number {
  return routeElevationAt(map, dot.x, dot.z, dot.levelId);
}

function nearestLureDot(dots: readonly LaserDot[], items: ItemConfig, state: KartState, kartIndex: number): LaserDot | null {
  let nearest: LaserDot | null = null;
  let nearestDistance = items.laser.lureRadiusMeters;
  for (const dot of dots) {
    if (dot.ownerIndex === kartIndex || dot.levelId !== state.levelId) continue;
    const distance = Math.hypot(dot.x - state.x, dot.z - state.z);
    if (distance > nearestDistance) continue;
    nearest = dot;
    nearestDistance = distance;
  }
  return nearest;
}

/** Blends the driver's steering toward the nearest foreign laser dot within the lure radius. */
export function withLaserLure(frame: InputFrame, state: KartState, kartIndex: number, dots: readonly LaserDot[], items: ItemConfig): InputFrame {
  const dot = nearestLureDot(dots, items, state, kartIndex);
  if (!dot) return frame;
  const angleToDot = Math.atan2(dot.z - state.z, dot.x - state.x) - state.yaw;
  const lureSteer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(angleToDot), Math.cos(angleToDot)) * items.laser.lureSteerGain));
  const strength = items.laser.lureStrength;
  return { ...frame, steer: frame.steer * (1 - strength) + lureSteer * strength };
}
