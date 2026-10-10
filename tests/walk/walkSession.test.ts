import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { createRng } from '../../src/shared/core/rng';
import type { EngineSeat } from '../../src/shared/game/engine';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { createWalkSession } from '../../src/games/walk/walkSession';
import { worldMove } from '../../src/games/walk/walkCat';

const STEP = 1 / 60;

function seats(...kinds: readonly ('human' | 'ai')[]): EngineSeat[] {
  return kinds.map((kind, slot) => ({ slot, name: `Katze ${slot + 1}`, color: '#ffffff', isAi: kind === 'ai', appearance: createCatAppearance() }));
}

function create(kinds: readonly ('human' | 'ai')[], seed = 1, adjust: (tuning: ReturnType<typeof createRuntimeModes>) => void = () => undefined) {
  const tuning = createRuntimeModes();
  adjust(tuning);
  return createWalkSession({ seats: seats(...kinds), rng: createRng(seed), tuning });
}

type Picture = { cats: number[][]; fish: number[][]; tiles: number[]; levels: number[]; side: number; lava: number };
const picture = (session: ReturnType<typeof create>): Picture => session.snapshot() as unknown as Picture;

function run(session: ReturnType<typeof create>, seconds: number, frames: readonly InputFrame[] = []): void {
  for (let tick = 0; tick < Math.round(seconds / STEP); tick += 1) session.step(frames, STEP);
}

const press = (override: Partial<InputFrame>): InputFrame => ({ ...NEUTRAL_INPUT, ...override });

