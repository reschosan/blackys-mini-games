import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/shared/core/rng';
import {
  KART_COLORS,
  KART_TYPES,
  NEUTRAL_DRIVE_MODIFIERS,
  createKartLoadout,
  driveModifiersFor,
  isValidKartLoadout,
  normalizeKartLoadout,
  randomKartLoadout,
  statBarsFor,
  type StatId,
} from '../../src/shared/config/kartLoadout';

describe('kart loadout', () => {
  it('keeps the plain car on standard wheels identical to the old driving values', () => {
    expect(driveModifiersFor(createKartLoadout())).toEqual(NEUTRAL_DRIVE_MODIFIERS);
  });

  it('drops the wheel choice for tank and skateboard', () => {
    expect(createKartLoadout(0, 'tank', 'slick').wheels).toBe('standard');
    expect(createKartLoadout(0, 'skateboard', 'offroad').wheels).toBe('standard');
    expect(createKartLoadout(0, 'motorcycle', 'slick').wheels).toBe('slick');
  });

  it('rejects wheel choices that the kart type does not allow', () => {
    expect(isValidKartLoadout({ kartType: 'tank', wheels: 'slick', colorIndex: 0 })).toBe(false);
    expect(isValidKartLoadout({ kartType: 'car', wheels: 'slick', colorIndex: 0 })).toBe(true);
    expect(isValidKartLoadout({ kartType: 'car', wheels: 'slick', colorIndex: KART_COLORS.length })).toBe(false);
  });

  it('wraps the color index into the palette', () => {
    expect(normalizeKartLoadout({ kartType: 'car', wheels: 'standard', colorIndex: -1 }).colorIndex).toBe(KART_COLORS.length - 1);
    expect(normalizeKartLoadout({ kartType: 'car', wheels: 'standard', colorIndex: KART_COLORS.length }).colorIndex).toBe(0);
  });

  it('makes the tank slower and the sports car and motorcycle faster than the car', () => {
    const topSpeed = (kartType: (typeof KART_TYPES)[number]) => driveModifiersFor(createKartLoadout(0, kartType)).topSpeedFactor;
    expect(topSpeed('tank')).toBeLessThan(topSpeed('car'));
    expect(topSpeed('tank')).toBeGreaterThan(0.8);
    expect(topSpeed('sportsCar')).toBeGreaterThan(topSpeed('car'));
    expect(topSpeed('motorcycle')).toBeGreaterThan(topSpeed('car'));
    expect(topSpeed('skateboard')).toBeLessThan(topSpeed('car'));
  });

  it('makes the motorcycle noticeably worse at drifting', () => {
    const motorcycle = driveModifiersFor(createKartLoadout(0, 'motorcycle'));
    expect(motorcycle.driftYawRateFactor).toBeLessThan(0.8);
    expect(motorcycle.driftBoostFactor).toBeLessThan(0.8);
  });

  it('combines wheel and kart type multipliers', () => {
    const slickSports = driveModifiersFor(createKartLoadout(0, 'sportsCar', 'slick'));
    expect(slickSports.topSpeedFactor).toBeCloseTo(1.1 * 1.06);
    expect(slickSports.offroadPenaltyShare).toBeGreaterThan(1);
    expect(driveModifiersFor(createKartLoadout(0, 'car', 'offroad')).offroadPenaltyShare).toBe(0);
  });

  it('draws only valid loadouts for the AI and is reproducible per seed', () => {
    const draw = (seed: number) => {
      const rng = createRng(seed);
      return [0, 1, 2, 3].map((index) => randomKartLoadout(rng, index));
    };
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const loadout of draw(seed)) expect(isValidKartLoadout(loadout)).toBe(true);
    }
    expect(draw(7)).toEqual(draw(7));
  });

  it('shows the strengths and weaknesses of each kart in the lobby bars', () => {
    const ratio = (kartType: Parameters<typeof createKartLoadout>[1], id: StatId, wheels?: Parameters<typeof createKartLoadout>[2]) =>
      statBarsFor(createKartLoadout(0, kartType, wheels)).find((bar) => bar.id === id)!.ratio;

    expect(ratio('tank', 'speed')).toBeLessThan(ratio('car', 'speed'));
    expect(ratio('sportsCar', 'speed')).toBeGreaterThan(ratio('car', 'speed'));
    expect(ratio('motorcycle', 'drift')).toBeLessThan(ratio('car', 'drift') / 2);
    expect(ratio('skateboard', 'steering')).toBeGreaterThan(ratio('car', 'steering'));
    expect(ratio('car', 'offroad', 'offroad')).toBeGreaterThan(ratio('car', 'offroad'));
    expect(ratio('car', 'offroad', 'slick')).toBeLessThan(ratio('car', 'offroad'));
    expect(ratio('car', 'drift', 'driftTires')).toBeGreaterThan(ratio('car', 'drift'));
  });

  it('keeps every bar within 0 to 1', () => {
    for (const kartType of KART_TYPES) {
      for (const bar of statBarsFor(createKartLoadout(0, kartType, 'slick'))) {
        expect(bar.ratio).toBeGreaterThanOrEqual(0);
        expect(bar.ratio).toBeLessThanOrEqual(1);
      }
    }
  });
});
