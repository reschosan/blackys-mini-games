import { describe, expect, it } from 'vitest';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import type { KartSnapshot, RaceSnapshot } from '../../src/games/kart/replication/snapshotTypes';
import { SnapshotTimeline } from '../../src/games/kart/replication/snapshotTimeline';

const HZ = 20;
const INTERVAL = 1000 / HZ;
const config = { ...createRuntimeRemote(), interpolationDelayMilliseconds: 100, maxExtrapolationMilliseconds: 250 };

function kart(x: number, overrides: Partial<KartSnapshot> = {}): KartSnapshot {
  return {
    x,
    z: 0,
    yaw: 0,
    velocityX: 0,
    velocityZ: 0,
    levelId: 'ground',
    stairTransitionId: null,
    driftDirection: 0,
    driftStage: 0,
    driftCharge: 0,
    lastBoostFieldId: null,
    lastWindowJumpId: null,
    boostSeconds: 0,
    stunSecondsLeft: 0,
    stickySecondsLeft: 0,
    shieldSecondsLeft: 0,
    catnipSecondsLeft: 0,
    penaltySecondsLeft: 0,
    airborneSecondsLeft: 0,
    airborneSeconds: 0,
    shoveCooldownSeconds: 0,
    onCarpet: true,
    surfaceKind: null,
    windowJumpId: null,
    windowJumpElapsedSeconds: 0,
    lap: 0,
    nextCheckpoint: 1,
    finished: false,
    finishTimeSeconds: null,
    heldItem: null,
    place: 1,
    ...overrides,
  };
}

function snapshot(sequence: number, x: number, overrides: Partial<KartSnapshot> = {}): RaceSnapshot {
  return {
    sequence,
    ackInputSequence: 0,
    raceTimeSeconds: sequence / HZ,
    countdownSecondsLeft: 0,
    goDisplayActive: false,
    finishCountdownSeconds: null,
    karts: [kart(x, overrides)],
    hairballs: [],
    traps: [],
    lasers: [],
    gravityBubbles: [],
    vacuumPulses: [],
    shells: [],
    explosions: [],
    itemBoxCollected: [],
    extras: [],
  };
}

/** A kart that drives 20 m/s along x: 1 m per snapshot. */
function drivingTimeline(count: number, arrivalDelay = 30): SnapshotTimeline {
  const timeline = new SnapshotTimeline(HZ, config);
  for (let sequence = 1; sequence <= count; sequence += 1) timeline.push(snapshot(sequence, sequence, { velocityX: 20 }), sequence * INTERVAL + arrivalDelay);
  return timeline;
}

