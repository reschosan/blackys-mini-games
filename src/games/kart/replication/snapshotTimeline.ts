import type { RemoteConfig } from '../../../shared/config/remote';
import type { KartSnapshot, RaceSnapshot } from './snapshotTypes';

interface TimedSnapshot {
  readonly snapshot: RaceSnapshot;
  /** Host time of this snapshot in milliseconds: its unwrapped sequence number times the interval between snapshots. */
  readonly hostMilliseconds: number;
}

export interface TimelineSample {
  readonly karts: readonly KartSnapshot[];
  /** The newest snapshot, for everything that is not blended (items on the track, boxes, countdown). */
  readonly latest: RaceSnapshot;
  /** How far the world objects have moved on since the newest snapshot, in seconds. */
  readonly secondsSinceLatest: number;
}

const OFFSET_RELAX = 0.01;
/** How much longer than the longest recent gap the delay is kept, so the next gap of that size is still covered. */
const GAP_MARGIN_MILLISECONDS = 15;
const PEAK_DECAY_PER_SECOND = 25;
const DELAY_GROW_PER_SECOND = 120;
const DELAY_SHRINK_PER_SECOND = 25;
const TELEPORT_METERS = 6;
const KEPT_SNAPSHOTS = 40;
const HALF_SEQUENCE = 0x8000;

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function blendKart(from: KartSnapshot, to: KartSnapshot, share: number): KartSnapshot {
  if (Math.hypot(to.x - from.x, to.z - from.z) > TELEPORT_METERS) return to;
  const late = share >= 0.5 ? to : from;
  return {
    ...late,
    x: from.x + (to.x - from.x) * share,
    z: from.z + (to.z - from.z) * share,
    yaw: from.yaw + shortestAngle(from.yaw, to.yaw) * share,
    velocityX: from.velocityX + (to.velocityX - from.velocityX) * share,
    velocityZ: from.velocityZ + (to.velocityZ - from.velocityZ) * share,
  };
}

function carryOn(kart: KartSnapshot, seconds: number): KartSnapshot {
  return { ...kart, x: kart.x + kart.velocityX * seconds, z: kart.z + kart.velocityZ * seconds };
}

/** Collects the snapshots a guest receives and answers "where were the karts a moment ago?". Karts are drawn a little in the past
 *  (`interpolationDelayMilliseconds`) so there are two snapshots to blend between even when one arrives late; when none arrives
 *  for a while the karts are carried on with their speed, but only for `maxExtrapolationMilliseconds`. The host's clock is never
 *  needed: the arrival times are matched to the sequence numbers, and the fastest arrivals set the pace, so jitter does not shake the picture. */
export class SnapshotTimeline {
  private readonly entries: TimedSnapshot[] = [];
  private delayMilliseconds: number;
  private gapPeakMilliseconds = 0;
  private lastArrival: number | null = null;
  private lastSampleAt: number | null = null;
  private unwrappedSequence = 0;
  private lastSequence: number | null = null;
  private offsetMilliseconds: number | null = null;
  private received = 0;
  private dropped = 0;

  constructor(
    private readonly snapshotHz: number,
    private readonly config: Pick<RemoteConfig, 'interpolationDelayMilliseconds' | 'maxInterpolationDelayMilliseconds' | 'maxExtrapolationMilliseconds'>,
  ) {
    this.delayMilliseconds = config.interpolationDelayMilliseconds;
  }

  /** How far in the past the other karts are drawn right now. */
  get currentDelayMilliseconds(): number {
    return this.delayMilliseconds;
  }

  get newest(): RaceSnapshot | null {
    return this.entries[this.entries.length - 1]?.snapshot ?? null;
  }

  get statistics(): { readonly received: number; readonly dropped: number } {
    return { received: this.received, dropped: this.dropped };
  }

