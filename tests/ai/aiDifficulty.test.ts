import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_DIFFICULTY, type AiDifficulty } from '../../src/shared/config/aiDifficulty';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState, forwardSpeedOf, stepKart } from '../../src/games/kart/kart/kartState';

describe('AI driving difficulty', () => {
  it.each([
    ['hard', 1.32],
    ['medium', 1.2],
    ['easy', 1.14],
  ] as const)('%s uses the requested speed and acceleration fraction', (difficulty: AiDifficulty, factor: number) => {
    const state = createKartState(0, 0, 0);
    const tuning = DEFAULT_AI_DIFFICULTY[difficulty];
    expect(tuning.topSpeedFactor).toBe(factor);
    expect(tuning.accelerationFactor).toBe(factor);

    stepKart(DEFAULT_DRIVING, state, { ...NEUTRAL_INPUT, accelerate: true }, 1 / 60, tuning);
    expect(forwardSpeedOf(state)).toBeCloseTo((DEFAULT_DRIVING.acceleration * factor) / 60, 5);
    for (let tick = 1; tick < 180; tick += 1) {
      stepKart(DEFAULT_DRIVING, state, { ...NEUTRAL_INPUT, accelerate: true }, 1 / 60, tuning);
    }
    expect(forwardSpeedOf(state)).toBeCloseTo(DEFAULT_DRIVING.maxSpeed * factor, 5);
  });
});
