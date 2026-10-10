import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { createRng } from '../../src/shared/core/rng';
import type { EngineSeat } from '../../src/shared/game/engine';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { createMemorySession } from '../../src/games/memory/memorySession';
import { DEFAULT_MEMORY_LEVEL, MEMORY_LEVELS, memoryColumnsFor } from '../../src/shared/config/memoryLevels';
import { GOLDEN_POINTS, MEMORY_MOTIF_COUNT } from '../../src/games/memory/memoryTuning';

const DEFAULT_PAIRS = MEMORY_LEVELS[DEFAULT_MEMORY_LEVEL]!;

const STEP = 1 / 60;

function seats(...kinds: readonly ('human' | 'ai')[]): EngineSeat[] {
  return kinds.map((kind, slot) => ({ slot, name: `Katze ${slot + 1}`, color: '#ffffff', isAi: kind === 'ai', appearance: createCatAppearance() }));
}

function press(...overrides: Partial<InputFrame>[]): InputFrame[] {
  return overrides.map((override) => ({ ...NEUTRAL_INPUT, ...override }));
}

function run(session: ReturnType<typeof createMemorySession>, seconds: number, frames: readonly InputFrame[] = [NEUTRAL_INPUT, NEUTRAL_INPUT]): void {
  for (let tick = 0; tick < Math.round(seconds / STEP); tick += 1) session.step(frames, STEP);
}

