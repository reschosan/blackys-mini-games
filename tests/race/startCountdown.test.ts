import { describe, expect, it } from 'vitest';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { DEFAULT_RACE } from '../../src/shared/config/race';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import type { RacePlayer } from '../../src/games/kart/race/racePlayer';
import { createProgress } from '../../src/games/kart/race/raceState';
import { RaceStartCountdown } from '../../src/games/kart/race/startCountdown';

const STEP = 1 / 60;
const race = { ...DEFAULT_RACE, startCountdownSeconds: 3, earlyBoostWindowSeconds: 0.35, earlyBoostSeconds: 1, startGoDisplaySeconds: 0.6 };

function player(isAi = false): RacePlayer {
  return {
    state: createKartState(0, 0, 0),
    progress: createProgress(0, 0),
    isAi,
    aiDriver: null,
    difficulty: null,
    loadout: createKartLoadout(),
    heldItem: null,
    previousUseItem: false,
    raceStartEarlyPress: false,
    raceStartBoostEarned: false,
  };
}

const pressing = (accelerate: boolean): InputFrame => ({ ...NEUTRAL_INPUT, accelerate });

function run(countdown: RaceStartCountdown, players: RacePlayer[], frameFor: (secondsLeft: number) => InputFrame, events = { beeps: 0, goes: 0 }) {
  let elapsed = 0;
  while (countdown.active) {
    countdown.step(players, [frameFor(race.startCountdownSeconds - elapsed)], STEP, race, {
      beep: () => {
        events.beeps += 1;
      },
      go: () => {
        events.goes += 1;
      },
    });
    elapsed += STEP;
  }
  return events;
}

describe('RaceStartCountdown', () => {
  it('counts 3, 2, 1 and then shows Los! before the label disappears', () => {
    const countdown = new RaceStartCountdown();
    countdown.reset(3);
    expect(countdown.label()).toBe('3');
    run(countdown, [player()], () => pressing(false));
    expect(countdown.active).toBe(false);
    expect(countdown.label()).toBe('Los!');
    countdown.tickGoDisplay(race.startGoDisplaySeconds);
    expect(countdown.label()).toBeNull();
  });

  it('beeps once per second change and signals go exactly once', () => {
    const countdown = new RaceStartCountdown();
    countdown.reset(3);
    const events = run(countdown, [player()], () => pressing(false));
    expect(events.beeps).toBe(2);
    expect(events.goes).toBe(1);
  });

  it('gives the early boost for pressing accelerate only inside the window before Los', () => {
    const countdown = new RaceStartCountdown();
    const late = player();
    countdown.reset(3);
    run(countdown, [late], (secondsLeft) => pressing(secondsLeft <= race.earlyBoostWindowSeconds));
    expect(late.state.boostSeconds).toBe(race.earlyBoostSeconds);
  });

  it('withholds the boost for a press that came too early, even if the player keeps holding', () => {
    const countdown = new RaceStartCountdown();
    const early = player();
    countdown.reset(3);
    run(countdown, [early], (secondsLeft) => pressing(secondsLeft <= 2));
    expect(early.raceStartEarlyPress).toBe(true);
    expect(early.state.boostSeconds).toBe(0);
  });

  it('gives auto-gas players the boost even though their gas is on from the first second', () => {
    const countdown = new RaceStartCountdown();
    const autoGas = player();
    countdown.reset(3);
    run(countdown, [autoGas], () => ({ ...NEUTRAL_INPUT, accelerate: true, autoGas: true }));
    expect(autoGas.raceStartEarlyPress).toBe(false);
    expect(autoGas.state.boostSeconds).toBe(race.earlyBoostSeconds);
  });

  it('gives an auto-gas player who holds the brake no boost', () => {
    const countdown = new RaceStartCountdown();
    const braking = player();
    countdown.reset(3);
    run(countdown, [braking], () => ({ ...NEUTRAL_INPUT, accelerate: false, brake: true, autoGas: true }));
    expect(braking.state.boostSeconds).toBe(0);
  });

  it('ignores AI karts in the press minigame and honours a boost rolled for them', () => {
    const countdown = new RaceStartCountdown();
    const ai = player(true);
    ai.raceStartBoostEarned = true;
    countdown.reset(3);
    run(countdown, [ai], () => pressing(true));
    expect(ai.raceStartEarlyPress).toBe(false);
    expect(ai.state.boostSeconds).toBe(race.earlyBoostSeconds);
  });
});
