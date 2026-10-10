import { driveAiKart, shouldAiUseHeldItem, type AiDriverState } from './aiDriver';
import type { AiConfig } from '../../../shared/config/ai';
import type { AiDifficulty, AiDifficultyTunings } from '../../../shared/config/aiDifficulty';
import type { DrivingConfig } from '../../../shared/config/driving';
import type { ItemType } from '../../../shared/config/items';
import { DEFAULT_KART_STATS, driveModifiersFor, type KartLoadout, type KartStatsTable } from '../../../shared/config/kartLoadout';
import type { MapConfig } from '../maps/shared/mapConfig';
import { NEUTRAL_INPUT, type InputFrame } from '../../../shared/input/actions';
import { DEFAULT_KART_DRIVE_FACTORS, type KartDriveFactors, type KartState } from '../kart/kartState';
import { raceProgressScore, type KartProgress } from '../race/raceState';

export interface RaceAiParticipant {
  readonly state: KartState;
  readonly progress: KartProgress;
  readonly aiDriver: AiDriverState | null;
  readonly difficulty: AiDifficulty | null;
  readonly heldItem: ItemType | null;
  readonly isAi: boolean;
  readonly loadout?: KartLoadout;
}

function combineWithLoadout(base: KartDriveFactors, loadout: KartLoadout, stats: KartStatsTable): KartDriveFactors {
  const modifiers = driveModifiersFor(loadout, stats);
  return {
    topSpeedFactor: base.topSpeedFactor * modifiers.topSpeedFactor,
    accelerationFactor: base.accelerationFactor * modifiers.accelerationFactor,
    steerRateFactor: modifiers.steerRateFactor,
    driftYawRateFactor: modifiers.driftYawRateFactor,
    driftBoostFactor: modifiers.driftBoostFactor,
    offroadPenaltyShare: modifiers.offroadPenaltyShare,
    surfaceFactors: stats.surfaces,
    massFactor: modifiers.massFactor,
    rammingFactor: modifiers.rammingFactor,
  };
}

export function driveFactorsOf(loadout: KartLoadout): KartDriveFactors {
  return combineWithLoadout(DEFAULT_KART_DRIVE_FACTORS, loadout, DEFAULT_KART_STATS);
}

export function raceDriveFactors(
  participants: readonly RaceAiParticipant[],
  difficulties: AiDifficultyTunings,
  stats: KartStatsTable = DEFAULT_KART_STATS,
): readonly KartDriveFactors[] {
  return participants.map((participant) => {
    const base = participant.isAi && participant.difficulty ? difficulties[participant.difficulty] : DEFAULT_KART_DRIVE_FACTORS;
    return participant.loadout ? combineWithLoadout(base, participant.loadout, stats) : base;
  });
}

export function raceInputFrames(
  participants: readonly RaceAiParticipant[],
  humanFrames: readonly InputFrame[],
  map: MapConfig,
  config: AiConfig,
  difficulties: AiDifficultyTunings,
  driving: DrivingConfig,
  stepSeconds: number,
): readonly InputFrame[] {
  const scores = participants.map((participant) => raceProgressScore(map, participant.progress, participant.state.x, participant.state.z));
  const leaderScore = Math.max(...scores, 0);

  return participants.map((participant, index) => {
    if (participant.isAi && participant.progress.finished) return NEUTRAL_INPUT;
    if (!participant.isAi || !participant.aiDriver || !participant.difficulty) return humanFrames[index] ?? NEUTRAL_INPUT;
    const otherKarts = participants
      .filter((other, otherIndex) => otherIndex !== index && !other.progress.finished && other.state.levelId === participant.state.levelId)
      .map((other) => ({ x: other.state.x, z: other.state.z, yaw: other.state.yaw, guideSlot: other.aiDriver?.guideSlot ?? -1 }));
    const rubberBanding = { myScore: scores[index] ?? 0, leaderScore };
    const frame = driveAiKart(participant.state, {
      config,
      difficulty: difficulties[participant.difficulty],
      driving,
      map,
      aiState: participant.aiDriver,
      stepSeconds,
      otherKarts,
      rubberBanding,
      ...(map.aiPaceFactors ? { paceFactor: map.aiPaceFactors[participant.difficulty] } : {}),
      ...(map.aiOffCourseMeters === undefined ? {} : { maxLateralOffset: map.aiOffCourseMeters }),
    });
    return participant.heldItem !== null && shouldAiUseHeldItem(config, participant.heldItem, participant.state, otherKarts, rubberBanding)
      ? { ...frame, useItem: true }
      : frame;
  });
}
