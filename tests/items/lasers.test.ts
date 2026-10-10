import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { spawnLaserDot, stepLaserDots, withLaserLure } from '../../src/games/kart/items/lasers';

describe('laser pointer', () => {
  it('spawns ahead of the user and moves forward', () => {
    const items = createRuntimeItems();
    const user = createKartState(0, 0, 0);

    const dot = spawnLaserDot(user, 0, items);

    expect(dot.x).toBeCloseTo(items.laser.spawnDistanceMeters);
    expect(dot.vx).toBeCloseTo(items.laser.speedMetersPerSecond);
  });

  it('disappears after its lifetime', () => {
    const items = createRuntimeItems();
    const dots = [spawnLaserDot(createKartState(0, 0, 0), 0, items)];

    stepLaserDots(dots, RING_TEST_MAP, items.laser.lifetimeSeconds + 0.1);

    expect(dots).toHaveLength(0);
  });

  it('lures another kart: steers toward a dot to its left and right', () => {
    const items = createRuntimeItems();
    const dot = spawnLaserDot(createKartState(0, 0, 0), 0, items);
    const victimFacingEast = createKartState(2, 3, 0);
    const lureToTheSideOfSouth = { ...dot, x: 2, z: 3 + 5 };
    const lureToTheSideOfNorth = { ...dot, x: 2, z: 3 - 5 };

    const toPositiveZ = withLaserLure(NEUTRAL_INPUT, victimFacingEast, 1, [lureToTheSideOfSouth], items);
    const toNegativeZ = withLaserLure(NEUTRAL_INPUT, victimFacingEast, 1, [lureToTheSideOfNorth], items);

    expect(toPositiveZ.steer).toBeGreaterThan(0);
    expect(toNegativeZ.steer).toBeLessThan(0);
  });

  it('lets a lured kart actually turn its heading toward the dot', () => {
    const items = createRuntimeItems();
    const victim = createKartState(0, 0, 0);
    const dots = [{ ...spawnLaserDot(createKartState(-50, 0, 0), 0, items), x: 0, z: 6 }];

    const steer = withLaserLure(NEUTRAL_INPUT, victim, 1, dots, items).steer;

    expect(steer * Math.sin(Math.PI / 2)).toBeGreaterThan(0);
  });

  it('does not lure its owner, karts out of range or karts on another level', () => {
    const items = createRuntimeItems();
    const dot = { ...spawnLaserDot(createKartState(0, 0, 0), 0, items), x: 0, z: 5 };

    expect(withLaserLure(NEUTRAL_INPUT, createKartState(0, 0, 0), 0, [dot], items)).toBe(NEUTRAL_INPUT);
    expect(withLaserLure(NEUTRAL_INPUT, createKartState(0, -100, 0), 1, [dot], items)).toBe(NEUTRAL_INPUT);
    expect(withLaserLure(NEUTRAL_INPUT, createKartState(0, 0, 0, 'second'), 1, [dot], items)).toBe(NEUTRAL_INPUT);
  });

  it('keeps the driver partly in control (blend, not override)', () => {
    const items = createRuntimeItems();
    const victim = createKartState(0, 0, 0);
    const dot = { ...spawnLaserDot(createKartState(0, 0, 0), 0, items), x: 0, z: 5 };

    const frame = withLaserLure({ ...NEUTRAL_INPUT, steer: -1 }, victim, 1, [dot], items);

    expect(frame.steer).toBeCloseTo(-(1 - items.laser.lureStrength) + items.laser.lureStrength);
  });
});
