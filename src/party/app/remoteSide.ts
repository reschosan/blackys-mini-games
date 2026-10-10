import type { TemplateResult } from 'lit';
import type { CatAppearance } from '../../shared/config/catAppearance';
import type { RemoteConfig } from '../../shared/config/remote';
import type { GameFlow } from '../../shared/core/gameFlow';
import type { InputManager } from '../../shared/input/inputManager';
import type { RemoteInput } from '../../shared/input/remote/remoteInput';
import { AVAILABLE_MAPS } from '../../games/kart/maps/registry';
import type { MapConfig } from '../../games/kart/maps/shared/mapConfig';
import type { GuestControlMessage } from '../../shared/net/messages';
import type { RacePlayer } from '../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../games/kart/race/raceWorld';
import type { CustomizationEntry, LobbyCustomization } from '../lobby/catCustomization';
import { InviteView } from '../../shared/ui/invite/inviteView';
import { itemLabelFor } from '../../shared/ui/hud';
import type { MapVoteStage } from '../lobby/mapVote';
import type { MenuOption } from '../../shared/ui/menus/menuOverlay';
import type { LobbyController } from './lobbyController';
import type { MenuController } from './menuController';
import { inviteSlotsFor } from './inviteSlots';
import { LobbyBroadcaster } from './lobbyBroadcaster';
import { RaceBroadcaster } from './raceBroadcaster';
import type { EngineRound } from './game/engineRound';
import { RemoteHost } from './remoteHost';
import { RemoteStatus } from './remoteStatus';
import { ScreenWakeLock } from '../../shared/net/screenWakeLock';

export interface RemoteSideDeps {
  readonly flow: GameFlow;
  readonly input: InputManager;
  readonly config: RemoteConfig;
  readonly players: () => readonly RacePlayer[];
  readonly world: () => RaceWorld;
  readonly map: () => MapConfig;
  readonly lapCount: () => number;
  /** What the card of a seat says in a game that is not a race; null in a race. */
  readonly gameStatusOf: (slot: number) => string | null;
  readonly appearanceOf: (player: RacePlayer) => CatAppearance;
  readonly countdown: () => { readonly secondsLeft: number; readonly goDisplayActive: boolean };
  readonly finishCountdownSeconds: () => number | null;
  readonly extras: () => readonly number[];
  readonly engine: () => EngineRound | null;
  /** What a kart is called on screen, human or AI. */
  readonly nameOfSlot: (slot: number) => string;
  /** What the human player of a seat is called in the lobby. */
  readonly chosenNameOf: (slot: number) => string;
  /** The name of the player who paused the race, while it is paused. */
  readonly pausedBy: () => string | null;
  readonly customization: LobbyCustomization;
  readonly gameVoteStage: MapVoteStage;
  readonly mapVoteStage: MapVoteStage;
  /** `KartMode.id` and the place in `GAMES` of the game being played or chosen. */
  readonly modeId: () => string;
  readonly gameIndex: () => number;
  /** Can this host's screen show a picture shared by guests that stay plain controllers? */
  readonly showsSharedPicture: () => boolean;
  /** The lobby and the menus are built after this side (they need its invitation page), so they are asked for when needed. */
  readonly lobby: () => LobbyController;
  readonly menus: () => MenuController;
}

/** Everything of the game that talks to other phones: the invitations, the status and the pictures sent to guests, the guests' lobby
 *  screens and what a guest may decide. `Game` only wires it in and asks it once per step or frame. */
export class RemoteSide {
  readonly race: RaceBroadcaster;
  readonly host: RemoteHost;
  private readonly lobbyScreens: LobbyBroadcaster;
  private readonly status: RemoteStatus;
  private readonly inviteView: InviteView;
  private readonly screenWakeLock = new ScreenWakeLock();

