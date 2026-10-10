import { PLAYER_APPEARANCES } from '../../shared/config/players';
import type { RemoteConfig } from '../../shared/config/remote';
import { hexColor } from '../../shared/core/color';
import type { InputManager } from '../../shared/input/inputManager';
import type { RemoteInput } from '../../shared/input/remote/remoteInput';
import type { GuestControlMessage } from '../../shared/net/messages';
import type { RacePlayer } from '../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../games/kart/race/raceWorld';
import type { CatAppearance } from '../../shared/config/catAppearance';
import type { GamePhase } from '../../shared/core/gameFlow';
import { SIMULATION_HZ } from '../../shared/core/loop';
import { encodeSnapshot, withAckInputSequence } from '../../games/kart/replication/snapshot';
import { buildSnapshot } from '../../games/kart/replication/snapshotBuilder';
import type { RaceEvent, RaceSetup, ResultEntry, SetupPlayer } from '../../games/kart/replication/raceSetup';
import type { GuestEngineSetup } from '../engine/engineSetup';
import type { EngineRound } from './game/engineRound';
import { inLanguage, type Language } from '../../shared/i18n/language';

export interface BroadcastSource {
  readonly input: InputManager;
  readonly players: () => readonly RacePlayer[];
  readonly world: () => RaceWorld;
  readonly mapIndex: () => number;
  readonly lapCount: () => number;
  /** `KartMode.id` of the game being played. */
  readonly modeId: () => string;
  readonly phase: () => GamePhase;
  readonly nameOfSlot: (slot: number) => string;
  readonly appearanceOf: (player: RacePlayer) => CatAppearance;
  readonly countdown: () => { readonly secondsLeft: number; readonly goDisplayActive: boolean };
  readonly finishCountdownSeconds: () => number | null;
  /** The state of the rules of the game being played, which the guests mirror. */
  readonly extras: () => readonly number[];
  /** The game that is not on the kart engine, while one runs. */
  readonly engine: () => EngineRound | null;
}

/** Snapshots go out every whole number of simulation ticks, so only rates that divide 60 are possible (at least 5 per second, what a guest accepts). */
const TICKS_PER_SNAPSHOT_CHOICES = [1, 2, 3, 4, 5, 6, 10, 12];

/** The snapshot rate the host really sends: the configured one, moved to the nearest rate that divides the simulation rate. */
function sendableSnapshotTicks(snapshotHz: number): number {
  return TICKS_PER_SNAPSHOT_CHOICES.reduce((best, ticks) =>
    Math.abs(SIMULATION_HZ / ticks - snapshotHz) < Math.abs(SIMULATION_HZ / best - snapshotHz) ? ticks : best,
  );
}

/** Tells the guests that draw the race themselves what the race looks like: the setup once, then snapshots many times a second,
 *  and the few events that make a sound. Guests that stay plain controllers get none of it. The host also holds the start
 *  countdown while guests are still loading the map, but not longer than `readyWaitSeconds`. */
export class RaceBroadcaster {
  /** Guests that built the race and want its picture, by remote id. */
  private readonly renderers = new Set<number>();
  private readonly waitingFor = new Set<number>();
  private waitSecondsLeft = 0;
  private sequence = 0;
  private tickCounter = 0;
  private readonly ticksPerSnapshot: number;

  constructor(
    private readonly source: BroadcastSource,
    private readonly config: RemoteConfig,
  ) {
    this.ticksPerSnapshot = sendableSnapshotTicks(config.snapshotHz);
  }

  /** A race starts (or starts again): every guest gets the setup and answers when it is ready. */
  beginRace(): void {
    this.renderers.clear();
    this.waitingFor.clear();
    this.tickCounter = 0;
    for (const remote of this.source.input.remoteInputs) {
      if (!remote.connected) continue;
      this.waitingFor.add(remote.id);
      remote.sendInOwnLanguage(() => ({ kind: 'setup', game: this.source.modeId(), setup: this.setupFor(remote, false) }));
    }
    this.waitSecondsLeft = this.config.readyWaitSeconds;
  }

  /** A guest that dropped out is back during a race: it builds the race while the others drive on. */
  resumeFor(remote: RemoteInput): void {
    this.renderers.delete(remote.id);
    remote.sendInOwnLanguage(() => ({ kind: 'setup', game: this.source.modeId(), setup: this.setupFor(remote, true) }));
  }

