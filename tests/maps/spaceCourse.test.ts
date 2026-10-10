import { readdirSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { aiGuideLine } from '../../src/games/kart/ai/aiGuideLine';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { KART_WALL_COLLIDER_RADIUS } from '../../src/shared/config/kart';
import { NATURE_CORNERS, NATURE_LOGS } from '../../src/games/kart/maps/nature/course';
import { SPACE_BARRIERS, SPACE_BOUNDARIES, SPACE_CORNERS, SPACE_SURFACES, SPACE_WIDTH } from '../../src/games/kart/maps/space/course';
import {
  SPACE_ALL_MODELS,
  SPACE_CHARACTER_PLACEMENTS,
  SPACE_FLYING_SHIPS,
  SPACE_LANDMARKS,
  SPACE_PLANET_PLACEMENTS,
  SPACE_STARS,
} from '../../src/games/kart/maps/space/scenery';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { SPACE } from '../../src/games/kart/maps/space/map';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { centrelineOf } from '../../src/games/kart/race/routeProgress';
import { segmentsCross } from '../../src/games/kart/race/raceState';
import { circleVsAabb, rectToAabb } from '../../src/games/kart/maps/shared/collision';
import { clearanceFromRoute } from '../../src/games/kart/maps/shared/view/sceneryInstancing';
import { scatterSpots } from '../../src/games/kart/maps/space/view/spaceProps';
import { isOnRouteSurface, routeSurfaceSpeedFactor } from '../../src/games/kart/maps/shared/surface';
import { createMapView, disposeMapView } from '../../src/games/kart/maps/shared/view/mapView';

const MINIMUM_CENTRELINE_SEPARATION_METERS = 40;
const CAMERA_FAR_PLANE_METERS = 1000;

function cornerCount(points: readonly { readonly x: number; readonly z: number }[]): number {
  return points.filter((point, index) => {
    const before = points[(index + points.length - 1) % points.length]!;
    const after = points[(index + 1) % points.length]!;
    const inX = point.x - before.x,
      inZ = point.z - before.z;
    const outX = after.x - point.x,
      outZ = after.z - point.z;
    return Math.abs(Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ)) >= 0.4;
  }).length;
}

function distanceBetweenAxisSegments(
  a: readonly [{ x: number; z: number }, { x: number; z: number }],
  b: readonly [{ x: number; z: number }, { x: number; z: number }],
): number {
  const gap = (minA: number, maxA: number, minB: number, maxB: number): number => Math.max(0, minB - maxA, minA - maxB);
  const dx = gap(Math.min(a[0].x, a[1].x), Math.max(a[0].x, a[1].x), Math.min(b[0].x, b[1].x), Math.max(b[0].x, b[1].x));
  const dz = gap(Math.min(a[0].z, a[1].z), Math.max(a[0].z, a[1].z), Math.min(b[0].z, b[1].z), Math.max(b[0].z, b[1].z));
  return Math.hypot(dx, dz);
}

