import { describe, expect, it } from 'vitest';
import { distanceForRadius, framingForPoints, smoothTowards } from '../../src/shared/core/framing';

describe('framingForPoints', () => {
  it('centres on a single kart with the margin as radius', () => {
    expect(framingForPoints([{ x: 4, z: -2 }], 6)).toEqual({
      centerX: 4,
      centerZ: -2,
      radius: 6,
    });
  });

  it('centres between two karts and grows with their spread', () => {
    const tight = framingForPoints(
      [
        { x: -1, z: 0 },
        { x: 1, z: 0 },
      ],
      6,
    );
    const wide = framingForPoints(
      [
        { x: -10, z: 0 },
        { x: 10, z: 0 },
      ],
      6,
    );
    expect(tight.centerX).toBe(0);
    expect(wide.centerX).toBe(0);
    expect(wide.radius).toBeGreaterThan(tight.radius);
  });

  it('falls back to the origin when no kart is on map', () => {
    expect(framingForPoints([], 6)).toEqual({ centerX: 0, centerZ: 0, radius: 6 });
  });
});

describe('distanceForRadius', () => {
  it('needs more distance for a larger radius', () => {
    expect(distanceForRadius(20, 50, 1.6)).toBeGreaterThan(distanceForRadius(10, 50, 1.6));
  });

  it('needs more distance for a narrower field of view', () => {
    expect(distanceForRadius(10, 30, 1.6)).toBeGreaterThan(distanceForRadius(10, 60, 1.6));
  });

  it('pulls back further on a portrait window than on a landscape one', () => {
    expect(distanceForRadius(10, 50, 0.6)).toBeGreaterThan(distanceForRadius(10, 50, 1.6));
  });
});

describe('smoothTowards', () => {
  it('approaches the target without overshooting', () => {
    let value = 0;
    for (let step = 0; step < 120; step += 1) value = smoothTowards(value, 10, 6, 1 / 60);
    expect(value).toBeGreaterThan(9.9);
    expect(value).toBeLessThanOrEqual(10);
  });

  it('stays put when it is already at the target', () => {
    expect(smoothTowards(5, 5, 6, 1 / 60)).toBe(5);
  });
});
