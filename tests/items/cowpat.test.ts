import { describe, expect, it } from 'vitest';
import { driveFactorsOf } from '../../src/games/kart/ai/raceAiInput';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createRuntimeItems } from '../../src/shared/config/items';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState, forwardSpeedOf, stepKart } from '../../src/games/kart/kart/kartState';
import { spawnTrap, stepTraps } from '../../src/games/kart/items/traps';
import { FARM } from '../../src/games/kart/maps/farm/map';
import { updateKartSurface } from '../../src/games/kart/maps/shared/surfaceZones';
import { TrapView } from '../../src/games/kart/items/views/trapView';
import { RING_TEST_MAP } from '../support/ringTestMap';

const STEP = 1 / 60;

function cowpatUnder(target: ReturnType<typeof createKartState>, items = createRuntimeItems()) {
  const dropper = createKartState(0, 0, 0);
  const pat = spawnTrap(dropper, 0, items, undefined, 'cowpat');
  target.x = pat.x;
  target.z = pat.z;
  return { dropper, traps: [pat], items };
}

describe('cow pat', () => {
  it('lands behind the dropping kart and is marked as a cow pat; a cup carries no mark', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);
    expect(spawnTrap(dropper, 0, items, undefined, 'cowpat')).toMatchObject({ kind: 'cowpat', ownerIndex: 0 });
    expect(spawnTrap(dropper, 0, items).kind).toBeUndefined();
    expect(spawnTrap(dropper, 0, items, undefined, 'cowpat').x).toBeLessThan(0);
  });

  it('holds another kart like mud and slows it, without a spin-out', () => {
    const target = createKartState(0, 0, 0);
    target.velocityX = 10;
    const { dropper, traps, items } = cowpatUnder(target);

    stepTraps(traps, items, [dropper, target]);

    expect(traps).toHaveLength(0);
    expect(target.stickySecondsLeft).toBeCloseTo(items.cowpat.stickySeconds);
    expect(target.velocityX).toBeCloseTo(10 * items.cowpat.velocityLossFactor);
    expect(target.stunSecondsLeft).toBe(0);
    expect(target.yaw).toBe(0);
  });

  it('never hits its own owner and stays until someone drives over it', () => {
    const items = createRuntimeItems();
    const dropper = createKartState(0, 0, 0);
    const traps = [spawnTrap(dropper, 0, items, undefined, 'cowpat')];
    for (let tick = 0; tick < 3600; tick += 1) stepTraps(traps, items, [dropper]);
    expect(traps).toHaveLength(1);
    expect(dropper.stickySecondsLeft).toBe(0);
  });

  it('keeps the race leader stuck longer, like the other hits', () => {
    const target = createKartState(0, 0, 0);
    target.leading = true;
    const { dropper, traps, items } = cowpatUnder(target);
    stepTraps(traps, items, [dropper, target]);
    expect(target.stickySecondsLeft).toBeCloseTo(items.cowpat.stickySeconds + items.leaderStunBonusSeconds);
  });

  it('is blocked by a shield, which is used up', () => {
    const target = createKartState(0, 0, 0);
    target.shieldSecondsLeft = 3;
    target.velocityX = 10;
    const { dropper, traps, items } = cowpatUnder(target);
    stepTraps(traps, items, [dropper, target]);
    expect(traps).toHaveLength(0);
    expect(target.shieldSecondsLeft).toBe(0);
    expect(target.stickySecondsLeft).toBe(0);
    expect(target.velocityX).toBe(10);
  });

  it('counts as mud under the kart while it lasts, then the ground is the ground again', () => {
    const kart = createKartState(0, 0, 0);
    kart.stickySecondsLeft = 1;
    updateKartSurface(FARM, kart);
    expect(kart.surfaceKind).toBe('mud');
    kart.stickySecondsLeft = 0;
    updateKartSurface(FARM, kart);
    expect(kart.surfaceKind).toBeNull();
  });

  it('wears off with time, and a sticky kart reaches a lower top speed than a free one', () => {
    const config = createRuntimeDriving();
    const topSpeedAfter = (sticky: boolean): number => {
      const kart = createKartState(0, 0, 0);
      for (let tick = 0; tick < 300; tick += 1) {
        kart.stickySecondsLeft = sticky ? 1 : 0;
        kart.surfaceKind = sticky ? 'mud' : null;
        stepKart(config, kart, { ...NEUTRAL_INPUT, accelerate: true }, STEP, driveFactorsOf(createKartLoadout()));
      }
      return forwardSpeedOf(kart);
    };
    expect(topSpeedAfter(true)).toBeLessThan(topSpeedAfter(false));

    const kart = createKartState(0, 0, 0);
    kart.stickySecondsLeft = 0.5;
    for (let tick = 0; tick < 40; tick += 1) stepKart(config, kart, NEUTRAL_INPUT, STEP);
    expect(kart.stickySecondsLeft).toBe(0);
  });

  it('is drawn as a brown heap by default, apart from the cups', () => {
    const view = new TrapView();
    view.update(RING_TEST_MAP, [
      { x: 0, z: 0, ownerIndex: 0, levelId: 'ground' },
      { kind: 'cowpat', x: 5, z: 0, ownerIndex: 0, levelId: 'ground' },
    ]);
    const [cupTrap, cowpatTrap] = view.object.children as import('three').Group[];
    const [cupOfCup, patOfCup] = cupTrap!.children;
    const [cupOfPat, patOfPat] = cowpatTrap!.children;
    expect([cupOfCup!.visible, patOfCup!.visible]).toEqual([true, false]);
    expect([cupOfPat!.visible, patOfPat!.visible]).toEqual([false, true]);
    expect((patOfPat as import('three').Group).children).toHaveLength(1);
  });
});
