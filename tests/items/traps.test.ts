import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { spawnTrap, stepTraps } from '../../src/games/kart/items/traps';

describe('trap drop and impact', () => {
  it('spawns behind the dropping kart, opposite its facing direction', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);

    const trap = spawnTrap(dropper, 0, items);

    expect(trap.x).toBeLessThan(0);
    expect(trap.z).toBeCloseTo(0);
    expect(trap.ownerIndex).toBe(0);
  });

  it('never hits its own owner', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);
    const traps = [spawnTrap(dropper, 0, items)];

    stepTraps(traps, items, [dropper]);

    expect(traps).toHaveLength(1);
    expect(dropper.stunSecondsLeft).toBe(0);
  });

  it('stuns and slows another kart that drives over it', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);
    const trap = spawnTrap(dropper, 0, items);
    const target = createKartState(trap.x, trap.z, 0);
    target.velocityX = 10;
    const traps = [trap];

    stepTraps(traps, items, [dropper, target]);

    expect(traps).toHaveLength(0);
    expect(target.stunSecondsLeft).toBeCloseTo(items.trap.stunSeconds);
    expect(target.velocityX).toBeCloseTo(10 * items.trap.velocityLossFactor);
  });

  it('remains indefinitely without an eligible contact', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);
    const traps = [spawnTrap(dropper, 0, items)];

    for (let tick = 0; tick < 36000; tick++) stepTraps(traps, items, [dropper]);

    expect(traps).toHaveLength(1);
  });
});
