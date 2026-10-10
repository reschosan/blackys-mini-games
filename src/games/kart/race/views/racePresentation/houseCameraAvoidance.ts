import * as THREE from 'three';
import type { CameraConfig } from '../../../../../shared/config/camera';
import { houseCameraClearance, houseViewLevelId, setHouseOccludedCameraPosition } from '../../../maps/familyHouse/view';
import type { MapConfig } from '../../../maps/shared/mapConfig';
import { routeElevationAt } from '../../../maps/shared/surface';

export interface ViewSubject {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly levelId?: string;
  readonly stairTransitionId?: string | null;
  readonly penaltySecondsLeft?: number;
  readonly elevation?: number;
  readonly nextCheckpoint?: number;
}

/** Pulls a follow camera in front of the house walls and ceilings that would hide the kart. */
export function keepCameraInsideHouse(map: MapConfig, cameraConfig: CameraConfig, camera: THREE.PerspectiveCamera, subject: ViewSubject | undefined): void {
  if (!subject || !map.levels || cameraConfig.mode !== 'follow') return;
  const origin = new THREE.Vector3(subject.x, (subject.elevation ?? routeElevationAt(map, subject.x, subject.z, subject.levelId)) + 2, subject.z);
  const direction = camera.position.clone().sub(origin);
  const distance = direction.length();
  const levelId = houseViewLevelId(map, subject);
  const clearance = houseCameraClearance(map, levelId, origin, direction.normalize(), distance);
  camera.userData.occluder = clearance < distance ? 'configured house boundary' : null;
  if (clearance < distance) {
    setHouseOccludedCameraPosition(map, levelId, origin, direction, clearance, camera.position);
    camera.lookAt(origin);
  }
}
