import { t } from '../i18n';
import { MAX_PLAYERS } from '../config/players';
import type { TouchControlMode, TouchSteeringConfig } from '../config/touch';
import { NEUTRAL_INPUT, type InputFrame } from './actions';
import { connectedGamepads, hasAnyButtonPressed, readGamepadFrame } from './gamepad';
import { TouchSource, type TouchOrientation } from './touch/touchSource';
import type { RemoteInput } from './remote/remoteInput';

export type PlayerSource =
  { readonly kind: 'gamepad'; readonly gamepadIndex: number } | { readonly kind: 'touch' } | { readonly kind: 'remote'; readonly remoteId: number };

export interface JoinedPlayer {
  readonly source: PlayerSource;
  readonly deviceName: string;
}

export type KartOrientation = TouchOrientation;

/** Stable per-device identity, used as the localStorage key for personalization. */
export function playerSourceKey(source: PlayerSource): string {
  if (source.kind === 'remote') return `remote:${source.remoteId}`;
  return source.kind === 'gamepad' ? `gamepad:${source.gamepadIndex}` : 'touch';
}

/** The device in the language being shown: read it while drawing. */
function describeSource(source: PlayerSource): string {
  const { lobby } = t();
  if (source.kind === 'remote') return lobby.phone(source.remoteId);
  return source.kind === 'gamepad' ? lobby.gamepad(source.gamepadIndex + 1) : lobby.touch;
}

export class InputManager {
  /** The on-screen controls; they drive the player who joined as `touch`. */
  readonly touch = new TouchSource();
  private readonly joined: JoinedPlayer[] = [];
  /** Phones that joined over the network; the player list only holds their ids. */
  private readonly remotes = new Map<number, RemoteInput>();
  private joinsBlockedUntilRelease = false;
  private touchControlMode: TouchControlMode = 'auto';

  constructor(private readonly touchSteering: TouchSteeringConfig) {}

  get players(): readonly JoinedPlayer[] {
    return this.joined;
  }

  set controlMode(mode: TouchControlMode) {
    this.touchControlMode = mode;
  }

  reset(): void {
    this.joined.length = 0;
    this.joinsBlockedUntilRelease = true;
    this.touch.releaseAll();
    for (const remote of [...this.remotes.values()]) {
      if (!remote.connected) this.releaseRemote(remote.id);
    }
  }

  /** Back in the lobby the phones that are still connected play on, behind the players already in. */
  rejoinConnectedRemotes(): void {
    for (const remote of this.remotes.values()) this.join({ kind: 'remote', remoteId: remote.id });
  }

  addRemote(remote: RemoteInput): boolean {
    if (!this.join({ kind: 'remote', remoteId: remote.id })) return false;
    this.remotes.set(remote.id, remote);
    return true;
  }

  remoteById(remoteId: number): RemoteInput | undefined {
    return this.remotes.get(remoteId);
  }

  nextRemoteId(): number {
    return Math.max(0, ...this.remotes.keys()) + 1;
  }

  get remoteInputs(): readonly RemoteInput[] {
    return [...this.remotes.values()];
  }

  /** Slots of phones that have been gone longer than the seat is kept for them. */
  slotsOfExpiredRemotes(reservationSeconds: number): readonly number[] {
    return this.joined.flatMap((player, slot) => {
      const remote = player.source.kind === 'remote' ? this.remotes.get(player.source.remoteId) : undefined;
      return remote && !remote.connected && remote.secondsLost() >= reservationSeconds ? [slot] : [];
    });
  }

  remoteInSlot(slot: number): RemoteInput | undefined {
    const source = this.joined[slot]?.source;
    return source?.kind === 'remote' ? this.remotes.get(source.remoteId) : undefined;
  }

  slotOfRemote(remoteId: number): number {
    return this.joined.findIndex((player) => player.source.kind === 'remote' && player.source.remoteId === remoteId);
  }
  /** Gamepads join with any button; a button still held from before a reset must be released first. */
  pollJoins(): void {
    const pressed = this.pressedGamepads();
    if (this.joinsBlockedUntilRelease) {
      if (pressed.length === 0) this.joinsBlockedUntilRelease = false;
      return;
    }
    for (const source of pressed) this.join(source);
  }

  readFrames(kartOrientations: readonly (KartOrientation | undefined)[] = []): readonly InputFrame[] {
    const pads = connectedGamepads();
    const gamepadsBlocked = !document.hasFocus();
    return this.joined.map((player, index) => {
      if (player.source.kind === 'touch') return this.touch.readFrame(this.touchControlMode, this.touchSteering, kartOrientations[index]);
      if (player.source.kind === 'remote')
        return this.remotes.get(player.source.remoteId)?.readFrame(this.touchSteering, kartOrientations[index]) ?? NEUTRAL_INPUT;
      if (gamepadsBlocked) return NEUTRAL_INPUT;
      const pad = pads[player.source.gamepadIndex];
      return pad ? readGamepadFrame(pad) : NEUTRAL_INPUT;
    });
  }

  disconnectedDeviceNames(): readonly string[] {
    const pads = connectedGamepads();
    return this.joined.flatMap((player) => (this.isDisconnected(player.source, pads) ? [player.deviceName] : []));
  }

  /** The seats of the players whose device is gone (a pulled gamepad, a phone that dropped out). */
  disconnectedSlots(): readonly number[] {
    const pads = connectedGamepads();
    return this.joined.flatMap((player, slot) => (this.isDisconnected(player.source, pads) ? [slot] : []));
  }

  private isDisconnected(source: PlayerSource, pads: ReturnType<typeof connectedGamepads>): boolean {
    if (source.kind === 'gamepad') return !pads[source.gamepadIndex];
    return source.kind === 'remote' && !(this.remotes.get(source.remoteId)?.connected ?? false);
  }

  hasTouchPlayer(): boolean {
    return this.hasJoined({ kind: 'touch' });
  }

  /** On-screen equivalent of pressing a join button; false when a touch player is already in or the lobby is full. */
  joinTouch(): boolean {
    return this.join({ kind: 'touch' });
  }

  /** Removes a player again; everyone after them moves up one slot. Held join buttons don't rejoin them. */
  leave(index: number): void {
    const source = this.joined[index]?.source;
    if (!source) return;
    this.joined.splice(index, 1);
    this.joinsBlockedUntilRelease = true;
    if (source.kind === 'remote') this.releaseRemote(source.remoteId);
  }

  private releaseRemote(remoteId: number): void {
    this.remotes.get(remoteId)?.close();
    this.remotes.delete(remoteId);
  }

  private hasJoined(source: PlayerSource): boolean {
    const key = playerSourceKey(source);
    return this.joined.some((player) => playerSourceKey(player.source) === key);
  }

  private join(source: PlayerSource): boolean {
    if (this.joined.length >= MAX_PLAYERS || this.hasJoined(source)) return false;
    this.joined.push({
      source,
      get deviceName() {
        return describeSource(source);
      },
    });
    return true;
  }

  private pressedGamepads(): readonly PlayerSource[] {
    return connectedGamepads().flatMap((pad, gamepadIndex): PlayerSource[] => (pad && hasAnyButtonPressed(pad) ? [{ kind: 'gamepad', gamepadIndex }] : []));
  }
}
