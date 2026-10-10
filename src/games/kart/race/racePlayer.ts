import type { AiDriverState } from '../ai/aiDriver';
import type { AiDifficulty } from '../../../shared/config/aiDifficulty';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import type { RaceParticipant } from './raceSimulation';

export interface RacePlayer extends RaceParticipant {
  readonly isAi: boolean;
  loadout: KartLoadout;
  readonly aiDriver: AiDriverState | null;
  difficulty: AiDifficulty | null;
  raceStartEarlyPress: boolean;
  raceStartBoostEarned: boolean;
  /** A guest phone draws this kart on its own screen, so this screen needs no camera on it. */
  viewedElsewhere?: boolean;
  /** Out of the game (fell off the platform, caught by the lava): it is not drawn and does not drive. */
  hidden?: boolean;
}
