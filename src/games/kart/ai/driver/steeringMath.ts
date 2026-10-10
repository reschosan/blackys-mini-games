import type { KartState } from '../../kart/kartState';
import type { MapPoint2D } from './driverTypes';

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Exponential approach toward `target`, framerate-independent given `stepSeconds`; used to smooth
 *  noisy per-tick readings (corner sharpness, avoidance push) into something that changes gradually
 *  enough to steer/brake by, instead of flickering between decisions frame to frame. */
export function approach(current: number, target: number, stepSeconds: number, smoothingSeconds: number): number {
  const factor = Math.min(stepSeconds / Math.max(smoothingSeconds, stepSeconds), 1);
  return current + (target - current) * factor;
}

export function steerToward(steerGain: number, state: KartState, target: MapPoint2D): number {
  const angleToTarget = Math.atan2(target.z - state.z, target.x - state.x);
  const steerAngle = normalizeAngle(angleToTarget - state.yaw);
  return clamp(steerAngle * steerGain, -1, 1);
}
