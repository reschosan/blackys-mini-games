import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createRng } from '../../src/shared/core/rng';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createProgress } from '../../src/games/kart/race/raceState';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createRaceWorld, resetRaceWorld } from '../../src/games/kart/race/raceWorld';
import { RING_TEST_MAP } from '../support/ringTestMap';

describe('a race world without items (time trial)', () => {
  it('has every box collected, from the start and after a reset', () => {
    const world = createRaceWorld(RING_TEST_MAP, false);
    expect(world.itemBoxes).toHaveLength(RING_TEST_MAP.itemBoxes.length);
    expect(world.itemBoxes.every((box) => box.collected)).toBe(true);
    resetRaceWorld(world, RING_TEST_MAP, true);
    expect(world.itemBoxes.some((box) => box.collected)).toBe(false);
    resetRaceWorld(world, RING_TEST_MAP, false);
    expect(world.itemBoxes.every((box) => box.collected)).toBe(true);
  });

  it('keeps every box collected while karts drive through them, and nobody gets an item', () => {
    const world = createRaceWorld(RING_TEST_MAP, false);
    const box = RING_TEST_MAP.itemBoxes[0]!;
    const participant = {
      state: createKartState(box.x, box.z, 0, box.levelId),
      progress: createProgress(box.x, box.z, box.levelId),
      heldItem: null,
      previousUseItem: false,
    };
    for (let tick = 0; tick < 120; tick += 1) {
      stepRaceSimulation({
        map: RING_TEST_MAP,
        driving: createRuntimeDriving(),
        items: createRuntimeItems(),
        participants: [participant],
        frames: [NEUTRAL_INPUT],
        hairballs: world.hairballs,
        traps: world.traps,
        fieldItems: world.fieldItems,
        tankFire: world.tankFire,
        itemBoxes: world.itemBoxes,
        itemsEnabled: false,
        places: [1],
        rng: createRng(1),
        lapCount: 1,
        raceTimeSeconds: tick / 60,
        stepSeconds: 1 / 60,
      });
    }
    expect(participant.heldItem).toBeNull();
    expect(world.itemBoxes.every((state) => state.collected)).toBe(true);
  });
});
