import { decodeSignal, encodeSignal } from './signalCodec';
import { PeerLink, type PeerLinkEvents } from './peerLink';
import type { RemoteConfig } from '../config/remote';

/** The guest's side: takes the code from the host's QR code and returns the code to show back. */
export class GuestConnection {
  readonly link: PeerLink;

  constructor(config: RemoteConfig, events: PeerLinkEvents) {
    this.link = new PeerLink(config, { channel: 'control', timeoutMilliseconds: config.hostSilenceMilliseconds }, events);
  }

  /** Null when the code is not an offer of this game. */
  async createAnswerCode(offerCode: string): Promise<{ readonly answerCode: string; readonly seatId?: number } | null> {
    const offer = await decodeSignal(offerCode);
    if (offer?.kind !== 'offer') return null;
    const { connection } = this.link;
    await connection.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await connection.setLocalDescription(await connection.createAnswer());
    await this.link.whenCandidatesGathered();
    const answerCode = await encodeSignal({ kind: 'answer', sdp: connection.localDescription?.sdp ?? '' });
    return { answerCode, ...(offer.seatId === undefined ? {} : { seatId: offer.seatId }) };
  }
}