  constructor(private readonly deps: RemoteSideDeps) {
    const { input, flow, config } = deps;
    this.race = new RaceBroadcaster(
      {
        input,
        players: deps.players,
        world: deps.world,
        lapCount: deps.lapCount,
        phase: () => flow.phase,
        modeId: deps.modeId,
        mapIndex: () =>
          Math.max(
            AVAILABLE_MAPS.findIndex((candidate) => candidate.name === deps.map().name),
            0,
          ),
        nameOfSlot: deps.nameOfSlot,
        appearanceOf: deps.appearanceOf,
        countdown: deps.countdown,
        finishCountdownSeconds: deps.finishCountdownSeconds,
        extras: deps.extras,
        engine: deps.engine,
      },
      config,
    );
    this.lobbyScreens = new LobbyBroadcaster({
      input,
      stage: () => flow.lobbyStage,
      entryOf: (player): CustomizationEntry | undefined => deps.customization.entryFor(player),
      inviting: () => flow.settingsSection === 'invite',
      gameIndex: deps.gameIndex,
      pickOf: (player) => (flow.lobbyStage === 'gameVote' ? deps.gameVoteStage : deps.mapVoteStage).pickFor(player),
      nameOfSlot: deps.chosenNameOf,
    });
    this.host = new RemoteHost(input, config, {
      guestJoined: () => deps.lobby().syncRemoteJoin(),
      canAddSeats: () => flow.phase === 'lobby',
      guestReturned: (guest) => {
        if (flow.phase === 'racing' || flow.phase === 'paused') this.race.resumeFor(guest);
      },
      guestMessage: (guest, message) => this.onGuestMessage(guest, message),
      changed: () => deps.menus().refreshInvite(),
    });
    this.inviteView = new InviteView(
      { onScan: (text) => void this.host.submitScan(text), onChange: () => deps.menus().refreshInvite() },
      () => inviteSlotsFor(input, this.host.state),
      () => this.host.state,
    );
    this.status = new RemoteStatus(
      {
        flow,
        input,
        players: deps.players,
        places: () => deps.world().places,
        lapCount: deps.lapCount,
        gameStatusOf: deps.gameStatusOf,
        nameOfSlot: deps.chosenNameOf,
        pausedBy: deps.pausedBy,
        awayNames: () => input.disconnectedSlots().map((slot) => deps.nameOfSlot(slot)),
        itemLabelOf: (item) => itemLabelFor(item, deps.map()),
        canDecideAfterRace: (slot) => this.decidesAfterRace(slot),
        showsSharedPicture: deps.showsSharedPicture,
      },
      config,
    );
  }

  /** The "Invite players" page, as hosted by the menu. */
  readonly invitePage = {
    open: (): void => {
      this.host.open();
      this.inviteView.startCamera();
    },
    close: (): void => {
      this.inviteView.stopCamera();
      this.host.close();
    },
    renew: (): void => this.host.renew(),
    switchCamera: (): void => this.inviteView.switchCamera(),
    body: (): TemplateResult => this.inviteView.body(),
    options: (): readonly MenuOption[] => this.inviteView.options(),
  };

  /** A seat may be taken in the lobby; in a paused race only a phone that dropped out may come back. */
  canInvite(): boolean {
    const { flow, input } = this.deps;
    return flow.phase === 'lobby' || (flow.phase === 'paused' && input.remoteInputs.some((remote) => !remote.connected));
  }

  /** Once per simulation step: the invitation counts down. */
  tick(stepSeconds: number): void {
    this.host.tick(stepSeconds);
  }

  /** Once per drawn frame: status, guest lobby screens, wake lock. */
  update(frameSeconds: number): void {
    this.status.update(frameSeconds);
    if (this.deps.flow.phase === 'lobby') this.lobbyScreens.update(frameSeconds);
    this.screenWakeLock.hold(this.deps.input.remoteInputs.some((remote) => remote.connected));
  }

  /** What a guest phone sends on the reliable channel: that it is ready for a race, its saved cat, a tap on its own lobby screen, a decision. */
  private onGuestMessage(guest: RemoteInput, message: GuestControlMessage): void {
    const { flow, input } = this.deps;
    const slot = input.slotOfRemote(guest.id);
    if (message.kind === 'ready') this.race.guestMessage(guest, message);
    else if (message.kind === 'profile') this.deps.lobby().applyGuestProfile(slot, message.appearance, message.loadout);
    else if (message.kind === 'tap') this.deps.lobby().guestTap(slot, message.tap);
    else if (message.kind === 'decide' && this.decidesAfterRace(slot)) this.deps.menus().chooseResult(message.choice);
    else if (message.kind === 'wantPicture' && (flow.phase === 'racing' || flow.phase === 'paused')) this.race.resumeFor(guest);
    else if (message.kind === 'language') guest.language = message.language;
  }

  /** A host that plays nobody itself (only phones joined) has no one to press "Again" or "Back to lobby": the first guest does it then. */
  private decidesAfterRace(slot: number): boolean {
    const { players } = this.deps.input;
    return slot === 0 && players.length > 0 && players.every((player) => player.source.kind === 'remote');
  }
}
