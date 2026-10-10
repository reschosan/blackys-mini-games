import { MEMORY_GAME } from '../games/memory/memoryGame';
import { MemoryView } from '../games/memory/view/memoryView';
import { JETS_GAME } from '../games/jets/jetsGame';
import { JetsView } from '../games/jets/view/jetsView';
import { WALK_GAME } from '../games/walk/walkGame';
import { WalkView } from '../games/walk/view/walkView';
import type { EngineEntry } from './engine/engineView';

/** Every game that is not on the kart engine, with its view; the party offers them after the kart games. */
export const ENGINES: readonly EngineEntry[] = [
  { game: MEMORY_GAME, createView: (seats) => new MemoryView(seats) },
  { game: WALK_GAME, createView: (seats) => new WalkView(seats) },
  { game: JETS_GAME, createView: (seats) => new JetsView(seats) },
];

export function engineById(id: string): EngineEntry | undefined {
  return ENGINES.find((entry) => entry.game.id === id);
}
