import type { AiConfig } from '../../../../shared/config/ai';
import type { AiDifficultyTuning } from '../../../../shared/config/aiDifficulty';
import { NEUTRAL_INPUT, type InputFrame } from '../../../../shared/input/actions';
import type { KartState } from '../../kart/kartState';
import { targetPointAhead } from '../../race/routeProgress';
import type { MapConfig } from '../../maps/shared/mapConfig';
import { aiGuideLine } from '../aiGuideLine';
import { avoidanceOffset, escapeDirection } from './avoidance';
import type { AiDriveContext, AiDriverState, EscapeGear, MapPoint2D } from './driverTypes';
import { clamp, steerToward } from './steeringMath';

/** Only things this close can be what the kart is stuck against. */
const ESCAPE_THREAT_RANGE_METERS = 6;
/** How far ahead/behind the escape direction has to point before the gear changes; keeps a kart
 *  wedged between two walls from flipping gear every tick. */
const ESCAPE_GEAR_SWITCH_THRESHOLD = 0.3;

/** Whether driving forward or reversing moves away from what the kart is stuck against.
 *  Reversing away from something ahead is correct, but reversing away from something already
 *  behind would drive straight back into it, so that case needs forward instead. */
export function chooseEscapeGear(map: MapConfig, state: KartState, otherKarts: readonly MapPoint2D[], currentGear: EscapeGear = 'reverse'): EscapeGear {
  const away = escapeDirection(map, state, otherKarts, ESCAPE_THREAT_RANGE_METERS);
  if (!away) return currentGear;
  const forwardComponent = away.x * Math.cos(state.yaw) + away.z * Math.sin(state.yaw);
  if (Math.abs(forwardComponent) < ESCAPE_GEAR_SWITCH_THRESHOLD) return currentGear;
  return forwardComponent > 0 ? 'forward' : 'reverse';
}

/** Moves away from everything the kart is close to (or just moves straight if nothing is nearby),
 *  in the given gear (see `chooseEscapeGear`). Only the sideways part of the escape direction
 *  affects steering: straight ahead/behind needs no turn, to one side gets steered toward
 *  (inverted while reversing, since driving backward flips the effective turn direction). */
function backAwayFromThreat(difficulty: AiDifficultyTuning, map: MapConfig, state: KartState, otherKarts: readonly MapPoint2D[], gear: EscapeGear): InputFrame {
  const away = escapeDirection(map, state, otherKarts, ESCAPE_THREAT_RANGE_METERS);
  if (!away) return gear === 'forward' ? { ...NEUTRAL_INPUT, accelerate: true } : { ...NEUTRAL_INPUT, brake: true };

  const rightX = -Math.sin(state.yaw);
  const rightZ = Math.cos(state.yaw);
  const lateral = away.x * rightX + away.z * rightZ;
  const steerAway = clamp(lateral * difficulty.steerGain, -1, 1);

  if (gear === 'forward') return { ...NEUTRAL_INPUT, steer: steerAway, accelerate: true };
  return { ...NEUTRAL_INPUT, steer: -steerAway, brake: true };
}

const REPOSITION_GEAR_MARGIN_METERS = 3;

function chooseRepositionGear(aiState: AiDriverState, forwardComponent: number): EscapeGear {
  const previous = aiState.repositionGear ?? (forwardComponent >= 0 ? 'forward' : 'reverse');
  if (previous === 'forward' && forwardComponent < -REPOSITION_GEAR_MARGIN_METERS) aiState.repositionGear = 'reverse';
  else if (previous === 'reverse' && forwardComponent > REPOSITION_GEAR_MARGIN_METERS) aiState.repositionGear = 'forward';
  else aiState.repositionGear = previous;
  return aiState.repositionGear;
}

