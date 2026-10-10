import { describe, expect, it } from 'vitest';
import { interpolatePose, type Pose } from '../../src/games/kart/race/views/poseInterpolation';

const TELEPORT = 5;

describe('interpolatePose', () => {
  it('blends position and heading between two simulation ticks', () => {
    const pose = interpolatePose({ x: 0, z: 10, yaw: 0 }, { x: 2, z: 14, yaw: 0.4 }, 0.5, TELEPORT);
    expect(pose.x).toBeCloseTo(1);
    expect(pose.z).toBeCloseTo(12);
    expect(pose.yaw).toBeCloseTo(0.2);
  });

  it('returns the previous pose at alpha 0 and the current pose at alpha 1', () => {
    const previous = { x: 1, z: 1, yaw: 0.1 };
    const current = { x: 2, z: 3, yaw: 0.5 };
    expect(interpolatePose(previous, current, 0, TELEPORT)).toEqual(previous);
    expect(interpolatePose(previous, current, 1, TELEPORT)).toEqual(current);
  });

  it('turns the short way around when the heading wraps past ±π', () => {
    const pose = interpolatePose({ x: 0, z: 0, yaw: Math.PI - 0.1 }, { x: 0, z: 0, yaw: -Math.PI + 0.1 }, 0.5, TELEPORT);
    expect(Math.abs(Math.abs(pose.yaw) - Math.PI)).toBeLessThan(1e-9);
  });

  it('shows a teleport as it is, without sliding across the map', () => {
    const current = { x: 80, z: 0, yaw: 1 };
    expect(interpolatePose({ x: 0, z: 0, yaw: 0 }, current, 0.5, TELEPORT)).toEqual(current);
  });

  it('draws the current pose when there is no previous tick yet', () => {
    const current = { x: 3, z: 4, yaw: 0 };
    expect(interpolatePose(undefined, current, 0.3, TELEPORT)).toEqual(current);
  });
});

/** Same accumulator as `GameLoop`: fixed 60 Hz steps, a frame at the display rate. */
function drawnPositions(displayHz: number, interpolate: boolean): number[] {
  const step = 1 / 60;
  const frame = 1 / displayHz;
  const speed = 20;
  let accumulator = 0;
  let previous: Pose = { x: 0, z: 0, yaw: 0 };
  let current: Pose = { x: 0, z: 0, yaw: 0 };
  const drawn: number[] = [];
  for (let index = 0; index < 120; index += 1) {
    accumulator += frame;
    while (accumulator >= step) {
      previous = current;
      current = { ...current, x: current.x + speed * step };
      accumulator -= step;
    }
    drawn.push(interpolate ? interpolatePose(previous, current, accumulator / step, TELEPORT).x : current.x);
  }
  return drawn.slice(10);
}

function stepSpread(positions: readonly number[]): number {
  const steps = positions.slice(1).map((position, index) => position - positions[index]!);
  return Math.max(...steps) - Math.min(...steps);
}

describe('smooth motion on a display that does not run at the simulation rate', () => {
  it.each([75, 144])('draws even steps at %s Hz, where the plain latest state judders', (hz) => {
    const plain = stepSpread(drawnPositions(hz, false));
    const smooth = stepSpread(drawnPositions(hz, true));

    expect(plain).toBeGreaterThan(0.2);
    expect(smooth).toBeLessThan(0.02);
  });
});
