import { decodeSignal, encodeSignal } from './signalCodec';
import { PeerLink, type PeerLinkEvents } from './peerLink';
import type { RemoteConfig } from '../config/remote';

/** The host's side of one seat: makes the code the guest scans and takes the code the guest shows back. */
export class HostInvitation {
  private readonly link: PeerLink;
  private answered = false;

  constructor(
    config: RemoteConfig,
    events: PeerLinkEvents,
    readonly seatId?: number,
  ) {
    this.link = new PeerLink(config, { channel: 'input', timeoutMilliseconds: config.lostConnectionMilliseconds }, events);
  }

  get peerLink(): PeerLink {
    return this.link;
  }

  async createOfferCode(): Promise<string> {
    const { connection } = this.link;
    await connection.setLocalDescription(await connection.createOffer());
    await this.link.whenCandidatesGathered();
    const sdp = connection.localDescription?.sdp ?? '';
    return encodeSignal({ kind: 'offer', sdp, ...(this.seatId === undefined ? {} : { seatId: this.seatId }) });
  }

  /** False for a code that is not an answer or that comes a second time; the invitation then stays as it was. */
  async acceptAnswerCode(code: string): Promise<boolean> {
    if (this.answered) return false;
    const signal = await decodeSignal(code);
    if (signal?.kind !== 'answer') return false;
    this.answered = true;
    try {
      await this.link.connection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      return true;
    } catch {
      this.answered = false;
      return false;
    }
  }

  cancel(): void {
    this.link.close();
  }
}
