import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { routeBankHeight } from '../../src/games/kart/maps/shared/routeBanks';
import { spawnHairball, stepHairballs } from '../../src/games/kart/items/hairballs';

describe('hairball flight and impact', () => {
  it('spawns ahead of the shooter, travelling in the direction it faces', () => {
    const items = createRuntimeItems();
    const shooter = createKartState(0, 0, 0);

    const hairball = spawnHairball(shooter, 0, items);

    expect(hairball.x).toBeGreaterThan(0);
    expect(hairball.z).toBeCloseTo(0);
    expect(hairball.vx).toBeCloseTo(items.hairball.speedMetersPerSecond);
    expect(hairball.vz).toBeCloseTo(0);
    expect(hairball.ownerIndex).toBe(0);
  });

  it('never hits its own owner', () => {
    const items = createRuntimeItems();
    const shooter = createKartState(0, 0, 0);
    const hairballs = [spawnHairball(shooter, 0, items)];

    stepHairballs(hairballs, items, RING_TEST_MAP, [shooter], 1 / 60);

    expect(hairballs).toHaveLength(1);
    expect(shooter.stunSecondsLeft).toBe(0);
  });

  it('stuns and slows another kart it overlaps', () => {
    const items = createRuntimeItems();
    const shooter = createKartState(0, 0, 0);
    const target = createKartState(2, 0, 0);
    target.velocityX = 10;
    const hairballs = [spawnHairball(shooter, 0, items)];

    for (let tick = 0; tick < 60 && hairballs.length > 0; tick += 1) {
      stepHairballs(hairballs, items, RING_TEST_MAP, [shooter, target], 1 / 60);
    }

    expect(hairballs).toHaveLength(0);
    expect(target.stunSecondsLeft).toBeCloseTo(items.hairball.stunSeconds);
    expect(target.velocityX).toBeCloseTo(10 * items.hairball.velocityLossFactor);
  });

  it('despawns once it exceeds its configured range without hitting anyone', () => {
    const items = createRuntimeItems();
    const shooter = createKartState(0, 0, 0);
    const hairballs = [spawnHairball(shooter, 0, items)];
    const travelSeconds = items.hairball.rangeMeters / items.hairball.speedMetersPerSecond + 0.1;

    stepHairballs(hairballs, items, RING_TEST_MAP, [shooter], travelSeconds);

    expect(hairballs).toHaveLength(0);
  });

  it('bounces twice before a third collision removes it', () => {
    const items = createRuntimeItems();
    const map = {
      ...RING_TEST_MAP,
      walls: [
        { x: 2, z: 0, width: 0.5, depth: 8 },
        { x: -2, z: 0, width: 0.5, depth: 8 },
      ],
      obstacles: [],
    };
    const shooter = createKartState(0, 0, 0);
    const hairballs = [spawnHairball(shooter, 0, items)];

    for (let tick = 0; tick < 240 && hairballs.length > 0 && hairballs[0]!.bouncesRemaining === 2; tick += 1) {
      stepHairballs(hairballs, items, map, [shooter], 1 / 60);
    }
    expect(hairballs[0]?.bouncesRemaining).toBe(1);

    for (let tick = 0; tick < 240 && hairballs.length > 0 && hairballs[0]!.bouncesRemaining === 1; tick += 1) {
      stepHairballs(hairballs, items, map, [shooter], 1 / 60);
    }
    expect(hairballs[0]?.bouncesRemaining).toBe(0);

    for (let tick = 0; tick < 240 && hairballs.length > 0; tick += 1) {
      stepHairballs(hairballs, items, map, [shooter], 1 / 60);
    }
    expect(hairballs).toHaveLength(0);
  });

  it('follows a stair upwards: it rises with the steps and changes level halfway', () => {
    const items = createRuntimeItems();
    const stair = FAMILY_HOUSE.stairTransitions![1]!;
    const shooter = createKartState(stair.rect.x, stair.rect.z + stair.rect.depth / 2 - 4, -Math.PI / 2, 'first');
    const hairballs = [spawnHairball(shooter, 0, items, FAMILY_HOUSE)];
    const elevations: number[] = [];
    const levels = new Set<string>();

    for (let tick = 0; tick < 60 && hairballs.length > 0; tick += 1) {
      stepHairballs(hairballs, items, FAMILY_HOUSE, [shooter], 1 / 60);
      const hairball = hairballs[0];
      if (!hairball || hairball.z > stair.rect.z + stair.rect.depth / 2 || hairball.z < stair.rect.z - stair.rect.depth / 2) continue;
      elevations.push(hairball.elevation ?? 0);
      levels.add(hairball.levelId);
    }

    expect(levels).toEqual(new Set(['first', 'second']));
    expect(elevations.length).toBeGreaterThan(5);
    expect(elevations.at(-1)!).toBeGreaterThan(elevations[0]! + 10);
  });

  it('follows a stair downwards: it sinks with the steps and changes back to the lower level', () => {
    const items = createRuntimeItems();
    const stair = FAMILY_HOUSE.stairTransitions![1]!;
    const shooter = createKartState(stair.rect.x, stair.rect.z - stair.rect.depth / 2 + 4, Math.PI / 2, 'second');
    const hairballs = [spawnHairball(shooter, 0, items, FAMILY_HOUSE)];
    const levels = new Set<string>();

    for (let tick = 0; tick < 60 && hairballs.length > 0; tick += 1) {
      stepHairballs(hairballs, items, FAMILY_HOUSE, [shooter], 1 / 60);
      if (hairballs[0]) levels.add(hairballs[0].levelId);
    }

    expect(levels).toEqual(new Set(['second', 'first']));
  });
});