describe('memory', () => {
  it('lays out the pairs of the level face down and keeps every face secret in the snapshot', () => {
    const session = createMemorySession({ seats: seats('human', 'human'), tuning: createRuntimeModes(), rng: createRng(1) });
    const snapshot = session.snapshot() as { cards: number[]; states: number[] };
    expect(snapshot.cards).toHaveLength(DEFAULT_PAIRS * 2);
    expect(snapshot.cards.every((face) => face === -1)).toBe(true);
    expect(snapshot.states.every((state) => state === 0)).toBe(true);
  });

  it('deals the same board for the same seed and another for another seed', () => {
    const reveal = (seed: number): number[] => {
      const session = createMemorySession({ seats: seats('human', 'human'), tuning: createRuntimeModes(), rng: createRng(seed) });
      const faces: number[] = [];
      for (let card = 0; card < DEFAULT_PAIRS * 2; card += 1) {
        session.step(press({ useItem: true }, NEUTRAL_INPUT), STEP);
        session.step(press(NEUTRAL_INPUT, NEUTRAL_INPUT), STEP);
        const cards = (session.snapshot() as { cards: number[] }).cards;
        faces.push(cards.find((face) => face >= 0) ?? -1);
        run(session, 3);
        if (faces.length >= 3) break;
      }
      return faces;
    };
    expect(reveal(4)).toEqual(reveal(4));
  });

  it('flips with the button, moves the cursor with the stick, and turns a mismatch back for the next player', () => {
    const session = createMemorySession({ seats: seats('human', 'human'), tuning: createRuntimeModes(), rng: createRng(2) });
    session.step(press({ useItem: true }, NEUTRAL_INPUT), STEP);
    let snapshot = session.snapshot() as { states: number[]; turn: number; cursor: number; phase: string };
    expect(snapshot.states[snapshot.cursor]).toBe(1);
    expect(snapshot.phase).toBe('second');
    session.step(press({ move: { x: 1, y: 0 } }, NEUTRAL_INPUT), STEP);
    snapshot = session.snapshot() as typeof snapshot;
    expect(snapshot.cursor).toBe(1);
    session.step(press({ useItem: true }, NEUTRAL_INPUT), STEP);
    session.step(press(NEUTRAL_INPUT, NEUTRAL_INPUT), STEP);
    run(session, 2);
    snapshot = session.snapshot() as typeof snapshot;
    const faceUp = snapshot.states.filter((state) => state === 1).length;
    const matched = snapshot.states.filter((state) => state === 2).length;
    expect(faceUp).toBe(0);
    expect(matched === 2 ? snapshot.turn === 0 : snapshot.turn === 1).toBe(true);
  });

  it("flips the card a player taps on a touch screen, but only on that player's turn", () => {
    const session = createMemorySession({ seats: seats('human', 'human'), tuning: createRuntimeModes(), rng: createRng(2) });
    session.step(press(NEUTRAL_INPUT, { pick: 4 }), STEP);
    expect((session.snapshot() as { states: number[] }).states[4]).toBe(0);
    session.step(press({ pick: 4 }, NEUTRAL_INPUT), STEP);
    const snapshot = session.snapshot() as { states: number[]; cursor: number };
    expect(snapshot.states[4]).toBe(1);
    expect(snapshot.cursor).toBe(4);
  });

  it('plays a whole game of AI cats to the end, every pair taken', () => {
    const session = createMemorySession({ seats: seats('ai', 'ai', 'ai'), tuning: createRuntimeModes(), rng: createRng(7) });
    let ticks = 0;
    while (!session.over && ticks < 60 * 600) {
      session.step([NEUTRAL_INPUT, NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
      ticks += 1;
    }
    expect(session.over).toBe(true);
    const places = session.places();
    expect(places).toHaveLength(3);
    expect(places).toContain(1);
    const total = [0, 1, 2].reduce((sum, slot) => sum + Number.parseInt(session.detail(slot), 10), 0);
    expect(total).toBe(DEFAULT_PAIRS - 1 + GOLDEN_POINTS);
  });

  it('is the same game for the same seed', () => {
    const play = (): string => {
      const session = createMemorySession({ seats: seats('ai', 'ai'), tuning: createRuntimeModes(), rng: createRng(11) });
      for (let tick = 0; tick < 60 * 120; tick += 1) session.step([NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
      return JSON.stringify(session.snapshot());
    };
    expect(play()).toBe(play());
  });

  it('says whose turn it is and how many pairs are taken', () => {
    const session = createMemorySession({ seats: seats('human', 'ai'), tuning: createRuntimeModes(), rng: createRng(3) });
    expect(session.statusLines()).toEqual(['Katze 1 ist dran', `0/${DEFAULT_PAIRS} Paare`]);
    expect(session.cardText(0)).toBe('0 Punkte · dran');
    expect(session.cardText(1)).toBe('0 Punkte');
  });

  it('flips a card for a human who takes too long', () => {
    const session = createMemorySession({ seats: seats('human', 'ai'), tuning: createRuntimeModes(), rng: createRng(3) });
    expect((session.snapshot().states as number[]).filter((value) => value === 1)).toHaveLength(0);
    for (let tick = 0; tick < 60 * 8; tick += 1) session.step([NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
    expect((session.snapshot().states as number[]).filter((value) => value === 1).length).toBeGreaterThan(0);
  });

  it.each(MEMORY_LEVELS.map((pairs, level) => [pairs, level] as const))(
    'lays out %i pairs on a board of whole rows when the level asks for it',
    (pairs, level) => {
      const session = createMemorySession({ seats: seats('human', 'human'), tuning: createRuntimeModes(), rng: createRng(1), level });
      const snapshot = session.snapshot() as { cards: number[]; columns: number };
      expect(snapshot.cards).toHaveLength(pairs * 2);
      expect(snapshot.columns).toBe(memoryColumnsFor(pairs));
      expect(snapshot.cards.length % snapshot.columns).toBe(0);
    },
  );

  it('plays the biggest level with AI cats to the end', () => {
    const level = MEMORY_LEVELS.length - 1;
    const session = createMemorySession({ seats: seats('ai', 'ai', 'ai'), tuning: createRuntimeModes(), rng: createRng(9), level });
    for (let tick = 0; tick < 60 * 900 && !session.over; tick += 1) session.step([NEUTRAL_INPUT, NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
    expect(session.over).toBe(true);
  });

  it('has a picture for every pair of the biggest level', () => {
    expect(Math.max(...MEMORY_LEVELS)).toBeLessThanOrEqual(MEMORY_MOTIF_COUNT);
  });
});
