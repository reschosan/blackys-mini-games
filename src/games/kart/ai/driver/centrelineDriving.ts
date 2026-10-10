import type { AiConfig } from '../../../../shared/config/ai';
import { NEUTRAL_INPUT, type InputFrame } from '../../../../shared/input/actions';
import { forwardSpeedOf, type KartState } from '../../kart/kartState';
import { nearestCentrelinePoint, nextCornerAhead, targetPointAhead, type Centreline, type UpcomingCorner } from '../../race/routeProgress';
import { aiGuideLine } from '../aiGuideLine';
import { avoidanceOffset } from './avoidance';
import { brakingDistanceNeeded, rubberBandSpeedFactor, targetCornerSpeed } from './cornerPlanning';
import type { AiDriveContext, AiDriverState } from './driverTypes';
import { chooseEscapeGear, repositionInput, updateStuckSeconds } from './recovery';
import { approach, steerToward } from './steeringMath';

type NearestPoint = ReturnType<typeof nearestCentrelinePoint>;

interface CornerPlan {
  readonly corner: UpcomingCorner;
  readonly forwardSpeed: number;
  readonly cornerSpeed: number;
  readonly approaching: boolean;
}

const MINIMUM_DRIFT_STEER = 0.5;
const DRIFT_SPEED_SHARE = 0.75;

function updateStuckTimer(state: KartState, config: AiConfig, aiState: AiDriverState, stepSeconds: number): void {
  if (aiState.cooldownSeconds <= 0) {
    updateStuckSeconds(state, config, aiState, stepSeconds);
    return;
  }
  aiState.cooldownSeconds = Math.max(aiState.cooldownSeconds - stepSeconds, 0);
  aiState.stuckSeconds = 0;
  aiState.stuckAnchor = null;
}

function updateRepositionState(state: KartState, context: AiDriveContext, nearest: NearestPoint): void {
  const { config, aiState, map, otherKarts } = context;
  const isStuck = aiState.stuckSeconds >= config.stuckSecondsThreshold;
  const isOffCourse = nearest.lateralOffset > (context.maxLateralOffset ?? config.maxLateralOffset);
  if (!aiState.repositioning && (isStuck || isOffCourse)) {
    aiState.repositioning = true;
    aiState.repositionForcedReverse = false;
    aiState.escapeGear = null;
    aiState.stuckSeconds = 0;
  } else if (aiState.repositioning && isStuck) {
    // The repositioning attempt itself stalled (still blocked by whatever it hit); fall back to
    // backing away from it. Re-evaluate the closest threat after a stall: blindly alternating
    // gears can push the kart repeatedly into a wall behind it.
    aiState.repositionForcedReverse = true;
    aiState.escapeGear = chooseEscapeGear(map, state, otherKarts);
    aiState.stuckSeconds = 0;
  }
}

function finishRepositioning(config: AiConfig, aiState: AiDriverState): void {
  aiState.repositioning = false;
  aiState.repositionForcedReverse = false;
  aiState.escapeGear = null;
  aiState.repositionGear = null;
  aiState.cooldownSeconds = config.stuckCooldownSeconds;
}

function steerAroundObstacles(state: KartState, context: AiDriveContext, centreline: Centreline): number {
  const { config, difficulty, map, aiState, stepSeconds, otherKarts } = context;
  const target = targetPointAhead(centreline, state.x, state.z, config.lookaheadDistance, state.levelId);
  const rawAvoidance = avoidanceOffset(config, map, state, otherKarts);
  aiState.smoothedAvoidX = approach(aiState.smoothedAvoidX, rawAvoidance.x, stepSeconds, config.avoidSmoothingSeconds);
  aiState.smoothedAvoidZ = approach(aiState.smoothedAvoidZ, rawAvoidance.z, stepSeconds, config.avoidSmoothingSeconds);
  return steerToward(difficulty.steerGain, state, { x: target.x + aiState.smoothedAvoidX, z: target.z + aiState.smoothedAvoidZ });
}

function planCorner(state: KartState, context: AiDriveContext, centreline: Centreline, distanceAlong: number): CornerPlan {
  const { config, difficulty, driving } = context;
  const corner = nextCornerAhead(centreline, distanceAlong);
  const cornerSpeed = targetCornerSpeed(driving, difficulty, corner.angle);
  const forwardSpeed = forwardSpeedOf(state);
  const isSignificant = Math.abs(corner.angle) > difficulty.brakeAngleThreshold;
  const withinBrakingRange = corner.distance <= brakingDistanceNeeded(config, driving, forwardSpeed, cornerSpeed);
  return { corner, forwardSpeed, cornerSpeed, approaching: isSignificant && withinBrakingRange };
}

