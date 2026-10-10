import * as THREE from 'three';
import type { MapConfig, MapKind } from '../mapConfig';
import { createHouseMapView } from '../../familyHouse/view';
import { createNatureView } from '../../nature/view';
import { createSpaceView } from '../../space/view';
import { createFarmView } from '../../farm/view';
import { createTownView } from '../../town/view';
import { createCityView } from '../../city/view';
import { createArenaView } from '../../arena/view';
import { addOutdoorRaceMarkings } from './mapOverlays';
import { FULL_MAP_DETAIL, type MapDetail } from './mapDetail';

type MapViewFactory = (map: MapConfig, loadDetailedAssets: boolean, detail: MapDetail) => THREE.Group;

function withOutdoorMarkings(group: THREE.Group, map: MapConfig): THREE.Group {
  addOutdoorRaceMarkings(group, map);
  return group;
}

const MAP_VIEW_FACTORIES: Readonly<Record<MapKind, MapViewFactory>> = {
  house: (map) => createHouseMapView(map),
  nature: (map, loadDetailedAssets, detail) => withOutdoorMarkings(createNatureView(map, loadDetailedAssets, detail), map),
  space: (map, loadDetailedAssets) => withOutdoorMarkings(createSpaceView(map, loadDetailedAssets), map),
  farm: (map, loadDetailedAssets, detail) => withOutdoorMarkings(createFarmView(map, loadDetailedAssets, detail), map),
  town: (map, loadDetailedAssets, detail) => withOutdoorMarkings(createTownView(map, loadDetailedAssets, detail), map),
  city: (map, loadDetailedAssets, detail) => withOutdoorMarkings(createCityView(map, loadDetailedAssets, detail), map),
  arena: (map) => createArenaView(map),
};

export function createMapView(map: MapConfig, loadDetailedAssets = true, detail: MapDetail = FULL_MAP_DETAIL): THREE.Group {
  if (!map.kind) return new THREE.Group();
  return MAP_VIEW_FACTORIES[map.kind](map, loadDetailedAssets, detail);
}

function disposeMesh(node: THREE.Mesh | THREE.Line): void {
  if (node instanceof THREE.InstancedMesh) node.dispose();
  if (node.userData.ownsGeometry !== false) node.geometry.dispose();
  if (node.userData.ownsMaterial === false) return;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  if (node.userData.ownsTexture) materials.forEach((material) => (material as THREE.MeshBasicMaterial).map?.dispose());
  materials.forEach((material) => material.dispose());
}

/** Groups keep their own resources (textures, shared materials) behind these disposal hooks. */
const DISPOSAL_HOOKS = ['disposeSurfaceMaterials', 'disposeNatureMaterials', 'disposeNatureWalls', 'disposeResources'] as const;

export function disposeMapView(group: THREE.Group): void {
  if (group.userData.disposed) return;
  group.userData.disposed = true;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line) disposeMesh(node);
  });
  for (const hook of DISPOSAL_HOOKS) group.userData[hook]?.();
}
