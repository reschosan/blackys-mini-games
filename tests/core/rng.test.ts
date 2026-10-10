import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, seedFromSearch } from '../../src/shared/core/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(1337);
    const b = createRng(1337);
    const drawsOf = (rng: ReturnType<typeof createRng>) => [rng.next(), rng.next(), rng.next()];
    expect(drawsOf(a)).toEqual(drawsOf(b));
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });
});

describe('seedFromSearch', () => {
  it('uses the seed from the address', () => {
    expect(seedFromSearch('?seed=1234', 99)).toBe(1234);
  });

  it('falls back to the fresh seed when missing or not a number', () => {
    expect(seedFromSearch('', 99)).toBe(99);
    expect(seedFromSearch('?seed=abc', 99)).toBe(99);
    expect(seedFromSearch('?seed=-5', 99)).toBe(99);
  });
});

describe('deriveSeed', () => {
  it('is stable for the same session, stream and race', () => {
    expect(deriveSeed(7, 'items', 2)).toBe(deriveSeed(7, 'items', 2));
  });

  it('differs between streams, races and sessions', () => {
    const seeds = [deriveSeed(7, 'items', 2), deriveSeed(7, 'startBoost', 2), deriveSeed(7, 'items', 3), deriveSeed(8, 'items', 2)];
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});
