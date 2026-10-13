import { describe, expect, it } from 'vitest';
import { circleVsAabb, rectToAabb, resolveBodyVsBody, resolveBodyVsRects, type Body } from '../../../src/games/kart/maps/shared/collision';
import { RING_TEST_MAP } from '../../support/ringTestMap';
import { collidableRects, isOnRouteSurface } from '../../../src/games/kart/maps/shared/surface';
import { KART_DIMENSIONS } from '../../../src/shared/config/kart';
import { stepAllKarts } from '../../../src/games/kart/kart/kartSimulation';
import { createKartState } from '../../../src/games/kart/kart/kartState';
import { NEUTRAL_INPUT } from '../../../src/shared/input/actions';
import { DEFAULT_DRIVING } from '../../../src/shared/config/driving';

const wall = { x: 0, z: 0, width: 4, depth: 4 };

function bodyAt(x: number, z: number, velocityX: number, velocityZ: number): Body {
  return { x, z, velocityX, velocityZ };
}

describe('circleVsAabb', () => {
  it('reports no contact when the circle is clear of the box', () => {
    expect(circleVsAabb(5, 0, 0.5, rectToAabb(wall))).toBeNull();
  });

  it('reports the face normal when the circle overlaps a side', () => {
    const contact = circleVsAabb(2.3, 0, 0.5, rectToAabb(wall));
    expect(contact).toMatchObject({ normalX: 1, normalZ: 0 });
    expect(contact?.penetration).toBeCloseTo(0.2);
  });

  it('pushes out along the nearest face when the centre is inside the box', () => {
    const contact = circleVsAabb(1.5, 0, 0.5, rectToAabb(wall));
    expect(contact).toMatchObject({ normalX: 1, normalZ: 0 });
    expect(contact?.penetration).toBeCloseTo(1);
  });
});

describe('resolveBodyVsRects', () => {
  it('bounces a body off a wall and keeps the tangential speed', () => {
    const body = bodyAt(2.3, 0, 3, 1);
    expect(resolveBodyVsRects(body, 0.5, [wall], 0.4)).toBe(true);
    expect(body.x).toBeCloseTo(2.5);
    expect(body.velocityZ).toBeCloseTo(1);
  });

  it('reflects a body driving into the wall', () => {
    const body = bodyAt(-2.3, 0, 3, 0);
    resolveBodyVsRects(body, 0.5, [wall], 0.5);
    expect(body.velocityX).toBeCloseTo(-1.5);
  });

  it('leaves a body untouched when nothing overlaps', () => {
    const body = bodyAt(10, 10, 2, 2);
    expect(resolveBodyVsRects(body, 0.5, [wall], 0.4)).toBe(false);
    expect(body).toEqual(bodyAt(10, 10, 2, 2));
  });
});

describe('resolveBodyVsBody', () => {
  it('pushes overlapping karts apart and slows both down', () => {
    const first = bodyAt(0, 0, 4, 0);
    const second = bodyAt(0.8, 0, 0, 0);
    expect(resolveBodyVsBody(first, second, 0.5, 0.5, 0.1)).toBe(true);
    expect(second.x - first.x).toBeCloseTo(1);
    expect(first.velocityX).toBeLessThan(4);
    expect(second.velocityX).toBeGreaterThan(0);
  });

  it('ignores karts that are far apart', () => {
    expect(resolveBodyVsBody(bodyAt(0, 0, 0, 0), bodyAt(5, 0, 0, 0), 0.5, 0.5, 0.1)).toBe(false);
  });
});

describe('ring test map', () => {
  it('keeps the central furniture inside the offroad island', () => {
    const centralFurniture = ['Sofa', 'Couchtisch'];
    for (const obstacle of RING_TEST_MAP.obstacles) {
      if (!centralFurniture.includes(obstacle.name)) continue;
      expect(isOnRouteSurface(RING_TEST_MAP, obstacle.rect.x, obstacle.rect.z)).toBe(false);
    }
  });

  it('keeps every start position on the route and clear of obstacles', () => {
    for (const start of RING_TEST_MAP.startPositions) {
      expect(isOnRouteSurface(RING_TEST_MAP, start.x, start.z)).toBe(true);
      const body = bodyAt(start.x, start.z, 0, 0);
      expect(resolveBodyVsRects(body, 0.7, collidableRects(RING_TEST_MAP), 0)).toBe(false);
    }
  });

  it('offers a ring wide enough for four karts side by side', () => {
    expect(RING_TEST_MAP.driveableWidth).toBeGreaterThanOrEqual(KART_DIMENSIONS.width * 4);
  });

  it('keeps every waypoint on the route and clear of obstacles', () => {
    for (const waypoint of RING_TEST_MAP.waypoints) {
      expect(isOnRouteSurface(RING_TEST_MAP, waypoint.x, waypoint.z)).toBe(true);
      const body = bodyAt(waypoint.x, waypoint.z, 0, 0);
      expect(resolveBodyVsRects(body, 1.5, collidableRects(RING_TEST_MAP), 0)).toBe(false);
    }
  });
});

describe('level-separated collisions', () => {
  it('does not collide karts with matching x/z on different house levels', () => {
    const first = createKartState(0, 0, 0, 'ground');
    const second = createKartState(0, 0, 0, 'upper');
    stepAllKarts(DEFAULT_DRIVING, RING_TEST_MAP, [first, second], [NEUTRAL_INPUT, NEUTRAL_INPUT], 1 / 60);
    expect(first.x).toBe(0);
    expect(second.x).toBe(0);
  });
});
