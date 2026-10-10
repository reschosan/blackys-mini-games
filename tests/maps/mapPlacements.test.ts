import { describe, expect, it } from 'vitest';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import type { MapConfig } from '../../src/games/kart/maps/shared/mapConfig';
import type { MapPlacement } from '../../src/games/kart/maps/shared/mapSettings';
import { placementPoseAt, placementRouteLength, withMapPlacements } from '../../src/games/kart/maps/shared/mapPlacements';
import { createItemBoxStates, stepItemBoxes } from '../../src/games/kart/items/itemBoxes';
import { createKartState, stepKart } from '../../src/games/kart/kart/kartState';
import { createRuntimeItems } from '../../src/shared/config/items';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { createRng } from '../../src/shared/core/rng';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { updateWindowJump } from '../../src/games/kart/maps/shared/windowJumps';

const STRAIGHT: MapConfig = {
  ...RING_TEST_MAP,
  walls: [],
  obstacles: [],
  waypoints: [
    { x: 0, z: 0 },
    { x: 50, z: 0 },
    { x: 100, z: 0 },
  ],
  raceFormat: 'pointToPoint',
};
const ITEM_JUMP = { type: 'itemJump', id: 'reward', level: 0, meter: 20, item: 'nap' } as const;

describe('distance-authored map placements', () => {
  it('keeps prototype item locations on their existing waypoint lines', () => {
    expect(RING_TEST_MAP.itemBoxes.map(({ x, z }) => [x, z])).toEqual([
      [51, -21.5],
      [-25.5, -43],
      [-51, 21.5],
      [25.5, 43],
    ]);
    expect(placementRouteLength(RING_TEST_MAP, 0)).toBe(376);
  });

  it('places independent contents side by side perpendicular to driving direction', () => {
    const map = withMapPlacements(STRAIGHT, [{ type: 'itemBoxes', level: 0, meter: 25, items: ['hairball', 'random', 'nap'] }]);
    expect(map.itemBoxes).toEqual([
      { x: 25, z: -3, levelId: 'ground', item: 'hairball' },
      { x: 25, z: 0, levelId: 'ground' },
      { x: 25, z: 3, levelId: 'ground', item: 'nap' },
    ]);
  });

  it('counts each numeric floor from its first route point even when starting above ground', () => {
    const map: MapConfig = {
      ...FAMILY_HOUSE,
      levels: [...FAMILY_HOUSE.levels!].reverse(),
      routeNodes: [
        { x: 0, z: 0, levelId: 'second' },
        { x: 0, z: 100, levelId: 'second' },
        { x: 0, z: 0, levelId: 'first' },
        { x: 0, z: 100, levelId: 'first' },
      ],
    };
    expect(placementPoseAt(map, 2, 25)).toMatchObject({ x: 0, z: 25, levelId: 'second' });
    expect(placementPoseAt(map, 1, 25)).toMatchObject({ x: 0, z: 25, levelId: 'first' });
    expect(() => placementPoseAt(map, 0, 25)).toThrow('outside');
  });

  it('does not join disconnected visits to the same floor across other floors', () => {
    const map: MapConfig = {
      ...FAMILY_HOUSE,
      routeNodes: [
        { x: 0, z: 0, levelId: 'first' },
        { x: 20, z: 0, levelId: 'first' },
        { x: 100, z: 100, levelId: 'second' },
        { x: 200, z: 100, levelId: 'second' },
        { x: 300, z: 0, levelId: 'first' },
        { x: 320, z: 0, levelId: 'first' },
      ],
    };
    expect(placementRouteLength(map, 1)).toBe(40);
    expect(placementPoseAt(map, 1, 25)).toMatchObject({ x: 305, z: 0 });
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid distance %s instead of clamping silently', (meter) => {
    expect(() => placementPoseAt(STRAIGHT, 0, meter)).toThrow('outside');
  });

  it.each([-1, 0.5, 1, Number.NaN])('rejects unknown or invalid flat-map floor %s', (level) => {
    expect(() => placementPoseAt(STRAIGHT, level, 10)).toThrow();
  });

  it('supports the exact route end and turns with outgoing headings', () => {
    const map = {
      ...STRAIGHT,
      waypoints: [
        { x: 0, z: 0 },
        { x: 20, z: 0 },
        { x: 20, z: 20 },
      ],
    };
    expect(placementPoseAt(map, 0, 20).yaw).toBeCloseTo(Math.PI / 2);
    expect(placementPoseAt(map, 0, 40)).toMatchObject({ x: 20, z: 20 });
  });

  it('allows a plain ramp without spawning an item or reward', () => {
    const map = withMapPlacements(STRAIGHT, [{ type: 'jump', id: 'plain', level: 0, meter: 20 }]);
    expect(map.itemBoxes).toEqual([]);
    expect(map.windowJumps![0]).toMatchObject({ hasItem: false, optional: true, launchRect: { x: 20, z: 0 } });
  });

  it('places the reward at the flight apex and associates three seconds of boost with its jump', () => {
    const map = withMapPlacements(STRAIGHT, [ITEM_JUMP]);
    expect(map.itemBoxes[0]).toMatchObject({ x: 27.2, z: 0, item: 'nap', heightOffset: 3.325, jumpId: 'reward', boostSeconds: 3 });
  });

  it('supports a northbound jump with automatically rotated ramp, item and landing', () => {
    const map = withMapPlacements(
      {
        ...STRAIGHT,
        waypoints: [
          { x: 0, z: 100 },
          { x: 0, z: 0 },
        ],
      },
      [ITEM_JUMP],
    );
    expect(map.windowJumps![0]!.launchYaw).toBeCloseTo(-Math.PI / 2);
    expect(map.itemBoxes[0]!.x).toBeCloseTo(0);
    expect(map.itemBoxes[0]!.z).toBeCloseTo(72.8);
  });

  it('rejects a jump whose flight would land beyond the next turn', () => {
    const map = {
      ...STRAIGHT,
      waypoints: [
        { x: 0, z: 0 },
        { x: 30, z: 0 },
        { x: 30, z: 70 },
      ],
    };
    expect(() => withMapPlacements(map, [ITEM_JUMP])).toThrow('needs a straight');
  });

  it('rejects duplicate ids, empty rows, invalid spacing and solid obstacles', () => {
    expect(() => withMapPlacements(STRAIGHT, [ITEM_JUMP, ITEM_JUMP])).toThrow('duplicate');
    expect(() => withMapPlacements(STRAIGHT, [{ type: 'itemBoxes', level: 0, meter: 20, items: [] }])).toThrow('at least one');
    expect(() => withMapPlacements(STRAIGHT, [{ type: 'itemBoxes', level: 0, meter: 20, items: ['nap'], spacingMeters: 0 }])).toThrow('positive');
    expect(() => withMapPlacements({ ...STRAIGHT, walls: [{ x: 20, z: 0, width: 2, depth: 20 }] }, [ITEM_JUMP])).toThrow('intersects');
  });

  it('rejects rows outside the flat road and jumps through route dividers', () => {
    expect(() => withMapPlacements(STRAIGHT, [{ type: 'itemBoxes', level: 0, meter: 20, lateralMeters: 20, items: ['nap'] }])).toThrow('flat route width');
    expect(() => withMapPlacements({ ...STRAIGHT, routeDividers: [{ levelId: 'ground', rect: { x: 30, z: 0, width: 2, depth: 20 } }] }, [ITEM_JUMP])).toThrow(
      'intersects',
    );
  });

  it('accepts JSON-compatible data and resolves the same placement deterministically', () => {
    const placements = JSON.parse(JSON.stringify([ITEM_JUMP])) as MapPlacement[];
    expect(withMapPlacements(STRAIGHT, placements)).toEqual(withMapPlacements(STRAIGHT, placements));
  });

  it('grants fixed contents without consuming RNG and grants boost only on the matching airborne pickup', () => {
    const map = withMapPlacements(STRAIGHT, [ITEM_JUMP]);
    const box = map.itemBoxes[0]!;
    const kart = createKartState(box.x, box.z, 0);
    kart.windowJumpId = 'reward';
    kart.windowJumpElapsedSeconds = 0.4;
    const carrier = { state: kart, heldItem: null };
    const rng = createRng(10),
      untouched = createRng(10);
    stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrier], [1], rng, 1 / 60);
    expect(carrier.heldItem).toBe('nap');
    expect(kart.boostSeconds).toBe(3);
    expect(rng.next()).toBe(untouched.next());
    for (let tick = 0; tick < 24; tick += 1) updateWindowJump(map, kart, NEUTRAL_INPUT, 1 / 60);
    for (let tick = 0; tick < 156; tick += 1) stepKart(DEFAULT_DRIVING, kart, NEUTRAL_INPUT, 1 / 60);
    expect(kart.boostSeconds).toBeCloseTo(0, 8);
  });

  it('does not grant the jump item or boost to a ground kart or a kart already holding an item', () => {
    const map = withMapPlacements(STRAIGHT, [ITEM_JUMP]);
    const box = map.itemBoxes[0]!;
    const kart = createKartState(box.x, box.z, 0);
    const carrier = { state: kart, heldItem: null };
    stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrier], [1], createRng(1), 1 / 60);
    expect(carrier.heldItem).toBeNull();
    expect(kart.boostSeconds).toBe(0);
    const holding = { state: kart, heldItem: 'trap' as const };
    kart.windowJumpId = 'reward';
    kart.windowJumpElapsedSeconds = 0.4;
    stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [holding], [1], createRng(1), 1 / 60);
    expect(kart.boostSeconds).toBe(0);
  });

  it('requires the associated jump even when the reward height is tuned close to the ground', () => {
    const generated = withMapPlacements(STRAIGHT, [ITEM_JUMP]);
    const map = { ...generated, itemBoxes: [{ ...generated.itemBoxes[0]!, heightOffset: 0.1 }] };
    const kart = createKartState(map.itemBoxes[0]!.x, map.itemBoxes[0]!.z, 0);
    const carrier = { state: kart, heldItem: null };
    stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrier], [1], createRng(1), 1 / 60);
    expect(carrier.heldItem).toBeNull();
    expect(kart.boostSeconds).toBe(0);
  });
});
