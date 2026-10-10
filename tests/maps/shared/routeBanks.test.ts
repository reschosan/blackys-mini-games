import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addHouseCeiling } from '../../../src/games/kart/maps/familyHouse/view/routeBankView';
import { FAMILY_HOUSE } from '../../../src/games/kart/maps/familyHouse/map';
import { DEFAULT_DRIVING } from '../../../src/shared/config/driving';
import { NEUTRAL_INPUT } from '../../../src/shared/input/actions';
import { createKartState } from '../../../src/games/kart/kart/kartState';
import { stepAllKarts } from '../../../src/games/kart/kart/kartSimulation';
import { collidableRects, kartElevationAt } from '../../../src/games/kart/maps/shared/surface';
import { circleVsAabb, rectToAabb } from '../../../src/games/kart/maps/shared/collision';
import { clearRouteBankLayout, reuseRouteBankLayout, routeBankHeight, routeBankLayout, routeBankTilt } from '../../../src/games/kart/maps/shared/routeBanks';

describe('banked house route', () => {
  it('doubles the road and bank widths and reuses preview layouts without sharing invalidation', () => {
    expect(FAMILY_HOUSE.routeBanks!.flatHalfWidth).toBeCloseTo(2 * 2.8, 5);
    expect(FAMILY_HOUSE.routeBanks!.width).toBeCloseTo(2 * 3, 5);
    const runtime = { ...FAMILY_HOUSE, routeBanks: { ...FAMILY_HOUSE.routeBanks! } };
    const original = routeBankLayout(FAMILY_HOUSE, 'ground');
    reuseRouteBankLayout(FAMILY_HOUSE, runtime);
    expect(routeBankLayout(runtime, 'ground')).toBe(original);
    clearRouteBankLayout(runtime);
    expect(routeBankLayout(runtime, 'ground')).not.toBe(original);
    expect(routeBankLayout(FAMILY_HOUSE, 'ground')).toBe(original);
  });
  it('closes each ceiling while retaining configured outgoing stair openings', () => {
    for (const level of FAMILY_HOUSE.levels!) {
      const group = new THREE.Group();
      addHouseCeiling(group, FAMILY_HOUSE, level);
      group.updateMatrixWorld(true);
      const hitAt = (x: number, z: number) =>
        new THREE.Raycaster(new THREE.Vector3(x, level.ceilingHeight - 1, z), new THREE.Vector3(0, 1, 0)).intersectObjects(group.children).length;
      expect(hitAt(0, 0)).toBeGreaterThan(0);
      const stair = FAMILY_HOUSE.stairTransitions!.find((entry) => entry.fromLevelId === level.id);
      if (stair) expect(hitAt(stair.rect.x, stair.rect.z)).toBe(0);
      for (const child of group.children) {
        expect(child.userData.levelId).toBe(level.id);
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
  });
  it.each([
    ['ground', -39, 90.8],
    ['ground', 21.3, 33],
    ['first', 47, 88.5],
    ['first', -15, 88.6],
    ['first', 7, 15.6],
    ['second', 30, 0],
    ['second', -22.4, 79.2],
  ] as const)('blocks inspected furniture and frames on %s at %s/%s', (levelId, x, z) => {
    expect(collidableRects(FAMILY_HOUSE, levelId).some((rect) => circleVsAabb(x, z, 0.855, rectToAabb(rect)) !== null)).toBe(true);
  });
  it('raises and lowers the kart continuously without changing its floor', () => {
    const kart = createKartState(40, -85.8, Math.PI / 2, 'ground');
    const heights = [0, 2, 4, 6, 8].map((offset) => {
      kart.z = -85.8 + offset;
      return kartElevationAt(FAMILY_HOUSE, kart);
    });
    expect(heights[0]).toBe(0);
    expect(heights[2]).toBe(0);
    expect(heights[3]).toBeCloseTo(0.1, 5);
    expect(heights[4]).toBeCloseTo(0.6, 5);
    expect(routeBankTilt(FAMILY_HOUSE, 'ground', 40, -77.8, Math.PI / 2).pitch).toBeCloseTo(Math.atan(0.25), 5);
    expect(routeBankTilt(FAMILY_HOUSE, 'ground', 40, -77.8, 0).roll).toBeCloseTo(-Math.atan(0.25), 5);
    expect(kart.levelId).toBe('ground');
    kart.z = -85.8;
    expect(kartElevationAt(FAMILY_HOUSE, kart)).toBe(0);
  });

  it('allows climbing the bank but blocks leaving through its outside wall', () => {
    const kart = createKartState(40, -85.8, Math.PI / 2, 'ground');
    let highest = 0;
    for (let tick = 0; tick < 180; tick += 1) {
      stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
      highest = Math.max(highest, kartElevationAt(FAMILY_HOUSE, kart));
    }
    expect(highest).toBeGreaterThan(0.5);
    expect(kart.z).toBeLessThan(-73);
    expect(kart.z).toBeGreaterThan(-77);
    expect(kart.levelId).toBe('ground');
  });

  it('keeps grid starts flat and leaves stairs to their own height profile', () => {
    for (const start of FAMILY_HOUSE.startPositions) expect(routeBankHeight(FAMILY_HOUSE, start.levelId!, start.x, start.z)).toBe(0);
    const stair = FAMILY_HOUSE.stairTransitions![0]!;
    expect(routeBankHeight(FAMILY_HOUSE, 'ground', stair.rect.x + 10, stair.rect.z)).toBe(0);
    expect(routeBankLayout(FAMILY_HOUSE, 'ground').walls.length).toBeGreaterThan(0);
    expect(routeBankLayout(FAMILY_HOUSE, 'first')).not.toBe(routeBankLayout(FAMILY_HOUSE, 'ground'));
  });
  it('physically separates the close outbound and returning hobby-room lanes', () => {
    const kart = createKartState(-6, -33, 0, 'first');
    for (let tick = 0; tick < 180; tick += 1) stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
    expect(kart.x).toBeLessThan(-1.2);
    expect(kart.levelId).toBe('first');
    expect(routeBankLayout(FAMILY_HOUSE, 'first').walls.some((rect) => rect.width === 0.4 && rect.depth === 52.8)).toBe(true);
  });
});
