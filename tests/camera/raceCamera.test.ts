import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RaceCamera } from '../../src/games/kart/camera/raceCamera';
import { createRuntimeCamera } from '../../src/shared/config/camera';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { kartElevationAt, routeElevationAt } from '../../src/games/kart/maps/shared/surface';

describe('RaceCamera', () => {
  it('immediately frames the recovery point after a window penalty ends on the same floor', () => {
    const camera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
    camera.setAspect(16 / 9);
    camera.update([{ x: -27, z: 96.5, yaw: Math.PI / 2, levelId: 'ground', elevation: 0, penaltySecondsLeft: 0.1 }], 1 / 60);
    const recovered = { x: -27, z: 119.4, yaw: 0, levelId: 'ground', elevation: 0, penaltySecondsLeft: 0 };
    camera.update([recovered], 1 / 60);
    camera.camera.updateMatrixWorld();
    const projected = new THREE.Vector3(recovered.x, recovered.elevation, recovered.z).project(camera.camera);
    expect(Math.abs(projected.x)).toBeLessThan(0.995);
    expect(Math.abs(projected.y)).toBeLessThan(0.995);
    expect(camera.camera.position.z).toBeCloseTo(recovered.z, 3);
  });
  it('follows the actual jump height instead of aiming at the floor below', () => {
    const camera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
    const subject = { x: -27, z: 110, yaw: Math.PI / 2, levelId: 'ground', elevation: 14 };
    camera.update([subject], 1 / 60);
    expect(camera.camera.position.y).toBeGreaterThan(subject.elevation);
    camera.camera.updateMatrixWorld();
    const projected = new THREE.Vector3(subject.x, subject.elevation, subject.z).project(camera.camera);
    expect(Math.abs(projected.y)).toBeLessThan(1);
  });
  describe('on a stair', () => {
    const stair = FAMILY_HOUSE.stairTransitions![0]!;
    const middle = { x: stair.rect.x, z: stair.rect.z };
    const UPHILL_Z = -1;

    function cameraOffsetOnStair(yaw: number): number {
      const camera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
      camera.setAspect(16 / 9);
      camera.update([{ ...middle, yaw, levelId: stair.fromLevelId, stairTransitionId: stair.name, elevation: stair.fromHeight / 2 }], 1 / 60);
      return camera.camera.position.z - middle.z;
    }

    it('stays on the downhill side whichever way the kart faces, so it never ends up inside the upper floor', () => {
      expect(stair.axis).toBe('z');
      expect(stair.toAt).toBe('min');
      const facingUphill = cameraOffsetOnStair(Math.PI * 1.5);
      const facingDownhill = cameraOffsetOnStair(Math.PI / 2);
      const facingSideways = cameraOffsetOnStair(0);
      for (const offset of [facingUphill, facingDownhill, facingSideways]) expect(offset * UPHILL_Z).toBeLessThan(-10);
      expect(facingDownhill).toBeCloseTo(facingUphill, 3);
    });

    it('still follows the kart heading on flat floor', () => {
      const camera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
      camera.setAspect(16 / 9);
      camera.update([{ ...middle, x: middle.x + 40, yaw: Math.PI / 2, levelId: 'ground', elevation: 0 }], 1 / 60);
      expect(camera.camera.position.z).toBeLessThan(middle.z - 10);
    }, 5000);
  });
  it('follows the first player instead of zooming out for distant karts', () => {
    const raceCamera = new RaceCamera(createRuntimeCamera(), RING_TEST_MAP);
    raceCamera.setAspect(16 / 9);
    const subjects = [
      { x: -80, z: -60, yaw: 0 },
      { x: 80, z: 60, yaw: 0 },
    ];

    raceCamera.update(subjects, 1 / 60);
    raceCamera.camera.updateMatrixWorld();

    const first = new THREE.Vector3(subjects[0]!.x, 0, subjects[0]!.z).project(raceCamera.camera);
    expect(Math.abs(first.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.y)).toBeLessThanOrEqual(1);
  });

  it('catches up before a fast-moving kart leaves the frame', () => {
    const raceCamera = new RaceCamera(createRuntimeCamera(), RING_TEST_MAP);
    raceCamera.setAspect(16 / 9);
    raceCamera.update([{ x: 0, z: 0, yaw: 0 }], 1 / 60);

    const subject = { x: 0, z: -60, yaw: 0 };
    raceCamera.update([subject], 1);
    raceCamera.camera.updateMatrixWorld();

    const projected = new THREE.Vector3(subject.x, 0, subject.z).project(raceCamera.camera);
    expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.995);
    expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.995);
  });

  it('raises its target and position with a kart on an upper house floor', () => {
    const raceCamera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
    raceCamera.setAspect(16 / 9);
    const subject = { x: -18, z: 90, yaw: -Math.PI / 2, levelId: 'second' };

    raceCamera.update([subject], 1 / 60);
    raceCamera.camera.updateMatrixWorld();

    const elevation = routeElevationAt(FAMILY_HOUSE, subject.x, subject.z, subject.levelId);
    const projected = new THREE.Vector3(subject.x, elevation, subject.z).project(raceCamera.camera);
    expect(elevation).toBe(FAMILY_HOUSE.levels?.find((level) => level.id === subject.levelId)?.floorHeight);
    expect(raceCamera.camera.position.y).toBeGreaterThan(elevation);
    expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(projected.y)).toBeLessThanOrEqual(1);
  });

  it('keeps the follow camera below the current house ceiling', () => {
    const raceCamera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
    raceCamera.setAspect(16 / 9);
    raceCamera.update([{ x: 210, z: 0, yaw: -Math.PI / 2, levelId: 'ground' }], 1 / 60);

    const ceiling = FAMILY_HOUSE.levels?.find((level) => level.id === 'ground')!.ceilingHeight!;
    expect(raceCamera.camera.position.y).toBeLessThanOrEqual(ceiling - createRuntimeCamera().follow.ceilingClearance);
  });
  it('does not snap when the floor changes halfway up a stair', () => {
    const stair = FAMILY_HOUSE.stairTransitions![0]!;
    const kart = createKartState(stair.rect.x, stair.rect.z + stair.rect.depth / 2 + 10, -Math.PI / 2, stair.fromLevelId);
    kart.velocityZ = -12;
    const camera = new RaceCamera(createRuntimeCamera(), FAMILY_HOUSE);
    camera.setAspect(16 / 9);
    let previous: THREE.Vector3 | null = null;
    let largestStep = 0;
    for (let tick = 0; tick < 60 * 6; tick += 1) {
      stepAllKarts(createRuntimeDriving(), FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
      camera.update(
        [
          {
            x: kart.x,
            z: kart.z,
            yaw: kart.yaw,
            levelId: kart.levelId,
            stairTransitionId: kart.stairTransitionId,
            elevation: kartElevationAt(FAMILY_HOUSE, kart),
          },
        ],
        1 / 60,
      );
      if (previous) largestStep = Math.max(largestStep, camera.camera.position.distanceTo(previous));
      previous = camera.camera.position.clone();
    }
    expect(largestStep).toBeLessThan(1);
  });
});
