import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState, hopHeightOf, speedOf, stepKart } from '../../src/games/kart/kart/kartState';
import { hasShoveTarget, shove, shoveTarget } from '../../src/games/kart/kart/kartShove';
import { sumoShove } from '../../src/games/kart/modes/rules/sumo';

const config = sumoShove(createRuntimeModes().sumo);
const STEP = 1 / 60;

/** A kart at the origin facing east (+x). */
const shover = () => createKartState(0, 0, 0);

describe('the shove of Sumo', () => {
  it('hits the nearest kart ahead and leaves the ones behind, beside and too far away alone', () => {
    const near = createKartState(3, 0.5, 0);
    const far = createKartState(6, 0, 0);
    const behind = createKartState(-2, 0, 0);
    const beside = createKartState(0, 3, 0);
    const outOfReach = createKartState(config.range + 2, 0, 0);
    expect(shoveTarget(shover(), [far, behind, beside, near, outOfReach], config)).toBe(near);
    expect(shoveTarget(shover(), [behind, beside, outOfReach], config)).toBeNull();
  });

  it('throws the target away from the shover and into the air', () => {
    const target = createKartState(3, 0, Math.PI / 2);
    shove(shover(), [target], config);
    expect(target.velocityX).toBeCloseTo(config.speed);
    expect(target.velocityZ).toBeCloseTo(0);
    expect(target.airborneSecondsLeft).toBe(config.flightSeconds);
  });

  it('has to recharge after every press, also after a miss', () => {
    const kart = shover();
    expect(shove(kart, [], config)).toBeNull();
    expect(kart.shoveCooldownSeconds).toBe(config.cooldownSeconds);
    const target = createKartState(3, 0, 0);
    expect(hasShoveTarget(kart, [target], config)).toBe(false);
    expect(shove(kart, [target], config)).toBeNull();
    for (let tick = 0; tick < Math.ceil(config.cooldownSeconds / STEP) + 1; tick += 1) stepKart(createRuntimeDriving(), kart, NEUTRAL_INPUT, STEP);
    expect(shove(kart, [target], config)).toBe(target);
  });

  it('lets a flying kart keep its speed, hop up and land again', () => {
    const target = createKartState(3, 0, 0);
    shove(shover(), [target], config);
    const driving = createRuntimeDriving();
    let highest = 0;
    for (let tick = 0; tick < Math.round(config.flightSeconds / STEP); tick += 1) {
      stepKart(driving, target, { ...NEUTRAL_INPUT, steer: 1, brake: true }, STEP);
      highest = Math.max(highest, hopHeightOf(target));
    }
    expect(speedOf(target)).toBeCloseTo(config.speed);
    expect(target.x).toBeGreaterThan(3 + config.speed * config.flightSeconds * 0.9);
    expect(highest).toBeGreaterThan(1);
    expect(target.airborneSecondsLeft).toBeLessThan(STEP);
  });
});
