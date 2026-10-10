import type { DrivingConfig } from '../../../shared/config/driving';
import type { ItemConfig } from '../../../shared/config/items';
import type { RemoteConfig } from '../../../shared/config/remote';
import type { InputFrame } from '../../../shared/input/actions';
import { activateBoost } from '../kart/boost';
import { stepAllKarts } from '../kart/kartSimulation';
import { createKartState, type KartDriveFactors, type KartState } from '../kart/kartState';
import { activateCatnip, stepCatnip, withCatnipWobble } from '../items/catnip';
import { stepBoostFields } from '../maps/shared/boostFields';
import type { MapConfig } from '../maps/shared/mapConfig';
import type { ItemType } from '../../../shared/config/items';
import type { KartSnapshot } from './snapshotTypes';
import { applyKartSnapshot } from './snapshotApply';

export interface PredictionEnvironment {
  readonly map: MapConfig;
  readonly driving: DrivingConfig;
  readonly items: ItemConfig;
  readonly driveFactors: KartDriveFactors;
}

interface PredictedStep {
  readonly sequence: number;
  readonly input: InputFrame;
  readonly usedItem: 'boost' | 'catnip' | null;
}

export interface Reconciliation {
  readonly errorMeters: number;
  readonly snapped: boolean;
}

const MAX_RESIDUAL_METERS = 0.002;

/** The own kart on a guest phone, driven by the guest's own fingers at once instead of waiting for the host's picture of it.
 *  The same driving code as on the host runs for this one kart. Every snapshot says where the host really has the kart
 *  after the input it had applied; the predictor puts the kart there, plays the inputs the host has not seen yet on top
 *  and blends the difference away (a small error melts, a big one, like a hit or a respawn, jumps). Hits, bumps and item
 *  pickups only happen on the host, so they show up with the next snapshot and are never wrong for long. */
export class OwnKartPredictor {
  readonly state: KartState = createKartState(0, 0, 0);
  /** What the picture is moved by right now to hide a correction; melts to zero. */
  readonly offset = { x: 0, z: 0, yaw: 0 };
  private history: PredictedStep[] = [];
  private heldItem: ItemType | null = null;
  private previousUseItem = false;

  constructor(
    private readonly environment: PredictionEnvironment,
    private readonly config: RemoteConfig,
  ) {}

  /** No prediction (countdown, finished, paused): the kart is exactly where the host has it. */
  follow(kart: KartSnapshot): void {
    applyKartSnapshot(this.state, kart);
    this.heldItem = kart.heldItem;
    this.history.length = 0;
    this.offset.x = 0;
    this.offset.z = 0;
    this.offset.yaw = 0;
  }

  step(input: InputFrame, sequence: number, stepSeconds: number): void {
    const usedItem = this.useItemIfPressed(input);
    this.advance(input, usedItem, stepSeconds);
    this.history.push({ sequence, input, usedItem });
    const kept = Math.ceil(this.config.predictionHistorySeconds / stepSeconds);
    if (this.history.length > kept) this.history.splice(0, this.history.length - kept);
  }

  /** The host's kart after its input `ackSequence`; the inputs after that are played again on top. */
  reconcile(kart: KartSnapshot, ackSequence: number, stepSeconds: number): Reconciliation {
    const shownX = this.state.x + this.offset.x;
    const shownZ = this.state.z + this.offset.z;
    const shownYaw = this.state.yaw + this.offset.yaw;
    const sameSegment = this.state.levelId === kart.levelId && (this.state.windowJumpId === null) === (kart.windowJumpId === null);
    const before = { x: this.state.x, z: this.state.z };
    this.history = this.history.filter((entry) => ((entry.sequence - ackSequence) & 0xffff) !== 0 && ((entry.sequence - ackSequence) & 0x8000) === 0);
    applyKartSnapshot(this.state, kart);
    this.heldItem = kart.heldItem;
    for (const entry of this.history) this.advance(entry.input, entry.usedItem, stepSeconds);
    const errorMeters = Math.hypot(this.state.x - before.x, this.state.z - before.z);
    const snapped = !sameSegment || errorMeters > this.config.predictionSnapMeters;
    if (snapped) {
      this.offset.x = 0;
      this.offset.z = 0;
      this.offset.yaw = 0;
    } else {
      this.offset.x = shownX - this.state.x;
      this.offset.z = shownZ - this.state.z;
      this.offset.yaw = Math.atan2(Math.sin(shownYaw - this.state.yaw), Math.cos(shownYaw - this.state.yaw));
    }
    return { errorMeters, snapped };
  }

  /** The correction melts away over about a quarter of a second. */
  melt(frameSeconds: number): void {
    const keep = Math.exp(-this.config.predictionBlendPerSecond * frameSeconds);
    this.offset.x *= keep;
    this.offset.z *= keep;
    this.offset.yaw *= keep;
    if (Math.hypot(this.offset.x, this.offset.z) < MAX_RESIDUAL_METERS) {
      this.offset.x = 0;
      this.offset.z = 0;
    }
  }

  private useItemIfPressed(input: InputFrame): 'boost' | 'catnip' | null {
    const justPressed = input.useItem && !this.previousUseItem;
    this.previousUseItem = input.useItem;
    if (!justPressed || this.state.penaltySecondsLeft > 0) return null;
    if (this.heldItem === 'boost' || this.heldItem === 'catnip') {
      const used = this.heldItem;
      this.heldItem = null;
      return used;
    }
    return null;
  }

  private advance(input: InputFrame, usedItem: 'boost' | 'catnip' | null, stepSeconds: number): void {
    const { map, driving, items, driveFactors } = this.environment;
    const frame = withCatnipWobble(input, this.state, items);
    stepAllKarts(driving, map, [this.state], [frame], stepSeconds, [driveFactors], [true]);
    if (usedItem === 'boost') activateBoost(this.state, items.boost.durationSeconds);
    if (usedItem === 'catnip') activateCatnip(this.state, items);
    stepBoostFields(map, this.state);
    stepCatnip(this.state, stepSeconds);
  }
}
