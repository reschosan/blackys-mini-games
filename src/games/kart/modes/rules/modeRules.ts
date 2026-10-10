import type { ModeTuning } from '../../../../shared/config/modes';
import type { Rng } from '../../../../shared/core/rng';
import type { KartState } from '../../kart/kartState';

/** What the rules of a game see after every physics step. */
export interface RulesContext {
  readonly karts: readonly KartState[];
  readonly stepSeconds: number;
  /** Seconds since "Los!". */
  readonly timeSeconds: number;
  /** Speed each kart lost in this step (a bump into a wall or a kart shows as a drop). */
  readonly speedDrops: readonly number[];
}

/** The point an AI kart drives to (a chase or a flight is just a different point). */
export interface AimPoint {
  readonly x: number;
  readonly z: number;
}

/** What a view draws besides the karts. */
export type ModeVisual =
  | { readonly kind: 'none' }
  | { readonly kind: 'tag'; readonly hunterSlot: number }
  | { readonly kind: 'platform'; readonly radius: number }
  | { readonly kind: 'tiles'; readonly tileSize: number; readonly tilesPerSide: number; readonly states: readonly number[] }
  | {
      readonly kind: 'field';
      readonly width: number;
      readonly depth: number;
      readonly goalWidth: number;
      readonly cornerSize: number;
      readonly ballX: number;
      readonly ballZ: number;
      readonly ballRadius: number;
    };

/** The rules of one game on the kart engine. They run on the host after the physics of every 60 Hz step; a guest that draws the game keeps an
 *  identical copy and only takes over what the host reports (`toExtras` / `fromExtras`). All state is numbers so it travels with a snapshot. */
export interface ModeRules {
  step(context: RulesContext): void;
  readonly over: boolean;
  /** Place of every seat; equal places are a draw (team games). 1 is the best. */
  places(): readonly number[];
  /** Is this seat out of the game (fell off, eliminated)? Out karts do not drive, collide or show. */
  isOut(slot: number): boolean;
  /** Result text of a seat for the result table, instead of a finish time. */
  detail(slot: number): string;
  /** Short text on the player's own score card while the game runs. */
  cardText(slot: number): string;
  /** Lines of the strip at the top (time left, score, who hunts). */
  statusLines(): readonly string[];
  /** Where an AI kart of this seat drives, or null to stay where it is. */
  aim(slot: number, karts: readonly KartState[]): AimPoint | null;
  /** Seats that must go back to their start positions (after a goal), once. */
  takeKickoff(): boolean;
  readonly visual: ModeVisual;
  toExtras(): number[];
  fromExtras(values: readonly number[]): void;
}

export interface RulesSetup {
  readonly count: number;
  readonly rng: Rng;
  readonly tuning: ModeTuning;
}

export type RulesFactory = (setup: RulesSetup) => ModeRules;
