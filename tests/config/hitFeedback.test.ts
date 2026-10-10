import { describe, expect, it } from 'vitest';
import { DEFAULT_ITEMS, createRuntimeItems, resetRuntimeItems } from '../../src/shared/config/items';

describe('item hit feedback', () => {
  it('ships a stronger camera shake than the old fixed 0.25 and a visible spark burst', () => {
    const items = createRuntimeItems();
    expect(items.hitFeedback.shakeStrength).toBeGreaterThan(0.25);
    expect(items.hitFeedback.burstCount).toBeGreaterThan(0);
  });

  it('can be tuned at runtime and is restored by the reset', () => {
    const items = createRuntimeItems();
    items.hitFeedback.shakeStrength = 0.9;
    items.hitFeedback.burstCount = 3;
    resetRuntimeItems(items);
    expect(items.hitFeedback).toEqual(DEFAULT_ITEMS.hitFeedback);
  });
});
