import { isValidCatAppearance, type CatAppearance } from './catAppearance';
import { isValidKartLoadout, type KartLoadout } from './kartLoadout';
import { isRecord } from '../core/wireChecks';

/** The cat and kart a player brings (from a saved profile or a guest phone) are checked field by field before the game takes them. */
export function isValidProfile(appearance: unknown, loadout: unknown): appearance is CatAppearance {
  return (
    isRecord(appearance) &&
    isValidCatAppearance(appearance as unknown as CatAppearance) &&
    isRecord(loadout) &&
    isValidKartLoadout(loadout as unknown as KartLoadout)
  );
}
