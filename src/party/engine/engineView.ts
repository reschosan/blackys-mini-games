import type { EngineGame, EngineSeat } from '../../shared/game/engine';
import type { EngineView } from '../../shared/game/engineView';

/** A game that is not on the kart engine, with its rules and its view. */
export interface EngineEntry {
  readonly game: EngineGame;
  createView(seats: readonly EngineSeat[]): EngineView;
}
