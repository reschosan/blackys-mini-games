import { describe, expect, it } from 'vitest';
import { createLavaKart } from '../../src/games/kart/modes/rules/lavaKart';
import { karts, run, setup } from './support';

function states(rules: ReturnType<typeof createLavaKart>): readonly number[] {
  const visual = rules.visual;
  return visual.kind === 'tiles' ? visual.states : [];
}

describe('lava floor with karts', () => {
  it('lets tiles glow and vanish one after another, starting after a delay', () => {
    const rules = createLavaKart(setup(2));
    const inside = karts([0, 0], [4, 4]);
    run(rules, inside, 5);
    expect(states(rules).every((state) => state === 0)).toBe(true);
    run(rules, inside, 2);
    expect(states(rules).some((state) => state === 1)).toBe(true);
    run(rules, inside, 30);
    expect(states(rules).filter((state) => state === 2).length).toBeGreaterThan(3);
  });

  it('puts a kart out when the tile under it is gone or it left the grid', () => {
    const rules = createLavaKart(setup(2));
    const placed = karts([0, 0], [4, 4]);
    run(rules, placed, 0.1, () => {
      placed[1]!.x = 500;
    });
    expect(rules.isOut(1)).toBe(true);
    expect(rules.isOut(0)).toBe(false);
    expect(rules.over).toBe(true);
    expect(rules.places()).toEqual([1, 2]);
  });

  it('is the same for the same seed and different for another', () => {
    const picture = (seed: number): readonly number[] => {
      const rules = createLavaKart(setup(2, seed));
      run(rules, karts([0, 0], [4, 4]), 12);
      return [...states(rules)];
    };
    expect(picture(3)).toEqual(picture(3));
    expect(picture(3)).not.toEqual(picture(4));
  });

  it('sends a kart on a vanishing tile to the nearest safe one', () => {
    const rules = createLavaKart(setup(2, 1));
    const placed = karts([0, 0], [4, 4]);
    run(rules, placed, 8);
    const aim = rules.aim(0, placed)!;
    expect(Number.isFinite(aim.x) && Number.isFinite(aim.z)).toBe(true);
  });

  it('survives the trip as numbers, tiles included', () => {
    const rules = createLavaKart(setup(2, 5));
    run(rules, karts([0, 0], [4, 4]), 15);
    const copy = createLavaKart(setup(2, 99));
    copy.fromExtras(rules.toExtras());
    expect(states(copy)).toEqual(states(rules));
  });
});
