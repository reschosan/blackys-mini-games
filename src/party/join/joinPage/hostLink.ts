import type { LobbyTap } from '../../../games/kart/replication/lobbyState';
import type { CatAppearance } from '../../../shared/config/catAppearance';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import { REMOTE_ANSWER_PREFIX, type RemoteConfig } from '../../../shared/config/remote';
import type { TouchControlMode } from '../../../shared/config/touch';
import type { TouchSnapshot } from '../../../shared/input/touch/touchSource';
import type { Language } from '../../../shared/i18n/language';
import { GuestConnection } from '../../../shared/net/guestConnection';
import type { PeerLinkEvents } from '../../../shared/net/peerLink';
import {
  serializeGuestDecision,
  serializeGuestLanguage,
  serializeGuestPong,
  serializeGuestProfile,
  serializeGuestReady,
  serializeGuestTap,
  serializeGuestWantsPicture,
  serializeInput,
  type InputMessage,
  type ResultChoice,
} from '../../../shared/net/messages';

/** The guest phone's link to its host: it answers the host's code, then carries everything the phone tells the host (before the
 *  connection is there, nothing is sent). */
export class HostLink {
  private connection: GuestConnection | null = null;
  private inputSequence = 0;

  /** Answers the code of the host's QR code. Returns the answer code for the host to scan, or null for a code that is no invitation. */
  async answer(config: RemoteConfig, offerCode: string, events: PeerLinkEvents): Promise<string | null> {
    this.connection = new GuestConnection(config, events);
    const answer = await this.connection.createAnswerCode(offerCode);
    return answer ? `${REMOTE_ANSWER_PREFIX}${answer.answerCode}` : null;
  }

  /** The keys of this phone, numbered (the host reports the newest number it applied); returns the message as it went out. */
  sendInput(keys: TouchSnapshot, mode: TouchControlMode): InputMessage {
    this.inputSequence = (this.inputSequence + 1) & 0xffff;
    const message: InputMessage = {
      kind: 'input',
      stickX: keys.stick.x,
      stickY: keys.stick.y,
      pressedBits: keys.pressedBits,
      pick: keys.pick,
      mode,
      sequence: this.inputSequence,
    };
    this.connection?.link.sendInput(serializeInput(message));
    return message;
  }

  /** This phone has built the game and wants its picture (`renders`), or stays a plain controller. */
  sendReady(renders: boolean): void {
    this.sendControl(serializeGuestReady({ kind: 'ready', renders }));
  }

  /** A tap on the own lobby screen (a row, an arrow, a card). */
  sendTap(tap: LobbyTap): void {
    this.sendControl(serializeGuestTap({ kind: 'tap', tap }));
  }

  /** What happens after the game, chosen by a phone that decides for a host without a player. */
  sendDecision(choice: ResultChoice): void {
    this.sendControl(serializeGuestDecision(choice));
  }

  /** The cat and kart this phone remembers; the host takes them for this player. */
  sendProfile(profile: { readonly appearance: CatAppearance; readonly loadout: KartLoadout }): void {
    this.sendControl(serializeGuestProfile({ kind: 'profile', ...profile }));
  }

  /** The language this phone shows: the host makes the texts for this phone in it. */
  sendLanguage(language: Language): void {
    this.sendControl(serializeGuestLanguage(language));
  }

  answerPing(sentAt: number): void {
    this.sendControl(serializeGuestPong({ kind: 'pong', sentAt }));
  }

  /** "Eigener Bildschirm" in a running race: the host sends the setup again. */
  askForPicture(): void {
    this.sendControl(serializeGuestWantsPicture());
  }

  close(): void {
    this.connection?.link.close();
  }

  private sendControl(raw: string): void {
    this.connection?.link.sendControl(raw);
  }
}
