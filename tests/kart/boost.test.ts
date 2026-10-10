import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { activateBoost } from '../../src/games/kart/kart/boost';
import { createKartState, forwardSpeedOf, stepKart } from '../../src/games/kart/kart/kartState';
import { stepBoostFields } from '../../src/games/kart/maps/shared/boostFields';
import { withMapPlacements } from '../../src/games/kart/maps/shared/mapPlacements';
import { createItemBoxStates, stepItemBoxes } from '../../src/games/kart/items/itemBoxes';
import { createRng } from '../../src/shared/core/rng';
import { shouldAiUseHeldItem } from '../../src/games/kart/ai/aiDriver';
import { DEFAULT_AI } from '../../src/shared/config/ai';

const field = RING_TEST_MAP.boostFields![0]!;

describe('configured nitro boosts', () => {
  it('allows braking during nitro instead of forcing acceleration', () => {
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 20;
    activateBoost(kart, 3);
    stepKart(DEFAULT_DRIVING, kart, { ...NEUTRAL_INPUT, brake: true }, 1 / 60);
    expect(forwardSpeedOf(kart)).toBeLessThan(20);
    expect(kart.boostSeconds).toBeCloseTo(3 - 1 / 60);
  });
  it('grants four seconds once on entry, not continuously while occupying the pad', () => {
    const kart = createKartState(field.rect.x, field.rect.z, field.yaw);
    stepBoostFields(RING_TEST_MAP, kart);
    expect(kart.boostSeconds).toBe(4);
    kart.boostSeconds = 1;
    stepBoostFields(RING_TEST_MAP, kart);
    expect(kart.boostSeconds).toBe(1);
    kart.x += 10;
    stepBoostFields(RING_TEST_MAP, kart);
    kart.x = field.rect.x;
    stepBoostFields(RING_TEST_MAP, kart);
    expect(kart.boostSeconds).toBe(4);
  });
  it('never triggers from a different stacked floor', () => {
    const pad = FAMILY_HOUSE.boostFields![1]!;
    const kart = createKartState(pad.rect.x, pad.rect.z, pad.yaw, 'ground');
    stepBoostFields(FAMILY_HOUSE, kart);
    expect(kart.boostSeconds).toBe(0);
    kart.levelId = pad.levelId;
    stepBoostFields(FAMILY_HOUSE, kart);
    expect(kart.boostSeconds).toBe(4);
  });
  it('does not trigger while airborne or recovering from a penalty', () => {
    const pad = FAMILY_HOUSE.boostFields![1]!;
    const kart = createKartState(pad.rect.x, pad.rect.z, pad.yaw, pad.levelId);
    kart.windowJumpId = 'hobby-item-ramp';
    kart.windowJumpElapsedSeconds = 0.4;
    stepBoostFields(FAMILY_HOUSE, kart);
    expect(kart.boostSeconds).toBe(0);
    kart.windowJumpId = null;
    kart.penaltySecondsLeft = 1;
    stepBoostFields(FAMILY_HOUSE, kart);
    expect(kart.boostSeconds).toBe(0);
  });
  it('grants a three-second item boost without stacking durations', () => {
    const kart = createKartState(0, 0, 0);
    activateBoost(kart, createRuntimeItems().boost.durationSeconds);
    expect(kart.boostSeconds).toBe(3);
    activateBoost(kart, 2);
    expect(kart.boostSeconds).toBe(3);
    for (let tick = 0; tick < 181; tick++) stepKart(DEFAULT_DRIVING, kart, NEUTRAL_INPUT, 1 / 60);
    expect(kart.boostSeconds).toBe(0);
  });
  it('allows thirty percent more top speed and returns to normal afterwards', () => {
    const kart = createKartState(0, 0, 0);
    kart.velocityX = DEFAULT_DRIVING.maxSpeed;
    activateBoost(kart, 4);
    for (let tick = 0; tick < 120; tick++) stepKart(DEFAULT_DRIVING, kart, { ...NEUTRAL_INPUT, accelerate: true }, 1 / 60);
    expect(forwardSpeedOf(kart)).toBeCloseTo(DEFAULT_DRIVING.maxSpeed * 1.3, 1);
    for (let tick = 0; tick < 240; tick++) stepKart(DEFAULT_DRIVING, kart, { ...NEUTRAL_INPUT, accelerate: true }, 1 / 60);
    expect(forwardSpeedOf(kart)).toBeCloseTo(DEFAULT_DRIVING.maxSpeed, 1);
  });
  it('supports fixed boost contents in the distance placement array', () => {
    const map = withMapPlacements(RING_TEST_MAP, [{ type: 'itemBoxes', level: 0, meter: 20, items: ['boost'] }]);
    const box = map.itemBoxes[0]!;
    const carrier = { state: createKartState(box.x, box.z, 0), heldItem: null };
    const leader = { state: createKartState(box.x - 50, box.z, 0), heldItem: null };
    stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrier, leader], [2, 1], createRng(1), 1 / 60);
    expect(carrier.heldItem).toBe('boost');
  });
  it('lets AI use its item, but not waste it during an existing boost or stun', () => {
    const kart = createKartState(0, 0, 0);
    expect(shouldAiUseHeldItem(DEFAULT_AI, 'boost', kart, [], null)).toBe(true);
    kart.boostSeconds = 1;
    expect(shouldAiUseHeldItem(DEFAULT_AI, 'boost', kart, [], null)).toBe(false);
    kart.boostSeconds = 0;
    kart.stunSecondsLeft = 1;
    expect(shouldAiUseHeldItem(DEFAULT_AI, 'boost', kart, [], null)).toBe(false);
  });
  it('rejects invalid field dimensions and duplicate ids', () => {
    const placement = { type: 'boostField', id: 'nitro', level: 0, meter: 20 } as const;
    expect(() => withMapPlacements(RING_TEST_MAP, [{ ...placement, width: 0 }])).toThrow('positive');
    expect(() => withMapPlacements(RING_TEST_MAP, [placement, placement])).toThrow('duplicate');
  });
  it('sets hairball speed fifty percent above its previous default', () => {
    expect(createRuntimeItems().hairball.speedMetersPerSecond).toBe(30 * 1.5);
  });
});