/** Drift only once actually carrying enough speed for it to be worth it, so the AI doesn't flick
 *  into a slow, low-boost drift right as it's still braking down to corner speed. */
function shouldDrift(state: KartState, context: AiDriveContext, plan: CornerPlan): boolean {
  return (
    state.boostSeconds <= 0 &&
    plan.approaching &&
    Math.abs(plan.corner.angle) > context.difficulty.driftAngleThreshold &&
    plan.forwardSpeed > plan.cornerSpeed * DRIFT_SPEED_SHARE
  );
}

/** Below minBrakeSpeed, braking further would flip the kart into reverse (the physics treats
 *  holding brake at near-zero speed as intent to reverse) - just let it accelerate again instead. */
function shouldBrake(context: AiDriveContext, plan: CornerPlan): boolean {
  return plan.approaching && plan.forwardSpeed > plan.cornerSpeed && plan.forwardSpeed > context.config.minBrakeSpeed;
}

/** The physics locks in which way a drift turns from whatever `steer` sign happens to be true at
 *  the instant it starts, and never revisits it - so force that sign to match the corner's actual
 *  turn direction here, rather than trust whatever the target-seeking steer happened to compute
 *  (which can be noisy this close to a corner and lock in a drift turning the wrong way entirely). */
function driftInput(steer: number, plan: CornerPlan): InputFrame {
  const driftSteer = Math.sign(plan.corner.angle) * Math.max(Math.abs(steer), MINIMUM_DRIFT_STEER);
  return { ...NEUTRAL_INPUT, steer: driftSteer, accelerate: true, drift: true };
}

/** Once within braking range of a real corner, cap speed at the corner's own target instead of the
 *  full straight-line cap, so the AI doesn't immediately floor it again the instant it drops below
 *  `cornerSpeed`. */
function accelerationInput(state: KartState, context: AiDriveContext, centreline: Centreline, plan: CornerPlan, steer: number): InputFrame {
  const { config, driving, difficulty, rubberBanding } = context;
  const boostFactor = state.boostSeconds > 0 ? driving.boostSpeedFactor : 1;
  const speedFactor =
    difficulty.topSpeedFactor * (context.paceFactor ?? 1) * rubberBandSpeedFactor(config, centreline.totalLength, rubberBanding) * boostFactor;
  const straightCap = driving.maxSpeed * speedFactor;
  const speedCap = plan.approaching ? Math.min(straightCap, plan.cornerSpeed) : straightCap;
  return { ...NEUTRAL_INPUT, steer, accelerate: plan.forwardSpeed < speedCap };
}

function raceLineInput(state: KartState, context: AiDriveContext, centreline: Centreline, nearest: NearestPoint): InputFrame {
  const steer = steerAroundObstacles(state, context, centreline);
  const plan = planCorner(state, context, centreline, nearest.distanceAlong);
  if (shouldDrift(state, context, plan)) return driftInput(steer, plan);
  if (shouldBrake(context, plan)) return { ...NEUTRAL_INPUT, steer, brake: true };
  return accelerationInput(state, context, centreline, plan, steer);
}

/** Centreline driving with corner braking/drifting and obstacle/kart avoidance. Once the kart strays
 *  too far from the line (typically after a collision) or stalls, it stops racing and repositions
 *  back onto the line first, in whichever gear needs less turning, before resuming. */
export function driveCentreline(state: KartState, context: AiDriveContext): InputFrame {
  const { config, difficulty, map, aiState, stepSeconds, otherKarts } = context;
  const centreline = aiGuideLine(map, aiState.guideSlot).centreline;
  const nearest = nearestCentrelinePoint(centreline, state.x, state.z, state.levelId);

  updateStuckTimer(state, config, aiState, stepSeconds);
  updateRepositionState(state, context, nearest);

  if (aiState.repositioning) {
    if (nearest.lateralOffset > config.repositionToleranceDistance) return repositionInput(config, difficulty, map, state, aiState, otherKarts);
    finishRepositioning(config, aiState);
  }
  return raceLineInput(state, context, centreline, nearest);
}
