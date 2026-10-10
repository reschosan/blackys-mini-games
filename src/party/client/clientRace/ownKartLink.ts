import { driveFactorsOf } from '../../../games/kart/ai/raceAiInput';
import { forwardSpeedOf, type KartState } from '../../../games/kart/kart/kartState';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { OwnKartPredictor } from '../../../games/kart/replication/ownKartPredictor';
import type { KartSnapshot } from '../../../games/kart/replication/snapshotTypes';
import { copyKartState } from '../../../games/kart/replication/snapshotApply';
import { createRuntimeDriving } from '../../../shared/config/driving';
import type { ItemConfig } from '../../../shared/config/items';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import type { RemoteConfig } from '../../../shared/config/remote';
import { createRuntimeTouchSteering } from '../../../shared/config/touch';
import { RemoteInput } from '../../../shared/input/remote/remoteInput';
import type { TouchOrientation } from '../../../shared/input/touch/touchSource';
import { SIMULATION_HZ } from '../../../shared/core/loop';
import type { InputMessage } from '../../../shared/net/messages';

const STEP_SECONDS = 1 / SIMULATION_HZ;
const RTT_SMOOTHING = 0.2;
const SENT_INPUTS_KEPT = 120;

/** What the own kart goes by in a step. */
interface OwnKartSituation {
  /** The own kart drives itself from the guest's input (the race runs and the host's pictures are fresh). */
  readonly predicting: boolean;
  /** Where the host's newest picture has the own kart, to follow it while not predicting. */
  readonly hostKart: KartSnapshot | undefined;
  readonly simpleMode: NonNullable<TouchOrientation['simpleMode']>;
}

const NO_STATISTICS = { reconciliations: 0, snaps: 0, worstErrorMeters: 0, lastErrorMeters: 0, ticks: 0 };

/** The own kart on a guest phone: it drives at once from the guest's own input (`OwnKartPredictor`) and is corrected by every snapshot of the host.
 *  It also times the round trip: from sending an input until a snapshot reports it applied. */
export class OwnKartLink {
  private predictor: OwnKartPredictor | null = null;
  private readonly sentAt = new Map<number, number>();
  private readonly steering = createRuntimeTouchSteering();
  private readonly localInput: RemoteInput;
  private smoothedRoundTrip = 0;
  readonly statistics = { ...NO_STATISTICS };

  constructor(private readonly config: RemoteConfig) {
    this.localInput = new RemoteInput(0, { send: () => undefined, sendState: () => undefined, close: () => undefined }, config);
  }

  get roundTripMilliseconds(): number {
    return this.smoothedRoundTrip;
  }

  /** A new race: a fresh prediction for the own kart on this map. */
  reset(map: MapConfig, items: ItemConfig, loadout: KartLoadout): void {
    this.predictor = new OwnKartPredictor({ map, driving: createRuntimeDriving(), items, driveFactors: driveFactorsOf(loadout) }, this.config);
    this.sentAt.clear();
    Object.assign(this.statistics, NO_STATISTICS);
  }

  /** Every input sent to the host, so that its answer can be timed. */
  noteSent(message: InputMessage, now: number): void {
    this.sentAt.set(message.sequence, now);
    this.sentAt.delete((message.sequence - SENT_INPUTS_KEPT) & 0xffff);
  }

  /** A step of a race that is built (for the debug readout). */
  countStep(): void {
    this.statistics.ticks += 1;
  }

  /** A snapshot came: time the round trip and, while the own kart drives itself, pull it towards where the host has it. */
  onSnapshot(own: KartSnapshot, ackSequence: number, now: number, predicting: boolean): void {
    this.measureRoundTrip(ackSequence, now);
    if (!this.predictor || !predicting) return;
    const result = this.predictor.reconcile(own, ackSequence, STEP_SECONDS);
    this.statistics.reconciliations += 1;
    this.statistics.lastErrorMeters = result.errorMeters;
    this.statistics.worstErrorMeters = Math.max(this.statistics.worstErrorMeters, result.errorMeters);
    if (result.snapped) this.statistics.snaps += 1;
  }

  /** One step of the own kart: driven by the own input while predicting, otherwise it follows the host's newest picture. Shown in `shown`. */
  step(message: InputMessage, situation: OwnKartSituation, shown: KartState): void {
    const { predictor } = this;
    if (!predictor) return;
    const { predicting, hostKart, simpleMode } = situation;
    if (predicting) {
      this.localInput.receive(message);
      const frame = this.localInput.readFrame(this.steering, { yaw: predictor.state.yaw, forwardSpeed: forwardSpeedOf(predictor.state), simpleMode });
      predictor.step(frame, message.sequence, STEP_SECONDS);
      predictor.melt(STEP_SECONDS);
    } else if (hostKart) {
      predictor.follow(hostKart);
    }
    copyKartState(shown, predictor.state, predictor.offset);
  }

  /** Where the own kart is shown (the prediction plus the correction that is still melting away), for the debug hook. */
  shownPose(): { x: number; z: number; yaw: number } | null {
    const { predictor } = this;
    if (!predictor) return null;
    return { x: predictor.state.x + predictor.offset.x, z: predictor.state.z + predictor.offset.z, yaw: predictor.state.yaw + predictor.offset.yaw };
  }

  private measureRoundTrip(ackSequence: number, now: number): void {
    const sent = this.sentAt.get(ackSequence);
    if (sent === undefined) return;
    const roundTrip = now - sent;
    this.smoothedRoundTrip = this.smoothedRoundTrip === 0 ? roundTrip : this.smoothedRoundTrip + (roundTrip - this.smoothedRoundTrip) * RTT_SMOOTHING;
  }
}
