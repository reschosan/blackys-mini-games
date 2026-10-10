import { describe, expect, it } from 'vitest';
import { createAiDriverState } from '../../src/games/kart/ai/aiDriver';
import { aiGuideLine } from '../../src/games/kart/ai/aiGuideLine';
import { raceDriveFactors, raceInputFrames } from '../../src/games/kart/ai/raceAiInput';
import { DEFAULT_AI } from '../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY, type AiDifficulty } from '../../src/shared/config/aiDifficulty';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems, type ItemType } from '../../src/shared/config/items';
import { DEFAULT_RACE } from '../../src/shared/config/race';
import { createRng } from '../../src/shared/core/rng';
import { createFieldItems } from '../../src/games/kart/items/fieldItems';
import { type Hairball } from '../../src/games/kart/items/hairballs';
import { createItemBoxStates } from '../../src/games/kart/items/itemBoxes';
import { type Trap } from '../../src/games/kart/items/traps';
import { createKartState, type KartState } from '../../src/games/kart/kart/kartState';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { SPACE } from '../../src/games/kart/maps/space/map';
import { evaluateFinish } from '../../src/games/kart/race/finish';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createProgress, type KartProgress } from '../../src/games/kart/race/raceState';
import { nearestCentrelinePoint } from '../../src/games/kart/race/routeProgress';
import type { MapConfig } from '../../src/games/kart/maps/shared/mapConfig';

const STEP_SECONDS = 1 / 60;
const KART_COUNT = 4;
const MAX_RACE_SECONDS = 420;

interface AiRacer {
  readonly state: KartState;
  readonly progress: KartProgress;
  readonly aiDriver: ReturnType<typeof createAiDriverState>;
  readonly difficulty: AiDifficulty;
  readonly isAi: true;
  heldItem: ItemType | null;
  previousUseItem: boolean;
}

/** How the AI kart behaved in one race: seconds spent back-on-the-line recovering, and how often it really stalled. */
function runRecoveryRace(map: MapConfig, seed: number, difficulty: AiDifficulty): { recoverySeconds: number; stalls: number } {
  const driving = createRuntimeDriving();
  const items = createRuntimeItems(map.itemOverrides);
  const racers: AiRacer[] = map.startPositions.slice(0, KART_COUNT).map((start, index) => ({
    state: createKartState(start.x, start.z, start.yaw, start.levelId),
    progress: createProgress(start.x, start.z, start.levelId),
    aiDriver: createAiDriverState(index),
    difficulty,
    isAi: true as const,
    heldItem: null,
    previousUseItem: false,
  }));
  const itemBoxes = createItemBoxStates(map);
  const itemRng = createRng(seed);
  const hairballs: Hairball[] = [];
  const traps: Trap[] = [];
  const fieldItems = createFieldItems();
  let places: readonly number[] = racers.map(() => 1);
  let finishDeadlineSeconds: number | null = null;
  const wasRecovering = racers.map(() => false);
  const offCourseMeters = map.aiOffCourseMeters ?? DEFAULT_AI.maxLateralOffset;
  let recoverySeconds = 0;
  let stalls = 0;
  for (let step = 0; step < MAX_RACE_SECONDS / STEP_SECONDS; step += 1) {
    const raceTimeSeconds = step * STEP_SECONDS;
    places = stepRaceSimulation({
      map,
      driving,
      items,
      participants: racers,
      frames: raceInputFrames(racers, [], map, DEFAULT_AI, DEFAULT_AI_DIFFICULTY, driving, STEP_SECONDS),
      driveFactors: raceDriveFactors(racers, DEFAULT_AI_DIFFICULTY),
      hairballs,
      traps,
      fieldItems,
      itemBoxes,
      places,
      rng: itemRng,
      lapCount: map.lapCount ?? DEFAULT_RACE.lapCount,
      raceTimeSeconds,
      stepSeconds: STEP_SECONDS,
    });
    racers.forEach((racer, index) => {
      const recovering = !racer.progress.finished && racer.aiDriver.repositioning;
      if (recovering) recoverySeconds += STEP_SECONDS;
      if (recovering && !wasRecovering[index]) {
        const nearest = nearestCentrelinePoint(aiGuideLine(map, index).centreline, racer.state.x, racer.state.z, racer.state.levelId);
        if (nearest.lateralOffset <= offCourseMeters) stalls += 1;
      }
      wasRecovering[index] = recovering;
    });
    const status = evaluateFinish(
      racers.map((racer) => racer.progress.finished),
      raceTimeSeconds,
      DEFAULT_RACE.finishCountdownSeconds,
      finishDeadlineSeconds,
    );
    finishDeadlineSeconds = status.deadlineSeconds;
    if (status.raceOver) break;
  }
  return { recoverySeconds, stalls };
}

const RECOVERY_SEEDS = 5;
const MAX_RECOVERY_SECONDS_PER_RACE = 20;
const MAX_STALLS_PER_RACE = 2;

describe('AI recovery on the maps with a wide course', () => {
  it.each([
    ['Ring-Testkarte', RING_TEST_MAP],
    ['Naturpfad', NATURE],
    ['Mondbasis', SPACE],
  ] as const)(
    '%s: hard AI karts hardly leave the line and do not stall',
    (_name, map) => {
      const races = Array.from({ length: RECOVERY_SEEDS }, (_, index) => runRecoveryRace(map, index + 1, 'hard'));
      const meanSeconds = races.reduce((sum, race) => sum + race.recoverySeconds, 0) / races.length;
      const meanStalls = races.reduce((sum, race) => sum + race.stalls, 0) / races.length;
      expect(meanSeconds, 'seconds spent recovering per race over four karts').toBeLessThan(MAX_RECOVERY_SECONDS_PER_RACE);
      expect(meanStalls, 'stalls per race').toBeLessThan(MAX_STALLS_PER_RACE);
    },
    120000,
  );
});