export function repositionTowardTarget(difficulty: AiDifficultyTuning, state: KartState, target: MapPoint2D, aiState: AiDriverState): InputFrame {
  const forwardX = Math.cos(state.yaw);
  const forwardZ = Math.sin(state.yaw);
  const toTargetX = target.x - state.x;
  const toTargetZ = target.z - state.z;
  const forwardComponent = toTargetX * forwardX + toTargetZ * forwardZ;

  if (chooseRepositionGear(aiState, forwardComponent) === 'forward') {
    return { ...NEUTRAL_INPUT, steer: steerToward(difficulty.steerGain, state, target), accelerate: true };
  }

  // The line is roughly behind the kart: reverse toward it instead. Steering by the lateral
  // component (rather than the absolute angle) sidesteps the instability of aiming at a point
  // directly behind the kart, and the sign mirrors `backAwayFromThreat` (steering toward something
  // while reversing is the same as steering away from it, with the opposite sign).
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const lateralComponent = toTargetX * rightX + toTargetZ * rightZ;
  return { ...NEUTRAL_INPUT, steer: clamp(-lateralComponent * difficulty.steerGain, -1, 1), brake: true };
}

/** Drives back toward the map's centreline (the AI's "invisible line"), in whichever gear needs
 *  less turning: forward if the line is roughly ahead, reverse if it's roughly behind. Falls back
 *  to backing away from whatever is close if that attempt itself stalls, and returns to driving
 *  toward the line as soon as nothing is close any more. */
export function repositionInput(
  config: AiConfig,
  difficulty: AiDifficultyTuning,
  map: MapConfig,
  state: KartState,
  aiState: AiDriverState,
  otherKarts: readonly MapPoint2D[],
): InputFrame {
  if (aiState.repositionForcedReverse && aiState.escapeGear) {
    if (escapeDirection(map, state, otherKarts, ESCAPE_THREAT_RANGE_METERS)) {
      aiState.escapeGear = chooseEscapeGear(map, state, otherKarts, aiState.escapeGear);
      return backAwayFromThreat(difficulty, map, state, otherKarts, aiState.escapeGear);
    }
    aiState.repositionForcedReverse = false;
    aiState.escapeGear = null;
  }

  const centreline = aiGuideLine(map, aiState.guideSlot).centreline;
  const lineTarget = targetPointAhead(centreline, state.x, state.z, config.lookaheadDistance, state.levelId);
  const avoidance = avoidanceOffset(config, map, state, otherKarts);

  return repositionTowardTarget(difficulty, state, { x: lineTarget.x + avoidance.x, z: lineTarget.z + avoidance.z }, aiState);
}

/** Counts how long the kart has stayed within `stuckMovementMeters` of one spot. */
export function updateStuckSeconds(state: KartState, config: AiConfig, aiState: AiDriverState, stepSeconds: number): void {
  const anchor = aiState.stuckAnchor;
  if (anchor && Math.hypot(state.x - anchor.x, state.z - anchor.z) >= config.stuckMovementMeters) {
    aiState.stuckAnchor = { x: state.x, z: state.z };
    aiState.stuckSeconds = 0;
    return;
  }
  aiState.stuckAnchor ??= { x: state.x, z: state.z };
  aiState.stuckSeconds += stepSeconds;
}

/** Backs away when a kart on a banked route stops moving; null while nothing needs recovering. */
export function recoverBankedRoute(state: KartState, context: AiDriveContext): InputFrame | null {
  if (!context.map.routeBanks) return null;
  const { aiState, config, stepSeconds } = context;
  updateStuckSeconds(state, config, aiState, stepSeconds);
  if (aiState.stuckSeconds > config.stuckSecondsThreshold) {
    aiState.cooldownSeconds = config.stuckCooldownSeconds;
    aiState.escapeGear = chooseEscapeGear(context.map, state, context.otherKarts);
    aiState.stuckSeconds = 0;
    aiState.stuckAnchor = null;
  }
  if (aiState.cooldownSeconds <= 0) return null;
  aiState.cooldownSeconds = Math.max(0, aiState.cooldownSeconds - stepSeconds);
  return backAwayFromThreat(context.difficulty, context.map, state, context.otherKarts, aiState.escapeGear ?? 'reverse');
}
