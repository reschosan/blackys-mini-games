import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createKartState, forwardSpeedOf, stepKart, type KartDriveFactors, type KartState } from '../../src/games/kart/kart/kartState';
import { driveFactorsOf } from '../../src/games/kart/ai/raceAiInput';

function lateralSpeedOf(state: KartState): number {
  return Math.abs(state.velocityX * -Math.sin(state.yaw) + state.velocityZ * Math.cos(state.yaw));
}

const STEP = 1 / 60;

function input(overrides: Partial<InputFrame>): InputFrame {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function drive(state: KartState, frame: InputFrame, seconds: number): void {
  const config = createRuntimeDriving();
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) stepKart(config, state, frame, STEP);
}

describe('stepKart throttle', () => {
  it('accelerates up to the configured top speed', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    for (let step = 0; step < 600; step += 1) {
      stepKart(config, state, input({ accelerate: true }), STEP);
    }
    expect(forwardSpeedOf(state)).toBeCloseTo(config.maxSpeed, 1);
  });

  it('caps the top speed offroad', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    state.onCarpet = false;
    for (let step = 0; step < 600; step += 1) {
      stepKart(config, state, input({ accelerate: true }), STEP);
    }
    expect(forwardSpeedOf(state)).toBeLessThan(config.maxSpeed * config.offroadSpeedFactor + 0.5);
  });

  it('shifts into reverse when braking at a standstill', () => {
    const state = createKartState(0, 0, 0);
    drive(state, input({ brake: true }), 1);
    expect(forwardSpeedOf(state)).toBeLessThan(0);
  });

  it('brakes to a standstill before reversing', () => {
    const state = createKartState(0, 0, 0);
    drive(state, input({ accelerate: true }), 2);
    const speedBefore = forwardSpeedOf(state);
    drive(state, input({ brake: true }), 0.2);
    expect(forwardSpeedOf(state)).toBeGreaterThan(0);
    expect(forwardSpeedOf(state)).toBeLessThan(speedBefore);
  });

  it('rolls out when no pedal is pressed', () => {
    const state = createKartState(0, 0, 0);
    drive(state, input({ accelerate: true }), 2);
    const speedBefore = forwardSpeedOf(state);
    drive(state, NEUTRAL_INPUT, 0.5);
    expect(forwardSpeedOf(state)).toBeLessThan(speedBefore);
  });
});

describe('stepKart steering', () => {
  it('turns less at top speed than at low speed', () => {
    const slow = createKartState(0, 0, 0);
    drive(slow, input({ accelerate: true }), 0.4);
    const slowStart = slow.yaw;
    drive(slow, input({ accelerate: true, steer: 1 }), 0.2);
    const slowTurn = slow.yaw - slowStart;

    const fast = createKartState(0, 0, 0);
    drive(fast, input({ accelerate: true }), 5);
    const fastStart = fast.yaw;
    drive(fast, input({ accelerate: true, steer: 1 }), 0.2);
    const fastTurn = fast.yaw - fastStart;

    expect(fastTurn).toBeLessThan(slowTurn);
  });

  it('does not turn while standing still', () => {
    const state = createKartState(0, 0, 0);
    drive(state, input({ steer: 1 }), 0.5);
    expect(state.yaw).toBe(0);
  });
});

