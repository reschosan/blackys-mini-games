import { describe, expect, it } from 'vitest';
import { createAiDriverState } from '../../src/games/kart/ai/aiDriver';
import { raceInputFrames } from '../../src/games/kart/ai/raceAiInput';
import { DEFAULT_AI } from '../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY } from '../../src/shared/config/aiDifficulty';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems, type ItemType } from '../../src/shared/config/items';
import { createRng } from '../../src/shared/core/rng';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { createProgress } from '../../src/games/kart/race/raceState';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';

const STEP_SECONDS = 1 / 60;
const MAX_SECONDS = 240;

/** Four AI karts drive the one lap of a time trial (no items); returns the finish time of each. */
function timeTrialFinishTimes(mapIndex: number): readonly (number | null)[] {
  const map = AVAILABLE_MAPS[mapIndex]!;
  const world = createRaceWorld(map, false);
  const driving = createRuntimeDriving();
  const items = createRuntimeItems(map.itemOverrides);
  const racers = map.startPositions.slice(0, 4).map((start, slot) => ({
    state: createKartState(start.x, start.z, start.yaw, start.levelId),
    progress: createProgress(start.x, start.z, start.levelId),
    aiDriver: createAiDriverState(slot),
    difficulty: 'medium' as const,
    isAi: true as const,
    heldItem: null as ItemType | null,
    previousUseItem: false,
  }));
  const rng = createRng(7);
  let places: readonly number[] = racers.map(() => 1);
  for (let step = 0; step < MAX_SECONDS / STEP_SECONDS && !racers.every((racer) => racer.progress.finished); step += 1) {
    const frames = raceInputFrames(racers, [], map, DEFAULT_AI, DEFAULT_AI_DIFFICULTY, driving, STEP_SECONDS);
    places = stepRaceSimulation({
      map,
      driving,
      items,
      participants: racers,
      frames,
      hairballs: world.hairballs,
      traps: world.traps,
      fieldItems: world.fieldItems,
      tankFire: world.tankFire,
      itemBoxes: world.itemBoxes,
      itemsEnabled: false,
      places,
      rng,
      lapCount: 1,
      raceTimeSeconds: step * STEP_SECONDS,
      stepSeconds: STEP_SECONDS,
    });
  }
  expect(racers.every((racer) => racer.heldItem === null)).toBe(true);
  return racers.map((racer) => racer.progress.finishTimeSeconds);
}

describe('AI karts in a time trial (one lap, no items)', () => {
  it.each(AVAILABLE_MAPS.map((map, index) => [map.name, index] as const))('all four finish the lap on %s', (_name, index) => {
    const times = timeTrialFinishTimes(index);
    expect(times.every((time) => time !== null && time < MAX_SECONDS)).toBe(true);
  });
});
