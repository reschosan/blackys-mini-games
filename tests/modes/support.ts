import { createRuntimeModes } from '../../src/shared/config/modes';
import { createRng } from '../../src/shared/core/rng';
import { createKartState, type KartState } from '../../src/games/kart/kart/kartState';
import type { ModeRules, RulesContext, RulesSetup } from '../../src/games/kart/modes/rules/modeRules';

export const STEP = 1 / 60;

/** Seconds each set of rules has already run, so several `run` calls continue one game. */
const clocks = new WeakMap<ModeRules, number>();

export function setup(count: number, seed = 1): RulesSetup {
  return { count, rng: createRng(seed), tuning: createRuntimeModes() };
}

export function karts(...positions: readonly [number, number][]): KartState[] {
  return positions.map(([x, z]) => createKartState(x, z, 0));
}

/** Runs the rules for `seconds` with the karts where they are (the caller may change them between ticks through `each`). */
export function run(
  rules: ModeRules,
  states: readonly KartState[],
  seconds: number,
  each: (time: number) => void = () => undefined,
  speedDrops: readonly number[] = [],
): void {
  const ticks = Math.round(seconds / STEP);
  for (let tick = 1; tick <= ticks; tick += 1) {
    const time = (clocks.get(rules) ?? 0) + STEP;
    clocks.set(rules, time);
    each(time);
    const context: RulesContext = { karts: states, stepSeconds: STEP, timeSeconds: time, speedDrops: states.map((_, slot) => speedDrops[slot] ?? 0) };
    rules.step(context);
  }
}
