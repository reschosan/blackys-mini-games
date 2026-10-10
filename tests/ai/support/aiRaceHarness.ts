import { createAiDriverState } from '../../../src/games/kart/ai/aiDriver';
import { raceDriveFactors, raceInputFrames } from '../../../src/games/kart/ai/raceAiInput';
import { DEFAULT_AI } from '../../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY, type AiDifficulty } from '../../../src/shared/config/aiDifficulty';
import { createRuntimeDriving } from '../../../src/shared/config/driving';
import { createRuntimeItems, type ItemType } from '../../../src/shared/config/items';
import type { KartLoadout } from '../../../src/shared/config/kartLoadout';
import { DEFAULT_RACE } from '../../../src/shared/config/race';
import type { MapConfig } from '../../../src/games/kart/maps/shared/mapConfig';
import { createRng } from '../../../src/shared/core/rng';
import { stepRaceSimulation } from '../../../src/games/kart/race/raceSimulation';
import { createKartState, type KartState } from '../../../src/games/kart/kart/kartState';
import { evaluateFinish } from '../../../src/games/kart/race/finish';
import { createProgress, type KartProgress } from '../../../src/games/kart/race/raceState';
import { type Hairball } from '../../../src/games/kart/items/hairballs';
import { createItemBoxStates } from '../../../src/games/kart/items/itemBoxes';
import { createFieldItems } from '../../../src/games/kart/items/fieldItems';
import { type Trap } from '../../../src/games/kart/items/traps';

const STEP_SECONDS = 1 / 60;
const KART_COUNT = 4;
export const RACE_COUNT = 20;
export const MAX_RACE_SECONDS = 420;
const MAX_REPOSITION_SECONDS = 8;

interface AiRacer {
  readonly state: KartState;
  readonly progress: KartProgress;
  readonly aiDriver: ReturnType<typeof createAiDriverState>;
  readonly difficulty: AiDifficulty;
  readonly isAi: true;
  heldItem: ItemType | null;
  previousUseItem: boolean;
  loadout?: KartLoadout;
}

interface AiRaceResult {
  readonly valid: boolean;
  readonly racers: readonly {
    readonly x: number;
    readonly z: number;
    readonly lap: number;
    readonly checkpointsPassed: number;
    readonly finished: boolean;
    readonly finishTimeSeconds: number | null;
    readonly lapTimesSeconds?: readonly number[];
    readonly repositioning: boolean;
    readonly routeNodeIndex: number;
    readonly levelId: string;
    readonly speed: number;
    readonly yaw: number;
  }[];
}

