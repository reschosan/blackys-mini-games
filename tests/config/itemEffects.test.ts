import { describe, expect, it } from 'vitest';
import { ITEM_EFFECT_COLORS } from '../../src/shared/config/itemEffects';
import { DEFAULT_ITEMS, ITEM_TYPES, createRuntimeItems, resetRuntimeItems } from '../../src/shared/config/items';

describe('item effect colours', () => {
  it('has a colour for every item and none of them is black', () => {
    for (const item of ITEM_TYPES) expect(ITEM_EFFECT_COLORS[item], item).toBeGreaterThan(0);
  });

  it('gives every item its own colour so the effects can be told apart', () => {
    expect(new Set(ITEM_TYPES.map((item) => ITEM_EFFECT_COLORS[item])).size).toBe(ITEM_TYPES.length);
  });
});

describe('item feedback tuning', () => {
  it('ships visible bursts for picking up and using an item', () => {
    const items = createRuntimeItems();
    expect(items.itemFeedback.pickupBurstCount).toBeGreaterThan(0);
    expect(items.itemFeedback.useBurstCount).toBeGreaterThan(items.itemFeedback.pickupBurstCount);
  });

  it('can be tuned at runtime and is restored by the reset', () => {
    const items = createRuntimeItems();
    items.itemFeedback.pickupBurstCount = 1;
    items.itemFeedback.useBurstCount = 2;
    resetRuntimeItems(items);
    expect(items.itemFeedback).toEqual(DEFAULT_ITEMS.itemFeedback);
  });
});
