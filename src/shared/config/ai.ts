export interface AiConfig {
  /** How far ahead along the waypoint path the AI aims its steering target. */
  lookaheadDistance: number;
  /** Extra reaction-time buffer (seconds, converted to distance via current speed) added on top of
   *  the physically computed braking distance, so the AI starts slowing a bit before the last
   *  possible moment instead of cutting it exactly to the limit. */
  cornerBrakingMarginSeconds: number;
  /** How far ahead of the kart obstacles/karts are checked for avoidance. */
  avoidLookaheadDistance: number;
  /** Radius around the lookahead point in which an obstacle/kart triggers avoidance. */
  avoidRadius: number;
  /** How strongly the steering target is pushed away from a detected obstacle/kart. */
  avoidStrength: number;
  /** Distance the AI has to travel within `stuckSecondsThreshold` to count as moving; wiggling in
   *  place against a wall does not. Measured as displacement, not speed, because a pinned kart can
   *  keep bouncing above any speed threshold without ever leaving its spot. */
  stuckMovementMeters: number;
  /** How long the AI may stay within `stuckMovementMeters` of one spot before it counts as stuck. */
  stuckSecondsThreshold: number;
  /** Grace period after repositioning during which the AI cannot be declared stuck again, so it
   *  gets a chance to build speed before the check re-arms. */
  stuckCooldownSeconds: number;
  /** How far ahead (in seconds of travel, added on top of `avoidLookaheadDistance`) the AI checks
   *  for obstacles/karts; keeps faster karts from noticing danger too late. */
  avoidSpeedLookaheadSeconds: number;
  /** Smooths the obstacle/kart avoidance push over this many seconds so nearby geometry doesn't
   *  make the steering twitch frame to frame. */
  avoidSmoothingSeconds: number;
  /** Distance off the map's centreline beyond which the AI treats itself as off course (e.g.
   *  knocked sideways by a collision) and repositions instead of driving normally. */
  maxLateralOffset: number;
  /** How close back to the centreline counts as "repositioned"; normal driving resumes from there. */
  repositionToleranceDistance: number;
  /** Forward speed below which the AI stops braking for a corner, so a brake input never lingers
   *  long enough to flip into reverse (the physics treats holding brake at near-zero speed as
   *  "reverse"). */
  minBrakeSpeed: number;
  /** Whether AI top speed is nudged toward the race leader's progress. */
  rubberBandingEnabled: boolean;
  /** How strongly rubber-banding adjusts AI top speed (0 = off, 1 = strong). */
  rubberBandingStrength: number;
  /** Half-angle (radians) of the forward cone checked for a hairball target. */
  itemAimConeRadians: number;
  /** Max distance a kart ahead may be for the AI to fire a held hairball at it. */
  itemAimRangeMeters: number;
  /** Half-angle (radians) of the rearward cone checked for a trap-worthy pursuer. */
  trapPursuerConeRadians: number;
  /** Max distance behind the AI a pursuer may be for it to drop a held trap. */
  trapPursuerRangeMeters: number;
  /** Race-progress deficit (metres) behind the leader that counts as "deficit", triggering a
   *  held Nickerchen (shield) use. */
  napDeficitMeters: number;
  /** Half-angle (radians) and range of the forward cone checked for a laser pointer target. */
  laserTargetConeRadians: number;
  laserTargetRangeMeters: number;
  /** Half-angle (radians) and range of the forward cone checked before using the vacuum. */
  vacuumTargetConeRadians: number;
  vacuumTargetRangeMeters: number;
}

export const DEFAULT_AI: Readonly<AiConfig> = Object.freeze({
  lookaheadDistance: 9,
  cornerBrakingMarginSeconds: 0.5,
  avoidLookaheadDistance: 5,
  avoidRadius: 3.5,
  avoidStrength: 4,
  stuckMovementMeters: 0.8,
  stuckSecondsThreshold: 0.8,
  stuckCooldownSeconds: 0.75,
  avoidSpeedLookaheadSeconds: 0.4,
  avoidSmoothingSeconds: 0.2,
  maxLateralOffset: 7,
  repositionToleranceDistance: 1.5,
  minBrakeSpeed: 2.5,
  rubberBandingEnabled: true,
  rubberBandingStrength: 0.25,
  itemAimConeRadians: 0.35,
  itemAimRangeMeters: 12,
  trapPursuerConeRadians: 0.6,
  trapPursuerRangeMeters: 8,
  napDeficitMeters: 10,
  laserTargetConeRadians: 0.5,
  laserTargetRangeMeters: 16,
  vacuumTargetConeRadians: 0.6,
  vacuumTargetRangeMeters: 9,
} satisfies AiConfig);

export function createRuntimeAi(): AiConfig {
  return { ...DEFAULT_AI };
}

export function resetRuntimeAi(target: AiConfig): void {
  Object.assign(target, createRuntimeAi());
}
