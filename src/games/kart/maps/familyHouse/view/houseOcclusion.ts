import * as THREE from 'three';
import type { MapConfig } from '../../shared/mapConfig';
import { collidableRects, routeElevationAt } from '../../shared/surface';

const bounds = new THREE.Box3();
const ray = new THREE.Ray();
const intersection = new THREE.Vector3();

/** On a stair the camera shows the floor below until the kart is this close below the next floor. */
const STAIR_TOP_METERS = 1;

export function houseViewLevelId(
  map: MapConfig,
  subject: { x: number; z: number; levelId?: string; elevation?: number; stairTransitionId?: string | null },
): string {
  const levelId = subject.levelId ?? 'ground';
  const stair = map.stairTransitions?.find((entry) => entry.name === subject.stairTransitionId);
  const target = map.levels?.find((entry) => entry.id === stair?.toLevelId);
  const elevation = subject.elevation ?? routeElevationAt(map, subject.x, subject.z, levelId);
  const stillOnLowerFloor = stair && target && elevation < target.floorHeight - STAIR_TOP_METERS;
  return stillOnLowerFloor ? stair.fromLevelId : levelId;
}

export function setHouseOccludedCameraPosition(
  map: MapConfig,
  levelId: string,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  clearance: number,
  position: THREE.Vector3,
): void {
  if (clearance >= (map.followCamera?.minimumClearance ?? 0)) {
    position.copy(origin).addScaledVector(direction, Math.max(0.5, clearance - 0.5));
    return;
  }
  const distance = position.distanceTo(origin);
  let bestClearance = clearance;
  let bestDirection = direction;
  for (const angle of [-Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2]) {
    const candidate = direction.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    const candidateClearance = houseCameraClearance(map, levelId, origin, candidate, distance);
    if (candidateClearance <= bestClearance) continue;
    bestClearance = candidateClearance;
    bestDirection = candidate;
  }
  position.copy(origin).addScaledVector(bestDirection, Math.max(0.5, Math.min(distance, bestClearance - 0.5)));
}

/** The banked route edges stand on the floor; the camera passes over them. */
function bankTopAboveFloor(map: MapConfig): number {
  return (map.routeBanks?.height ?? 0) + (map.routeBanks?.wallHeight ?? 0);
}

export function houseCameraClearance(map: MapConfig, levelId: string, origin: THREE.Vector3, direction: THREE.Vector3, distance: number): number {
  const level = map.levels?.find((entry) => entry.id === levelId);
  if (!level) return distance;
  ray.set(origin, direction);
  const rects = collidableRects(map, levelId);
  const padding = map.followCamera?.occlusionPadding ?? 0;
  let nearest = distance;
  rects.forEach((rect, index) => {
    const isRoomWall = index < level.collisionRects.length;
    const top = isRoomWall ? level.ceilingHeight : level.floorHeight + bankTopAboveFloor(map);
    bounds.min.set(rect.x - rect.width / 2 - padding, level.floorHeight, rect.z - rect.depth / 2 - padding);
    bounds.max.set(rect.x + rect.width / 2 + padding, top, rect.z + rect.depth / 2 + padding);
    if (bounds.containsPoint(origin)) {
      nearest = 0;
      return;
    }
    if (ray.intersectBox(bounds, intersection)) nearest = Math.min(nearest, origin.distanceTo(intersection));
  });
  return nearest;
}
