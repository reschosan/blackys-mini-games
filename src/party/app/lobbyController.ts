import type { SoundEngine } from '../../shared/audio/soundEngine';
import type { GameFlow } from '../../shared/core/gameFlow';
import type { Rng } from '../../shared/core/rng';
import type { CatAppearance } from '../../shared/config/catAppearance';
import type { KartLoadout } from '../../shared/config/kartLoadout';
import { NEUTRAL_INPUT, type InputFrame } from '../../shared/input/actions';
import { parseLobbyTap, type LobbyTap } from '../../games/kart/replication/lobbyState';
import { AVAILABLE_MAPS } from '../../games/kart/maps/registry';
import { GAMES } from '../games';
import type { RemoteConfig } from '../../shared/config/remote';
import type { InputManager, JoinedPlayer } from '../../shared/input/inputManager';
import type { AiWizard } from '../lobby/aiWizard';
import type { LobbyCustomization } from '../lobby/catCustomization';
import type { MapVoteStage } from '../lobby/mapVote';
import type { MenuInput } from '../../shared/ui/menus/menuInput';
import type { MenuController } from './menuController';
import type { PlayerRoster } from './playerRoster';

export interface LobbyDependencies {
  readonly flow: GameFlow;
  readonly input: InputManager;
  readonly customization: LobbyCustomization;
  readonly aiWizard: AiWizard;
  /** The vote for the game; it works like the map vote (the stage counts options, not maps). */
  readonly gameVoteStage: MapVoteStage;
  readonly mapVoteStage: MapVoteStage;
  readonly roster: PlayerRoster;
  readonly menuInput: MenuInput;
  readonly menus: MenuController;
  readonly sound: SoundEngine;
  readonly rng: Rng;
  readonly remote: RemoteConfig;
}

export interface LobbyActions {
  /** The vote chose the game at `gameIndex` of `GAMES`; true when the players still choose the map (a game on an arena has its own ground). */
  chooseGame(gameIndex: number): boolean;
  /** Starts the game on the map at `mapIndex` of the registry. */
  startRaceOnMap(mapIndex: number): void;
}

/** Everything that happens in the lobby before a race: joining, cat customization, AI setup and
 *  the shared votes for the game and the map. Runs once per simulation tick while the phase is `lobby`. */
export class LobbyController {
  private settingsHeld = false;
  private settingsWereOpen = false;
  /** The game the vote chose while its players still make their kart or plane (an index in `GAMES`), otherwise null. */
  private pendingGame: number | null = null;

  constructor(
    private readonly deps: LobbyDependencies,
    private readonly actions: LobbyActions,
  ) {}

  /** The settings are open over the lobby: the lobby does not run, so a button still down when they close must not count. */
  noteSettingsOpen(): void {
    this.settingsWereOpen = true;
  }

  update(frames: readonly InputFrame[]): void {
    const { flow, menuInput, roster, customization, aiWizard, input } = this.deps;
    if (this.settingsWereOpen) {
      this.settingsWereOpen = false;
      customization.holdInputsUntilRelease();
    }
    if (this.updateSettings(frames) || this.updateJoins()) return;
    this.dropExpiredRemotes();
    if (flow.lobbyStage === 'gameVote') {
      this.updateGameVote(frames);
      return;
    }
    if (flow.lobbyStage === 'trackVote') {
      this.updateMapVote(frames);
      return;
    }
    if (menuInput.read(frames.slice(0, 1)).toggle) roster.cycleAiFill();
    this.updateCustomization(frames);
    roster.syncAppearance();
    if (roster.players.length > 0 && customization.allReady(input.players) && aiWizard.allReady()) this.finishCustomizing();
  }

  /** Everyone is ready: after the cat comes the vote for the game; after the kart or the plane comes the game itself. */
  private finishCustomizing(): void {
    const game = this.pendingGame;
    this.pendingGame = null;
    if (game === null) this.beginGameVote();
    else this.startChosenGame(game);
  }

  /** Everyone is ready (or a game just ended): the players choose what to play next. */
  beginGameVote(): void {
    this.pendingGame = null;
    this.deps.customization.showPage(this.deps.input.players, 'start');
    this.deps.flow.setLobbyStage('gameVote');
    this.deps.gameVoteStage.start(this.deps.input.players);
  }

