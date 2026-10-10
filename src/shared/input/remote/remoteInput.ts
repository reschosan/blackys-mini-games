import { NEUTRAL_INPUT, type InputFrame } from '../actions';
import type { RemoteConfig } from '../../config/remote';
import type { TouchSteeringConfig, TouchControlMode } from '../../config/touch';
import type { HostMessage, InputMessage } from '../../net/messages';
import { TouchSource, type TouchOrientation } from '../touch/touchSource';
import { currentLanguage, inLanguage, type Language } from '../../i18n/language';

/** The way back to a guest phone; the connection behind it belongs to the app. */
export interface RemoteLink {
  send(message: HostMessage): void;
  /** A snapshot of the race on the fast channel (may get lost). */
  sendState(data: ArrayBuffer): void;
  close(): void;
}

/** A player on another phone: the keys and stick it sends act like the on-screen controls of this device. Every player may pause
 *  (and resume), but the settings of the host stay with the host, so that key is never passed on. */
export class RemoteInput {
  private readonly source = new TouchSource();
  private mode: TouchControlMode = 'auto';
  private lastInputAt: number;
  private lostAt: number | null = null;
  private smoothedLatency: number | null = null;
  private latestSequence = 0;
  /** The language the phone shows; until it says, the host's own. */
  language: Language = currentLanguage();

  constructor(
    readonly id: number,
    private link: RemoteLink,
    private readonly config: RemoteConfig,
    private readonly clock: () => number = () => performance.now(),
  ) {
    this.lastInputAt = clock();
  }

  get connected(): boolean {
    return this.lostAt === null;
  }

  secondsLost(): number {
    return this.lostAt === null ? 0 : (this.clock() - this.lostAt) / 1000;
  }

  receive(message: InputMessage): void {
    if (!this.connected) return;
    this.lastInputAt = this.clock();
    this.latestSequence = message.sequence;
    this.mode = message.mode;
    this.source.applySnapshot({ stick: { x: message.stickX, y: message.stickY }, pressedBits: message.pressedBits, pick: message.pick });
  }

  /** The number of the newest input applied, reported back to the guest with every snapshot. */
  get lastInputSequence(): number {
    return this.latestSequence;
  }

  sendState(data: ArrayBuffer): void {
    if (this.connected) this.link.sendState(data);
  }

  /** Round trip to the phone in milliseconds, smoothed; null until the first answer. */
  get latencyMilliseconds(): number | null {
    return this.smoothedLatency === null ? null : Math.round(this.smoothedLatency);
  }

  sendPing(): void {
    this.send({ kind: 'ping', sentAt: Math.round(this.clock()) });
  }

  receivePong(sentAt: number): void {
    const roundTrip = Math.max(this.clock() - sentAt, 0);
    this.smoothedLatency = this.smoothedLatency === null ? roundTrip : this.smoothedLatency * 0.7 + roundTrip * 0.3;
  }

  markLost(): void {
    if (this.lostAt !== null) return;
    this.lostAt = this.clock();
    this.source.releaseAll();
  }

  /** A returning guest gets the seat back: the same player, a new connection. */
  reconnect(link: RemoteLink): void {
    this.link = link;
    this.lostAt = null;
    this.lastInputAt = this.clock();
    this.source.releaseAll();
  }

  send(message: HostMessage): void {
    if (this.connected) this.link.send(message);
  }

  /** A message with texts in it: they are made in the language of this phone. */
  sendInOwnLanguage(make: () => HostMessage): void {
    if (this.connected) this.link.send(inLanguage(this.language, make));
  }

  close(): void {
    this.markLost();
    this.link.close();
  }

  /** Without news from the phone for a moment the kart gets neutral input and rolls out. */
  readFrame(steering: TouchSteeringConfig, orientation: TouchOrientation | undefined): InputFrame {
    if (!this.connected) return NEUTRAL_INPUT;
    if (this.clock() - this.lastInputAt > this.config.staleInputMilliseconds) this.source.releaseAll();
    return { ...this.source.readFrame(this.mode, steering, orientation), settings: false };
  }
}
