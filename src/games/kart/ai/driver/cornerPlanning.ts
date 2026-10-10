import type { AiConfig } from '../../../../shared/config/ai';
import type { AiDifficultyTuning } from '../../../../shared/config/aiDifficulty';
import type { DrivingConfig } from '../../../../shared/config/driving';
import { clamp } from './steeringMath';
import type { RubberBandContext } from './driverTypes';

/** How fast the AI should be going for a corner of this sharpness: full speed for a dead-straight
 *  path, down to `minCornerSpeedFactor` of top speed for a 90° corner (this map's tightest turns)
 *  or sharper, scaled linearly in between. */
export function targetCornerSpeed(driving: DrivingConfig, difficulty: AiDifficultyTuning, angle: number): number {
  const normalizedAngle = clamp(Math.abs(angle) / (Math.PI / 2), 0, 1);
  return driving.maxSpeed * (1 - normalizedAngle * (1 - difficulty.minCornerSpeedFactor));
}

/** Distance (metres) needed to slow from `speed` down to `targetSpeed` under the shared braking
 *  deceleration, plus a small reaction-time buffer; 0 if already at or below the target. Comparing
 *  this to the real distance left to the next corner (see `nextCornerAhead`) is what actually
 *  decides when to brake - physically grounded, so it neither brakes absurdly early nor discovers
 *  the corner too late to actually slow down for it, at any speed. */
export function brakingDistanceNeeded(config: AiConfig, driving: DrivingConfig, speed: number, targetSpeed: number): number {
  if (speed <= targetSpeed) return 0;
  const kinematic = (speed * speed - targetSpeed * targetSpeed) / (2 * driving.brakeDeceleration);
  return kinematic + speed * config.cornerBrakingMarginSeconds;
}

/** Scales AI top speed toward the race leader's progress: behind the leader nudges it faster, far
 *  ahead of the leader nudges it slower. Returns 1 (no change) when rubber-banding is off, there is
 *  no other kart to compare against, or the map has no length. */
export function rubberBandSpeedFactor(config: AiConfig, routeLength: number, rubberBanding: RubberBandContext | null): number {
  if (!config.rubberBandingEnabled || !rubberBanding || routeLength <= 0) return 1;
  const deficit = clamp((rubberBanding.leaderScore - rubberBanding.myScore) / routeLength, -1, 1);
  return clamp(1 + deficit * config.rubberBandingStrength, 0.5, 1.5);
}
