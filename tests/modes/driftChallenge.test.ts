import { describe, expect, it } from 'vitest';
import { createDriftChallenge } from '../../src/games/kart/modes/rules/driftChallenge';
import { karts, run, setup } from './support';

function drifting(state: ReturnType<typeof karts>[number], stage = 0): void {
  state.driftDirection = 1;
  state.driftStage = stage;
  state.velocityX = 12;
}

describe('drift challenge', () => {
  it('pays points for every second of drifting and banks them when the drift ends', () => {
    const rules = createDriftChallenge(setup(2));
    const states = karts([0, 0], [5, 0]);
    drifting(states[0]!);
    run(rules, states, 2);
    expect(rules.cardText(0)).toBe('0 Punkte (+20)');
    states[0]!.driftDirection = 0;
    run(rules, states, 0.1);
    expect(rules.cardText(0)).toBe('20 Punkte');
    expect(rules.cardText(1)).toBe('0 Punkte');
  });

  it('pays more in a higher drift stage, and nothing below the minimum speed', () => {
    const slow = createDriftChallenge(setup(2));
    const states = karts([0, 0], [5, 0]);
    drifting(states[0]!, 3);
    drifting(states[1]!, 0);
    states[1]!.velocityX = 2;
    run(slow, states, 1);
    expect(slow.cardText(0)).toBe('0 Punkte (+28)');
    expect(slow.cardText(1)).toBe('0 Punkte');
  });

  it('loses the running streak when the kart bumps', () => {
    const rules = createDriftChallenge(setup(1));
    const states = karts([0, 0]);
    drifting(states[0]!);
    run(rules, states, 1);
    run(rules, states, 0.02, () => undefined, [4]);
    states[0]!.driftDirection = 0;
    run(rules, states, 0.1);
    expect(rules.cardText(0).startsWith('0 Punkte')).toBe(true);
  });

  it('ends after the time, banks what is running and ranks by points', () => {
    const rules = createDriftChallenge(setup(2));
    const states = karts([0, 0], [5, 0]);
    drifting(states[1]!);
    run(rules, states, 59);
    expect(rules.over).toBe(false);
    run(rules, states, 1.1);
    expect(rules.over).toBe(true);
    expect(rules.places()).toEqual([2, 1]);
    expect(rules.detail(1)).toMatch(/Punkte/);
  });

  it('survives the trip as numbers', () => {
    const rules = createDriftChallenge(setup(2));
    const copy = createDriftChallenge(setup(2));
    const states = karts([0, 0], [5, 0]);
    drifting(states[0]!);
    run(rules, states, 3);
    copy.fromExtras(rules.toExtras());
    expect(copy.cardText(0)).toBe(rules.cardText(0));
    expect(copy.statusLines()).toEqual(rules.statusLines());
  });
});
