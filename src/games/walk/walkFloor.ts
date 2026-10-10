import type { ModeTuning } from '../../shared/config/modes';
import type { Rng } from '../../shared/core/rng';
import { OUTSIDE_GRID, SquareGrid } from '../../shared/game/squareGrid';
import { buildLevels } from './walkTerrain';

export const SOLID = 0;
export const WARNING = 1;
export const GONE = 2;

const SINGLE_TILE = 0;
const LINE = 1;
const COLLAPSE_PATTERNS = 3;
const PATTERN_STAGGER_SECONDS = 0.1;
/** Where the lava lies before it rises, and how far below the next step it stays once it has flooded a level. */
const LAVA_START_HEIGHT = -1.6;
const LAVA_BELOW_STEP = 0.9;
/** How long the lava takes to rise to a flooded level. */
const LAVA_RISE_SECONDS = 2;

/** The floor of "Boden ist Lava" on foot: a grid of tiles on stepped hills over the lava. Tiles start to glow and then vanish, and the lava rises
 *  level by level, so the cats have to climb. */
export class WalkFloor {
  readonly side: number;
  readonly tileSize: number;
  readonly levelHeight: number;
  readonly states: number[];
  readonly levels: number[];
  private readonly grid: SquareGrid;
  private readonly warningLeft: number[];
  private nextCollapseAt: number;
  /** Levels below this one are under the lava. */
  private floodedLevels = 0;
  private lastFloodAt = 0;
  private time = 0;

  constructor(
    private readonly tuning: ModeTuning['walk'],
    private readonly rng: Rng,
  ) {
    this.side = tuning.tilesPerSide;
    this.tileSize = tuning.tileSize;
    this.levelHeight = tuning.levelHeight;
    this.grid = new SquareGrid(this.side, this.tileSize);
    this.states = new Array<number>(this.grid.tileCount).fill(SOLID);
    this.warningLeft = new Array<number>(this.grid.tileCount).fill(0);
    this.nextCollapseAt = tuning.firstCollapseSeconds;
    this.levels = buildLevels(this.side, tuning, rng);
  }

  /** The tile under a point, or `OUTSIDE_GRID`. */
  tileAt(x: number, z: number): number {
    return this.grid.tileAt(x, z);
  }

  centreOf(tile: number): { x: number; z: number } {
    return this.grid.centreOf(tile);
  }

  /** The height of the top of a tile. */
  topOf(tile: number): number {
    return (this.levels[tile] ?? 0) * this.levelHeight;
  }

  /** How high the ground is under a point: the top of its tile, minus infinity over a hole or the lava. */
  heightAt(x: number, z: number): number {
    const tile = this.tileAt(x, z);
    if (tile < 0 || this.states[tile] === GONE) return Number.NEGATIVE_INFINITY;
    return this.topOf(tile);
  }

  tilesLeft(): number {
    return this.states.filter((state) => state !== GONE).length;
  }

  /** The surface of the lava: it rises over a couple of seconds whenever it floods a level. */
  lavaHeight(): number {
    if (this.floodedLevels === 0) return LAVA_START_HEIGHT;
    const target = this.floodedLevels * this.levelHeight - LAVA_BELOW_STEP;
    const before = this.floodedLevels === 1 ? LAVA_START_HEIGHT : (this.floodedLevels - 1) * this.levelHeight - LAVA_BELOW_STEP;
    const share = Math.min((this.time - this.lastFloodAt) / LAVA_RISE_SECONDS, 1);
    return before + (target - before) * share;
  }

  /** Seconds until the lava takes the next level, or null when the top level is reached. */
  secondsToFlood(): number | null {
    if (this.floodedLevels >= this.tuning.topLevel) return null;
    return Math.max(this.floodAt(this.floodedLevels + 1) - this.time, 0);
  }

  /** The level the lava takes next (every level below it), or the top level when nothing is left to flood. */
  nextFloodLevel(): number {
    return Math.min(this.floodedLevels + 1, this.tuning.topLevel);
  }

  /** The tiles next to a tile (also diagonally) that are neither glowing nor gone. */
  safeNeighbours(tile: number): number[] {
    return this.blockAround(tile).filter((other) => other !== tile && this.states[other] === SOLID);
  }

