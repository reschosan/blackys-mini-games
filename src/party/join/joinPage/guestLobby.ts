import type { TemplateResult } from 'lit';
import type { LobbyScreen } from '../../client/lobbyScreen';
import type { LobbyTap } from '../../../games/kart/replication/lobbyState';
import type { StatusMessage } from '../../../shared/net/messages';
import type { GuestLobbyState } from '../../../games/kart/replication/lobbyState';

interface GuestLobbyDeps {
  readonly overlay: HTMLElement;
  readonly sendTap: (tap: LobbyTap) => void;
  readonly ownScreenChosen: () => boolean;
  readonly loaded: () => void;
  readonly failed: () => void;
}

/** The lobby screen drawn on the guest phone itself (loaded only when needed) from the state the host sends. */
export class GuestLobby {
  private screen: LobbyScreen | null = null;
  private loading = false;
  private state: GuestLobbyState | null = null;

  constructor(private readonly deps: GuestLobbyDeps) {}

  receive(lobby: GuestLobbyState): void {
    this.state = lobby;
    void this.ensureScreen();
  }

  /** The guest wants its own screen but the host has not sent a lobby yet (it is still inviting): only the cross shows until then. */
  waitingForHost(): boolean {
    return this.state === null && this.deps.ownScreenChosen();
  }

  /** Shows the screen while in the lobby (or before the first status) when the guest chose its own screen and the host sent a state; hides it otherwise. */
  update(status: StatusMessage | null, controlButtons: TemplateResult, allowed: boolean): boolean {
    const inLobby = status === null || status.phase === 'lobby';
    const wanted = allowed && inLobby && this.screen !== null && this.state !== null && this.deps.ownScreenChosen();
    if (wanted) this.screen!.show(this.state!, controlButtons);
    else this.screen?.hide();
    return wanted;
  }

  private async ensureScreen(): Promise<void> {
    if (this.screen || this.loading || !this.deps.ownScreenChosen()) return;
    this.loading = true;
    try {
      const { LobbyScreen: LobbyScreenClass } = await import('../../client/lobbyScreen');
      this.screen = new LobbyScreenClass(this.deps.overlay, this.deps.sendTap);
      this.deps.loaded();
    } catch {
      this.deps.failed();
    } finally {
      this.loading = false;
    }
  }
}
