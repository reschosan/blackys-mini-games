import { placesByStaying } from '../../../../shared/game/ranking';
import { OUTSIDE_GRID, SquareGrid } from '../../../../shared/game/squareGrid';
import { type ModeRules, type RulesContext, type RulesSetup } from './modeRules';
import { t as texts } from '../../../../shared/i18n';

const NOT_OUT = -1;
const SOLID = 0;
const WARNING = 1;
const GONE = 2;
/** Two bits per tile, twelve tiles to a number, so a float32 carries them exactly. */
const TILES_PER_NUMBER = 12;

function packTiles(states: readonly number[]): number[] {
  const packed: number[] = [];
  for (let start = 0; start < states.length; start += TILES_PER_NUMBER) {
    packed.push(states.slice(start, start + TILES_PER_NUMBER).reduce((bits, state, index) => bits + state * 4 ** index, 0));
  }
  return packed;
}

function unpackTiles(packed: readonly number[], tileCount: number): number[] {
  return Array.from({ length: tileCount }, (_, tile) => Math.floor((packed[Math.floor(tile / TILES_PER_NUMBER)] ?? 0) / 4 ** (tile % TILES_PER_NUMBER)) % 4);
}

/** The floor is a grid of tiles that start to glow and then vanish one after another; whoever stands on a vanished tile is out, the last one wins. */
export function createLavaKart({ count, rng, tuning }: RulesSetup): ModeRules {
  const t = tuning.lava;
  const grid = new SquareGrid(t.tilesPerSide, t.tileSize);
  const states = new Array<number>(grid.tileCount).fill(SOLID);
  const warningLeft = new Array<number>(grid.tileCount).fill(0);
  const outAt = new Array<number>(count).fill(NOT_OUT);
  let nextCollapseAt = t.firstCollapseSeconds;
  let over = false;

  const alive = (): number => outAt.filter((time) => time === NOT_OUT).length;

  const startWarning = (): void => {
    const solid = states.flatMap((state, tile) => (state === SOLID ? [tile] : []));
    const tile = solid[rng.nextInt(solid.length)];
    if (tile === undefined) return;
    states[tile] = WARNING;
    warningLeft[tile] = t.warningSeconds;
  };

  const advanceTiles = (context: RulesContext): void => {
    warningLeft.forEach((left, tile) => {
      if (states[tile] !== WARNING) return;
      warningLeft[tile] = left - context.stepSeconds;
      if (warningLeft[tile]! <= 0) states[tile] = GONE;
    });
    while (context.timeSeconds >= nextCollapseAt) {
      startWarning();
      const sinceStart = context.timeSeconds - t.firstCollapseSeconds;
      nextCollapseAt += Math.max(t.collapseIntervalSeconds - sinceStart * 0.03, t.minimumIntervalSeconds);
    }
  };

  const nearestSafeTile = (x: number, z: number): { x: number; z: number } => {
    const safe = states.flatMap((state, tile) => (state === SOLID ? [grid.centreOf(tile)] : []));
    if (safe.length === 0) return { x: 0, z: 0 };
    return safe.reduce((best, centre) => (Math.hypot(centre.x - x, centre.z - z) < Math.hypot(best.x - x, best.z - z) ? centre : best));
  };

  return {
    step(context) {
      if (over) return;
      advanceTiles(context);
      context.karts.forEach((kart, slot) => {
        const tile = grid.tileAt(kart.x, kart.z);
        if (outAt[slot] === NOT_OUT && (tile === OUTSIDE_GRID || states[tile] === GONE)) outAt[slot] = context.timeSeconds;
      });
      over = alive() <= (count > 1 ? 1 : 0);
    },
    get over() {
      return over;
    },
    places: () => placesByStaying(outAt.map((time) => (time === NOT_OUT ? null : time))),
    isOut: (slot) => outAt[slot] !== NOT_OUT,
    detail: (slot) => {
      const { status } = texts().games;
      return outAt[slot] === NOT_OUT ? status.lastCat : status.fellAfter(status.seconds(Math.round(outAt[slot]!)));
    },
    cardText: (slot) => (outAt[slot] === NOT_OUT ? texts().games.status.in : texts().games.status.out),
    statusLines: () => [texts().games.status.stillIn(alive()), texts().games.status.tiles(states.filter((state) => state !== GONE).length)],
    aim: (slot, karts) => {
      const me = karts[slot]!;
      const tile = grid.tileAt(me.x, me.z);
      return states[tile] === SOLID ? grid.centreOf(tile) : nearestSafeTile(me.x, me.z);
    },
    takeKickoff: () => false,
    get visual() {
      return { kind: 'tiles' as const, tileSize: t.tileSize, tilesPerSide: grid.side, states };
    },
    toExtras: () => [over ? 1 : 0, ...outAt, ...packTiles(states)],
    fromExtras(values) {
      over = values[0] === 1;
      for (let slot = 0; slot < count; slot += 1) outAt[slot] = values[1 + slot] ?? NOT_OUT;
      unpackTiles(values.slice(1 + count), grid.tileCount).forEach((state, tile) => {
        states[tile] = state;
      });
    },
  };
}