  /** False for a snapshot that is not newer than the newest one (a late arrival or a copy): it is ignored. */
  push(snapshot: RaceSnapshot, nowMilliseconds: number): boolean {
    if (this.lastSequence !== null) {
      const difference = (snapshot.sequence - this.lastSequence) & 0xffff;
      if (difference === 0 || difference >= HALF_SEQUENCE) {
        this.dropped += 1;
        return false;
      }
      this.unwrappedSequence += difference;
    } else {
      this.unwrappedSequence = snapshot.sequence;
    }
    this.lastSequence = snapshot.sequence;
    const hostMilliseconds = (this.unwrappedSequence * 1000) / this.snapshotHz;
    const candidate = nowMilliseconds - hostMilliseconds;
    this.offsetMilliseconds =
      this.offsetMilliseconds === null || candidate < this.offsetMilliseconds
        ? candidate
        : this.offsetMilliseconds + (candidate - this.offsetMilliseconds) * OFFSET_RELAX;
    if (this.lastArrival !== null) this.gapPeakMilliseconds = Math.max(this.gapPeakMilliseconds, nowMilliseconds - this.lastArrival);
    this.lastArrival = nowMilliseconds;
    this.entries.push({ snapshot, hostMilliseconds });
    if (this.entries.length > KEPT_SNAPSHOTS) this.entries.shift();
    this.received += 1;
    return true;
  }

  clear(): void {
    this.entries.length = 0;
    this.lastSequence = null;
    this.offsetMilliseconds = null;
    this.lastArrival = null;
    this.gapPeakMilliseconds = 0;
    this.delayMilliseconds = this.config.interpolationDelayMilliseconds;
  }

  /** The delay follows the longest recent gap between snapshots: quickly up, slowly down, so the picture never jumps by it. */
  private adaptDelay(nowMilliseconds: number): void {
    const seconds = this.lastSampleAt === null ? 0 : Math.min((nowMilliseconds - this.lastSampleAt) / 1000, 0.25);
    this.lastSampleAt = nowMilliseconds;
    this.gapPeakMilliseconds = Math.max(this.gapPeakMilliseconds - PEAK_DECAY_PER_SECOND * seconds, 0);
    const wanted = Math.min(
      Math.max(this.gapPeakMilliseconds + GAP_MARGIN_MILLISECONDS, this.config.interpolationDelayMilliseconds),
      this.config.maxInterpolationDelayMilliseconds,
    );
    const step = (wanted > this.delayMilliseconds ? DELAY_GROW_PER_SECOND : DELAY_SHRINK_PER_SECOND) * seconds;
    this.delayMilliseconds =
      wanted > this.delayMilliseconds ? Math.min(this.delayMilliseconds + step, wanted) : Math.max(this.delayMilliseconds - step, wanted);
  }

  sample(nowMilliseconds: number): TimelineSample | null {
    const newest = this.entries[this.entries.length - 1];
    if (!newest || this.offsetMilliseconds === null) return null;
    this.adaptDelay(nowMilliseconds);
    const renderHostMilliseconds = nowMilliseconds - this.offsetMilliseconds - this.delayMilliseconds;
    const secondsSinceLatest = Math.max((renderHostMilliseconds - newest.hostMilliseconds) / 1000, 0);
    const worldSeconds = Math.min(secondsSinceLatest, this.config.maxExtrapolationMilliseconds / 1000);
    if (renderHostMilliseconds >= newest.hostMilliseconds) {
      return { karts: newest.snapshot.karts.map((kart) => carryOn(kart, worldSeconds)), latest: newest.snapshot, secondsSinceLatest: worldSeconds };
    }
    const upper = this.entries.findIndex((entry) => entry.hostMilliseconds > renderHostMilliseconds);
    const to = this.entries[upper];
    const from = this.entries[upper - 1];
    if (!to) return null;
    if (!from) return { karts: to.snapshot.karts, latest: newest.snapshot, secondsSinceLatest: 0 };
    const share = (renderHostMilliseconds - from.hostMilliseconds) / (to.hostMilliseconds - from.hostMilliseconds);
    const karts = to.snapshot.karts.map((kart, index) => {
      const earlier = from.snapshot.karts[index];
      return earlier ? blendKart(earlier, kart, share) : kart;
    });
    return { karts, latest: newest.snapshot, secondsSinceLatest: 0 };
  }
}
