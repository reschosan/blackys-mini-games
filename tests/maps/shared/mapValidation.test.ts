import { describe, expect, it } from 'vitest';
import { KART_COLLIDER_RADIUS, KART_WALL_COLLIDER_RADIUS } from '../../../src/shared/config/kart';
import { createKartState } from '../../../src/games/kart/kart/kartState';
import { stepAllKarts } from '../../../src/games/kart/kart/kartSimulation';
import { NEUTRAL_INPUT } from '../../../src/shared/input/actions';
import { aiGuideLine } from '../../../src/games/kart/ai/aiGuideLine';
import { DEFAULT_DRIVING } from '../../../src/shared/config/driving';
import { FAMILY_HOUSE } from '../../../src/games/kart/maps/familyHouse/map';
import { NATURE } from '../../../src/games/kart/maps/nature/map';
import { NATURE_CORNERS, NATURE_LOGS } from '../../../src/games/kart/maps/nature/course';
import { AVAILABLE_MAPS } from '../../../src/games/kart/maps/registry';
import { buildWalls, type MapConfig } from '../../../src/games/kart/maps/shared/mapConfig';
import { centrelineOf } from '../../../src/games/kart/race/routeProgress';
import { segmentsCross } from '../../../src/games/kart/race/raceState';
import { circleVsAabb, rectToAabb } from '../../../src/games/kart/maps/shared/collision';
import { validateMap } from '../../../src/games/kart/maps/shared/mapValidation';
import { isOnRouteSurface, routeSurfaceSpeedFactor } from '../../../src/games/kart/maps/shared/surface';
import { ringSurfaces } from '../../support/ringTestMap';

const BASE_MAP: MapConfig = {
  name: 'Teststrecke',
  room: { x: 0, z: 0, width: 30, depth: 30 },
  wallHeight: 3,
  wallThickness: 1,
  driveableSurfaces: ringSurfaces({ x: 0, z: 0, width: 10, depth: 10 }, 5),
  driveableWidth: 5,
  walls: buildWalls({ x: 0, z: 0, width: 30, depth: 30 }, 1),
  obstacles: [{ name: 'Island table', rect: { x: 0, z: 0, width: 3, depth: 3 }, height: 1 }],
  checkpoints: [
    { ax: 5, az: 0, bx: 10, bz: 0 },
    { ax: 0, az: -5, bx: 0, bz: -10 },
    { ax: -5, az: 0, bx: -10, bz: 0 },
    { ax: 0, az: 5, bx: 0, bz: 10 },
  ],
  waypoints: [
    { x: 7.5, z: 0 },
    { x: 7.5, z: -7.5 },
    { x: 0, z: -7.5 },
    { x: -7.5, z: -7.5 },
    { x: -7.5, z: 0 },
    { x: -7.5, z: 7.5 },
    { x: 0, z: 7.5 },
    { x: 7.5, z: 7.5 },
  ],
  startPositions: [
    { x: 6.5, z: 1.5, yaw: -Math.PI / 2 },
    { x: 8.5, z: 1.5, yaw: -Math.PI / 2 },
    { x: 6.5, z: 3.5, yaw: -Math.PI / 2 },
    { x: 8.5, z: 3.5, yaw: -Math.PI / 2 },
  ],
  itemBoxes: [
    { x: 7.5, z: -3.75 },
    { x: -3.75, z: -7.5 },
    { x: -7.5, z: 3.75 },
    { x: 3.75, z: 7.5 },
  ],
};

function map(overrides: Partial<MapConfig>): MapConfig {
  return { ...BASE_MAP, ...overrides };
}

function rulesFor(config: MapConfig): readonly string[] {
  return validateMap(config).map((error) => error.rule);
}

