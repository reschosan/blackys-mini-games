import { playerDisplayName } from '../../../shared/i18n/labels';
import { GameFlow } from '../../../shared/core/gameFlow';
import { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import { createRaceWorld } from '../../../games/kart/race/raceWorld';
import { AVAILABLE_MAPS } from '../../../games/kart/maps/registry';
import { SoundEngine } from '../../../shared/audio/soundEngine';
import { otherQuality } from '../../../shared/config/graphics';

import { graphicsEmergency, graphicsLowered } from '../../../shared/ui/problemTexts';
import { createRuntimeRemote } from '../../../shared/config/remote';
import type { TouchSettings } from '../../../shared/config/touch';
import { createRng, deriveSeed, seedFromSearch } from '../../../shared/core/rng';
import { DebugPanel } from '../../../shared/debug/panel';
import { InputManager } from '../../../shared/input/inputManager';
import { LoadingView } from '../../../shared/ui/loadingView';
import { saveGraphicsSettings } from '../../../shared/ui/menus/graphicsPersistence';
import { MenuInput } from '../../../shared/ui/menus/menuInput';
import { saveTouchSettings } from '../../../shared/ui/menus/touchPersistence';
import { PerformanceView } from '../../../shared/ui/performanceView';
import type { ProblemView } from '../../../shared/ui/problemView';
import type { GameCard } from '../../../shared/game/gameCard';
import { GAMES } from '../../games';
import { AiWizard } from '../../lobby/aiWizard';
import { LobbyCustomization } from '../../lobby/catCustomization';
import { MapVoteStage } from '../../lobby/mapVote';
import { Scoreboard } from '../../scoring/scoreboard';
import { FrameRateGovernor } from '../frameRateGovernor';
import { LobbyController } from '../lobbyController';
import { MenuController } from '../menuController';
import { PlayerRoster } from '../playerRoster';
import { RemoteSide } from '../remoteSide';
import { isPhoneScreen } from '../screenSize';
import { DevHooks } from './devHooks';
import { EngineCoordinator } from './engineCoordinator';
import { createGameConfigs } from './gameConfigs';
import { GameOverlays } from './gameOverlays';
import { RaceLifecycle } from './raceLifecycle';
import { RaceSession } from './raceSession';
import { enginesFor, lifecycleFor, lobbyFor, menusFor, overlaysFor, remoteFor, rosterFor, sessionFor } from './gameWiring';

const FIRST_MAP = AVAILABLE_MAPS[0]!;

/** Every part of the game, built once in this order; how each one is connected to the others is in `gameWiring.ts`. `Game` drives the parts
 *  every step and frame. */
export class GameParts {
  readonly flow = new GameFlow();
  readonly configs = createGameConfigs(FIRST_MAP);
  /** Seeded, not Math.random(): gameplay-affecting randomness must be reproducible (see architecture rules).
   *  The session seed is shown in `getState()` and can be fixed with `?seed=` in the address. */
  readonly sessionSeed = seedFromSearch(window.location.search, Date.now());
  readonly lobbyRng = createRng(deriveSeed(this.sessionSeed, 'lobby', 0));
  readonly sound = new SoundEngine(this.configs.audio);
  readonly input = new InputManager(this.configs.touchSteering);
  readonly menuInput = new MenuInput();
  readonly customization = new LobbyCustomization();
  readonly aiWizard = new AiWizard();
  readonly gameVoteStage = new MapVoteStage(GAMES.length);
  readonly mapVoteStage = new MapVoteStage(AVAILABLE_MAPS.length);
  readonly scoreboard = new Scoreboard();
  readonly world = createRaceWorld(FIRST_MAP);
  /** Only the development server shows the tuning panel; the preview and the production build look like the real game. */
  readonly debugPanel = import.meta.env.DEV
    ? new DebugPanel(this.configs, {
        onAddAiKart: () => {
          if (this.flow.phase === 'lobby') this.roster.addDebugAiKart();
        },
        onSetGlobalDifficulty: (difficulty) => this.aiWizard.setAllDifficulties(difficulty),
        onShowGuideLines: (visible) => this.presentation.setAiGuidesVisible(visible),
        onGraphicsTuned: () => this.presentation.applyGraphicsQuality(),
      })
    : null;
  readonly governor = new FrameRateGovernor(this.configs.graphics, (step) => {
    this.presentation.applyGraphicsQuality();
    this.problems.showNotice(step === 'lowered' ? graphicsLowered() : graphicsEmergency());
  });
  readonly presentation: RacePresentation;
  readonly roster: PlayerRoster;
  readonly players: RacePlayer[];
  readonly engines: EngineCoordinator;
  readonly overlays: GameOverlays;
  readonly performanceView: PerformanceView;
  readonly loading: LoadingView;
  readonly remote: RemoteSide;
  readonly session: RaceSession;
  readonly lifecycle: RaceLifecycle;
  readonly menus: MenuController;
  readonly lobby: LobbyController;
  readonly dev: DevHooks;

  /** `accelerate` switches the endurance races of the browser tests on and off (many simulation steps per drawn frame). */
  constructor(
    canvas: HTMLCanvasElement,
    overlay: HTMLElement,
    touchRoot: HTMLElement,
    readonly problems: ProblemView,
    accelerate: (on: boolean) => void,
  ) {
    this.presentation = new RacePresentation(canvas, FIRST_MAP, this.configs.camera, this.sound, this.configs.graphics);
    this.roster = rosterFor(this);
    this.players = this.roster.players;
    this.engines = enginesFor(this, overlay);
    this.overlays = overlaysFor(this, overlay, touchRoot);
    this.performanceView = new PerformanceView(overlay);
    this.loading = new LoadingView(overlay);
    const remoteConfig = createRuntimeRemote();
    this.remote = remoteFor(this, remoteConfig);
    this.session = sessionFor(this);
    this.lifecycle = lifecycleFor(this);
    this.menus = menusFor(this, overlay);
    this.lobby = lobbyFor(this, remoteConfig);
    const { flow, input, roster, lifecycle, remote } = this;
    this.dev = new DevHooks({
      flow,
      input,
      roster,
      lifecycle,
      remote,
      race: this.configs.race,
      accelerate,
    });
    this.joinTouchPlayerOnPhone();
  }

  /** What the human player of this slot is called: their typed name, or "Katze N" while unnamed. */
  chosenNameOf(index: number): string {
    const joined = this.input.players[index];
    return playerDisplayName(joined ? (this.customization.entryFor(joined)?.appearance.name ?? '') : '', index);
  }

  /** What a kart is called on screen, human or AI: its cat's name, or "Katze N" while unnamed. */
  labelOfSlot(slot: number): string {
    const player = this.players[slot];
    return playerDisplayName(player ? this.presentation.appearanceFor(player).name : '', slot);
  }

  /** The game running now (its card), or null while a kart game runs. */
  engineGameCard(): GameCard | null {
    return this.engines.round ? GAMES[this.lifecycle.gameIndex]! : null;
  }

  /** The big count before the start: the one of a game that is not on the kart engine, or the race's. */
  countdownLabel(): string | null {
    return this.engines.round ? this.engines.round.countdownLabel() : this.session.startCountdown.label();
  }

  /** A phone has no gamepad to join with: its on-screen controls join by themselves. */
  joinTouchPlayerOnPhone(): void {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (isPhoneScreen(window.innerWidth, window.innerHeight, coarsePointer)) this.lobby.joinTouchPlayer();
  }

  changeTouchSettings(change: Partial<TouchSettings>): void {
    Object.assign(this.configs.touchSettings, change);
    saveTouchSettings(this.configs.touchSettings);
  }

  toggleGraphicsQuality(): void {
    const { graphics } = this.configs;
    graphics.quality = otherQuality(graphics.quality);
    graphics.emergency = false;
    saveGraphicsSettings(graphics);
    this.presentation.applyGraphicsQuality();
  }
}
