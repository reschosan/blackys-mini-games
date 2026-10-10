import { PLAYER_APPEARANCES } from '../../shared/config/players';
import { hexColor } from '../../shared/core/color';
import type { LobbyStage } from '../../shared/core/gameFlow';
import type { InputManager, JoinedPlayer } from '../../shared/input/inputManager';
import { toLobbyEntryState, type GuestLobbyState, type VotePickState } from '../../games/kart/replication/lobbyState';
import type { CustomizationEntry } from '../lobby/catCustomization';
import type { MapVotePick } from '../lobby/mapVote';
import { inLanguage } from '../../shared/i18n/language';

export interface LobbyBroadcastSource {
  readonly input: InputManager;
  readonly stage: () => LobbyStage;
  /** Index in `GAMES` of the game being chosen for. */
  readonly gameIndex: () => number;
  readonly entryOf: (player: JoinedPlayer) => CustomizationEntry | undefined;
  readonly pickOf: (player: JoinedPlayer) => MapVotePick | undefined;
  readonly nameOfSlot: (slot: number) => string;
  /** The host still has the invitation page open: the guests wait, they see nothing of the lobby yet. */
  readonly inviting: () => boolean;
}

const CHECK_SECONDS = 0.08;
const REPEAT_SECONDS = 1;

/** Shows every guest its own lobby screen: its card while the cats are made, the vote when the map is chosen. The lobby itself
 *  (rows, ready, names, votes) stays on the host, which already runs it for every device; the guest gets the state to draw. A state is
 *  sent when it changes and, so that a guest that missed one catches up, once a second. */
export class LobbyBroadcaster {
  private readonly lastSent = new Map<number, { readonly text: string; seconds: number }>();
  private seconds = 0;
  private sinceCheck = 0;

  constructor(private readonly source: LobbyBroadcastSource) {}

  update(frameSeconds: number): void {
    this.seconds += frameSeconds;
    this.sinceCheck += frameSeconds;
    if (this.sinceCheck < CHECK_SECONDS) return;
    this.sinceCheck = 0;
    if (this.source.inviting()) return;
    for (const remote of this.source.input.remoteInputs) {
      const slot = this.source.input.slotOfRemote(remote.id);
      if (slot < 0 || !remote.connected) continue;
      const lobby = inLanguage(remote.language, () => this.stateFor(slot));
      const text = JSON.stringify(lobby);
      const previous = this.lastSent.get(remote.id);
      if (previous && previous.text === text && this.seconds - previous.seconds < REPEAT_SECONDS) continue;
      this.lastSent.set(remote.id, { text, seconds: this.seconds });
      remote.send({ kind: 'lobby', lobby });
    }
  }

  /** A guest connected again or a new lobby began: everything is sent once more. */
  resend(): void {
    this.lastSent.clear();
  }

  private stateFor(slot: number): GuestLobbyState {
    const { input } = this.source;
    const player = input.players[slot];
    const entry = player ? this.source.entryOf(player) : undefined;
    const stage = this.source.stage();
    return {
      stage,
      seat: slot,
      game: this.source.gameIndex(),
      entry: entry ? toLobbyEntryState(entry) : null,
      picks: stage === 'customizing' ? [] : this.picks(),
    };
  }

  private picks(): VotePickState[] {
    return this.source.input.players.flatMap((player, slot) => {
      const pick = this.source.pickOf(player);
      const appearance = PLAYER_APPEARANCES[slot];
      return pick && appearance
        ? [{ slot, name: this.source.nameOfSlot(slot), color: hexColor(appearance.bodyColor), mapIndex: pick.mapIndex, confirmed: pick.confirmed }]
        : [];
    });
  }
}
