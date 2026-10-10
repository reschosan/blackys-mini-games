import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { createRng } from '../../src/shared/core/rng';
import type { EngineSeat } from '../../src/shared/game/engine';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { jetAiFrame } from '../../src/games/jets/jetsAi';
import { createJetsSession } from '../../src/games/jets/jetsSession';

const STEP = 1 / 60;
const X = 0;
const Z = 1;
const HEADING = 2;
const HITS = 3;
const Y = 6;
const BOOST = 8;
const SHIELD = 9;
const ITEM = 10;
const WATCHING = 11;

function create(kinds: readonly ('human' | 'ai')[], seed = 1) {
  const seats: EngineSeat[] = kinds.map((kind, slot) => ({
    slot,
    name: `Katze ${slot + 1}`,
    color: '#ffffff',
    isAi: kind === 'ai',
    appearance: createCatAppearance(),
  }));
  return createJetsSession({ seats, rng: createRng(seed), tuning: createRuntimeModes() });
}

type Picture = { jets: number[][]; bullets: number[][]; pickups: number[][]; size: number };
const picture = (session: ReturnType<typeof create>): Picture => session.snapshot() as unknown as Picture;
const press = (override: Partial<InputFrame>): InputFrame => ({ ...NEUTRAL_INPUT, ...override });

function run(session: ReturnType<typeof create>, seconds: number, frames: readonly InputFrame[] = []): void {
  for (let tick = 0; tick < Math.round(seconds / STEP); tick += 1) session.step(frames, STEP);
}

