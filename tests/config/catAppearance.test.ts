import { describe, expect, it } from 'vitest';
import {
  CAT_PRESETS,
  createCatAppearance,
  isValidCatAppearance,
  HAIR_LENGTHS,
  MANE_STYLES,
  MAX_CAT_NAME_LENGTH,
  patternUsesSecondaryColor,
  type CatAppearance,
} from '../../src/shared/config/catAppearance';

describe('catAppearance presets', () => {
  it('provides between 5 and 6 named presets', () => {
    expect(CAT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(CAT_PRESETS.length).toBeLessThanOrEqual(6);
  });

  it('creates a valid appearance for every preset', () => {
    for (const preset of CAT_PRESETS) {
      const appearance = createCatAppearance(preset);
      expect(isValidCatAppearance(appearance)).toBe(true);
    }
  });

  it('defaults to the first preset when none is given', () => {
    expect(createCatAppearance()).toEqual(createCatAppearance(CAT_PRESETS[0]));
  });
});

describe('patternUsesSecondaryColor', () => {
  it('uses the secondary color for tabby and bicolor', () => {
    expect(patternUsesSecondaryColor('tabby')).toBe(true);
    expect(patternUsesSecondaryColor('bicolor')).toBe(true);
  });

  it('ignores the secondary color for solid and lucky', () => {
    expect(patternUsesSecondaryColor('solid')).toBe(false);
    expect(patternUsesSecondaryColor('lucky')).toBe(false);
  });
});

describe('isValidCatAppearance', () => {
  const base: CatAppearance = createCatAppearance();

  it('accepts a valid appearance', () => {
    expect(isValidCatAppearance(base)).toBe(true);
  });

  it('accepts an empty name (unnamed) and rejects one that is too long', () => {
    expect(isValidCatAppearance({ ...base, name: '' })).toBe(true);
    expect(isValidCatAppearance({ ...base, name: 'x'.repeat(MAX_CAT_NAME_LENGTH) })).toBe(true);
    expect(isValidCatAppearance({ ...base, name: 'x'.repeat(MAX_CAT_NAME_LENGTH + 1) })).toBe(false);
  });

  it('rejects an unknown fur color', () => {
    expect(isValidCatAppearance({ ...base, furColor: 'purple' as never })).toBe(false);
  });

  it('rejects an unknown pattern', () => {
    expect(isValidCatAppearance({ ...base, pattern: 'striped' as never })).toBe(false);
  });

  it('rejects an unknown eye color', () => {
    expect(isValidCatAppearance({ ...base, eyeColor: 'red' as never })).toBe(false);
  });

  it('stays valid for the lucky pattern even though it ignores fur and secondary color', () => {
    const lucky = CAT_PRESETS.find((preset) => preset.pattern === 'lucky');
    expect(lucky).toBeDefined();
    expect(isValidCatAppearance(createCatAppearance(lucky!))).toBe(true);
  });
});

describe('hair length', () => {
  it('offers short and long hair', () => {
    expect(HAIR_LENGTHS).toEqual(['short', 'long']);
  });

  it('keeps every preset short-haired, so existing cats and the AI look as before', () => {
    expect(CAT_PRESETS.every((preset) => preset.hairLength === 'short')).toBe(true);
  });

  it('accepts long hair and rejects an unknown hair length', () => {
    const base = createCatAppearance();
    expect(isValidCatAppearance({ ...base, hairLength: 'long' })).toBe(true);
    expect(isValidCatAppearance({ ...base, hairLength: 'fluffy' as never })).toBe(false);
  });
});

describe('mane', () => {
  it('offers none, a ruff and a lion mane', () => {
    expect(MANE_STYLES).toEqual(['none', 'ruff', 'lion']);
  });

  it('keeps every preset maneless, so existing cats and the AI look as before', () => {
    expect(CAT_PRESETS.every((preset) => preset.mane === 'none')).toBe(true);
  });

  it('accepts every style and rejects an unknown one', () => {
    const base = createCatAppearance();
    for (const mane of MANE_STYLES) expect(isValidCatAppearance({ ...base, mane })).toBe(true);
    expect(isValidCatAppearance({ ...base, mane: 'mohawk' as never })).toBe(false);
  });
});
