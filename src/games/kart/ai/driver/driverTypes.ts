import type { AiConfig } from '../../../../shared/config/ai';
import type { AiDifficultyTuning } from '../../../../shared/config/aiDifficulty';
import type { DrivingConfig } from '../../../../shared/config/driving';
import type { MapConfig } from '../../maps/shared/mapConfig';

export interface AiDriverState {
  readonly guideSlot: number;
  stuckSeconds: number;
  /** Where the current stuck measurement started; null until the first tick or after a reset. */
  stuckAnchor: { readonly x: number; readonly z: number } | null;
  /** True while the AI is driving back toward the centreline instead of racing normally. */
  repositioning: boolean;
  /** Set once repositioning itself has stalled, so the AI backs away from whatever is blocking it
   *  instead of endlessly re-attempting the same forward/reverse move. */
  repositionForcedReverse: boolean;
  /** Which gear the forced-reverse escape committed to; kept stable for a while instead of being
   *  recomputed every tick, so a threat sitting almost exactly to the side (where the forward/behind
   *  sign is unstable) can't make the AI flip gear every frame and never actually move. */
  escapeGear: 'forward' | 'reverse' | null;
  /** Gear chosen for driving back onto the line; kept until the target is clearly on the other side
   *  so a target sitting beside the kart cannot flip the gear (and the steering) every tick. */
  repositionGear: EscapeGear | null;
  cooldownSeconds: number;
  /** Smoothed obstacle/kart avoidance push, carried across ticks to avoid steering twitch. */
  smoothedAvoidX: number;
  smoothedAvoidZ: number;
  routeNodeIndex: number;
}

export function createAiDriverState(guideSlot = 0): AiDriverState {
  return {
    guideSlot,
    stuckSeconds: 0,
    stuckAnchor: null,
    repositioning: false,
    repositionForcedReverse: false,
    escapeGear: null,
    repositionGear: null,
    cooldownSeconds: 0,
    smoothedAvoidX: 0,
    smoothedAvoidZ: 0,
    routeNodeIndex: 0,
  };
}

export interface MapPoint2D {
  readonly x: number;
  readonly z: number;
  readonly guideSlot?: number;
  readonly yaw?: number;
}

/** Race-progress scores (see `raceProgressScore`) used to nudge AI top speed toward the leader. */
export interface RubberBandContext {
  readonly myScore: number;
  readonly leaderScore: number;
}

export interface AiDriveContext {
  readonly paceFactor?: number;
  /** Per-map replacement for `config.maxLateralOffset`. */
  readonly maxLateralOffset?: number;
  readonly config: AiConfig;
  readonly difficulty: AiDifficultyTuning;
  readonly driving: DrivingConfig;
  readonly map: MapConfig;
  readonly aiState: AiDriverState;
  readonly stepSeconds: number;
  readonly otherKarts: readonly MapPoint2D[];
  readonly rubberBanding: RubberBandContext | null;
}

export type EscapeGear = 'forward' | 'reverse';
