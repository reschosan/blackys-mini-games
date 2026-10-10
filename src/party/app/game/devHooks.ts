import type { GameFlow } from '../../../shared/core/gameFlow';
import type { RaceConfig } from '../../../shared/config/race';
import type { InputManager } from '../../../shared/input/inputManager';
import { AVAILABLE_MAPS } from '../../../games/kart/maps/registry';
import { GAMES } from '../../games';
import type { PlayerRoster } from '../playerRoster';
import type { RemoteSide } from '../remoteSide';
import type { RaceLifecycle } from './raceLifecycle';

interface DevHooksDeps {
  readonly flow: GameFlow;
  readonly input: InputManager;
  readonly roster: PlayerRoster;
  readonly lifecycle: RaceLifecycle;
  readonly remote: RemoteSide;
  readonly race: RaceConfig;
  /** Runs many simulation steps per drawn frame (every one still uses the fixed 60 Hz step). */
  readonly accelerate: (on: boolean) => void;
}

const NO_WAITING: Partial<RaceConfig> = { finishCountdownSeconds: 0, startCountdownSeconds: 0, startGoDisplaySeconds: 0 };

/** The entry points of the browser tests: they start games and show results without people who press buttons. Every one is unavailable in production builds. */
export class DevHooks {
  constructor(private readonly deps: DevHooksDeps) {}

  /** Four medium AI karts drive one lap of the map at `mapIndex`, with no presentation delays. */
  startEnduranceRace(mapIndex: number, accelerated = true): boolean {
    const map = AVAILABLE_MAPS[mapIndex];
    if (!import.meta.env.DEV || this.deps.input.players.length > 0 || !map) return false;
    this.deps.accelerate(accelerated);
    this.deps.lifecycle.applyMap(map);
    Object.assign(this.deps.race, { lapCount: 1, ...NO_WAITING });
    this.deps.roster.fillWithAi();
    this.deps.lifecycle.startRace();
    return true;
  }

  /** The game with the given id starts at once, the free seats filled with AI karts. */
  startGameForTest(gameId: string, accelerated = true): boolean {
    const index = GAMES.findIndex((game) => game.id === gameId);
    if (!import.meta.env.DEV || this.deps.flow.phase !== 'lobby' || index < 0) return false;
    this.deps.accelerate(accelerated);
    this.deps.lifecycle.chooseGame(index);
    Object.assign(this.deps.race, NO_WAITING);
    this.deps.roster.fillWithAi();
    this.deps.lifecycle.startRaceOnMap(0);
    return true;
  }

  /** Ends the running race at once and shows the results (tests cannot wait for a whole race of people who do not drive). */
  showResultsForTest(): void {
    if (import.meta.env.DEV && this.deps.flow.phase === 'racing') this.deps.lifecycle.openResults();
  }

  /** Hands the invitation a scanned code as if the camera had read it (tests have no camera). */
  submitInviteScan(text: string): Promise<void> {
    return import.meta.env.DEV ? this.deps.remote.host.submitScan(text) : Promise.resolve();
  }
}
