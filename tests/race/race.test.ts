import { describe, expect, it } from 'vitest';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { DEFAULT_RACE } from '../../src/shared/config/race';
import { createProgress, placeByKart, rankKarts, segmentsCross, updateProgress, type KartProgress } from '../../src/games/kart/race/raceState';

const LAPS = DEFAULT_RACE.lapCount;

// Ring centreline, driven anticlockwise. The lap opens just past the start line
// and closes by crossing it again on the right straight.
const LAP_ROUTE = [
  { x: 51, z: -12 },
  { x: 51, z: -43 },
  { x: 12, z: -43 },
  { x: -12, z: -43 },
  { x: -51, z: -43 },
  { x: -51, z: -12 },
  { x: -51, z: 12 },
  { x: -51, z: 43 },
  { x: -12, z: 43 },
  { x: 12, z: 43 },
  { x: 51, z: 43 },
  { x: 51, z: 12 },
  { x: 51, z: -12 },
];

function driveRoute(progress: KartProgress, route: readonly { x: number; z: number }[], time = 0): void {
  for (const point of route) {
    updateProgress(RING_TEST_MAP, LAPS, progress, point.x, point.z, time);
  }
}

function driveLaps(progress: KartProgress, laps: number): void {
  for (let lap = 0; lap < laps; lap += 1) driveRoute(progress, LAP_ROUTE, lap + 1);
}

describe('segmentsCross', () => {
  it('detects a crossing', () => {
    expect(segmentsCross(0, -1, 0, 1, -1, 0, 1, 0)).toBe(true);
  });

  it('ignores segments that miss each other', () => {
    expect(segmentsCross(0, -1, 0, -0.5, -1, 0, 1, 0)).toBe(false);
  });

  it('ignores parallel segments', () => {
    expect(segmentsCross(0, 0, 1, 0, 0, 1, 1, 1)).toBe(false);
  });
});

describe('lap counting', () => {
  it('starts at lap zero aiming for the first checkpoint after the start line', () => {
    const progress = createProgress(44, 14);
    expect(progress).toMatchObject({ lap: 0, nextCheckpoint: 1, finished: false });
  });

  it('counts one lap per full trip around the ring', () => {
    const progress = createProgress(51, 12);
    driveLaps(progress, 1);
    expect(progress.lap).toBe(1);
    driveLaps(progress, 1);
    expect(progress.lap).toBe(2);
  });

  it('finishes after the configured number of laps', () => {
    const progress = createProgress(51, 12);
    driveLaps(progress, LAPS);
    expect(progress.finished).toBe(true);
    expect(progress.lap).toBe(LAPS);
    expect(progress.finishTimeSeconds).toBe(LAPS);
  });

  it('stops counting once a kart has finished', () => {
    const progress = createProgress(51, 12);
    driveLaps(progress, LAPS + 1);
    expect(progress.lap).toBe(LAPS);
  });
});

describe('point-to-point finish', () => {
  function crossGate(progress: KartProgress, checkpointIndex: number, time: number): void {
    const gate = FAMILY_HOUSE.checkpoints[checkpointIndex]!;
    const centerX = (gate.ax + gate.bx) / 2;
    const centerZ = (gate.az + gate.bz) / 2;
    const forwardX = gate.bz - gate.az;
    const forwardZ = gate.ax - gate.bx;
    const length = Math.hypot(forwardX, forwardZ);
    const offsetX = (forwardX / length) * 2;
    const offsetZ = (forwardZ / length) * 2;

    progress.previousX = centerX - offsetX;
    progress.previousZ = centerZ - offsetZ;
    progress.previousLevelId = gate.levelId ?? 'ground';
    updateProgress(FAMILY_HOUSE, 1, progress, centerX + offsetX, centerZ + offsetZ, time, gate.levelId);
  }

  it('finishes at the final checkpoint without requiring a return to the start', () => {
    const start = FAMILY_HOUSE.startPositions[0]!;
    const progress = createProgress(start.x, start.z);

    for (let checkpoint = 1; checkpoint < FAMILY_HOUSE.checkpoints.length; checkpoint += 1) {
      crossGate(progress, checkpoint, checkpoint * 10);
    }

    expect(progress).toMatchObject({ lap: 1, finished: true, finishTimeSeconds: (FAMILY_HOUSE.checkpoints.length - 1) * 10 });
  });
});

describe('shortcut protection', () => {
  it('ignores a checkpoint crossed in the reverse direction', () => {
    const progress = createProgress(-12, -43);

    updateProgress(RING_TEST_MAP, LAPS, progress, 51, -43, 0);

    expect(progress).toMatchObject({ nextCheckpoint: 1, checkpointsPassed: 0 });
  });

  it('ignores the start line when checkpoints are still missing', () => {
    const progress = createProgress(51, 12);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      driveRoute(progress, [
        { x: 51, z: -12 },
        { x: 51, z: 12 },
      ]);
    }
    expect(progress.lap).toBe(0);
  });

  it('refuses to count a lap when the far side of the ring was skipped', () => {
    const progress = createProgress(51, 12);
    driveRoute(progress, [
      { x: 51, z: -43 },
      { x: 12, z: -43 },
      { x: 12, z: 43 },
      { x: 51, z: 43 },
      { x: 51, z: 12 },
    ]);
    expect(progress.lap).toBe(0);
    expect(progress.checkpointsPassed).toBeLessThan(RING_TEST_MAP.checkpoints.length);
  });

  it('does not credit a checkpoint again when driving back through it', () => {
    const progress = createProgress(51, -43);
    driveRoute(progress, [
      { x: -12, z: -43 },
      { x: 51, z: -43 },
      { x: -12, z: -43 },
    ]);
    expect(progress.checkpointsPassed).toBe(1);
  });
});

describe('live ranking', () => {
  function kartAt(progress: KartProgress, x: number, z: number) {
    return { progress, x, z };
  }

  it('ranks the kart with more checkpoints first', () => {
    const leader = createProgress(51, 12);
    driveRoute(leader, LAP_ROUTE.slice(0, 5));
    const chaser = createProgress(51, 12);
    driveRoute(chaser, LAP_ROUTE.slice(0, 2));

    const ranking = rankKarts(RING_TEST_MAP, [kartAt(chaser, 51, -12), kartAt(leader, -12, -43)]);
    expect(placeByKart(ranking)).toEqual([2, 1]);
  });

  it('ranks the kart closer to the next gate first when both are level', () => {
    const near = createProgress(51, 12);
    const far = createProgress(51, 12);
    const ranking = rankKarts(RING_TEST_MAP, [kartAt(far, 51, 8), kartAt(near, 51, -24)]);
    expect(placeByKart(ranking)).toEqual([2, 1]);
  });

  it('ranks finished karts by finish time, ahead of everyone still driving', () => {
    const fast = createProgress(51, 12);
    const slow = createProgress(51, 12);
    const driving = createProgress(51, 12);
    for (let lap = 0; lap < LAPS; lap += 1) {
      driveRoute(fast, LAP_ROUTE, 10);
      driveRoute(slow, LAP_ROUTE, 20);
    }

    const ranking = rankKarts(RING_TEST_MAP, [kartAt(driving, 51, 12), kartAt(slow, 51, 12), kartAt(fast, 51, 12)]);
    expect(placeByKart(ranking)).toEqual([3, 2, 1]);
  });
});
