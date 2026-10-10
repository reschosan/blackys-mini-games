import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { houseCameraClearance, houseViewLevelId, setHouseOccludedCameraPosition } from '../../src/games/kart/maps/familyHouse/view/houseOcclusion';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';

describe('configured house camera occlusion', () => {
  it('checks the floor actually rendered while ascending a stacked stair', () => {
    const stair = FAMILY_HOUSE.stairTransitions![0]!;
    expect(houseViewLevelId(FAMILY_HOUSE, { x: -51, z: -21, levelId: 'first', elevation: 30, stairTransitionId: stair.name })).toBe('ground');
    expect(houseViewLevelId(FAMILY_HOUSE, { x: -51, z: -54, levelId: 'first', elevation: 60, stairTransitionId: stair.name })).toBe('first');
  });
  it('keeps a low rear-quarter view instead of jumping above the kart at a wall', () => {
    const origin = new THREE.Vector3(-27, 62, -85.8);
    const position = origin.clone().add(new THREE.Vector3(-18, 5, 0));
    const direction = position.clone().sub(origin).normalize();
    setHouseOccludedCameraPosition(FAMILY_HOUSE, 'first', origin, direction, 0.2, position);
    expect(position.y - origin.y).toBeLessThan(5);
    expect(Math.hypot(position.x - origin.x, position.z - origin.z)).toBeGreaterThan(0.5);
    expect((position.y - origin.y) / position.distanceTo(origin)).toBeCloseTo(direction.y, 5);
    expect(houseCameraClearance(FAMILY_HOUSE, 'first', origin, position.clone().sub(origin).normalize(), position.distanceTo(origin))).toBeGreaterThanOrEqual(
      position.distanceTo(origin),
    );
  });
  it('stops before solid furniture without raycasting model triangles', () => {
    const distance = houseCameraClearance(FAMILY_HOUSE, 'ground', new THREE.Vector3(-27, 2, 70), new THREE.Vector3(1, 0, 0), 20);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(7);
  });
  it('never considers furniture on another floor', () => {
    expect(houseCameraClearance(FAMILY_HOUSE, 'first', new THREE.Vector3(-27, 2, 70), new THREE.Vector3(1, 0, 0), 20)).toBe(20);
  });
  it('leaves clear approach space between subject and camera intact', () => {
    expect(houseCameraClearance(FAMILY_HOUSE, 'ground', new THREE.Vector3(-45, 2, 86.4), new THREE.Vector3(-1, 0, 0), 10)).toBe(10);
  });
  it('keeps the camera on the visible side of the hobby-room entrance wall', () => {
    const direction = new THREE.Vector3(-1, Math.tan((20 * Math.PI) / 180), 0).normalize();
    const origin = new THREE.Vector3(-1.6513, 62, -87.6592);
    const clearance = houseCameraClearance(FAMILY_HOUSE, 'first', origin, direction, 18);
    expect(origin.x + direction.x * (clearance - 0.5)).toBeGreaterThan(-9.598);
  });
});