  /** Whether player one is currently in the AI setup step. */
  aiSetupActive(playerIndex: number): boolean {
    const { input, customization, aiWizard } = this.deps;
    const player = input.players[playerIndex];
    const ready = player ? (customization.entryFor(player)?.ready ?? false) : false;
    return aiWizard.isActive(ready);
  }

  joinTouchPlayer(): void {
    if (this.deps.input.joinTouch()) this.deps.roster.syncWithLobby();
  }

  /** A phone that joined over the network came in: it gets its kart and its card like any other player. */
  syncRemoteJoin(): void {
    this.deps.roster.syncWithLobby();
  }

  /** A guest phone brings its saved cat and kart. */
  applyGuestProfile(slot: number, appearance: CatAppearance, loadout: KartLoadout): void {
    const player = this.deps.input.players[slot];
    if (!player || this.deps.flow.lobbyStage !== 'customizing') return;
    this.deps.customization.applyProfile(player, appearance, loadout);
    this.deps.roster.syncAppearance();
  }

  /** A tap on a guest's own lobby screen does what the same tap does on the host's lobby. */
  guestTap(slot: number, rawTap: unknown): void {
    const { input, flow, customization } = this.deps;
    const player = input.players[slot];
    const tap = parseLobbyTap(rawTap, AVAILABLE_MAPS.length, GAMES.length);
    if (!player || !tap) return;
    if (flow.lobbyStage !== 'customizing') {
      this.guestVoteTap(player, tap);
      return;
    }
    if (tap.target === 'row') customization.selectRow(player, tap.value);
    else if (tap.target === 'arrow') customization.changeValue(player, tap.value);
    else if (tap.target === 'leave') this.leaveOrStepBack(player, slot);
    else return;
    this.onMenuAction('navigate');
  }

  /** "Leave" on the cat card, "Back" on the kart or plane card (back to the vote for the game). */
  private leaveOrStepBack(player: JoinedPlayer, slot: number): void {
    if (this.deps.customization.pageOf(player) === 'start') {
      this.leavePlayer(slot);
      return;
    }
    this.beginGameVote();
    this.onMenuAction('navigate');
  }

  private guestVoteTap(player: JoinedPlayer, tap: LobbyTap): void {
    const { flow, mapVoteStage, gameVoteStage } = this.deps;
    if (tap.target === 'game' && flow.lobbyStage === 'gameVote') gameVoteStage.tapMap(player, tap.value, this.onMenuAction);
    else if (tap.target === 'map' && flow.lobbyStage === 'trackVote') mapVoteStage.tapMap(player, tap.value, this.onMenuAction);
    else if (tap.target === 'back') this.stepBack();
  }

  /** Back in the lobby the phones that are still connected play on. */
  joinConnectedRemotes(): void {
    this.deps.input.rejoinConnectedRemotes();
    this.deps.roster.syncWithLobby();
  }

  cycleAiFillByClick(): void {
    if (this.deps.input.players.length > 0) this.deps.roster.cycleAiFill();
  }

  clickAiRow(rowIndex: 0 | 1): void {
    const { aiWizard } = this.deps;
    aiWizard.selectRow(rowIndex);
    this.onMenuAction('navigate');
    if (rowIndex !== 1 || !aiWizard.confirmFocused(this.onMenuAction)) return;
    this.handBackToCustomization();
  }

  /** A player quits in the lobby: later players move up a slot and keep their cats and ready state;
   *  the number of AI opponents stays, only the last player leaving clears the lobby fully. */
  leavePlayer(index: number): void {
    const { flow, input, roster, aiWizard } = this.deps;
    const player = input.players[index];
    if (!player || flow.lobbyStage !== 'customizing') return;
    const humansBefore = input.players.length;
    input.leave(index);
    roster.removeFrom(humansBefore - 1);
    roster.syncWithLobby();
    if (input.players.length === 0) {
      roster.clear();
      aiWizard.reset();
    }
    this.onMenuAction('navigate');
  }

  /** "Back" in a vote: from the map vote to the game vote, from the game vote to the customization (nobody ready, votes dropped). */
  stepBack(): void {
    const { flow, input, customization } = this.deps;
    if (flow.lobbyStage === 'trackVote') {
      this.beginGameVote();
      this.onMenuAction('navigate');
      return;
    }
    if (flow.lobbyStage !== 'gameVote') return;
    flow.setLobbyStage('customizing');
    for (const player of input.players) customization.setReady(player, false);
    customization.holdInputsUntilRelease();
    this.onMenuAction('navigate');
  }

