import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { fireVacuum, stepVacuumPulses } from '../../src/games/kart/items/vacuum';

describe('vacuum', () => {
  it('stuns and pulls a kart in the cone toward the user', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);
    const target = createKartState(8, 0, 0);
    target.velocityX = 10;

    fireVacuum(user, 0, [user, target], items);

    expect(target.stunSecondsLeft).toBeCloseTo(items.vacuum.stunSeconds);
    expect(target.velocityX).toBeCloseTo(10 * items.vacuum.velocityLossFactor - items.vacuum.pullSpeedMetersPerSecond);
  });

  it('ignores the user, karts behind, out of range, and on another level', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);
    const others = [createKartState(-5, 0, 0), createKartState(items.vacuum.rangeMeters + 2, 0, 0), createKartState(5, 0, 0, 'second')];

    fireVacuum(user, 0, [user, ...others], items);

    expect([user, ...others].map((kart) => kart.stunSecondsLeft)).toEqual([0, 0, 0, 0]);
  });

  it('is blocked by a shield without pulling, consuming the shield', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);
    const target = createKartState(6, 0, 0);
    target.shieldSecondsLeft = 3;

    fireVacuum(user, 0, [user, target], items);

    expect(target.velocityX).toBe(0);
    expect(target.stunSecondsLeft).toBe(0);
    expect(target.shieldSecondsLeft).toBe(0);
  });

  it('keeps the leader stunned longer', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);
    const leader = createKartState(6, 0, 0);
    leader.leading = true;

    fireVacuum(user, 0, [user, leader], items);

    expect(leader.stunSecondsLeft).toBeCloseTo(items.vacuum.stunSeconds + items.leaderStunBonusSeconds);
  });

  it('removes its visual pulse after the visible time', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);
    const pulses = [fireVacuum(user, 0, [user], items)];

    stepVacuumPulses(pulses, items, items.vacuum.pulseVisibleSeconds + 0.01);

    expect(pulses).toHaveLength(0);
  });
});
