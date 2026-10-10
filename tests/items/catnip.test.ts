import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { activateCatnip, catnipSteerOffset, stepCatnip, withCatnipWobble } from '../../src/games/kart/items/catnip';

describe('catnip', () => {
  it('boosts first and keeps steering clean while the boost runs', () => {
    const items = createRuntimeItems();
    const kart = createKartState(0, 0, 0);

    activateCatnip(kart, items);

    expect(kart.boostSeconds).toBeCloseTo(items.catnip.boostSeconds);
    expect(kart.catnipSecondsLeft).toBeCloseTo(items.catnip.boostSeconds + items.catnip.chaosSeconds);
    expect(catnipSteerOffset(kart, items)).toBe(0);
    expect(withCatnipWobble(NEUTRAL_INPUT, kart, items)).toBe(NEUTRAL_INPUT);
  });

  it('wobbles the steering during the final seconds, within the configured amplitude', () => {
    const items = createRuntimeItems();
    const kart = createKartState(0, 0, 0);
    activateCatnip(kart, items);
    stepCatnip(kart, items.catnip.boostSeconds + 0.1);

    const offsets = Array.from({ length: 30 }, () => {
      stepCatnip(kart, 0.05);
      return catnipSteerOffset(kart, items);
    });

    expect(offsets.some((offset) => offset > 0.2)).toBe(true);
    expect(offsets.some((offset) => offset < -0.2)).toBe(true);
    expect(offsets.every((offset) => Math.abs(offset) <= items.catnip.chaosSteerAmplitude)).toBe(true);
  });

  it('keeps wobbled steering within -1..1', () => {
    const items = createRuntimeItems();
    const kart = createKartState(0, 0, 0);
    kart.catnipSecondsLeft = 0.12;

    const frame = withCatnipWobble({ ...NEUTRAL_INPUT, steer: 1 }, kart, items);

    expect(frame.steer).toBeLessThanOrEqual(1);
    expect(frame.steer).toBeGreaterThanOrEqual(-1);
  });

  it('ends after the full duration', () => {
    const items = createRuntimeItems();
    const kart = createKartState(0, 0, 0);
    activateCatnip(kart, items);

    for (let tick = 0; tick < 60 * 10; tick += 1) stepCatnip(kart, 1 / 60);

    expect(kart.catnipSecondsLeft).toBe(0);
    expect(catnipSteerOffset(kart, items)).toBe(0);
  });
});
