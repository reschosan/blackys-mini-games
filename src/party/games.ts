import type { GameCard } from '../shared/game/gameCard';
import { KART_MODES } from '../games/kart/modes/kartModes';
import { ENGINES } from './engines';

/** Every game the party can offer, in the order of the selection; the first one is the default. */
export const GAMES: readonly GameCard[] = [...KART_MODES, ...ENGINES.map((entry) => entry.game)];
