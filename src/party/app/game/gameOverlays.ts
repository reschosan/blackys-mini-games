import type { AudioConfig } from '../../../shared/config/audio';
import type { GraphicsConfig } from '../../../shared/config/graphics';
import type { KartStatsTable } from '../../../shared/config/kartLoadout';
import { PLAYER_APPEARANCES } from '../../../shared/config/players';
import type { TouchSettings } from '../../../shared/config/touch';
import { hexColor } from '../../../shared/core/color';
import type { GameFlow } from '../../../shared/core/gameFlow';
import type { InputManager } from '../../../shared/input/inputManager';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { routeDrivingHint } from '../../../games/kart/maps/shared/routeGuidance';
import { windowJumpHint } from '../../../games/kart/maps/shared/windowJumps';
import type { RoundInfo } from '../../../shared/game/engine';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../../games/kart/race/raceWorld';
import type { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import { TouchControls } from '../../../shared/touch/touchControls';
import type { AiWizard } from '../../lobby/aiWizard';
import type { LobbyCustomization } from '../../lobby/catCustomization';
import { HudView, itemLabelFor } from '../../../shared/ui/hud';
import { LobbyPresentation } from '../../lobby/lobbyPresentation';
import type { MapVoteStage } from '../../lobby/mapVote';
import type { GameCard } from '../../../shared/game/gameCard';
import type { LobbyController } from '../lobbyController';
import { t } from '../../../shared/i18n';

interface GameOverlaysDeps {
  readonly flow: GameFlow;
  readonly input: InputManager;
  readonly players: readonly RacePlayer[];
  readonly world: RaceWorld;
  readonly lapCount: () => number;
  readonly currentMap: () => MapConfig;
  readonly rules: () => RoundInfo | null;
  readonly countdownLabel: () => string | null;
  readonly remainingFinishSeconds: () => number | null;
  readonly waitingForGuests: () => boolean;
  readonly presentation: RacePresentation;
  readonly customization: LobbyCustomization;
  readonly aiWizard: AiWizard;
  readonly gameVoteStage: MapVoteStage;
  readonly mapVoteStage: MapVoteStage;
  readonly currentGame: () => GameCard;
  /** The action button of the running game when it is not on the kart engine. */
  readonly engineGameCard: () => GameCard | null;
  readonly lobby: () => LobbyController;
  readonly chosenNameOf: (slot: number) => string;
  /** The name of any seat, human or AI. */
  readonly labelOfSlot: (slot: number) => string;
  readonly audio: AudioConfig;
  readonly graphics: GraphicsConfig;
  readonly kartStats: KartStatsTable;
  readonly touchSettings: TouchSettings;
}

/** Everything drawn over the 3D picture: the lobby, the track vote, the score cards of a race and the on-screen touch controls. */
export class GameOverlays {
  private readonly lobbyPresentation: LobbyPresentation;
  private readonly hud: HudView;
  private readonly touchControls: TouchControls;

  constructor(
    overlay: HTMLElement,
    touchRoot: HTMLElement,
    lobbyClicks: ConstructorParameters<typeof LobbyPresentation>[1],
    private readonly deps: GameOverlaysDeps,
  ) {
    this.lobbyPresentation = new LobbyPresentation(overlay, lobbyClicks);
    this.hud = new HudView(overlay);
    this.touchControls = new TouchControls(touchRoot, deps.input.touch);
  }

  update(frameSeconds: number): void {
    const { flow } = this.deps;
    if (flow.phase === 'lobby' && flow.lobbyStage === 'gameVote') this.showGameVote();
    else if (flow.phase === 'lobby' && flow.lobbyStage === 'trackVote') this.showVote();
    else if (flow.phase === 'lobby') this.showLobby(frameSeconds);
    else this.showRace();
    this.showTouchControls();
  }

  private showGameVote(): void {
    const { input, gameVoteStage, chosenNameOf } = this.deps;
    this.lobbyPresentation.showGameVote(input.players, (player) => gameVoteStage.pickFor(player), chosenNameOf);
    this.hud.hide();
  }

  private showVote(): void {
    const { input, mapVoteStage, chosenNameOf, presentation, currentGame } = this.deps;
    this.lobbyPresentation.showVote(
      input.players,
      (player) => mapVoteStage.pickFor(player),
      chosenNameOf,
      (preview) => presentation.warmPreview(preview),
      currentGame(),
    );
    this.hud.hide();
  }

  private showLobby(frameSeconds: number): void {
    const { input, players, customization, aiWizard, lobby, audio, graphics, kartStats } = this.deps;
    const focusIndex = lobby().aiSetupActive(0) ? aiWizard.focusIndex : -1;
    this.lobbyPresentation.showLobby(
      input.players,
      (player) => customization.entryFor(player),
      players.map((player, index) => {
        if (!player.isAi) return null;
        const aiIndex = index - input.players.length;
        const view = aiWizard.viewFor(aiIndex, aiIndex === focusIndex);
        const appearance = this.deps.presentation.appearanceFor(player);
        return view ? { ...view, name: appearance.name, appearance, loadout: player.loadout } : null;
      }),
      audio.muted,
      graphics.quality,
      kartStats,
      frameSeconds,
    );
    this.hud.hide();
  }

  private showRace(): void {
    const { flow, input, players, world, countdownLabel, lapCount, waitingForGuests, remainingFinishSeconds } = this.deps;
    const rules = this.deps.rules();
    const map = this.deps.currentMap();
    this.lobbyPresentation.hide();
    this.hud.show();
    this.hud.update(
      players.map((player, index) => ({
        lap: player.progress.lap,
        place: world.places[index] ?? index + 1,
        finished: player.progress.finished,
        heldItem: player.heldItem,
        ...(player.heldItem ? { heldItemLabel: itemLabelFor(player.heldItem, map) } : {}),
        objective: rules ? null : (map.checkpoints[player.progress.nextCheckpoint]?.name ?? null),
        penaltySecondsLeft: player.state.penaltySecondsLeft,
        drivingHint: rules ? null : (windowJumpHint(map, player.state) ?? routeDrivingHint(map, player.state, player.progress.nextCheckpoint)),
        ...(rules ? { statusText: rules.cardText(index) } : {}),
        ...(rules ? { placeHidden: true, title: this.deps.labelOfSlot(index) } : {}),
      })),
      lapCount(),
      world.raceTimeSeconds,
      flow.phase === 'racing' ? remainingFinishSeconds() : null,
      waitingForGuests() ? t().race.waitingForGuests : countdownLabel(),
      input.disconnectedDeviceNames(),
      rules?.statusLines() ?? [],
    );
  }

  private showTouchControls(): void {
    const { flow, input, touchSettings } = this.deps;
    const engineGame = this.deps.engineGameCard();
    const { itemButtonLabel } = this.deps.currentGame();
    const touchIndex = input.players.findIndex((player) => player.source.kind === 'touch');
    this.touchControls.update({
      active: touchIndex !== -1,
      racing: flow.phase === 'racing',
      mode: touchSettings.mode,
      layout: touchSettings.layout,
      playerColor: hexColor(PLAYER_APPEARANCES[Math.max(touchIndex, 0)]?.bodyColor ?? 0xffffff),
      crossHidden: flow.settingsSection === 'invite' || flow.phase === 'results' || (flow.phase === 'paused' && flow.settingsSection === null),
      ...(engineGame?.touch ? { touchGame: engineGame.touch } : {}),
      ...(itemButtonLabel ? { itemLabel: itemButtonLabel } : {}),
    });
  }
}
