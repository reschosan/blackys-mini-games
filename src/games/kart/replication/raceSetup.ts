import type { CatAppearance } from '../../../shared/config/catAppearance';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import { isValidProfile } from '../../../shared/config/playerProfile';
import { isHexColor, isIntegerIn, isListOf, isRecord, isTextUpTo } from '../../../shared/core/wireChecks';
import { kartModeById } from '../modes/kartModes';

const MAX_PLAYERS_IN_SETUP = 8;
const MAX_BUILD_ID_CHARACTERS = 40;

export interface SetupPlayer {
  readonly slot: number;
  readonly isAi: boolean;
  readonly name: string;
  readonly color: string;
  readonly appearance: CatAppearance;
  readonly loadout: KartLoadout;
}

/** What a guest needs to build the race before the first snapshot: the map, the cats and karts, who it is. */
export interface RaceSetup {
  /** Both sides must run the same build: same maps, same numbers. A different one is refused. */
  readonly buildId: string;
  /** The kart mode being played (`KartMode.id`): decides about items and the number of laps. */
  readonly mode: string;
  readonly mapIndex: number;
  readonly lapCount: number;
  readonly seat: number;
  readonly snapshotHz: number;
  /** The race is already under way (a returning guest): drive on without waiting for the others. */
  readonly resume: boolean;
  readonly players: readonly SetupPlayer[];
}

export type RaceEvent =
  | { readonly type: 'itemUsed'; readonly slot: number; readonly item: string }
  | { readonly type: 'itemPickedUp'; readonly slot: number }
  | { readonly type: 'collision'; readonly slot: number }
  | { readonly type: 'tankShot' }
  | { readonly type: 'explosion' }
  | { readonly type: 'countdownBeep' }
  | { readonly type: 'go' }
  | { readonly type: 'results'; readonly rows: readonly ResultEntry[] };

export interface ResultEntry {
  readonly place: number;
  readonly name: string;
  readonly color: string;
  readonly time: string;
  /** "+4 · 9": points of this game and the total over all games. */
  readonly score: string;
}

function isSetupPlayer(value: unknown): value is SetupPlayer {
  if (!isRecord(value)) return false;
  const { slot, isAi, name, color, appearance, loadout } = value;
  return (
    isIntegerIn(slot, 0, MAX_PLAYERS_IN_SETUP - 1) &&
    typeof isAi === 'boolean' &&
    isTextUpTo(name, 40) &&
    isHexColor(color) &&
    isValidProfile(appearance, loadout)
  );
}

/** Null for anything that is not a complete, valid setup. */
export function parseRaceSetup(value: unknown, mapCount: number): RaceSetup | null {
  if (!isRecord(value)) return null;
  const { buildId, mode, mapIndex, lapCount, seat, snapshotHz, resume, players } = value;
  if (!isTextUpTo(buildId, MAX_BUILD_ID_CHARACTERS) || typeof mode !== 'string' || !kartModeById(mode) || !isIntegerIn(mapIndex, 0, mapCount - 1)) return null;
  if (!isIntegerIn(lapCount, 1, 99) || !isIntegerIn(seat, 0, MAX_PLAYERS_IN_SETUP - 1) || !isIntegerIn(snapshotHz, 5, 60) || typeof resume !== 'boolean')
    return null;
  if (!isListOf(players, 1, MAX_PLAYERS_IN_SETUP, isSetupPlayer)) return null;
  if (!players.some((player) => player.slot === seat)) return null;
  return { buildId, mode, mapIndex, lapCount, seat, snapshotHz, resume, players };
}

function isResultEntry(value: unknown): value is ResultEntry {
  if (!isRecord(value)) return false;
  return isIntegerIn(value.place, 0, 16) && isTextUpTo(value.name, 40) && isHexColor(value.color) && isTextUpTo(value.time, 28) && isTextUpTo(value.score, 16);
}

const EVENT_PARSERS: Readonly<Record<string, (value: Record<string, unknown>) => RaceEvent | null>> = {
  itemUsed: (value) => (isIntegerIn(value.slot, 0, 7) && isTextUpTo(value.item, 16) ? { type: 'itemUsed', slot: value.slot, item: value.item } : null),
  itemPickedUp: (value) => (isIntegerIn(value.slot, 0, 7) ? { type: 'itemPickedUp', slot: value.slot } : null),
  collision: (value) => (isIntegerIn(value.slot, 0, 7) ? { type: 'collision', slot: value.slot } : null),
  tankShot: () => ({ type: 'tankShot' }),
  explosion: () => ({ type: 'explosion' }),
  countdownBeep: () => ({ type: 'countdownBeep' }),
  go: () => ({ type: 'go' }),
  results: (value) => (isListOf(value.rows, 0, 8, isResultEntry) ? { type: 'results', rows: value.rows } : null),
};

export function parseRaceEvent(value: unknown): RaceEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  return Object.hasOwn(EVENT_PARSERS, value.type) ? EVENT_PARSERS[value.type]!(value) : null;
}
