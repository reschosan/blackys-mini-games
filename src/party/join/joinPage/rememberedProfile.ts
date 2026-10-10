import type { CatAppearance } from '../../../shared/config/catAppearance';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import { loadCatAppearance, loadKartLoadout, saveCatAppearance, saveKartLoadout } from '../../lobby/catPersistence';

/** The cat and kart of this phone are kept under one key of their own, whatever seat the phone gets. */
const PROFILE_KEY = 'guest';

type Profile = { readonly appearance: CatAppearance; readonly loadout: KartLoadout };

/** The cat and kart this phone remembers go to the host, which takes them for this player; every change the host reports is kept. */
export class RememberedProfile {
  private lastSaved = '';
  private sentInLobby = false;

  constructor(private readonly send: (profile: Profile) => void) {}

  sendSaved(): void {
    const saved = this.saved();
    if (saved) this.send(saved);
  }

  /** The first entry brings the saved cat to the host once more: a profile that came in before the seat existed is lost. */
  onLobbyEntry(entry: Profile): void {
    if (!this.sentInLobby) {
      this.sentInLobby = true;
      this.sendSaved();
    }
    this.remember(entry);
  }

  private remember(entry: Profile): void {
    const serialized = JSON.stringify([entry.appearance, entry.loadout]);
    if (serialized === this.lastSaved) return;
    this.lastSaved = serialized;
    saveCatAppearance(PROFILE_KEY, entry.appearance);
    saveKartLoadout(PROFILE_KEY, entry.loadout);
  }

  private saved(): Profile | null {
    const appearance = loadCatAppearance(PROFILE_KEY);
    const loadout = loadKartLoadout(PROFILE_KEY);
    return appearance && loadout ? { appearance, loadout } : null;
  }
}
