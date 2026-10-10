import type { CatAppearance } from '../../../shared/config/catAppearance';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import { MEMORY_LEVELS } from '../../../shared/config/memoryLevels';
import { isPlaneType, type PlaneTypeId } from '../../../shared/config/planeTypes';
import { isValidProfile } from '../../../shared/config/playerProfile';
import { isHexColor, isIntegerIn, isRecord, isTextUpTo } from '../../../shared/core/wireChecks';

const MAX_ROW = 30;
const LOBBY_STAGES: readonly string[] = ['customizing', 'gameVote', 'trackVote'];
const PAGES: readonly string[] = ['start', 'cat', 'kart', 'plane', 'memory'];

/** One player's card as the lobby shows it: the cat, the kart, which row the cursor is on, ready or not. */
interface LobbyEntryState {
  readonly appearance: CatAppearance;
  readonly loadout: KartLoadout;
  readonly plane: PlaneTypeId;
  readonly level: number;
  readonly page: 'start' | 'cat' | 'kart' | 'plane' | 'memory';
  readonly presetIndex: number;
  readonly ready: boolean;
  readonly selectedRow: number;
}

export interface VotePickState {
  readonly slot: number;
  readonly name: string;
  readonly color: string;
  /** The game or map the player points at; one past the last stands for "Back". */
  readonly mapIndex: number;
  readonly confirmed: boolean;
}

/** What a guest phone needs to show its own lobby screen: its own card while the cats are made, the vote when the map is chosen. */
export interface GuestLobbyState {
  readonly stage: 'customizing' | 'gameVote' | 'trackVote';
  readonly seat: number;
  /** The game the vote chose (index in `GAMES`), shown with its rules while the map is chosen. */
  readonly game: number;
  readonly entry: LobbyEntryState | null;
  readonly picks: readonly VotePickState[];
}

/** What a guest does on its own screen by touch, instead of with the cross: the host applies it like the same tap on the host's lobby. */
export type LobbyTap =
  | { readonly target: 'row'; readonly value: number }
  | { readonly target: 'arrow'; readonly value: -1 | 1 }
  | { readonly target: 'game'; readonly value: number }
  | { readonly target: 'map'; readonly value: number }
  | { readonly target: 'back' }
  | { readonly target: 'leave' };

/** What goes to the guest of a host's entry: exactly these fields, so that nothing the host adds later goes over the network by accident. */
export function toLobbyEntryState(entry: LobbyEntryState): LobbyEntryState {
  const { appearance, loadout, plane, level, page, presetIndex, ready, selectedRow } = entry;
  return { appearance, loadout, plane, level, page, presetIndex, ready, selectedRow };
}

function parseEntry(value: unknown): LobbyEntryState | null {
  if (!isRecord(value)) return null;
  const { appearance, loadout, plane, level, page, presetIndex, ready, selectedRow } = value;
  const valid =
    isValidProfile(appearance, loadout) &&
    isPlaneType(plane) &&
    isIntegerIn(level, 0, MEMORY_LEVELS.length - 1) &&
    PAGES.includes(page as string) &&
    isIntegerIn(presetIndex, 0, MAX_ROW) &&
    typeof ready === 'boolean' &&
    isIntegerIn(selectedRow, 0, MAX_ROW);
  if (!valid) return null;
  return { appearance, loadout: loadout as KartLoadout, plane, level, page: page as LobbyEntryState['page'], presetIndex, ready, selectedRow };
}

function parsePick(value: unknown, optionCount: number): VotePickState | null {
  if (!isRecord(value)) return null;
  const { slot, name, color, mapIndex, confirmed } = value;
  const valid = isIntegerIn(slot, 0, 7) && isTextUpTo(name, 40) && isHexColor(color) && isIntegerIn(mapIndex, 0, optionCount) && typeof confirmed === 'boolean';
  return valid ? { slot, name, color, mapIndex, confirmed } : null;
}

/** Null for anything that is not a well-formed lobby state. */
export function parseGuestLobbyState(value: unknown, optionCount: number): GuestLobbyState | null {
  if (!isRecord(value)) return null;
  const { stage, seat, game, entry, picks } = value;
  if (
    !LOBBY_STAGES.includes(stage as GuestLobbyState['stage']) ||
    !isIntegerIn(seat, 0, 7) ||
    !isIntegerIn(game, 0, 15) ||
    !Array.isArray(picks) ||
    picks.length > 8
  )
    return null;
  const parsedPicks = picks.map((pick) => parsePick(pick, optionCount));
  const parsedEntry = entry === null ? null : parseEntry(entry);
  if (parsedPicks.includes(null) || (entry !== null && parsedEntry === null)) return null;
  return { stage: stage as GuestLobbyState['stage'], seat, game, entry: parsedEntry, picks: parsedPicks as VotePickState[] };
}

/** Null for anything that is not a tap a guest may send. */
export function parseLobbyTap(value: unknown, mapCount: number, gameCount: number): LobbyTap | null {
  if (!isRecord(value) || typeof value.target !== 'string') return null;
  const index = (limit: number): number | null => (isIntegerIn(value.value, 0, limit) ? value.value : null);
  const parsers: Readonly<Record<string, () => LobbyTap | null>> = {
    row: () => {
      const row = index(MAX_ROW);
      return row === null ? null : { target: 'row', value: row };
    },
    arrow: () => (value.value === -1 || value.value === 1 ? { target: 'arrow', value: value.value } : null),
    game: () => {
      const game = index(gameCount - 1);
      return game === null ? null : { target: 'game', value: game };
    },
    map: () => {
      const map = index(mapCount - 1);
      return map === null ? null : { target: 'map', value: map };
    },
    back: () => ({ target: 'back' }),
    leave: () => ({ target: 'leave' }),
  };
  return Object.hasOwn(parsers, value.target) ? parsers[value.target]!() : null;
}