describe('yarn ball (hairball sibling)', () => {
  it('flies with its own tuning and a larger hit radius', () => {
    const items = createRuntimeItems();
    const shooter = createKartState(0, 0, 0);

    const yarn = spawnHairball(shooter, 0, items, RING_TEST_MAP, 'yarn');

    expect(yarn.kind).toBe('yarn');
    expect(yarn.vx).toBeCloseTo(items.yarn.speedMetersPerSecond);
    expect(yarn.bouncesRemaining).toBe(items.yarn.maxBounces);
  });

  it('stuns a kart it hits with the yarn tuning, not the hairball tuning', () => {
    const items = createRuntimeItems();
    items.yarn.stunSeconds = 2.5;
    const shooter = createKartState(0, 0, 0);
    const target = createKartState(3, 0, 0);
    const yarns = [spawnHairball(shooter, 0, items, RING_TEST_MAP, 'yarn')];

    for (let tick = 0; tick < 60 && yarns.length > 0; tick += 1) stepHairballs(yarns, items, RING_TEST_MAP, [shooter, target], 1 / 60);

    expect(target.stunSecondsLeft).toBeCloseTo(2.5);
  });

  it('bounces more often than a hairball would be allowed to', () => {
    const items = createRuntimeItems();
    expect(items.yarn.maxBounces).toBeGreaterThan(items.hairball.maxBounces);
  });
});

describe('hairball over the raised side floor of a house route', () => {
  function raisedFloorPoint(): { x: number; z: number; height: number } {
    for (let x = -80; x < 80; x += 2) {
      for (let z = -80; z < 80; z += 2) {
        const height = routeBankHeight(FAMILY_HOUSE, 'ground', x, z);
        if (height > 1) return { x, z, height };
      }
    }
    throw new Error('house has no raised side floor on the ground level');
  }

  it('rises with the floor instead of flying through it', () => {
    const items = createRuntimeItems();
    const point = raisedFloorPoint();
    const hairball = { ...spawnHairball(createKartState(point.x, point.z, 0), 0, items, FAMILY_HOUSE), x: point.x, z: point.z, vx: 0, vz: 0, elevation: 0 };

    stepHairballs([hairball], items, FAMILY_HOUSE, [], 1 / 60);

    expect(hairball.elevation).toBeCloseTo(point.height, 1);
  });
});