describe('stepKart drift', () => {
  it('charges three stages while the drift is held', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    drive(state, input({ accelerate: true }), 2);

    const driftInput = input({ accelerate: true, drift: true, steer: 1 });
    const stageAfter = (seconds: number): number => {
      let guard = 0;
      while (state.driftCharge < seconds && guard < 1000) {
        stepKart(config, state, driftInput, STEP);
        guard += 1;
      }
      expect(state.driftDirection).not.toBe(0);
      return state.driftStage;
    };

    expect(state.driftStage).toBe(0);
    expect(stageAfter(config.driftStageSeconds[0])).toBe(1);
    expect(stageAfter(config.driftStageSeconds[1])).toBe(2);
    expect(stageAfter(config.driftStageSeconds[2])).toBe(3);
  });

  it('grants the stage boost when the drift button is released', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    drive(state, input({ accelerate: true }), 2);

    const driftInput = input({ accelerate: true, drift: true, steer: 1 });
    let guard = 0;
    while (state.driftStage < 2 && guard < 1000) {
      stepKart(config, state, driftInput, STEP);
      guard += 1;
    }

    stepKart(config, state, input({ accelerate: true }), STEP);
    expect(state.boostSeconds).toBeCloseTo(config.driftBoostSeconds[1] - STEP);
    expect(state.driftDirection).toBe(0);
    expect(state.driftStage).toBe(0);
  });

  it('grants no boost when the drift is released before the first stage', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    drive(state, input({ accelerate: true }), 2);

    stepKart(config, state, input({ accelerate: true, drift: true, steer: 1 }), STEP);
    stepKart(config, state, input({ accelerate: true }), STEP);
    expect(state.boostSeconds).toBe(0);
  });

  it('refuses to start a drift below the minimum speed', () => {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    stepKart(config, state, input({ drift: true, steer: 1 }), STEP);
    expect(state.driftDirection).toBe(0);
  });

  it('slides sideways more while drifting than while gripping', () => {
    const config = createRuntimeDriving();
    const gripping = createKartState(0, 0, 0);
    const drifting = createKartState(0, 0, 0);
    drive(gripping, input({ accelerate: true }), 2);
    drive(drifting, input({ accelerate: true }), 2);

    for (let step = 0; step < 60; step += 1) {
      stepKart(config, gripping, input({ accelerate: true, steer: 1 }), STEP);
      stepKart(config, drifting, input({ accelerate: true, steer: 1, drift: true }), STEP);
    }
    expect(lateralSpeedOf(drifting)).toBeGreaterThan(lateralSpeedOf(gripping));
  });
});

describe('stepKart with a kart loadout', () => {
  function topSpeedWith(factors: KartDriveFactors, onCarpet = true): number {
    const config = createRuntimeDriving();
    const state = createKartState(0, 0, 0);
    state.onCarpet = onCarpet;
    for (let step = 0; step < 900; step += 1) stepKart(config, state, input({ accelerate: true }), STEP, factors);
    return forwardSpeedOf(state);
  }

  const plain = driveFactorsOf(createKartLoadout());

  it('reaches a higher top speed with a sports car and a lower one with a tank', () => {
    expect(topSpeedWith(driveFactorsOf(createKartLoadout(0, 'sportsCar')))).toBeGreaterThan(topSpeedWith(plain));
    expect(topSpeedWith(driveFactorsOf(createKartLoadout(0, 'tank')))).toBeLessThan(topSpeedWith(plain));
  });

  it('loses no speed offroad with offroad wheels but more with slick wheels', () => {
    const offroadWheels = driveFactorsOf(createKartLoadout(0, 'car', 'offroad'));
    const slick = driveFactorsOf(createKartLoadout(0, 'car', 'slick'));
    const config = createRuntimeDriving();
    expect(topSpeedWith(offroadWheels, false)).toBeCloseTo(config.maxSpeed * 0.95, 1);
    expect(topSpeedWith(slick, false)).toBeLessThan(topSpeedWith(plain, false));
  });

  it('turns tighter on a skateboard than in a tank', () => {
    const yawAfterSteering = (factors: KartDriveFactors): number => {
      const state = createKartState(0, 0, 0);
      state.velocityX = 10;
      for (let step = 0; step < 30; step += 1) stepKart(createRuntimeDriving(), state, input({ accelerate: true, steer: 1 }), STEP, factors);
      return state.yaw;
    };
    expect(yawAfterSteering(driveFactorsOf(createKartLoadout(0, 'skateboard')))).toBeGreaterThan(
      yawAfterSteering(driveFactorsOf(createKartLoadout(0, 'tank'))),
    );
  });

  it('earns a shorter drift boost on a motorcycle', () => {
    const boostAfterDrift = (factors: KartDriveFactors): number => {
      const state = createKartState(0, 0, 0);
      state.velocityX = 15;
      for (let step = 0; step < 90; step += 1) stepKart(createRuntimeDriving(), state, input({ accelerate: true, drift: true, steer: 1 }), STEP, factors);
      stepKart(createRuntimeDriving(), state, input({ accelerate: true }), STEP, factors);
      return state.boostSeconds;
    };
    const motorcycle = boostAfterDrift(driveFactorsOf(createKartLoadout(0, 'motorcycle')));
    expect(motorcycle).toBeGreaterThan(0);
    expect(motorcycle).toBeLessThan(boostAfterDrift(plain));
  });
});