describe('SnapshotTimeline', () => {
  it('shows the karts a little in the past, blended between the two snapshots around that moment', () => {
    const timeline = drivingTimeline(10);
    const arrivalOfLast = 10 * INTERVAL + 30;
    // 25 ms after the newest arrived, minus 100 ms of delay: halfway between snapshot 8 (400 ms) and 9 (450 ms).
    expect(timeline.sample(arrivalOfLast + 25)?.karts[0]?.x).toBeCloseTo(8.5, 5);
  });

  it('is exactly on the snapshots when asked at their time plus the delay', () => {
    const timeline = drivingTimeline(10);
    const sample = timeline.sample(5 * INTERVAL + 30 + 100);
    expect(sample?.karts[0]?.x).toBeCloseTo(5, 5);
  });

  it('carries the karts on with their speed when snapshots stop, but only for a quarter of a second', () => {
    const timeline = drivingTimeline(10);
    const arrivalOfLast = 10 * INTERVAL + 30;
    const soon = timeline.sample(arrivalOfLast + 100 + 100)!;
    expect(soon.karts[0]!.x).toBeCloseTo(10 + 20 * 0.1, 3);
    const late = timeline.sample(arrivalOfLast + 100 + 5000)!;
    expect(late.karts[0]!.x).toBeCloseTo(10 + 20 * 0.25, 3);
  });

  it('ignores a snapshot that is not newer, and one that arrives twice', () => {
    const timeline = drivingTimeline(5);
    expect(timeline.push(snapshot(3, 3), 999)).toBe(false);
    expect(timeline.push(snapshot(5, 5), 999)).toBe(false);
    expect(timeline.statistics).toEqual({ received: 5, dropped: 2 });
  });

  it('keeps counting across the wrap of the sequence number', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    timeline.push(snapshot(65534, 1), 0);
    timeline.push(snapshot(65535, 2), INTERVAL);
    expect(timeline.push(snapshot(0, 3), 2 * INTERVAL)).toBe(true);
    expect(timeline.push(snapshot(1, 4), 3 * INTERVAL)).toBe(true);
    expect(timeline.push(snapshot(65535, 2), 4 * INTERVAL)).toBe(false);
  });

  it('does not slide a kart across the map when it was put somewhere else (a respawn)', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    timeline.push(snapshot(1, 0), 0);
    timeline.push(snapshot(2, 80), INTERVAL);
    timeline.push(snapshot(3, 81), 2 * INTERVAL);
    const sample = timeline.sample(INTERVAL + 100 - 10 + 0);
    expect([0, 80]).toContain(Math.round(sample!.karts[0]!.x));
  });

  it('turns along the short way round at the edge of the angle', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    timeline.push(snapshot(1, 0, { yaw: Math.PI - 0.1 }), 0);
    timeline.push(snapshot(2, 0, { yaw: -Math.PI + 0.1 }), INTERVAL);
    timeline.push(snapshot(3, 0, { yaw: -Math.PI + 0.2 }), 2 * INTERVAL);
    const yaw = timeline.sample(INTERVAL / 2 + 100)!.karts[0]!.yaw;
    expect(Math.abs(Math.abs(yaw) - Math.PI)).toBeLessThan(0.11);
  });

  it('is steady when the arrivals jitter, because the fastest arrivals set the pace', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    const jitter = [0, 30, 5, 40, 2, 35, 8, 0, 25, 12];
    jitter.forEach((delay, index) => timeline.push(snapshot(index + 1, index + 1), (index + 1) * INTERVAL + delay));
    const first = timeline.sample(6 * INTERVAL + 100)!.karts[0]!.x;
    expect(first).toBeCloseTo(6, 1);
  });

  it('has nothing to show before the first snapshot and after a clear', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    expect(timeline.sample(0)).toBeNull();
    timeline.push(snapshot(1, 1), 0);
    expect(timeline.sample(10)).not.toBeNull();
    timeline.clear();
    expect(timeline.sample(10)).toBeNull();
  });
});

describe('SnapshotTimeline delay that adapts', () => {
  it('draws the others further in the past after a late snapshot, and comes back when the connection calms down', () => {
    const timeline = new SnapshotTimeline(HZ, config);
    let now = 0;
    for (let sequence = 1; sequence <= 20; sequence += 1) {
      now += INTERVAL;
      timeline.push(snapshot(sequence, sequence), now);
      timeline.sample(now);
    }
    expect(timeline.currentDelayMilliseconds).toBe(config.interpolationDelayMilliseconds);

    now += 190;
    timeline.push(snapshot(21, 21), now);
    for (let frame = 0; frame < 20; frame += 1) {
      now += 16;
      timeline.sample(now);
    }
    expect(timeline.currentDelayMilliseconds).toBeGreaterThan(config.interpolationDelayMilliseconds + 40);
    expect(timeline.currentDelayMilliseconds).toBeLessThanOrEqual(config.maxInterpolationDelayMilliseconds);

    for (let sequence = 22; sequence <= 400; sequence += 1) {
      now += INTERVAL;
      timeline.push(snapshot(sequence, sequence), now);
      timeline.sample(now);
    }
    expect(timeline.currentDelayMilliseconds).toBeCloseTo(config.interpolationDelayMilliseconds, 0);
  });

  it('never goes past the longest delay it is allowed', () => {
    const timeline = new SnapshotTimeline(HZ, { ...config, maxInterpolationDelayMilliseconds: 150 });
    timeline.push(snapshot(1, 1), 0);
    timeline.push(snapshot(2, 2), 5000);
    for (let frame = 0; frame < 200; frame += 1) timeline.sample(5000 + frame * 16);
    expect(timeline.currentDelayMilliseconds).toBe(150);
  });
});