  clickGame(gameIndex: number): void {
    this.deps.gameVoteStage.clickMap(this.deps.input.players, gameIndex, this.onMenuAction);
  }

  clickMap(mapIndex: number): void {
    this.deps.mapVoteStage.clickMap(this.deps.input.players, mapIndex, this.onMenuAction);
  }

  private readonly onMenuAction = (kind: 'navigate' | 'confirm'): void => {
    if (kind === 'navigate') this.deps.sound.playMenuNavigate();
    else this.deps.sound.playMenuConfirm();
  };

  private updateSettings(frames: readonly InputFrame[]): boolean {
    const pressed = frames.some((frame) => frame.settings === true);
    const justPressed = pressed && !this.settingsHeld;
    this.settingsHeld = pressed;
    if (justPressed) this.deps.menus.openSettings();
    return justPressed;
  }

  /** A phone that has been gone for the whole reservation time gives its seat up. */
  private dropExpiredRemotes(): void {
    const { input, flow } = this.deps;
    if (flow.lobbyStage !== 'customizing') return;
    for (const slot of [...input.slotsOfExpiredRemotes(this.deps.remote.seatReservationSeconds)].reverse()) this.leavePlayer(slot);
  }

  private updateJoins(): boolean {
    const { input, roster, menuInput } = this.deps;
    const joinedBefore = input.players.length;
    input.pollJoins();
    roster.syncWithLobby();
    const joined = input.players.length > joinedBefore;
    if (joined) menuInput.suppressUntilRelease();
    return joined;
  }

  private updateCustomization(frames: readonly InputFrame[]): void {
    const { input, customization } = this.deps;
    const wizardActive = this.aiSetupActive(0);
    const customizationFrames = wizardActive ? frames.map((frame, index) => (index === 0 ? NEUTRAL_INPUT : frame)) : frames;
    const leavers = customization.update(input.players, customizationFrames, this.onMenuAction);
    for (const player of leavers) this.leaveOrStepBack(player, input.players.indexOf(player));
    if (wizardActive) this.updateAiWizard(frames);
  }

  private updateAiWizard(frames: readonly InputFrame[]): void {
    const { aiWizard } = this.deps;
    if (aiWizard.update(frames[0] ?? NEUTRAL_INPUT, this.onMenuAction)) this.handBackToCustomization();
  }

  /** "Back" on the first AI kart: player one is not ready any more and customizes their cat again. The
   *  confirm that just went back must not count as a new "Ready" on the customization list. */
  private handBackToCustomization(): void {
    const { input, customization } = this.deps;
    const player1 = input.players[0];
    if (player1) customization.setReady(player1, false);
    customization.holdInputsUntilRelease();
  }

  /** The shared "Choose game" screen drives every joined human's input (see `MapVoteStage`); the game the vote picked
   *  goes on to the map vote the instant the last player locks their choice in. */
  private updateGameVote(frames: readonly InputFrame[]): void {
    const { input, gameVoteStage, rng } = this.deps;
    if (gameVoteStage.update(input.players, frames, this.onMenuAction)) {
      this.stepBack();
      return;
    }
    if (!gameVoteStage.allConfirmed(input.players)) return;
    const game = gameVoteStage.resolveWinnerIndex(input.players, rng);
    const page = GAMES[game]?.lobbyPage;
    if (!page) {
      this.startChosenGame(game);
      return;
    }
    this.pendingGame = game;
    this.deps.flow.setLobbyStage('customizing');
    this.deps.customization.showPage(input.players, page);
  }

  private startChosenGame(game: number): void {
    const { input, mapVoteStage } = this.deps;
    if (!this.actions.chooseGame(game)) {
      this.actions.startRaceOnMap(0);
      return;
    }
    this.deps.flow.setLobbyStage('trackVote');
    mapVoteStage.start(input.players);
  }

  /** The shared "Choose map" screen drives every joined human's input the same way. Starts the race, on the
   *  map the vote picked, the instant the last player locks their choice in. */
  private updateMapVote(frames: readonly InputFrame[]): void {
    const { input, mapVoteStage, rng } = this.deps;
    if (mapVoteStage.update(input.players, frames, this.onMenuAction)) {
      this.stepBack();
      return;
    }
    if (!mapVoteStage.allConfirmed(input.players)) return;
    this.actions.startRaceOnMap(mapVoteStage.resolveWinnerIndex(input.players, rng));
  }
}
