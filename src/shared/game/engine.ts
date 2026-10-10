import type { MusicTrackId } from '../audio/music/tracks';
import type { CatAppearance } from '../config/catAppearance';
import type { PlaneTypeId } from '../config/planeTypes';
import type { ModeTuning } from '../config/modes';
import type { Rng } from '../core/rng';
import type { InputFrame } from '../input/actions';
import type { TouchGame } from './gameCard';

/** One seat of a game that is not on the kart engine. */
export interface EngineSeat {
  readonly slot: number;
  /** The cat's name as it is stored (an id): every screen shows it in its own language (`playerDisplayName`). */
  readonly name: string;
  /** The seat's colour as `#rrggbb`. */
  readonly color: string;
  readonly isAi: boolean;
  readonly appearance: CatAppearance;
  /** The plane the player chose (games with planes; the jet when missing). */
  readonly plane?: PlaneTypeId;
}

/** The picture of a game as plain JSON (numbers, texts, lists): small enough to send to every guest phone a few times a second. A game keeps hidden
 *  information (the faces of memory cards that are face down) out of it, because a guest could read it. */
export type EngineSnapshot = Readonly<Record<string, unknown>>;

/** Numbers in a snapshot carry two decimals (or `decimals` steps per unit): enough for the picture, and short on the wire. */
export function roundForSnapshot(value: number, decimals = 100): number {
  return Math.round(value * decimals) / decimals;
}

/** The rules of a game that is not on the kart engine, on the host: it moves on in 60 Hz steps from the players' input, deterministic for a seed. */
export interface EngineSession {
  step(frames: readonly InputFrame[], stepSeconds: number): void;
  readonly over: boolean;
  /** Place of every seat (1 is best); equal places are a draw. */
  places(): readonly number[];
  /** Result text of a seat for the result table. */
  detail(slot: number): string;
  /** Short text on the player's own score card while the game runs. */
  cardText(slot: number): string;
  /** Lines of the strip at the top (time left, whose turn it is). */
  statusLines(): readonly string[];
  snapshot(): EngineSnapshot;
}

export interface EngineSetup {
  /** The level the players chose before the start (an index; games without levels ignore it). */
  readonly level?: number;
  readonly seats: readonly EngineSeat[];
  readonly rng: Rng;
  readonly tuning: ModeTuning;
}

/** A game that is not on the kart engine: what the party shell needs to offer and start it. */
export interface EngineGame {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly rules: readonly string[];
  readonly touch: TouchGame;
  readonly lobbyPage?: 'cat' | 'kart' | 'plane' | 'memory';
  readonly minimumSeats?: number;
  readonly music: MusicTrackId;
  createSession(setup: EngineSetup): EngineSession;
}

/** What the HUD and the result table read from a game that is running: shared by the games on the kart engine and the others. */
export type RoundInfo = Pick<EngineSession, 'detail' | 'cardText' | 'statusLines'>;
