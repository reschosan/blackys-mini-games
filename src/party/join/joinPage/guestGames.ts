import { AVAILABLE_MAPS } from '../../../games/kart/maps/registry';
import { parseRaceSetup } from '../../../games/kart/replication/raceSetup';
import type { RemoteConfig } from '../../../shared/config/remote';
import type { InputMessage } from '../../../shared/net/messages';
import type { ClientRace } from '../../client/clientRace';
import type { ClientEngine } from '../../client/clientEngine';
import type { GuestGame } from '../../client/guestGame';
import { engineById } from '../../engines';
import { parseEngineSetup } from '../../engine/engineSetup';

interface GuestGamesDeps {
  readonly canvas: HTMLCanvasElement;
  readonly overlay: HTMLElement;
  readonly config: RemoteConfig;
  readonly nextInput: () => InputMessage;
  readonly sendReady: (renders: boolean) => void;
  readonly onFailure: () => void;
}

/** What a guest page needs to start the game the host announces: which build it needs and how to build it. The two kinds (the race on the kart engine with
 *  its own-kart prediction, and every other game) load their code only when they are played. */
export interface GamePlan {
  readonly buildId: string;
  readonly build: () => Promise<GuestGame>;
}

export class GuestGames {
  private race: ClientRace | null = null;
  private engine: ClientEngine | null = null;

  constructor(private readonly deps: GuestGamesDeps) {}

  /** Null for a setup that is not valid. */
  plan(game: string, raw: unknown): GamePlan | null {
    const entry = engineById(game);
    if (entry) {
      const setup = parseEngineSetup(raw);
      if (!setup) return null;
      return {
        buildId: setup.buildId,
        build: async () => {
          const { ClientEngine: ClientEngineClass } = await import('../../client/clientEngine');
          this.engine ??= new ClientEngineClass(this.deps);
          this.engine.prepare(setup, entry);
          return this.engine;
        },
      };
    }
    const setup = parseRaceSetup(raw, AVAILABLE_MAPS.length);
    if (!setup) return null;
    return {
      buildId: setup.buildId,
      build: async () => {
        const { ClientRace: ClientRaceClass } = await import('../../client/clientRace');
        this.race ??= new ClientRaceClass(this.deps);
        this.race.prepare(setup);
        return this.race;
      },
    };
  }
}
