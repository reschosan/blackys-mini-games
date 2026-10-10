import { describe, expect, it } from 'vitest';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { buildCentreline, centrelineOf, distanceAlongLap, nextCornerAhead, targetPointAhead } from '../../src/games/kart/race/routeProgress';
import { createProgress, raceProgressScore, updateProgress } from '../../src/games/kart/race/raceState';

const centreline = centrelineOf(RING_TEST_MAP);

describe('buildCentreline', () => {
  it('closes the loop back to the first waypoint', () => {
    const built = buildCentreline(RING_TEST_MAP);
    expect(built.segments).toHaveLength(RING_TEST_MAP.waypoints.length);
    expect(built.totalLength).toBeGreaterThan(0);
  });

  it('leaves a point-to-point route open at its goal', () => {
    const built = buildCentreline(FAMILY_HOUSE);
    expect(built.closed).toBe(false);
    expect(built.segments).toHaveLength(FAMILY_HOUSE.waypoints.length - 1);
  });
});

describe('distanceAlongLap', () => {
  it('reports zero at the start line', () => {
    expect(distanceAlongLap(centreline, 51, 0)).toBeCloseTo(0);
  });

  it('grows while driving along the ring', () => {
    const early = distanceAlongLap(centreline, 51, -20);
    const later = distanceAlongLap(centreline, 0, -43);
    expect(later).toBeGreaterThan(early);
    expect(early).toBeGreaterThan(0);
  });

  it('ignores how far the kart is off the centreline', () => {
    const onLine = distanceAlongLap(centreline, 0, -43);
    const offLine = distanceAlongLap(centreline, 0, -55);
    expect(offLine).toBeCloseTo(onLine);
  });

  it('ranks a kart in the corner by map distance, not by straight line', () => {
    // The far corner is close to the next gate as the crow flies but far along the map.
    const cornerProgress = distanceAlongLap(centreline, -51, -43);
    const straightProgress = distanceAlongLap(centreline, 51, -43);
    expect(cornerProgress).toBeGreaterThan(straightProgress);
  });
});

describe('targetPointAhead', () => {
  it('moves further along the ring than the closest point on the path', () => {
    const distanceAtKart = distanceAlongLap(centreline, 51, 0);
    const target = targetPointAhead(centreline, 51, 0, 6);
    const distanceAtTarget = distanceAlongLap(centreline, target.x, target.z);
    expect(distanceAtTarget).toBeCloseTo((distanceAtKart + 6) % centreline.totalLength, 1);
  });

  it('wraps around past the finish line', () => {
    // Starting a few metres before the line, a lookahead longer than what's left in the lap
    // must land just after the start rather than off the end of the last segment.
    const distanceAtKart = distanceAlongLap(centreline, 24, -20);
    const lookahead = centreline.totalLength - distanceAtKart + 3;
    const target = targetPointAhead(centreline, 24, -20, lookahead);
    const distanceAtTarget = distanceAlongLap(centreline, target.x, target.z);
    expect(distanceAtTarget).toBeCloseTo(3, 1);
  });
});

describe('nextCornerAhead', () => {
  it('reports a real, fixed 90° corner regardless of exactly how far ahead it is measured from', () => {
    const nearby = nextCornerAhead(centreline, distanceAlongLap(centreline, 51, -32));
    const further = nextCornerAhead(centreline, distanceAlongLap(centreline, 51, -8));
    expect(Math.abs(nearby.angle)).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.abs(further.angle)).toBeCloseTo(Math.PI / 2, 1);
    expect(nearby.distance).toBeLessThan(further.distance);
  });

  it('reports no turn for the straight midpoint waypoints', () => {
    const corner = nextCornerAhead(centreline, distanceAlongLap(centreline, 24, -43));
    expect(corner.angle).toBeCloseTo(0, 1);
  });

  it('signs the angle consistently with the actual turn direction', () => {
    // All four corners of this rectangular, counter-clockwise-from-above map turn the same way.
    const first = nextCornerAhead(centreline, distanceAlongLap(centreline, 51, -32));
    const second = nextCornerAhead(centreline, distanceAlongLap(centreline, -32, -43));
    expect(Math.sign(first.angle)).toBe(Math.sign(second.angle));
  });
});

