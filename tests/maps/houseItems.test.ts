import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createRng } from '../../src/shared/core/rng';
import { createItemBoxStates, stepItemBoxes } from '../../src/games/kart/items/itemBoxes';
import { spawnHairball, stepHairballs } from '../../src/games/kart/items/hairballs';
import { spawnTrap, stepTraps } from '../../src/games/kart/items/traps';

const items = createRuntimeItems();
const floorBox = FAMILY_HOUSE.itemBoxes.find((box) => box.levelId === 'first' && !box.heightOffset)!;

function airborneKart(x: number, z: number) {
  const kart = createKartState(x, z, 0, floorBox.levelId);
  const jump = FAMILY_HOUSE.windowJumps!.find((jump) => jump.levelId === floorBox.levelId)!;
  kart.windowJumpId = jump.id;
  kart.windowJumpElapsedSeconds = jump.durationSeconds / 2;
  return kart;
}

describe('house item height separation', () => {
  it('does not collect an item while jumping above it on the same floor', () => {
    const kart = airborneKart(floorBox.x, floorBox.z);
    const carrier = { state: kart, heldItem: null };
    const boxes = createItemBoxStates(FAMILY_HOUSE);
    stepItemBoxes(FAMILY_HOUSE, boxes, items, [carrier], [1], createRng(1), 1 / 60);
    expect(carrier.heldItem).toBeNull();
    kart.windowJumpId = null;
    stepItemBoxes(FAMILY_HOUSE, boxes, items, [carrier], [1], createRng(1), 1 / 60);
    expect(carrier.heldItem).not.toBeNull();
  });

  it('does not hit an airborne kart with a floor-level hairball', () => {
    const owner = createKartState(floorBox.x, floorBox.z, 0, floorBox.levelId);
    const hairballs = [spawnHairball(owner, 0, items, FAMILY_HOUSE)];
    const target = airborneKart(hairballs[0]!.x, hairballs[0]!.z);
    stepHairballs(hairballs, items, FAMILY_HOUSE, [owner, target], 0);
    expect(target.stunSecondsLeft).toBe(0);
    target.windowJumpId = null;
    stepHairballs(hairballs, items, FAMILY_HOUSE, [owner, target], 0);
    expect(target.stunSecondsLeft).toBeGreaterThan(0);
  });

  it('does not hit an airborne kart with a floor-level trap', () => {
    const owner = createKartState(floorBox.x, floorBox.z, 0, floorBox.levelId);
    const traps = [spawnTrap(owner, 0, items, FAMILY_HOUSE)];
    const target = airborneKart(traps[0]!.x, traps[0]!.z);
    stepTraps(traps, items, [owner, target], FAMILY_HOUSE);
    expect(target.stunSecondsLeft).toBe(0);
    target.windowJumpId = null;
    stepTraps(traps, items, [owner, target], FAMILY_HOUSE);
    expect(target.stunSecondsLeft).toBeGreaterThan(0);
  });
});