/** Four AI karts race the map with a seed; invalid when one is stuck repositioning or ends up outside the room. */
export function runAiRace(
  map: MapConfig,
  seed: number,
  firstSlot = 0,
  difficulty: AiDifficulty = 'medium',
  maxSeconds = MAX_RACE_SECONDS,
  measureLaps = false,
  loadouts: readonly KartLoadout[] = [],
): AiRaceResult {
  const driving = createRuntimeDriving();
  const items = createRuntimeItems(map.itemOverrides);
  const racers: AiRacer[] = map.startPositions.slice(firstSlot, KART_COUNT).map((start, index) => ({
    state: createKartState(start.x, start.z, start.yaw, start.levelId),
    progress: createProgress(start.x, start.z, start.levelId),
    aiDriver: createAiDriverState(index + firstSlot),
    difficulty,
    isAi: true,
    heldItem: null,
    previousUseItem: false,
    ...(loadouts[index + firstSlot] ? { loadout: loadouts[index + firstSlot]! } : {}),
  }));
  const itemBoxes = createItemBoxStates(map);
  const itemRng = createRng(seed);
  const hairballs: Hairball[] = [];
  const traps: Trap[] = [];
  const fieldItems = createFieldItems();
  let places: readonly number[] = racers.map(() => 1);
  const repositionSeconds = racers.map(() => 0);
  const lapStarts = racers.map(() => 0);
  const lapTimes = racers.map(() => [] as number[]);
  let finishDeadlineSeconds: number | null = null;

  for (let step = 0; step < maxSeconds / STEP_SECONDS; step += 1) {
    const previousLaps = racers.map((racer) => racer.progress.lap);
    const inputs = raceInputFrames(racers, [], map, DEFAULT_AI, DEFAULT_AI_DIFFICULTY, driving, STEP_SECONDS);

    places = stepRaceSimulation({
      map,
      driving,
      items,
      participants: racers,
      frames: inputs,
      driveFactors: raceDriveFactors(racers, DEFAULT_AI_DIFFICULTY),
      hairballs,
      traps,
      fieldItems,
      itemBoxes,
      places,
      rng: itemRng,
      lapCount: map.lapCount ?? DEFAULT_RACE.lapCount,
      raceTimeSeconds: step * STEP_SECONDS,
      stepSeconds: STEP_SECONDS,
    });

    for (let index = 0; index < racers.length; index += 1) {
      const racer = racers[index]!;
      if (measureLaps && racer.progress.lap > previousLaps[index]!) {
        const elapsed = step * STEP_SECONDS - lapStarts[index]!;
        lapTimes[index]!.push(elapsed);
        lapStarts[index] = step * STEP_SECONDS;
      }
      repositionSeconds[index] = !racer.progress.finished && racer.aiDriver.repositioning ? (repositionSeconds[index] ?? 0) + STEP_SECONDS : 0;
      if ((repositionSeconds[index] ?? 0) > MAX_REPOSITION_SECONDS) return raceResult(false, racers, measureLaps ? lapTimes : undefined);
    }

    const raceTimeSeconds = step * STEP_SECONDS;
    const finishStatus = evaluateFinish(
      racers.map((racer) => racer.progress.finished),
      raceTimeSeconds,
      DEFAULT_RACE.finishCountdownSeconds,
      finishDeadlineSeconds,
    );
    finishDeadlineSeconds = finishStatus.deadlineSeconds;
    if (
      maxSeconds === MAX_RACE_SECONDS
        ? finishStatus.raceOver && (!map.routeNodes || racers.every((racer) => racer.progress.finished))
        : racers.every((racer) => racer.progress.finished)
    ) {
      const validPositions = racers.every(
        (racer) =>
          Number.isFinite(racer.state.x) &&
          Number.isFinite(racer.state.z) &&
          Math.abs(racer.state.x - map.room.x) < map.room.width / 2 &&
          Math.abs(racer.state.z - map.room.z) < map.room.depth / 2 &&
          racer.progress.checkpointsPassed > 0,
      );
      return raceResult(validPositions, racers, measureLaps ? lapTimes : undefined);
    }
  }

  return raceResult(false, racers, measureLaps ? lapTimes : undefined);
}

function raceResult(valid: boolean, racers: readonly AiRacer[], lapTimes?: readonly (readonly number[])[]): AiRaceResult {
  return {
    valid,
    racers: racers.map((racer, index) => ({
      x: racer.state.x,
      z: racer.state.z,
      lap: racer.progress.lap,
      checkpointsPassed: racer.progress.checkpointsPassed,
      finished: racer.progress.finished,
      finishTimeSeconds: racer.progress.finishTimeSeconds,
      ...(lapTimes ? { lapTimesSeconds: lapTimes[index] } : {}),
      repositioning: racer.aiDriver.repositioning,
      routeNodeIndex: racer.aiDriver.routeNodeIndex,
      levelId: racer.state.levelId,
      speed: Math.hypot(racer.state.velocityX, racer.state.velocityZ),
      yaw: racer.state.yaw,
      windowJumpId: racer.state.windowJumpId,
      penaltySecondsLeft: racer.state.penaltySecondsLeft,
    })),
  };
}

export function medianOf(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

export const nextTask = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));