describe('map validation', () => {
  for (const registeredMap of AVAILABLE_MAPS) {
    it(`${registeredMap.name}: validates clean`, () => {
      expect(validateMap(registeredMap)).toEqual([]);
    });
  }

  it('registry lists the maps in the order of the map choice', () => {
    expect(AVAILABLE_MAPS.map((registeredMap) => registeredMap.name)).toEqual([
      'Naturpfad',
      'Einfamilienhaus',
      'Mondbasis',
      'Bauernhof',
      'Mittelalterstadt',
      'Großstadt bei Nacht',
    ]);
  });

  it('nature course is a closed two-lap map with house-scale distance and complete boundaries', () => {
    expect(NATURE.lapCount).toBe(2);
    expect(centrelineOf(NATURE).totalLength).toBeGreaterThanOrEqual(1700);
    expect(centrelineOf(NATURE).totalLength).toBeLessThanOrEqual(2000);
    expect(NATURE.walls).toHaveLength(54);
    expect(NATURE.walls.every((wall) => wall.width > 0 && wall.depth > 0)).toBe(true);
    expect(NATURE.followCamera?.pitchDegrees).toBe(20);
    expect(NATURE.boostFields?.length).toBeGreaterThanOrEqual(2);
    expect(NATURE.windowJumps?.some((jump) => jump.hasItem)).toBe(true);
  });

  it('nature course has at least twelve meaningful corners and slower grass shoulders', () => {
    const points = NATURE_CORNERS;
    const corners = points.filter((point, index) => {
      const before = points[(index + points.length - 1) % points.length]!;
      const after = points[(index + 1) % points.length]!;
      const inX = point.x - before.x,
        inZ = point.z - before.z;
      const outX = after.x - point.x,
        outZ = after.z - point.z;
      return Math.abs(Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ)) >= 0.4;
    });
    expect(corners.length).toBeGreaterThanOrEqual(12);
    expect(NATURE_LOGS).toHaveLength(12);
    expect(new Set(points.map((point) => point.x)).size).toBeGreaterThan(4);
    expect(new Set(points.map((point) => point.z)).size).toBeGreaterThan(4);
    expect(NATURE.shoulder?.widthFraction).toBe(0.1);
    expect(routeSurfaceSpeedFactor(NATURE, 230, 35)).toBe(1);
    expect(routeSurfaceSpeedFactor(NATURE, 240.5, 35)).toBe(0.9);
    expect(routeSurfaceSpeedFactor(NATURE, 219.5, 35)).toBe(0.9);
  });

  it('nature shoulder caps kart speed at ninety percent while occupied', () => {
    const centre = createKartState(230, 35, -Math.PI / 2);
    const shoulder = createKartState(240.5, 35, -Math.PI / 2);
    const throttle = { ...NEUTRAL_INPUT, accelerate: true };
    for (let tick = 0; tick < 120; tick += 1) {
      stepAllKarts(DEFAULT_DRIVING, NATURE, [centre], [throttle], 1 / 60);
      stepAllKarts(DEFAULT_DRIVING, NATURE, [shoulder], [throttle], 1 / 60);
    }
    expect(Math.hypot(centre.velocityX, centre.velocityZ)).toBeCloseTo(DEFAULT_DRIVING.maxSpeed);
    expect(Math.hypot(shoulder.velocityX, shoulder.velocityZ)).toBeCloseTo(DEFAULT_DRIVING.maxSpeed * 0.9);
  });

  it('nature course has no route crossings and every AI lane clears the closed walls', () => {
    const points = NATURE.waypoints;
    const walls = NATURE.walls.map(rectToAabb);
    for (let index = 0; index < points.length; index += 1) {
      const from = points[index]!;
      const to = points[(index + 1) % points.length]!;
      for (let other = index + 2; other < points.length; other += 1) {
        if ((other + 1) % points.length === index) continue;
        const a = points[other]!;
        const b = points[(other + 1) % points.length]!;
        expect(segmentsCross(from.x, from.z, to.x, to.z, a.x, a.z, b.x, b.z), `${index}/${other}`).toBe(false);
      }
    }
    for (let slot = 0; slot < 4; slot += 1) {
      const guide = aiGuideLine(NATURE, slot).points;
      for (let index = 0; index < guide.length; index += 1) {
        const from = guide[index]!;
        const to = guide[(index + 1) % guide.length]!;
        const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z));
        for (let step = 0; step <= steps; step += 1) {
          const x = from.x + ((to.x - from.x) * step) / steps;
          const z = from.z + ((to.z - from.z) * step) / steps;
          expect(
            walls.some((wall) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, wall)),
            `slot ${slot} segment ${index} metre ${step} at ${x.toFixed(2)},${z.toFixed(2)}`,
          ).toBe(false);
        }
      }
    }
  });

  it('nature course perimeter prevents karts from leaving or entering the central island', () => {
    const approaches = [
      [230, 0, 0],
      [230, 0, Math.PI],
      [-230, 0, Math.PI],
      [-230, 0, 0],
      [0, -130, -Math.PI / 2],
      [0, -130, Math.PI / 2],
      [0, 130, Math.PI / 2],
      [0, 130, -Math.PI / 2],
    ] as const;
    for (const [x, z, yaw] of approaches) {
      const kart = createKartState(x, z, yaw);
      for (let tick = 0; tick < 180; tick += 1) {
        stepAllKarts(DEFAULT_DRIVING, NATURE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
        expect(isOnRouteSurface(NATURE, kart.x, kart.z), `${x}/${z}/${yaw} tick ${tick}`).toBe(true);
      }
    }
  });

  it('family house needs at least 45 seconds per lap even at normal top speed', () => {
    expect(centrelineOf(FAMILY_HOUSE).totalLength / DEFAULT_DRIVING.maxSpeed).toBeGreaterThanOrEqual(45);
  });

  it('family house defines a connected three-level course with per-level rooms and item boxes', () => {
    expect(FAMILY_HOUSE.levels).toHaveLength(3);
    for (const level of FAMILY_HOUSE.levels ?? []) {
      expect(FAMILY_HOUSE.namedRooms?.filter((room) => room.levelId === level.id)).toHaveLength(3);
      expect(FAMILY_HOUSE.itemBoxes.some((box) => box.levelId === level.id)).toBe(true);
    }
    expect(FAMILY_HOUSE.doorways).toHaveLength(6);
    expect(FAMILY_HOUSE.stairTransitions).toHaveLength(2);
  });

  it('fails when the route is narrower than a kart diameter', () => {
    expect(rulesFor(map({ driveableWidth: KART_COLLIDER_RADIUS * 1.5 }))).toContain('routeWidth');
  });

  it('fails when a start position leaves the route', () => {
    expect(rulesFor(map({ startPositions: [{ ...BASE_MAP.startPositions[0]!, x: 0, z: 0 }] }))).toContain('startOnMap');
  });

  it('fails when start positions overlap', () => {
    expect(
      rulesFor(
        map({
          startPositions: [BASE_MAP.startPositions[0]!, { ...BASE_MAP.startPositions[0]!, x: BASE_MAP.startPositions[0]!.x + KART_COLLIDER_RADIUS }],
        }),
      ),
    ).toContain('startOverlap');
  });

  it('fails when a waypoint leaves the route', () => {
    expect(rulesFor(map({ waypoints: [{ ...BASE_MAP.waypoints[0]!, x: 0, z: 0 }] }))).toContain('waypointOnRoute');
  });

  it('fails when a checkpoint does not cross the route', () => {
    expect(rulesFor(map({ checkpoints: [{ ax: 0, az: 0, bx: 1, bz: 0 }] }))).toContain('checkpointCrossesRoute');
  });

  it('fails when an item box is too far away from the waypoint line', () => {
    expect(rulesFor(map({ itemBoxes: [{ x: 1, z: 1 }] }))).toContain('itemReachable');
  });

  it('fails when an obstacle intrudes into the route', () => {
    expect(rulesFor(map({ obstacles: [{ name: 'Bad chair', rect: { x: 7.5, z: 0, width: 1, depth: 1 }, height: 1 }] }))).toContain('obstacleIntrusion');
  });

  it('fails when an item box sits inside furniture', () => {
    expect(
      rulesFor(
        map({
          obstacles: [{ name: 'Bad chair', rect: { x: 7.5, z: -3.75, width: 1, depth: 1 }, height: 1 }],
          itemBoxes: [{ x: 7.5, z: -3.75 }],
        }),
      ),
    ).toContain('itemObstacle');
  });
});