describe('raceProgressScore', () => {
  it('counts progress across laps', () => {
    const progress = createProgress(51, 0);
    const firstLap = raceProgressScore(RING_TEST_MAP, progress, 0, -43);
    progress.lap = 1;
    expect(raceProgressScore(RING_TEST_MAP, progress, 0, -43)).toBeGreaterThan(firstLap);
  });

  it('stays monotone across the start line', () => {
    const before = createProgress(51, 0);
    before.nextCheckpoint = 0;
    before.checkpointsPassed = 3;
    const scoreBefore = raceProgressScore(RING_TEST_MAP, before, 51, 4);

    const after = createProgress(51, 0);
    after.nextCheckpoint = 1;
    after.lap = 1;
    const scoreAfter = raceProgressScore(RING_TEST_MAP, after, 51, -4);

    expect(scoreAfter).toBeGreaterThan(scoreBefore);
    expect(scoreBefore).toBeGreaterThan(centreline.totalLength * 0.9);
  });

  it('does not credit a lap for reversing over the start line', () => {
    const progress = createProgress(51, -12);
    updateProgress(RING_TEST_MAP, 3, progress, 51, 12, 0);
    expect(progress.lap).toBe(0);
    expect(raceProgressScore(RING_TEST_MAP, progress, 51, 12)).toBeLessThan(centreline.totalLength / 2);
  });

  it('does not reset progress after the midpoint of a point-to-point route', () => {
    const midpoint = FAMILY_HOUSE.routeNodes!.find((node) => node.levelId === 'second')!;
    const progress = createProgress(midpoint.x, midpoint.z, midpoint.levelId);
    progress.nextCheckpoint = FAMILY_HOUSE.checkpoints.findIndex((gate) => gate.levelId === 'second');
    expect(raceProgressScore(FAMILY_HOUSE, progress, midpoint.x, midpoint.z)).toBeGreaterThan(centrelineOf(FAMILY_HOUSE).totalLength / 2);
  });

  it('does not award a later overlapping house passage before its mandatory gates', () => {
    const nodes = FAMILY_HOUSE.routeNodes!.filter((node) => node.levelId === 'first');
    const early = nodes[3]!;
    const progress = createProgress(early.x, early.z, early.levelId);
    progress.nextCheckpoint = FAMILY_HOUSE.checkpoints.findIndex((gate) => gate.name === 'Hobbyzimmer');
    const score = raceProgressScore(FAMILY_HOUSE, progress, nodes[22]!.x, nodes[22]!.z);
    const next = FAMILY_HOUSE.routeNodes![FAMILY_HOUSE.checkpoints[progress.nextCheckpoint]!.routeNodeIndex!]!;
    const nextGateScore = distanceAlongLap(centrelineOf(FAMILY_HOUSE), next.x, next.z, 'first');
    expect(score).toBeLessThanOrEqual(nextGateScore);
  });
});

describe('level-separated gates', () => {
  it('does not advance a gate from a different level', () => {
    const map = {
      ...RING_TEST_MAP,
      checkpoints: [{ ax: 0, az: -1, bx: 0, bz: 1, levelId: 'upper' }],
      raceFormat: 'pointToPoint' as const,
    };
    const progress = createProgress(-1, 0, 'ground');
    progress.nextCheckpoint = 0;
    updateProgress(map, 1, progress, 1, 0, 1, 'ground');
    expect(progress.finished).toBe(false);
    updateProgress(map, 1, progress, -1, 0, 2, 'upper');
    updateProgress(map, 1, progress, 1, 0, 3, 'upper');
    expect(progress.finished).toBe(true);
  });
});
