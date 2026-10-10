export interface Rng {
  next(): number;
  nextInt(maxExclusive: number): number;
  getSeed(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    getSeed: () => seed >>> 0,
  };
}

/** `?seed=123` in the address makes a session reproducible; without it every session gets a fresh seed. */
export function seedFromSearch(search: string, freshSeed: number): number {
  const requested = new URLSearchParams(search).get('seed');
  if (requested === null || !/^\d+$/.test(requested)) return freshSeed;
  return Number(requested) >>> 0;
}

/** Gives each subsystem and each race its own stream, so a new draw in one place never shifts another. */
export function deriveSeed(sessionSeed: number, stream: string, raceNumber: number): number {
  let hash = (sessionSeed ^ Math.imul(raceNumber + 1, 0x9e3779b1)) >>> 0;
  for (const character of stream) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}
