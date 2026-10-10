import { describe, expect, it } from 'vitest';
import { createTag } from '../../src/games/kart/modes/rules/tag';
import { karts, run, setup } from './support';

function hunterOf(rules: ReturnType<typeof createTag>): number {
  const visual = rules.visual;
  return visual.kind === 'tag' ? visual.hunterSlot : -1;
}

describe('tag', () => {
  it('starts with one hunter, chosen by the seeded stream', () => {
    const first = hunterOf(createTag(setup(4, 5)));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(hunterOf(createTag(setup(4, 5)))).toBe(first);
  });

  it('passes the hunt on at a touch, and the new hunter cannot be caught back at once', () => {
    const rules = createTag(setup(2, 1));
    const hunter = hunterOf(rules);
    const prey = 1 - hunter;
    const states = karts([0, 0], [1.5, 0]);
    run(rules, states, 0.05);
    expect(hunterOf(rules)).toBe(prey);
    run(rules, states, 1);
    expect(hunterOf(rules)).toBe(prey);
    run(rules, states, 1.5);
    expect(hunterOf(rules)).toBe(hunter);
  });

  it('counts the time a seat hunted and ranks the one who hunted least first', () => {
    const rules = createTag(setup(2, 1));
    const hunter = hunterOf(rules);
    const states = karts([0, 0], [40, 0]);
    run(rules, states, 61);
    expect(rules.over).toBe(true);
    expect(rules.places()[hunter]).toBe(2);
    expect(rules.places()[1 - hunter]).toBe(1);
  });

  it('sends the hunter towards the nearest kart and the others away from the hunter', () => {
    const rules = createTag(setup(3, 1));
    const hunter = hunterOf(rules);
    const states = karts([0, 0], [10, 0], [-30, 0]);
    const prey = [0, 1, 2].filter((slot) => slot !== hunter);
    const aimOfHunter = rules.aim(hunter, states)!;
    expect(Math.hypot(aimOfHunter.x - states[prey[0]!]!.x, aimOfHunter.z - states[prey[0]!]!.z)).toBeLessThanOrEqual(
      Math.hypot(aimOfHunter.x - states[prey[1]!]!.x, aimOfHunter.z - states[prey[1]!]!.z),
    );
    const away = rules.aim(prey[0]!, states)!;
    expect(Math.hypot(away.x - states[hunter]!.x, away.z - states[hunter]!.z)).toBeGreaterThan(
      Math.hypot(states[prey[0]!]!.x - states[hunter]!.x, states[prey[0]!]!.z - states[hunter]!.z),
    );
  });

  it('survives the trip as numbers', () => {
    const rules = createTag(setup(3, 2));
    run(rules, karts([0, 0], [1, 0], [50, 0]), 2);
    const copy = createTag(setup(3, 9));
    copy.fromExtras(rules.toExtras());
    expect(hunterOf(copy)).toBe(hunterOf(rules));
    expect(copy.cardText(0)).toBe(rules.cardText(0));
  });
});
