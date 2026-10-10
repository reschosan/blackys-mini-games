import { withCardTexts, type CardTexts, type GameCard, type GameId } from '../../../shared/game/gameCard';
import { t } from '../../../shared/i18n';
import type { ArenaKind } from './arena/arenaMaps';
import { createDriftChallenge } from './rules/driftChallenge';
import { createLavaKart } from './rules/lavaKart';
import type { RulesFactory } from './rules/modeRules';
import { createSoccer } from './rules/soccer';
import { createSumo } from './rules/sumo';
import { createTag } from './rules/tag';

/** One set of rules on the kart engine: the same karts, maps and physics, played for a different goal. */
export interface KartMode extends GameCard {
  /** Item boxes, items on the track and the tank's automatic shots. */
  readonly itemsEnabled: boolean;
  /** The item button shoves the kart ahead instead of using an item. */
  readonly shove?: boolean;
  /** Laps of this mode, or null to use the lap count of the map. */
  readonly lapCount: number | null;
  /** The ground it is played on (no map vote then), or null for the race maps. */
  readonly arena: ArenaKind | null;
  /** The rules on top of the physics (who wins, who is out), or null for the plain race by laps. */
  readonly createRules: RulesFactory | null;
}

/** A mode as it is written down; its title, summary and rules come from the texts. */
const kartMode = (mode: Omit<KartMode, CardTexts> & { readonly id: GameId }): KartMode => withCardTexts(mode);

const RACE = kartMode({
  id: 'race',
  lobbyPage: 'kart',
  music: 'zoomies',
  itemsEnabled: true,
  lapCount: null,
  arena: null,
  createRules: null,
});

const TIME_TRIAL = kartMode({
  id: 'timetrial',
  lobbyPage: 'kart',
  music: 'zoomies',
  itemsEnabled: false,
  lapCount: 1,
  arena: null,
  createRules: null,
});

const DRIFT_CHALLENGE = kartMode({
  id: 'drift',
  lobbyPage: 'kart',
  music: 'zoomies',
  itemsEnabled: false,
  lapCount: 99,
  arena: null,
  createRules: createDriftChallenge,
});

const TAG = kartMode({
  id: 'tag',
  minimumSeats: 4,
  lobbyPage: 'kart',
  music: 'arena',
  itemsEnabled: true,
  lapCount: 99,
  arena: 'walled',
  createRules: createTag,
});

const SUMO = kartMode({
  id: 'sumo',
  minimumSeats: 4,
  lobbyPage: 'kart',
  music: 'arena',
  itemsEnabled: false,
  shove: true,
  get itemButtonLabel() {
    return t().games.buttons.shove;
  },
  lapCount: 99,
  arena: 'platform',
  createRules: createSumo,
});

const LAVA_KART = kartMode({
  id: 'lavakart',
  minimumSeats: 4,
  lobbyPage: 'kart',
  music: 'arena',
  itemsEnabled: false,
  lapCount: 99,
  arena: 'tiles',
  createRules: createLavaKart,
});

const SOCCER = kartMode({
  id: 'soccer',
  minimumSeats: 4,
  lobbyPage: 'kart',
  music: 'arena',
  itemsEnabled: true,
  lapCount: 99,
  arena: 'field',
  createRules: createSoccer,
});

/** The default is the first entry. */
export const KART_MODES: readonly KartMode[] = [RACE, TIME_TRIAL, DRIFT_CHALLENGE, TAG, SUMO, LAVA_KART, SOCCER];

export function kartModeById(id: string): KartMode | undefined {
  return KART_MODES.find((mode) => mode.id === id);
}
