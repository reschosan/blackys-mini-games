import type { TouchGame } from '../../shared/game/gameCard';
import type { RaceEvent } from '../../games/kart/replication/raceSetup';
import type { RemotePhase, ResultChoice } from '../../shared/net/messages';

/** What the guest page needs of the game it draws, whatever the engine: a race with its own kart prediction or any other game. */
export interface GuestGame {
  /** Whether the game loop runs and sends the guest's input itself (otherwise the page does). */
  readonly isRunning: boolean;
  /** The touch buttons when the game is outside the kart engine (the stick is then free), otherwise undefined. */
  readonly touchGame: TouchGame | undefined;
  /** The name of the item button in a kart game that gives it another job (the shove of Sumo). */
  readonly itemLabel?: string | undefined;
  onSnapshot(raw: unknown): void;
  onStatus(phase: RemotePhase, away: readonly string[]): void;
  onEvent(event: RaceEvent): void;
  setMuted(muted: boolean): void;
  setDecision(canDecide: boolean, selected: ResultChoice): void;
  leave(): void;
  getState(): unknown;
}
