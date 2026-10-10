import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { DEFAULT_RACE } from '../../src/shared/config/race';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { createRng } from '../../src/shared/core/rng';
import type { InputFrame } from '../../src/shared/input/actions';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createProgress, placeByKart, rankKarts, updateProgress } from '../../src/games/kart/race/raceState';
import { createItemBoxStates, stepItemBoxes, type ItemCarrier } from '../../src/games/kart/items/itemBoxes';

const STEP = 1 / 60;
const STEPS = 1200;
const KART_COUNT = 2;

function recordInputs(seed: number, steps: number): readonly (readonly InputFrame[])[] {
  const rng = createRng(seed);
  const frames: InputFrame[][] = [];
  const held = Array.from({ length: KART_COUNT }, () => ({ steer: 0, drift: false }));

  for (let step = 0; step < steps; step += 1) {
    frames.push(
      held.map((state) => {
        if (rng.next() < 0.04) state.steer = rng.nextInt(3) - 1;
        if (rng.next() < 0.03) state.drift = !state.drift;
        return {
          steer: state.steer,
          accelerate: rng.next() < 0.9,
          brake: rng.next() < 0.05,
          drift: state.drift,
          useItem: false,
          pause: false,
          menuUp: false,
          menuDown: false,
          confirm: false,
        };
      }),
    );
  }
  return frames;
}

function simulate(inputs: readonly (readonly InputFrame[])[]): string {
  const driving = createRuntimeDriving();
  const items = createRuntimeItems();
  const karts = RING_TEST_MAP.startPositions.slice(0, KART_COUNT).map((start) => createKartState(start.x, start.z, start.yaw));
  const progresses = RING_TEST_MAP.startPositions.slice(0, KART_COUNT).map((start) => createProgress(start.x, start.z));
  const itemBoxes = createItemBoxStates(RING_TEST_MAP);
  const itemRng = createRng(1);
  const carriers: ItemCarrier[] = karts.map((kart) => ({ state: kart, heldItem: null }));
  let ranks: readonly number[] = karts.map(() => 1);

  inputs.forEach((frames, step) => {
    stepAllKarts(driving, RING_TEST_MAP, karts, frames, STEP);
    stepItemBoxes(RING_TEST_MAP, itemBoxes, items, carriers, ranks, itemRng, STEP);
    karts.forEach((kart, index) => {
      const progress = progresses[index];
      if (progress) {
        updateProgress(RING_TEST_MAP, DEFAULT_RACE.lapCount, progress, kart.x, kart.z, step * STEP);
      }
    });
    ranks = placeByKart(
      rankKarts(
        RING_TEST_MAP,
        karts.map((kart, index) => ({ progress: progresses[index]!, x: kart.x, z: kart.z })),
      ),
    );
  });

  return JSON.stringify({ karts, progresses, itemBoxes, heldItems: carriers.map((carrier) => carrier.heldItem) });
}

describe('simulation determinism', () => {
  it('produces the same state for the same seed and the same inputs', () => {
    const inputs = recordInputs(20260922, STEPS);
    expect(simulate(inputs)).toBe(simulate(inputs));
  });

  it('produces the same state when the same seed is replayed from scratch', () => {
    expect(simulate(recordInputs(7, STEPS))).toBe(simulate(recordInputs(7, STEPS)));
  });

  it('produces a different state for a different seed', () => {
    expect(simulate(recordInputs(1, STEPS))).not.toBe(simulate(recordInputs(2, STEPS)));
  });

  it('keeps every kart inside the room over a long run', () => {
    const inputs = recordInputs(99, STEPS);
    const finalState = JSON.parse(simulate(inputs)) as { karts: { x: number; z: number }[] };
    const halfWidth = RING_TEST_MAP.room.width / 2;
    const halfDepth = RING_TEST_MAP.room.depth / 2;

    for (const kart of finalState.karts) {
      expect(Math.abs(kart.x)).toBeLessThan(halfWidth);
      expect(Math.abs(kart.z)).toBeLessThan(halfDepth);
      expect(Number.isFinite(kart.x)).toBe(true);
    }
  });
});
