import type { SoundEngine } from '../../../shared/audio/soundEngine';
import type { ItemConfig } from '../../../shared/config/items';
import { resetRuntimeItems } from '../../../shared/config/items';
import { createRuntimeRace, type RaceConfig } from '../../../shared/config/race';
import type { GameFlow } from '../../../shared/core/gameFlow';
import type { DebugPanel } from '../../../shared/debug/panel';
import type { InputFrame } from '../../../shared/input/actions';
import type { InputManager } from '../../../shared/input/inputManager';
import { AVAILABLE_MAPS } from '../../../games/kart/maps/registry';
import { createArenaMap } from '../../../games/kart/modes/arena/arenaMaps';
import type { ModeTuning } from '../../../shared/config/modes';
import { KART_MODES, kartModeById, type KartMode } from '../../../games/kart/modes/kartModes';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { reuseRouteBankLayout } from '../../../games/kart/maps/shared/routeBanks';
import { PLAYER_APPEARANCES } from '../../../shared/config/players';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../../games/kart/race/raceWorld';
import type { Scoreboard } from '../../scoring/scoreboard';
import { GAMES } from '../../games';
import { engineById } from '../../engines';
import type { EngineEntry } from '../../engine/engineView';
import type { RoundInfo } from '../../../shared/game/engine';
import type { EngineCoordinator } from './engineCoordinator';
import type { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { AiWizard } from '../../lobby/aiWizard';
import type { LobbyCustomization } from '../../lobby/catCustomization';
import { resultsBody, resultsTitle, resultTableRows, type ResultRow } from '../../../shared/ui/menus/menuContent';
import type { MenuInput } from '../../../shared/ui/menus/menuInput';
import type { FrameRateGovernor } from '../frameRateGovernor';
import type { LobbyController } from '../lobbyController';
import type { MenuController } from '../menuController';
import type { PlayerRoster } from '../playerRoster';
import type { RaceBroadcaster } from '../raceBroadcaster';
import { editableMap } from './editableMap';
import type { RaceSession } from './raceSession';

interface RaceLifecycleDeps {
  readonly flow: GameFlow;
  readonly session: RaceSession;
  readonly roster: PlayerRoster;
  readonly aiWizard: AiWizard;
  readonly input: InputManager;
  readonly menuInput: MenuInput;
  readonly customization: LobbyCustomization;
  readonly sound: SoundEngine;
  readonly presentation: RacePresentation;
  readonly governor: FrameRateGovernor;
  readonly broadcaster: RaceBroadcaster;
  readonly debugPanel: DebugPanel | null;
  readonly race: RaceConfig;
  readonly items: ItemConfig;
  readonly world: RaceWorld;
  readonly players: readonly RacePlayer[];
  readonly scoreboard: Scoreboard;
  readonly tuning: ModeTuning;
  readonly engines: EngineCoordinator;
  readonly labelOfSlot: (slot: number) => string;
  readonly joinTouchPlayerOnPhone: () => void;
  /** The lobby and the menus are built after this and need its actions, so they are asked for when needed. */
  readonly lobby: () => LobbyController;
  readonly menus: () => MenuController;
}

/** How a race comes and goes: the map it runs on, start, pause, resume, results and the way back to the lobby. */
export class RaceLifecycle {
  /** The map the current/upcoming race runs on. Reassigned by `applyMap` right before a race starts;
   *  everything that depends on it at construction time (camera, item boxes, the 3D scene) gets rebuilt there too. */
  private currentMap: MapConfig = AVAILABLE_MAPS[0]!;
  /** Who paused the race (the seat of the player whose pause key it was), or -1 when nobody did (the window lost focus). */
  private pausedBySlot = -1;
  /** The game chosen in the lobby; the first one until somebody chooses. */
  private currentMode: KartMode = KART_MODES[0]!;
  /** The chosen game when it is not on the kart engine. */
  private currentEngine: EngineEntry | null = null;
  /** The mode before this one changed the number of laps: the map's own laps come back when it is not needed any more. */
  private modeChangedLaps = false;

  constructor(private readonly deps: RaceLifecycleDeps) {}

  get map(): MapConfig {
    return this.currentMap;
  }

  get pausedBy(): number {
    return this.pausedBySlot;
  }

  get mode(): KartMode {
    return this.currentMode;
  }

  /** Id of the chosen game, kart mode or not. */
  get gameId(): string {
    return this.currentEngine?.game.id ?? this.currentMode.id;
  }

  private gameCard(): (typeof GAMES)[number] {
    return GAMES[this.gameIndex]!;
  }

  /** Place of the chosen game in `GAMES`. */
  get gameIndex(): number {
    return Math.max(
      GAMES.findIndex((game) => game.id === this.gameId),
      0,
    );
  }

  /** What the HUD and the result table read from the game that is running. */
  info(): RoundInfo | null {
    return this.deps.engines.round ?? this.deps.session.rules;
  }

  /** The lobby's game vote decided: `index` is the place in `GAMES`. Returns whether a map is still to be chosen. */
  chooseGame(index: number): boolean {
    const id = GAMES[index]?.id ?? '';
    this.currentEngine = engineById(id) ?? null;
    if (!this.currentEngine) this.currentMode = kartModeById(id) ?? KART_MODES[0]!;
    return this.currentEngine === null && this.currentMode.arena === null;
  }

  /** If `map` differs from the one currently loaded, rebuilds everything that was built for the old map at construction time
   *  (3D scene, item boxes, camera). Called right before the race is reset so the new map's start positions/item boxes are already in place. */
  applyMap(map: MapConfig): void {
    if (map === this.currentMap) return;
    const { debugPanel, race, items, presentation } = this.deps;
    this.currentMap = editableMap(map);
    reuseRouteBankLayout(map, this.currentMap);
    debugPanel?.setMap(this.currentMap, () => presentation.refreshMap());
    race.lapCount = map.lapCount ?? createRuntimeRace().lapCount;
    resetRuntimeItems(items, map.itemOverrides);
    debugPanel?.refreshControllers();
    presentation.setMap(this.currentMap);
  }

  startRace(): void {
    const { session, flow, governor, broadcaster, sound, engines } = this.deps;
    this.deps.roster.fillUpTo(this.gameCard().minimumSeats ?? 0);
    if (this.currentEngine) engines.start(this.currentEngine, this.deps.customization.memoryLevel());
    else {
      engines.stop();
      session.beginNewRace();
    }
    this.deps.menus().close();
    flow.startRace();
    governor.restart();
    broadcaster.beginRace();
    sound.playMusic(this.gameCard().music);
  }

  startRaceOnMap(mapIndex: number): void {
    if (this.currentEngine) {
      this.deps.flow.setLobbyStage('customizing');
      this.startRace();
      return;
    }
    const arena = this.currentMode.arena;
    this.applyMap(arena ? createArenaMap(arena, this.deps.tuning) : (AVAILABLE_MAPS[mapIndex] ?? this.currentMap));
    this.applyModeLaps();
    this.deps.flow.setLobbyStage('customizing');
    this.startRace();
  }

  /** A mode with its own number of laps sets it; the mode after it gives the map's laps back (a value tuned in the debug panel stays otherwise). */
  private applyModeLaps(): void {
    const { race } = this.deps;
    if (this.currentMode.lapCount !== null) {
      race.lapCount = this.currentMode.lapCount;
      this.modeChangedLaps = true;
    } else if (this.modeChangedLaps) {
      race.lapCount = this.currentMap.lapCount ?? createRuntimeRace().lapCount;
      this.modeChangedLaps = false;
    }
  }

  resumeRace(): void {
    this.deps.menus().close();
    this.deps.flow.startRace();
  }

  pauseRunningRace(): void {
    if (this.deps.flow.phase !== 'racing') return;
    this.pausedBySlot = -1;
    this.deps.menus().openPause();
  }

  /** One step of a running race: the pause key opens the menu, otherwise the race simulation moves on. */
  updateRace(frames: readonly InputFrame[], stepSeconds: number): void {
    if (this.deps.menuInput.read(frames).toggle) {
      this.pausedBySlot = frames.findIndex((frame) => frame.pause);
      this.deps.menus().openPause(this.pausedBySlot >= 0 ? this.deps.labelOfSlot(this.pausedBySlot) : undefined);
    } else if (this.stepRound(frames, stepSeconds)) {
      this.openResults();
    }
  }

  private stepRound(frames: readonly InputFrame[], stepSeconds: number): boolean {
    const { engines, session, world } = this.deps;
    if (!engines.round) return session.step(frames, stepSeconds);
    this.deps.broadcaster.tick();
    if (this.deps.broadcaster.holdsStart(stepSeconds)) return false;
    const over = engines.step(frames, stepSeconds);
    world.places = engines.round.places();
    return over;
  }

  /** The result page's "Next game": the same players choose the next game, the score stays. */
  nextGame(): void {
    const { flow, session, broadcaster, sound } = this.deps;
    this.deps.engines.stop();
    this.deps.roster.releaseFill();
    session.reset();
    this.deps.menus().close();
    flow.enterLobby();
    broadcaster.endRace();
    sound.playMusic('lobby');
    this.deps.lobby().beginGameVote();
  }

  openResults(): void {
    const { players, world, scoreboard } = this.deps;
    const points = scoreboard.award(players.map((_, index) => world.places[index] ?? 0));
    const rows = this.resultRows(points);
    this.deps.broadcaster.results(() => resultTableRows(this.resultRows(points)));
    this.deps.menus().openResults(resultsTitle(resultTableRows(rows)), resultsBody(rows));
    this.deps.world.traps.length = 0;
  }

  returnToLobby(): void {
    const { roster, aiWizard, input, customization, flow, session, broadcaster, sound } = this.deps;
    this.deps.engines.stop();
    roster.releaseFill();
    roster.clear();
    aiWizard.reset();
    input.reset();
    customization.reset();
    flow.setLobbyStage('customizing');
    session.reset();
    this.deps.scoreboard.reset();
    this.deps.menus().close();
    flow.enterLobby();
    broadcaster.endRace();
    sound.playMusic('lobby');
    this.deps.joinTouchPlayerOnPhone();
    this.deps.lobby().joinConnectedRemotes();
  }

  /** The rows of the result page in the language being shown; the points were awarded once before. */
  private resultRows(points: readonly number[]): ResultRow[] {
    const { players, world, scoreboard } = this.deps;
    const rules = this.info();
    return players.map((player, index) => ({
      place: world.places[index] ?? 0,
      label: this.deps.labelOfSlot(index),
      color: PLAYER_APPEARANCES[index]?.bodyColor ?? 0xffffff,
      finishTimeSeconds: player.progress.finishTimeSeconds,
      points: points[index] ?? 0,
      total: scoreboard.totalOf(index),
      ...(rules ? { detail: rules.detail(index) } : {}),
    }));
  }
}