describe('space course layout', () => {
  it('is a closed two-lap course as long as the house and nature courses', () => {
    expect(SPACE.lapCount).toBe(2);
    const length = centrelineOf(SPACE).totalLength;
    const natureLength = centrelineOf(NATURE).totalLength;
    expect(length).toBeGreaterThanOrEqual(1700);
    expect(length).toBeLessThanOrEqual(2000);
    expect(Math.abs(length / natureLength - 1)).toBeLessThan(0.08);
  });

  it('has at least as many corners and barriers as the nature course', () => {
    expect(cornerCount(SPACE_CORNERS)).toBeGreaterThanOrEqual(cornerCount(NATURE_CORNERS));
    expect(SPACE_BARRIERS.length).toBeGreaterThanOrEqual(NATURE_LOGS.length);
    expect(SPACE.boostFields?.length).toBeGreaterThanOrEqual(1);
    expect(SPACE.windowJumps?.some((jump) => jump.hasItem)).toBe(true);
    expect(SPACE.itemBoxes.length).toBeGreaterThanOrEqual(10);
  });

  it('never lets two route parts come closer than the corridor plus a safety gap', () => {
    const points = SPACE_CORNERS;
    for (let index = 0; index < points.length; index += 1) {
      for (let other = index + 2; other < points.length; other += 1) {
        if (index === 0 && other === points.length - 1) continue;
        const separation = distanceBetweenAxisSegments(
          [points[index]!, points[(index + 1) % points.length]!],
          [points[other]!, points[(other + 1) % points.length]!],
        );
        expect(separation, `segments ${index}/${other}`).toBeGreaterThanOrEqual(MINIMUM_CENTRELINE_SEPARATION_METERS);
      }
    }
  });

  it('has no route crossings and every AI lane clears the closed walls', () => {
    const points = SPACE.waypoints;
    const walls = SPACE.walls.map(rectToAabb);
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
      const guide = aiGuideLine(SPACE, slot).points;
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

  it('keeps barriers inside the corridor with a passable gap and away from start, gates and boosts', () => {
    for (const barrier of SPACE_BARRIERS) {
      const passableGap = SPACE_WIDTH - Math.max(barrier.width, barrier.depth);
      expect(passableGap).toBeGreaterThanOrEqual(8);
      expect(isOnRouteSurface(SPACE, barrier.x, barrier.z)).toBe(true);
      for (const start of SPACE.startPositions) expect(Math.hypot(start.x - barrier.x, start.z - barrier.z)).toBeGreaterThan(30);
      for (const gate of SPACE.checkpoints) expect(Math.hypot((gate.ax + gate.bx) / 2 - barrier.x, (gate.az + gate.bz) / 2 - barrier.z)).toBeGreaterThan(20);
      for (const field of SPACE.boostFields ?? []) expect(Math.hypot(field.rect.x - barrier.x, field.rect.z - barrier.z)).toBeGreaterThan(20);
    }
  });

  it('closes both rail loops without gaps', () => {
    const loopSize = SPACE_CORNERS.length;
    expect(SPACE_BOUNDARIES).toHaveLength(loopSize * 2);
    for (let loop = 0; loop < 2; loop += 1) {
      for (let index = 0; index < loopSize; index += 1) {
        const current = SPACE_BOUNDARIES[loop * loopSize + index]!;
        const next = SPACE_BOUNDARIES[loop * loopSize + ((index + 1) % loopSize)]!;
        const overlapX = Math.min(current.x + current.width / 2, next.x + next.width / 2) - Math.max(current.x - current.width / 2, next.x - next.width / 2);
        const overlapZ = Math.min(current.z + current.depth / 2, next.z + next.depth / 2) - Math.max(current.z - current.depth / 2, next.z - next.depth / 2);
        expect(Math.min(overlapX, overlapZ), `loop ${loop} rail ${index}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps karts on the route when they drive straight into every corner from every side', () => {
    const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    for (const corner of SPACE_CORNERS) {
      for (const yaw of yaws) {
        const kart = createKartState(corner.x, corner.z, yaw);
        for (let tick = 0; tick < 180; tick += 1) {
          stepAllKarts(DEFAULT_DRIVING, SPACE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
          expect(isOnRouteSurface(SPACE, kart.x, kart.z), `${corner.x}/${corner.z}/${yaw} tick ${tick}`).toBe(true);
        }
      }
    }
  });

  it('slows karts on the dust shoulder like the nature grass shoulder', () => {
    expect(SPACE.shoulder).toEqual(NATURE.shoulder);
    expect(routeSurfaceSpeedFactor(SPACE, 220, 80)).toBe(1);
    expect(routeSurfaceSpeedFactor(SPACE, 231, 80)).toBe(0.9);
  });

  it('places the start grid on the start straight behind the finish line', () => {
    const finish = SPACE.checkpoints[0]!;
    for (const start of SPACE.startPositions) {
      expect(isOnRouteSurface(SPACE, start.x, start.z)).toBe(true);
      expect(start.z).toBeGreaterThan(finish.az);
    }
  });
});

describe('space scenery', () => {
  const files = readdirSync('public/models/space-pack')
    .filter((file) => file.endsWith('.glb'))
    .map((file) => file.replace(/\.glb$/, ''));

  it('uses every model of the space pack and references no missing one', () => {
    expect([...SPACE_ALL_MODELS].sort()).toEqual([...files].sort());
    expect(new Set(SPACE_ALL_MODELS).size).toBe(SPACE_ALL_MODELS.length);
  });

  it('keeps landmarks and characters off the course', () => {
    for (const landmark of SPACE_LANDMARKS) {
      expect(clearanceFromRoute(SPACE, landmark.x, landmark.z), landmark.asset).toBeGreaterThanOrEqual(landmark.radius + 6);
    }
    for (const character of SPACE_CHARACTER_PLACEMENTS) {
      expect(clearanceFromRoute(SPACE, character.x, character.z), character.asset).toBeGreaterThanOrEqual(12);
    }
  });

  it('scatters props deterministically around the course but never on it', () => {
    const first = scatterSpots(SPACE);
    const second = scatterSpots(SPACE);
    expect([...first.keys()]).toEqual([...second.keys()]);
    const all = [...first.values()].flat();
    expect(all.length).toBeGreaterThanOrEqual(300);
    for (const spot of all) expect(clearanceFromRoute(SPACE, spot.x, spot.z)).toBeGreaterThanOrEqual(9);
    expect(SPACE_SURFACES.length).toBeGreaterThan(0);
  });

  it('keeps sky objects within the camera far plane from every point of the course', () => {
    const farthestCameraOffset = Math.max(
      ...SPACE_SURFACES.map((surface) =>
        Math.hypot(Math.abs(surface.x - SPACE.room.x) + surface.width / 2, Math.abs(surface.z - SPACE.room.z) + surface.depth / 2),
      ),
    );
    for (const planet of SPACE_PLANET_PLACEMENTS) {
      expect(planet.distanceMeters + farthestCameraOffset).toBeLessThan(CAMERA_FAR_PLANE_METERS);
    }
    expect(SPACE_STARS.radiusMeters + farthestCameraOffset).toBeLessThan(CAMERA_FAR_PLANE_METERS);
    expect(new Set(SPACE_PLANET_PLACEMENTS.map((planet) => planet.asset)).size).toBe(SPACE_PLANET_PLACEMENTS.length);
  });

  it('flies every spaceship low enough to be seen by the follow camera at least on the course loop', () => {
    expect(SPACE_FLYING_SHIPS.length).toBeGreaterThanOrEqual(4);
    expect(SPACE_FLYING_SHIPS.some((ship) => ship.path === 'course' && ship.heightMeters <= 25)).toBe(true);
  });

  it('builds and disposes the textured course view without loading models', () => {
    const view = createMapView(SPACE, false);
    const meshes: THREE.Mesh[] = [];
    view.traverse((node) => {
      if (node instanceof THREE.Mesh) meshes.push(node);
    });
    expect(meshes.length).toBeGreaterThan(SPACE_BOUNDARIES.length * 2);
    expect(view.children.find((child) => child.userData.finishLine === true)?.userData.checkpointIndex).toBe(0);
    expect(() => disposeMapView(view)).not.toThrow();
  });
});