  endRace(): void {
    this.renderers.clear();
    this.waitingFor.clear();
  }

  guestMessage(remote: RemoteInput, message: GuestControlMessage): void {
    if (message.kind !== 'ready') return;
    this.waitingFor.delete(remote.id);
    if (message.renders) this.renderers.add(remote.id);
    else this.renderers.delete(remote.id);
  }

  /** Does a guest phone draw the kart of this seat itself? Then the host needs no camera on it. */
  drawsItself(slot: number): boolean {
    const remote = this.source.input.remoteInSlot(slot);
    return remote !== undefined && this.renderers.has(remote.id);
  }

  /** Guests are still loading the map: the start countdown is on hold and the host's screen says so. */
  get waitingForGuests(): boolean {
    return this.waitingFor.size > 0;
  }

  /** True while the start countdown must wait for guests that are loading. */
  holdsStart(stepSeconds: number): boolean {
    if (this.waitingFor.size === 0) return false;
    this.waitSecondsLeft -= stepSeconds;
    if (this.waitSecondsLeft > 0) return true;
    this.waitingFor.clear();
    return false;
  }

  /** Once per simulation tick while a race is on: every few ticks the picture goes out. */
  tick(): void {
    if (this.renderers.size === 0) return;
    this.tickCounter += 1;
    if (this.tickCounter % this.ticksPerSnapshot !== 0) return;
    const { source } = this;
    const engine = source.engine();
    if (engine) {
      this.sendEngineFrame(engine);
      return;
    }
    this.sequence = (this.sequence + 1) & 0xffff;
    const countdown = source.countdown();
    const encoded = encodeSnapshot(
      buildSnapshot(
        {
          players: source.players(),
          world: source.world(),
          countdownSecondsLeft: countdown.secondsLeft,
          goDisplayActive: countdown.goDisplayActive,
          finishCountdownSeconds: source.finishCountdownSeconds(),
          extras: source.extras(),
        },
        this.sequence,
      ),
    );
    for (const remote of source.input.remoteInputs) {
      if (this.renderers.has(remote.id)) remote.sendState(withAckInputSequence(encoded, remote.lastInputSequence));
    }
  }

  event(event: RaceEvent): void {
    for (const remote of this.source.input.remoteInputs) {
      if (this.renderers.has(remote.id)) remote.send({ kind: 'event', event });
    }
  }

  /** The result table goes to every phone in its own language. */
  results(rowsInLanguage: () => readonly ResultEntry[]): void {
    for (const remote of this.source.input.remoteInputs) {
      if (this.renderers.has(remote.id)) remote.sendInOwnLanguage(() => ({ kind: 'event', event: { type: 'results', rows: rowsInLanguage() } }));
    }
  }

  /** The picture holds the status lines and cards of the game: it is made once for every language the phones show. */
  private sendEngineFrame(engine: EngineRound): void {
    const byLanguage = new Map<Language, ArrayBuffer>();
    for (const remote of this.source.input.remoteInputs) {
      if (!this.renderers.has(remote.id)) continue;
      let encoded = byLanguage.get(remote.language);
      if (!encoded) {
        encoded = inLanguage(remote.language, () => engine.encode());
        byLanguage.set(remote.language, encoded);
      }
      remote.sendState(encoded);
    }
  }

  private setupFor(remote: RemoteInput, resume: boolean): RaceSetup | GuestEngineSetup {
    const { source } = this;
    const engine = source.engine();
    if (engine) {
      return {
        buildId: __BUILD_ID__,
        seat: source.input.slotOfRemote(remote.id),
        snapshotHz: SIMULATION_HZ / this.ticksPerSnapshot,
        resume,
        seats: engine.seats,
      };
    }
    const players: SetupPlayer[] = source.players().map((player, slot) => ({
      slot,
      isAi: player.isAi,
      name: source.nameOfSlot(slot),
      color: hexColor(PLAYER_APPEARANCES[slot]?.bodyColor ?? 0xffffff),
      appearance: source.appearanceOf(player),
      loadout: player.loadout,
    }));
    return {
      buildId: __BUILD_ID__,
      mode: source.modeId(),
      mapIndex: source.mapIndex(),
      lapCount: source.lapCount(),
      seat: source.input.slotOfRemote(remote.id),
      snapshotHz: SIMULATION_HZ / this.ticksPerSnapshot,
      resume,
      players,
    };
  }
}
