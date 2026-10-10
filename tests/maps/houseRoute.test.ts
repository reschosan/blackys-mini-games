import { describe, expect, it } from 'vitest';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { KART_COLLIDER_RADIUS, KART_WALL_COLLIDER_RADIUS } from '../../src/shared/config/kart';
import { circleVsAabb, isInsideRect, rectToAabb } from '../../src/games/kart/maps/shared/collision';
import { collidableRects, isOnRouteSurface, kartElevationAt, updateKartStair } from '../../src/games/kart/maps/shared/surface';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createProgress, updateProgress } from '../../src/games/kart/race/raceState';

describe('house route geometry', () => {
  it('finishes a complete nine-room route with legally cut garden and bedroom corners', () => {
    const nodes = FAMILY_HOUSE.routeNodes!.filter((_node, index) => index !== 56).map((node, index) => (index === 3 ? { ...node, z: 110 } : node));
    const kart = createKartState(nodes[0]!.x, nodes[0]!.z, 0, 'ground');
    const progress = createProgress(kart.x, kart.z, kart.levelId);
    for (let index = 1; index < nodes.length; index += 1) {
      const from = nodes[index - 1]!;
      const to = nodes[index]!;
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) * 5);
      for (let step = 1; step <= steps; step += 1) {
        const previousX = kart.x;
        const previousZ = kart.z;
        kart.x = from.x + ((to.x - from.x) * step) / steps;
        kart.z = from.z + ((to.z - from.z) * step) / steps;
        updateKartStair(FAMILY_HOUSE, kart, previousX, previousZ);
        updateProgress(FAMILY_HOUSE, 1, progress, kart.x, kart.z, index, kart.levelId);
      }
    }
    expect(progress.finished).toBe(true);
    expect(progress.checkpointsPassed).toBe(FAMILY_HOUSE.checkpoints.length - 1);
  });
  it('counts the garden when legally cutting the former window landing corner', () => {
    const progress = createProgress(-27, 96, 'ground');
    for (const [x, z] of [
      [-27, 110],
      [-13, 110],
      [10, 119.4],
    ])
      updateProgress(FAMILY_HOUSE, 1, progress, x!, z!, 10, 'ground');
    expect(progress.nextCheckpoint).toBe(2);
  });
  it('counts the office before an early left turn through the open doorway', () => {
    const progress = createProgress(57, 110, 'ground');
    progress.nextCheckpoint = 2;
    for (const [x, z] of [
      [57, 99],
      [57, 91],
      [43, 91],
      [25.8, 82.8],
    ])
      updateProgress(FAMILY_HOUSE, 1, progress, x!, z!, 20, 'ground');
    expect(progress.nextCheckpoint).toBe(3);
  });
  it('closes the wrong right branch at the hobby-room entrance without blocking the required left turn', () => {
    const kart = createKartState(-6, -33, Math.PI / 2, 'first');
    for (let tick = 0; tick < 120; tick += 1) stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
    expect(kart.z).toBeLessThan(-24 - KART_WALL_COLLIDER_RADIUS);
    expect(collidableRects(FAMILY_HOUSE, 'first').some((rect) => circleVsAabb(-6, -40, KART_WALL_COLLIDER_RADIUS, rectToAabb(rect)))).toBe(false);
  });
  it('counts the bedroom entry when legally cutting its short dogleg on the wide road', () => {
    const progress = createProgress(-14.4, 12, 'second');
    progress.nextCheckpoint = FAMILY_HOUSE.checkpoints.findIndex((gate) => gate.name === 'Schlafzimmer');
    for (const [x, z] of [
      [-14.4, 18],
      [-14.4, 30],
      [-18, 48],
      [-27, 64],
      [-32, 75],
      [-36, 84],
    ]) {
      expect(collidableRects(FAMILY_HOUSE, 'second').some((rect) => circleVsAabb(x!, z!, KART_WALL_COLLIDER_RADIUS, rectToAabb(rect)))).toBe(false);
      const fromX = progress.previousX;
      const fromZ = progress.previousZ;
      for (let step = 1; step <= 100; step += 1)
        updateProgress(FAMILY_HOUSE, 1, progress, fromX + ((x! - fromX) * step) / 100, fromZ + ((z! - fromZ) * step) / 100, 100, 'second');
    }
    expect(progress.finished).toBe(true);
  });
  it('keeps the kitchen approach and final bedroom passage free of oversized furniture proxies', () => {
    for (const [levelId, x, z] of [
      ['first', 15, 78],
      ['first', 32, 79],
      ['second', -34, 79],
      ['second', -30, 33],
    ] as const) {
      expect(
        collidableRects(FAMILY_HOUSE, levelId).some((rect) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, rectToAabb(rect))),
        `${levelId}: ${x}/${z}`,
      ).toBe(false);
    }
  });
  it('keeps the full rendered kart outside a house wall after another kart pushes it sideways', () => {
    const { routeBanks: _banks, ...base } = FAMILY_HOUSE;
    const map = {
      ...base,
      levels: [{ id: 'ground', name: 'Test', floorHeight: 0, ceilingHeight: 60, collisionRects: [{ x: 0, z: 0, width: 0.4, depth: 20 }] }],
    };
    const first = createKartState(-1.4, 0, 0, 'ground');
    const second = createKartState(-2.8, 0, 0, 'ground');
    stepAllKarts(DEFAULT_DRIVING, map, [first, second], [NEUTRAL_INPUT, NEUTRAL_INPUT], 1 / 60);
    expect(first.x).toBeLessThanOrEqual(-0.2 - KART_WALL_COLLIDER_RADIUS + 1e-7);
  });
  it('finishes when the player cuts the final corner inside the legal road rather than visiting its centre node', () => {
    const progress = createProgress(-27, 64, 'second');
    progress.nextCheckpoint = FAMILY_HOUSE.checkpoints.findIndex((gate) => gate.name === 'Zielraum');
    const points = [
      [-27, 64],
      [-32, 75],
      [-36, 84],
    ] as const;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!;
      const to = points[index]!;
      for (let step = 1; step <= 100; step += 1) {
        const x = from[0] + ((to[0] - from[0]) * step) / 100;
        const z = from[1] + ((to[1] - from[1]) * step) / 100;
        expect(collidableRects(FAMILY_HOUSE, 'second').some((rect) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, rectToAabb(rect)))).toBe(false);
        updateProgress(FAMILY_HOUSE, 1, progress, x, z, step / 60, 'second');
      }
    }
    expect(progress.finished).toBe(true);
  });
  it.each([
    ['sofa', -15, 70, -27, 70, 0, 'x'],
    ['coffee table', -45, 58, -45, 80, -Math.PI / 2, 'z'],
    ['desk', 10, 60, 0, 60, 0, 'x'],
    ['cabinet', -66, 42, -66, 60, -Math.PI / 2, 'z'],
  ] as const)('blocks the visible living-room %s without requiring the marked route', (_name, x, z, startX, startZ, yaw, axis) => {
    const rects = collidableRects(FAMILY_HOUSE, 'ground');
    expect(rects.some((rect) => isInsideRect(rect, x, z))).toBe(true);
    const kart = createKartState(startX, startZ, yaw, 'ground');
    for (let tick = 0; tick < 180; tick += 1) stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
    expect(rects.some((rect) => isInsideRect(rect, kart.x, kart.z))).toBe(false);
    expect(axis === 'x' ? kart.x < x : kart.z > z).toBe(true);
  });
  it('keeps the start approach free until the new visible outside turn boundary', () => {
    for (const z of [84.4, 86.4, 88.4]) {
      const kart = createKartState(-63, z, 0, 'ground');
      for (let tick = 0; tick < 210; tick += 1) stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
      expect(kart.x).toBeGreaterThan(-33);
      expect(kart.x).toBeLessThan(-15);
      expect(kart.penaltySecondsLeft).toBe(0);
    }
  });
  it('does not keep displaced furniture colliders on visibly empty floor', () => {
    for (const [x, z] of [
      [-45, 73],
      [-57, 45],
      [-4, 70],
    ] as const) {
      expect(collidableRects(FAMILY_HOUSE, 'ground').some((rect) => circleVsAabb(x, z, KART_COLLIDER_RADIUS, rectToAabb(rect)))).toBe(false);
    }
  });
  it('provides collision-free continuous driving through every room on each floor', () => {
    const nodes = FAMILY_HOUSE.routeNodes!;
    for (let index = 1; index < nodes.length; index += 1) {
      const from = nodes[index - 1]!;
      const to = nodes[index]!;
      if (from.levelId !== to.levelId) continue;
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z));
      for (let step = 0; step <= steps; step += 1) {
        const x = from.x + ((to.x - from.x) * step) / steps;
        const z = from.z + ((to.z - from.z) * step) / steps;
        expect(isOnRouteSurface(FAMILY_HOUSE, x, z, from.levelId), `Surface segment ${index}`).toBe(true);
        const blocked = collidableRects(FAMILY_HOUSE, from.levelId).some((rect) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, rectToAabb(rect)));
        expect(blocked, `Collision segment ${index} at ${x}, ${z}`).toBe(false);
      }
    }
    for (const room of FAMILY_HOUSE.namedRooms!) {
      expect(
        nodes.some((node) => node.levelId === room.levelId && isInsideRect(room.rect, node.x, node.z)),
        room.name,
      ).toBe(true);
    }
  });

  it('requires crossing the stair in its ascent direction, not entering its side', () => {
    const stair = FAMILY_HOUSE.stairTransitions![0]!;
    const { x, z, width } = stair.rect;
    const kart = createKartState(x, z - 1, 0);
    updateKartStair(FAMILY_HOUSE, kart, x - width, z - 1);
    expect(kart.stairTransitionId).toBeNull();
    expect(kart.levelId).toBe('ground');
    expect(kartElevationAt(FAMILY_HOUSE, kart)).toBeCloseTo(0, 3);
  });

  it('keeps height continuous and distinguishes stacked stairs during ascent and descent', () => {
    const first = FAMILY_HOUSE.stairTransitions![0]!;
    const second = FAMILY_HOUSE.stairTransitions![1]!;
    const { x, z, depth } = first.rect;
    const bottom = z + depth / 2;
    const top = z - depth / 2;
    const kart = createKartState(x, bottom - 0.1, 0);
    updateKartStair(FAMILY_HOUSE, kart, x, bottom + 1);
    expect(kart.stairTransitionId).toBe(first.name);
    kart.z = z - 0.1;
    updateKartStair(FAMILY_HOUSE, kart, x, z + 0.1);
    expect(kart.levelId).toBe('first');
    expect(kartElevationAt(FAMILY_HOUSE, kart)).toBeCloseTo(30 + (0.1 * 60) / depth, 3);
    kart.z = top - 1;
    updateKartStair(FAMILY_HOUSE, kart, x, top + 0.1);
    expect(kart.stairTransitionId).toBeNull();
    expect(kartElevationAt(FAMILY_HOUSE, kart)).toBeCloseTo(60, 3);
    kart.z = bottom - 0.1;
    updateKartStair(FAMILY_HOUSE, kart, x, bottom + 1);
    expect(kart.stairTransitionId).toBe(second.name);
    kart.z = z - 0.1;
    updateKartStair(FAMILY_HOUSE, kart, x, z + 0.1);
    expect(kartElevationAt(FAMILY_HOUSE, kart)).toBeCloseTo(90 + (0.1 * 60) / depth, 3);
    kart.levelId = 'first';
    kart.stairTransitionId = null;
    kart.z = top + 0.1;
    updateKartStair(FAMILY_HOUSE, kart, x, top - 1);
    expect(kart.stairTransitionId).toBe(first.name);
    kart.z = z + 0.1;
    updateKartStair(FAMILY_HOUSE, kart, x, z - 0.1);
    expect(kart.levelId).toBe('ground');
  });

  it('has separate geometry at identical coordinates on different floors', () => {
    const wall = FAMILY_HOUSE.levels![0]!.collisionRects[6]!;
    expect(collidableRects(FAMILY_HOUSE, 'ground').some((rect) => isInsideRect(rect, wall.x, wall.z))).toBe(true);
    expect(collidableRects(FAMILY_HOUSE, 'second')).not.toEqual(collidableRects(FAMILY_HOUSE, 'ground'));
  });
});