describe('kampfjets', () => {
  it('flies on by itself, turns with the stick and never leaves the room', () => {
    const session = create(['human', 'human']);
    const start = picture(session).jets[0]!;
    run(session, 1, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    const straight = picture(session).jets[0]!;
    expect(Math.hypot(straight[X]! - start[X]!, straight[Z]! - start[Z]!)).toBeGreaterThan(20);
    expect(straight[HEADING]).toBeCloseTo(start[HEADING]!, 5);
    run(session, 1, [press({ move: { x: 1, y: 0 } }), NEUTRAL_INPUT]);
    expect(picture(session).jets[0]![HEADING]!).toBeGreaterThan(start[HEADING]! + 1);
    run(session, 40, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    const { size, jets } = picture(session);
    expect(jets.every((jet) => Math.abs(jet[X]!) <= size / 2 && Math.abs(jet[Z]!) <= size / 2)).toBe(true);
  });

  it('climbs with the stick pushed up and dives pushed down, within the height of the room', () => {
    const session = create(['human', 'human']);
    const start = picture(session).jets[0]![Y]!;
    run(session, 0.8, [press({ move: { x: 0, y: -1 } }), NEUTRAL_INPUT]);
    expect(picture(session).jets[0]![Y]!).toBeGreaterThan(start + 4);
    run(session, 6, [press({ move: { x: 0, y: -1 } }), NEUTRAL_INPUT]);
    const tuning = createRuntimeModes().jets;
    expect(picture(session).jets[0]![Y]!).toBe(tuning.maxAltitude);
    run(session, 8, [press({ move: { x: 0, y: 1 } }), NEUTRAL_INPUT]);
    expect(picture(session).jets[0]![Y]!).toBe(tuning.minAltitude);
  });

  it('fires with the button at the pace of the cooldown', () => {
    const session = create(['human', 'human']);
    run(session, 0.1, [press({ drift: true }), NEUTRAL_INPUT]);
    expect(picture(session).bullets).toHaveLength(1);
    run(session, 0.55, [press({ drift: true }), NEUTRAL_INPUT]);
    expect(picture(session).bullets).toHaveLength(2);
  });

  it('counts a hit on the other plane, never on the shooter, and is out after three', () => {
    const session = create(['ai', 'human']);
    for (let tick = 0; tick < 90 * 60 && !session.over; tick += 1) session.step([NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
    const { jets } = picture(session);
    expect(jets[0]![HITS]).toBe(0);
    expect(jets[1]![HITS]).toBeGreaterThanOrEqual(3);
    expect(session.over).toBe(true);
  });

  it('lets a pilot who is out watch another one and switch with the fire key', () => {
    let tried = 0;
    for (let seed = 1; seed <= 12 && tried === 0; seed += 1) {
      const session = create(['ai', 'human', 'ai', 'ai'], seed);
      for (let tick = 0; tick < 100 * 60 && picture(session).jets[1]![4] !== 1 && !session.over; tick += 1) session.step([], STEP);
      session.step([], STEP);
      if (session.over || picture(session).jets.filter((jet) => jet[4] === 0).length < 2) continue;
      tried += 1;
      const first = picture(session).jets[1]![WATCHING]!;
      expect(picture(session).jets[first]![4]).toBe(0);
      expect(session.cardText(1)).toMatch(/^raus · schaut Katze/);
      session.step([NEUTRAL_INPUT, press({ drift: true }), NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
      expect(picture(session).jets[1]![WATCHING]).not.toBe(first);
    }
    expect(tried).toBe(1);
  });

  it('flies shots past a plane that is at another height', () => {
    const session = create(['human', 'human']);
    run(session, 1.2, [NEUTRAL_INPUT, press({ move: { x: 0, y: -1 } })]);
    run(session, 12, [press({ drift: true }), press({ move: { x: 0, y: -1 } })]);
    expect(picture(session).jets[1]![HITS]).toBe(0);
  });

  it('plays a whole game of AI pilots to the end, the same for the same seed, and they pick up and use items', () => {
    const play = (): { final: string; items: number; boosts: number; shields: number } => {
      const session = create(['ai', 'ai', 'ai', 'ai'], 7);
      let items = 0;
      let boosts = 0;
      let shields = 0;
      for (let tick = 0; tick < 130 * 60 && !session.over; tick += 1) {
        session.step([], STEP);
        const { jets } = picture(session);
        items = Math.max(items, ...jets.map((jet) => jet[ITEM]!));
        boosts += jets.filter((jet) => jet[BOOST] === 1).length;
        shields += jets.filter((jet) => jet[SHIELD] === 1).length;
      }
      expect(session.over).toBe(true);
      expect(session.places()).toContain(1);
      return { final: JSON.stringify([session.places(), session.snapshot()]), items, boosts, shields };
    };
    const first = play();
    expect(play().final).toBe(first.final);
    expect(first.items).toBeGreaterThan(0);
    expect(first.boosts + first.shields).toBeGreaterThan(0);
  });

  it('shows lives and the item on the card and the time on the strip', () => {
    const session = create(['ai', 'ai']);
    expect(session.cardText(0)).toBe('5 Leben');
    expect(session.statusLines()[0]).toMatch(/Zeit 2:00/);
  });
});

describe('what AI pilots see', () => {
  const tuning = createRuntimeModes().jets;
  const level = { x: 0, y: 15, z: 0, heading: 0, item: 0 };

  it('turns towards the enemy and fires when it points at it', () => {
    expect(jetAiFrame(level, [{ x: 30, y: 15, z: 0, heading: 0 }], [], tuning)).toMatchObject({ fire: true });
    const left = jetAiFrame(level, [{ x: 0, y: 15, z: 30, heading: 0 }], [], tuning);
    expect(left.steer).toBeGreaterThan(0);
    expect(left.fire).toBe(false);
    expect(jetAiFrame(level, [], [], tuning)).toEqual({ steer: 0, climb: 0, fire: false, useItem: false });
  });

  it('climbs to an enemy above and does not fire while it is far off in height', () => {
    const above = jetAiFrame(level, [{ x: 40, y: 32, z: 0, heading: 0 }], [], tuning);
    expect(above.climb).toBeGreaterThan(0.5);
    expect(above.fire).toBe(false);
  });

  it('fetches an item box when no enemy is close and uses the item it holds', () => {
    const toBox = jetAiFrame(level, [{ x: 150, y: 15, z: 0, heading: 0 }], [{ x: 0, y: 25, z: 40 }], tuning);
    expect(toBox.steer).toBeGreaterThan(0);
    expect(toBox.climb).toBeGreaterThan(0);
    expect(jetAiFrame({ ...level, item: 1 }, [{ x: 150, y: 15, z: 0, heading: 0 }], [], tuning).useItem).toBe(true);
  });
});
