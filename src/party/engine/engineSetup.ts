import { isValidCatAppearance, type CatAppearance } from '../../shared/config/catAppearance';
import { isPlaneType } from '../../shared/config/planeTypes';
import type { EngineSeat } from '../../shared/game/engine';
import { isHexColor, isIntegerIn, isListOf, isRecord, isTextUpTo } from '../../shared/core/wireChecks';

const MAX_SEATS = 8;

/** What a guest needs to build a game that is not on the kart engine before the first snapshot. */
export interface GuestEngineSetup {
  /** Both sides must run the same build; a different one is refused. */
  readonly buildId: string;
  readonly seat: number;
  readonly snapshotHz: number;
  /** The game is already under way (a returning guest). */
  readonly resume: boolean;
  readonly seats: readonly EngineSeat[];
}

function isSeat(value: unknown): value is EngineSeat {
  if (!isRecord(value)) return false;
  const { slot, name, color, isAi, appearance, plane } = value;
  return (
    isIntegerIn(slot, 0, MAX_SEATS - 1) &&
    isTextUpTo(name, 40) &&
    isHexColor(color) &&
    typeof isAi === 'boolean' &&
    (plane === undefined || isPlaneType(plane)) &&
    isRecord(appearance) &&
    isValidCatAppearance(appearance as unknown as CatAppearance)
  );
}

/** Null for anything that is not a complete, valid setup. */
export function parseEngineSetup(value: unknown): GuestEngineSetup | null {
  if (!isRecord(value)) return null;
  const { buildId, seat, snapshotHz, resume, seats } = value;
  if (!isTextUpTo(buildId, 40) || !isIntegerIn(seat, 0, MAX_SEATS - 1) || !isIntegerIn(snapshotHz, 5, 60) || typeof resume !== 'boolean') return null;
  if (!isListOf(seats, 1, MAX_SEATS, isSeat)) return null;
  if (!seats.some((candidate) => candidate.slot === seat)) return null;
  return { buildId, seat, snapshotHz, resume, seats };
}
