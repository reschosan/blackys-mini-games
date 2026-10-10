import { MessageRateLimit } from './messages';
import { REMOTE_MAX_MESSAGES_PER_SECOND, REMOTE_STATE_MAX_BYTES, type RemoteConfig } from '../config/remote';

export type LinkState = 'connecting' | 'open' | 'lost';

export interface PeerLinkEvents {
  onOpen(): void;
  onLost(): void;
  /** Already limited in rate; the receiver still has to validate the content. */
  onRawInput(raw: unknown): void;
  onRawControl(raw: unknown): void;
  /** A snapshot of the race (binary), host to guest. */
  onRawState(raw: unknown): void;
}

/** Which channel proves the other side is still there, and how long it may stay silent: the host listens to the
 *  guest's steady input, the guest to the host's status. */
export interface Heartbeat {
  readonly channel: 'input' | 'control';
  readonly timeoutMilliseconds: number;
}

const INPUT_CHANNEL = { id: 0, negotiated: true, ordered: false, maxRetransmits: 0 } as const;
const CONTROL_CHANNEL = { id: 1, negotiated: true, ordered: true } as const;
/** Snapshots of the race: the newest counts, an old one is worthless, so nothing is repeated and nothing waits for the one before. */
const STATE_CHANNEL = { id: 2, negotiated: true, ordered: false, maxRetransmits: 0 } as const;
const WATCHDOG_MILLISECONDS = 500;

/** One direct browser-to-browser connection with two fixed channels: `input` (fast, may drop messages) and
 *  `control` (reliable). No server and no candidate exchange besides the two QR codes: only local addresses
 *  are used, so the connection works inside one network. Shared by the host and the guest side. */
export class PeerLink {
  readonly connection = new RTCPeerConnection({ iceServers: [] });
  private readonly inputChannel = this.connection.createDataChannel('input', INPUT_CHANNEL);
  private readonly controlChannel = this.connection.createDataChannel('control', CONTROL_CHANNEL);
  private readonly stateChannel = this.connection.createDataChannel('state', STATE_CHANNEL);
  private readonly rateLimit = new MessageRateLimit(REMOTE_MAX_MESSAGES_PER_SECOND, () => performance.now());
  private readonly stateRateLimit = new MessageRateLimit(REMOTE_MAX_MESSAGES_PER_SECOND, () => performance.now());
  private watchdog: number | null = null;
  private lastHeardAt = performance.now();
  private lostReported = false;
  private state: LinkState = 'connecting';

  constructor(
    private readonly config: RemoteConfig,
    private readonly heartbeat: Heartbeat,
    private readonly events: PeerLinkEvents,
  ) {
    this.inputChannel.addEventListener('message', (event) => {
      this.heard('input');
      if (this.rateLimit.allows()) this.events.onRawInput(event.data);
    });
    this.controlChannel.addEventListener('message', (event) => {
      this.heard('control');
      this.events.onRawControl(event.data);
    });
    this.stateChannel.binaryType = 'arraybuffer';
    this.stateChannel.addEventListener('message', (event) => {
      const size = event.data instanceof ArrayBuffer ? event.data.byteLength : Number.POSITIVE_INFINITY;
      if (size <= REMOTE_STATE_MAX_BYTES && this.stateRateLimit.allows()) this.events.onRawState(event.data);
    });
    this.controlChannel.addEventListener('open', () => this.markOpen());
    this.controlChannel.addEventListener('close', () => this.markLost());
    this.connection.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed', 'disconnected'].includes(this.connection.connectionState)) this.markLost();
    });
  }

  get linkState(): LinkState {
    return this.state;
  }

  sendInput(text: string): void {
    if (this.inputChannel.readyState === 'open') this.inputChannel.send(text);
  }

  sendState(data: ArrayBuffer): void {
    if (this.stateChannel.readyState === 'open') this.stateChannel.send(data);
  }

  sendControl(text: string): void {
    if (this.controlChannel.readyState === 'open') this.controlChannel.send(text);
  }

  /** Waits until the browser has collected its local candidates, so one code holds everything the other side needs. */
  async whenCandidatesGathered(): Promise<void> {
    if (this.connection.iceGatheringState === 'complete') return;
    await new Promise<void>((resolve) => {
      const done = (): void => {
        window.clearTimeout(timer);
        this.connection.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      };
      const onChange = (): void => {
        if (this.connection.iceGatheringState === 'complete') done();
      };
      const timer = window.setTimeout(done, this.config.candidateGatherMilliseconds);
      this.connection.addEventListener('icegatheringstatechange', onChange);
    });
  }

  close(): void {
    this.stopWatchdog();
    this.state = 'lost';
    this.lostReported = true;
    this.connection.close();
  }

  private markOpen(): void {
    if (this.state !== 'connecting') return;
    this.state = 'open';
    this.lastHeardAt = performance.now();
    this.watchdog = window.setInterval(() => this.checkHeartbeat(), WATCHDOG_MILLISECONDS);
    this.events.onOpen();
  }

  private heard(channel: Heartbeat['channel']): void {
    if (channel === this.heartbeat.channel) this.lastHeardAt = performance.now();
  }

  /** The connection state of the browser needs many seconds to notice a vanished phone; a steady stream notices at once. */
  private checkHeartbeat(): void {
    if (performance.now() - this.lastHeardAt > this.heartbeat.timeoutMilliseconds) this.markLost();
  }

  private markLost(): void {
    this.stopWatchdog();
    if (this.lostReported) return;
    this.lostReported = true;
    this.state = 'lost';
    this.connection.close();
    this.events.onLost();
  }

  private stopWatchdog(): void {
    if (this.watchdog !== null) window.clearInterval(this.watchdog);
    this.watchdog = null;
  }
}
