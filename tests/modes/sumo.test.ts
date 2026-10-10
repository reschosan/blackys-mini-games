import { describe, expect, it } from 'vitest';
import { createSumo } from '../../src/games/kart/modes/rules/sumo';
import { karts, run, setup } from './support';

describe('sumo', () => {
  it('puts a kart out the moment it leaves the platform', () => {
    const rules = createSumo(setup(3));
    const states = karts([0, 0], [10, 0], [20, 0]);
    run(rules, states, 0.1, () => {
      states[2]!.x = 60;
    });
    expect([0, 1, 2].map((slot) => rules.isOut(slot))).toEqual([false, false, true]);
    expect(rules.over).toBe(false);
  });

  it('ends when one is left, and ranks by how long each stayed', () => {
    const rules = createSumo(setup(3));
    const states = karts([0, 0], [10, 0], [20, 0]);
    run(rules, states, 1);
    states[2]!.x = 60;
    run(rules, states, 1);
    states[1]!.x = 60;
    run(rules, states, 0.1);
    expect(rules.over).toBe(true);
    expect(rules.places()).toEqual([1, 2, 3]);
    expect(rules.detail(0)).toBe('Letzte Katze');
    expect(rules.detail(2)).toMatch(/raus nach/);
  });

  it('shrinks the platform after the delay, but never below the minimum', () => {
    const rules = createSumo(setup(2));
    const states = karts([0, 0], [1, 0]);
    run(rules, states, 11);
    expect(rules.visual).toEqual({ kind: 'platform', radius: 38 });
    run(rules, states, 20);
    const radius = rules.visual.kind === 'platform' ? rules.visual.radius : 0;
    expect(radius).toBeLessThan(38);
    run(rules, states, 120);
    expect(rules.visual).toEqual({ kind: 'platform', radius: 2 });
  });

  it('sends a kart that stands at the edge back to the middle and otherwise at the nearest rival', () => {
    const rules = createSumo(setup(3));
    const states = karts([36, 0], [5, 0], [-20, 0]);
    run(rules, states, 0.02);
    expect(rules.aim(0, states)).toEqual({ x: 0, z: 0 });
    const calm = karts([0, 0], [5, 0], [-20, 0]);
    expect(rules.aim(0, calm)).toEqual(calm[1]);
  });

  it('tells on the card whether the shove is ready, also on a guest that only gets the numbers', () => {
    const rules = createSumo(setup(2));
    const states = karts([0, 0], [10, 0]);
    states[1]!.shoveCooldownSeconds = 1;
    run(rules, states, 0.02);
    expect([rules.cardText(0), rules.cardText(1)]).toEqual(['Stoß bereit', 'Stoß lädt …']);
    const copy = createSumo(setup(2));
    copy.fromExtras(rules.toExtras());
    expect(copy.cardText(1)).toBe('Stoß lädt …');
  });

  it('survives the trip as numbers', () => {
    const rules = createSumo(setup(3));
    const states = karts([0, 0], [10, 0], [60, 0]);
    run(rules, states, 1);
    const copy = createSumo(setup(3));
    copy.fromExtras(rules.toExtras());
    expect([0, 1, 2].map((slot) => copy.isOut(slot))).toEqual([false, false, true]);
    expect(copy.visual).toEqual(rules.visual);
  });
});