  /** The nearest tile that is neither glowing nor gone and that `accepts` (by its level). */
  nearestSafe(x: number, z: number, accepts: (level: number) => boolean = () => true): number {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    this.states.forEach((state, tile) => {
      if (state !== SOLID || !accepts(this.levels[tile]!)) return;
      const centre = this.centreOf(tile);
      const distance = Math.hypot(centre.x - x, centre.z - z);
      if (distance < bestDistance) {
        best = tile;
        bestDistance = distance;
      }
    });
    return best;
  }

  /** Lets glowing tiles run down, starts new ones (the pace picks up with time) and lets the lava rise. */
  advance(timeSeconds: number, stepSeconds: number): void {
    this.time = timeSeconds;
    this.warningLeft.forEach((left, tile) => {
      if (this.states[tile] !== WARNING) return;
      this.warningLeft[tile] = left - stepSeconds;
      if (this.warningLeft[tile]! <= 0) this.states[tile] = GONE;
    });
    this.advanceFlood(timeSeconds);
    while (timeSeconds >= this.nextCollapseAt) {
      this.startWarning();
      const sinceStart = timeSeconds - this.tuning.firstCollapseSeconds;
      this.nextCollapseAt += Math.max(this.tuning.collapseIntervalSeconds - sinceStart * 0.03, this.tuning.minimumIntervalSeconds);
    }
  }

  private floodAt(stage: number): number {
    return this.tuning.floodStartSeconds + (stage - 1) * this.tuning.floodIntervalSeconds;
  }

  /** Before the lava takes a level, every tile below it glows; then the lava rises over them. */
  private advanceFlood(timeSeconds: number): void {
    const stage = this.floodedLevels + 1;
    if (stage > this.tuning.topLevel || timeSeconds < this.floodAt(stage) - this.tuning.floodWarningSeconds) return;
    this.levels.forEach((level, tile) => {
      if (level >= stage || this.states[tile] === GONE) return;
      const left = this.floodAt(stage) - timeSeconds;
      if (this.states[tile] === SOLID || this.warningLeft[tile]! > left) {
        this.states[tile] = WARNING;
        this.warningLeft[tile] = left;
      }
    });
    if (timeSeconds < this.floodAt(stage)) return;
    this.floodedLevels = stage;
    this.lastFloodAt = timeSeconds;
  }

  /** The lowest level goes first: higher steps only when there is nothing below them. A collapse is one tile, a whole row or column, or a block of nine. */
  private startWarning(): void {
    const solid = this.states.flatMap((state, tile) => (state === SOLID ? [tile] : []));
    const lowest = Math.min(...solid.map((tile) => this.levels[tile]!));
    const pool = solid.filter((tile) => this.levels[tile] === lowest);
    const first = pool[this.rng.nextInt(pool.length)];
    if (first === undefined) return;
    this.collapseShapeAround(first)
      .filter((tile) => this.states[tile] === SOLID && this.levels[tile] === lowest)
      .forEach((tile, order) => {
        this.states[tile] = WARNING;
        this.warningLeft[tile] = this.tuning.warningSeconds + order * PATTERN_STAGGER_SECONDS;
      });
  }

  private collapseShapeAround(tile: number): number[] {
    const pattern = this.rng.nextInt(COLLAPSE_PATTERNS);
    if (pattern === SINGLE_TILE) return [tile];
    return pattern === LINE ? this.lineThrough(tile) : this.blockAround(tile);
  }

  /** A row or a column through a tile, the nearest tiles first so that the collapse runs along it. */
  private lineThrough(tile: number): number[] {
    const column = this.grid.columnOf(tile);
    const row = this.grid.rowOf(tile);
    const alongRow = this.rng.nextInt(2) === 0;
    return Array.from({ length: this.side }, (_, index) => (alongRow ? row * this.side + index : index * this.side + column)).sort(
      (first, second) => Math.abs(first - tile) - Math.abs(second - tile),
    );
  }

  private blockAround(tile: number): number[] {
    const column = this.grid.columnOf(tile);
    const row = this.grid.rowOf(tile);
    const tiles: number[] = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) tiles.push(this.grid.tileOf(column + columnOffset, row + rowOffset));
    }
    return tiles.filter((neighbour) => neighbour !== OUTSIDE_GRID);
  }
}