describe('boden ist lava on foot', () => {
  it('lets a cat run with the stick and turn to face where it runs', () => {
    const session = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
      tuning.walk.cameraFollowRate = 0;
    });
    const before = picture(session).cats[0]!;
    run(session, 0.5, [press({ move: { x: 1, y: 0 } }), NEUTRAL_INPUT]);
    const after = picture(session).cats[0]!;
    const wanted = worldMove({ x: 1, y: 0 }, before[6]!);
    expect((after[0]! - before[0]!) * wanted.x + (after[1]! - before[1]!) * wanted.y).toBeGreaterThan(1);
    expect(Math.abs(after[3]! - Math.atan2(wanted.y, wanted.x))).toBeLessThan(0.1);
  });

  it('jumps with the button, once per press, and lands again', () => {
    const session = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
    });
    session.step([press({ drift: true }), NEUTRAL_INPUT], STEP);
    run(session, 0.2, [press({ drift: true }), NEUTRAL_INPUT]);
    expect(picture(session).cats[0]![2]!).toBeGreaterThan(0.3);
    run(session, 1.5, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    expect(picture(session).cats[0]![2]!).toBe(0);
  });

  it('lets tiles glow and vanish after the delay', () => {
    const session = create(['human', 'human'], 3, (tuning) => {
      Object.assign(tuning.walk, {
        floodStartSeconds: 999,
        firstCollapseSeconds: 5,
        collapseIntervalSeconds: 1,
        minimumIntervalSeconds: 1,
        warningSeconds: 1.5,
      });
    });
    run(session, 4.5);
    expect(picture(session).tiles.every((tile) => tile === 0)).toBe(true);
    run(session, 1);
    expect(picture(session).tiles.some((tile) => tile === 1)).toBe(true);
    run(session, 6);
    expect(picture(session).tiles.filter((tile) => tile === 2).length).toBeGreaterThan(4);
  });

  it('builds stepped hills up to the top level that can be climbed step by step, the start in the middle flat', () => {
    const { levels, side } = picture(
      create(['human'], 4, (tuning) => {
        tuning.walk.firstCollapseSeconds = 999;
      }),
    );
    expect(Math.max(...levels)).toBe(2);
    const middle = Math.floor(side / 2);
    for (let row = middle - 1; row <= middle + 1; row += 1)
      for (let column = middle - 1; column <= middle + 1; column += 1) expect(levels[row * side + column]).toBe(0);
    levels.forEach((level, tile) => {
      if (tile % side < side - 1) expect(Math.abs(level - levels[tile + 1]!)).toBeLessThanOrEqual(1);
      if (tile + side < levels.length) expect(Math.abs(level - levels[tile + side]!)).toBeLessThanOrEqual(1);
    });
  });

  it('floods the lowest level when the time comes: its tiles glow, then the lava rises over them and takes the cats standing there', () => {
    const session = create(['human', 'human'], 4, (tuning) => {
      Object.assign(tuning.walk, { firstCollapseSeconds: 999, floodStartSeconds: 3, floodWarningSeconds: 1 });
    });
    run(session, 2.5);
    const { levels, tiles } = picture(session);
    expect(tiles.filter((_, tile) => levels[tile] === 0).every((state) => state === 1)).toBe(true);
    expect(session.statusLines()[1]).toBe('Lava steigt in 1 s');
    run(session, 3);
    const after = picture(session);
    expect(after.tiles.filter((_, tile) => after.levels[tile] === 0).every((state) => state === 2)).toBe(true);
    expect(after.tiles.filter((_, tile) => after.levels[tile]! > 0).every((state) => state === 0)).toBe(true);
    expect(after.lava).toBeGreaterThan(-1.6);
    expect(after.cats.every((cat) => cat[4] === 1)).toBe(true);
    expect(session.over).toBe(true);
  });

  it('never lets a cat that sank below the floor stand on a tile again (it fell into the lava)', () => {
    for (const seed of [9, 11, 12, 13]) {
      const session = create(['ai', 'ai', 'ai', 'ai'], seed);
      const sank = new Set<number>();
      for (let tick = 0; tick < 60 * 400 && !session.over; tick += 1) {
        session.step([], STEP);
        picture(session).cats.forEach((cat, slot) => {
          if (cat[4] === 1) return;
          if (cat[2]! < -0.5) sank.add(slot);
          if (sank.has(slot)) expect(cat[2]!).toBeLessThan(-0.4);
        });
      }
    }
  });

  it('shoves two cats that touch apart', () => {
    const session = create(['human', 'human', 'human', 'human'], 5, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
    });
    const start = picture(session).cats;
    run(session, 0.4, [press({ move: { x: 1, y: 0 } }), NEUTRAL_INPUT, NEUTRAL_INPUT, NEUTRAL_INPUT]);
    const after = picture(session).cats;
    expect(after.some((cat, slot) => Math.hypot(cat[0]! - start[slot]![0]!, cat[1]! - start[slot]![1]!) > 0.5)).toBe(true);
  });

  it('plays a whole game of AI cats to the end with one winner, the same for the same seed', () => {
    const play = (): { places: readonly number[]; text: string } => {
      const session = create(['ai', 'ai', 'ai', 'ai'], 9);
      let ticks = 0;
      while (!session.over && ticks < 60 * 400) {
        session.step([], STEP);
        ticks += 1;
      }
      expect(session.over).toBe(true);
      return { places: session.places(), text: JSON.stringify(session.snapshot()) };
    };
    const first = play();
    expect(first.places).toContain(1);
    expect(first.places.filter((place) => place === 1)).toHaveLength(1);
    expect(play()).toEqual(first);
  });

  it('says how many cats and tiles are left, and names the winner and the fallen in the results', () => {
    const session = create(['ai', 'ai', 'ai'], 2);
    expect(session.statusLines()).toEqual(['Noch 3 dabei', '81 Kacheln']);
    for (let tick = 0; tick < 60 * 400 && !session.over; tick += 1) session.step([], STEP);
    const details = [0, 1, 2].map((slot) => session.detail(slot));
    expect(details.filter((text) => text === 'Letzte Katze')).toHaveLength(1);
    expect(details.filter((text) => text.startsWith('gefallen nach'))).toHaveLength(2);
  });

  it('turns the camera with the look input and moves the stick relative to it', () => {
    const session = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
    });
    const before = picture(session).cats[0]!;
    run(session, 0.5, [press({ look: 1 }), NEUTRAL_INPUT]);
    expect(picture(session).cats[0]![6]!).toBeGreaterThan(before[6]! + 0.8);
    run(session, 0.5, [press({ look: -1 }), NEUTRAL_INPUT]);
    expect(picture(session).cats[0]![6]!).toBeCloseTo(before[6]!, 1);
  });

  it('hits the cat in front with the paw: it flies away and is stunned', () => {
    const session = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
      tuning.walk.fishMax = 0;
    });
    const [first, second] = picture(session).cats as [number[], number[]];
    const toward = { x: second[0]! - first[0]!, y: second[1]! - first[1]! };
    const stick = { x: toward.x / Math.hypot(toward.x, toward.y), y: toward.y / Math.hypot(toward.x, toward.y) };
    const yaw = first[6]!;
    const inCamera = { x: Math.cos(yaw) * stick.x + Math.sin(yaw) * stick.y, y: -Math.sin(yaw) * stick.x + Math.cos(yaw) * stick.y };
    run(session, 0.1, [press({ move: inCamera }), NEUTRAL_INPUT]);
    const knocked: number[] = [];
    for (let tick = 0; tick < 300 && knocked.length === 0; tick += 1) {
      session.step([press({ move: inCamera, useItem: tick % 2 === 0 }), NEUTRAL_INPUT], STEP);
      if (picture(session).cats[1]![9] === 1) knocked.push(tick);
    }
    expect(knocked.length).toBe(1);
  });

  it('gives a cat that eats a fish a burst of speed', () => {
    const session = create(['human'], 2, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
      tuning.walk.fishSpawnSeconds = 0.5;
      tuning.walk.cameraFollowRate = 0;
    });
    run(session, 1);
    const spot = picture(session).fish[0]!;
    const cat = picture(session).cats[0]!;
    const yaw = cat[6]!;
    const dx = spot[0]! - cat[0]!;
    const dz = spot[1]! - cat[1]!;
    const length = Math.hypot(dx, dz);
    const stick = { x: (Math.cos(yaw) * dx + Math.sin(yaw) * dz) / length, y: (-Math.sin(yaw) * dx + Math.cos(yaw) * dz) / length };
    for (let tick = 0; tick < 600 && picture(session).cats[0]![7] !== 1; tick += 1) session.step([press({ move: stick })], STEP);
    expect(picture(session).cats[0]![7]).toBe(1);
  });

  it('takes tiles in rows and blocks too, not only one at a time', () => {
    const session = create(['human', 'human'], 5, (tuning) => {
      tuning.walk.collapseIntervalSeconds = 8;
      tuning.walk.minimumIntervalSeconds = 8;
    });
    let most = 0;
    for (let tick = 0; tick < 60 * 60; tick += 1) {
      session.step([NEUTRAL_INPUT, NEUTRAL_INPUT], STEP);
      most = Math.max(most, picture(session).tiles.filter((tile) => tile === 1).length);
    }
    expect(most).toBeGreaterThan(2);
  });

  it('swings the camera round behind a cat that runs sideways, and keeps it where it is for a cat that runs straight on', () => {
    const sideways = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
    });
    const startYaw = picture(sideways).cats[0]![6]!;
    run(sideways, 1.5, [press({ move: { x: 1, y: 0 } }), NEUTRAL_INPUT]);
    expect(Math.abs(picture(sideways).cats[0]![6]! - startYaw)).toBeGreaterThan(0.5);
    const straight = create(['human', 'human'], 1, (tuning) => {
      tuning.walk.firstCollapseSeconds = 999;
    });
    run(straight, 1.5, [press({ move: { x: 0, y: -1 } }), NEUTRAL_INPUT]);
    expect(Math.abs(picture(straight).cats[0]![6]! - startYaw)).toBeLessThan(0.05);
  });
});
