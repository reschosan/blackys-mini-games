import { describe, expect, it } from 'vitest';
import { evaluateFinish } from '../../src/games/kart/race/finish';
import { DEFAULT_RACE } from '../../src/shared/config/race';

const COUNTDOWN = DEFAULT_RACE.finishCountdownSeconds;

describe('evaluateFinish', () => {
  it('keeps the race running while nobody has finished', () => {
    expect(evaluateFinish([false, false], 30, COUNTDOWN, null)).toEqual({
      deadlineSeconds: null,
      raceOver: false,
    });
  });

  it('ends the race at once when everybody has finished', () => {
    expect(evaluateFinish([true, true], 30, COUNTDOWN, null).raceOver).toBe(true);
  });

  it('starts the countdown when the first kart finishes', () => {
    const status = evaluateFinish([true, false], 30, COUNTDOWN, null);
    expect(status.deadlineSeconds).toBe(30 + COUNTDOWN);
    expect(status.raceOver).toBe(false);
  });

  it('keeps the deadline once it has been set', () => {
    const deadline = 50;
    expect(evaluateFinish([true, false], 40, COUNTDOWN, deadline).deadlineSeconds).toBe(deadline);
  });

  it('ends the race when the countdown runs out', () => {
    expect(evaluateFinish([true, false], 50, COUNTDOWN, 50).raceOver).toBe(true);
    expect(evaluateFinish([true, false], 49.9, COUNTDOWN, 50).raceOver).toBe(false);
  });

  it('does nothing without players', () => {
    expect(evaluateFinish([], 10, COUNTDOWN, null).raceOver).toBe(false);
  });
});
