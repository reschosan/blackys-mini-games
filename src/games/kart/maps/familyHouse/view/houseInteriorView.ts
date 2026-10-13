import * as THREE from 'three';
import { createModelLoader } from '../../../../../shared/effects/modelLoader';
import { assetUrl } from '../../../../../shared/config/assets';
import type { MapLevel, MapConfig } from '../../shared/mapConfig';
import { HOUSE_MODEL_SCALE, HOUSE_WALL_CUTAWAY_HEIGHT } from '../settings';
import { geometryWithOpenings } from './modelOpenings';

interface LevelView {
  readonly level: MapLevel;
  readonly group: THREE.Group;
  readonly openings: readonly THREE.Box3[];
}

let sourcePromise: Promise<THREE.Group> | null = null;
const interiorMaterials = new WeakMap<THREE.Material, THREE.Material>();

function interiorMaterial(source: THREE.Material): THREE.Material {
  let material = interiorMaterials.get(source);
  if (!material) {
    material = source.clone();
    material.side = THREE.DoubleSide;
    interiorMaterials.set(source, material);
  }
  return material;
}

export function addHouseInterior(parent: THREE.Group, map: MapConfig): void {
  if (typeof window === 'undefined') return;
  sourcePromise ??= createModelLoader()
    .loadAsync(assetUrl('models/house-interiors/house-interiors.glb'))
    .then((gltf) => gltf.scene);
  void sourcePromise
    .then((source) => {
      if (parent.userData.disposed) return;
      source.updateMatrixWorld(true);
      const levels = (map.levels ?? []).map((level) => createLevelView(parent, HOUSE_MODEL_SCALE, level));
      source.traverse((node) => addModelMesh(node, levels, map.closedCeilings ? undefined : HOUSE_WALL_CUTAWAY_HEIGHT));
      parent.userData.houseModelLoaded = true;
    })
    .catch((error: unknown) => {
      parent.userData.assetsFailed = true;
      console.error('House model failed to load', error);
    });
}

function createLevelView(parent: THREE.Group, scale: number, level: MapLevel): LevelView {
  const group = new THREE.Group();
  const source = level.modelSource;
  group.userData.levelId = level.id;
  group.userData.houseModelLevel = true;
  group.scale.setScalar(scale);
  group.position.set(-(source?.centreX ?? 0) * scale, level.floorHeight - (source?.floorY ?? 0) * scale, 0);
  parent.add(group);
  const openings = (level.modelCutouts ?? []).map(
    ({ rect, minHeight, maxHeight }) =>
      new THREE.Box3(
        new THREE.Vector3(
          (source?.centreX ?? 0) + (rect.x - rect.width / 2) / scale,
          (source?.floorY ?? 0) + (minHeight - level.floorHeight) / scale,
          (rect.z - rect.depth / 2) / scale,
        ),
        new THREE.Vector3(
          (source?.centreX ?? 0) + (rect.x + rect.width / 2) / scale,
          (source?.floorY ?? 0) + (maxHeight - level.floorHeight) / scale,
          (rect.z + rect.depth / 2) / scale,
        ),
      ),
  );
  return { level, group, openings };
}

function addModelMesh(node: THREE.Object3D, levels: readonly LevelView[], cutawayHeight: number | undefined): void {
  if (!(node instanceof THREE.Mesh)) return;
  const bounds = new THREE.Box3().setFromObject(node);
  const centre = bounds.getCenter(new THREE.Vector3());
  const entry = levels.find(({ level }) => level.modelSource && centre.x >= level.modelSource.minX && centre.x < level.modelSource.maxX);
  if (!entry) return;
  const mesh = cloneModelMesh(node, entry.openings);
  applyWallCutaway(mesh, bounds.getSize(new THREE.Vector3()), entry.level.floorHeight, cutawayHeight);
  entry.group.add(mesh);
}

function cloneModelMesh(source: THREE.Mesh, openings: readonly THREE.Box3[]): THREE.Mesh {
  const mesh = source.clone(false);
  mesh.material = Array.isArray(source.material) ? source.material.map(interiorMaterial) : interiorMaterial(source.material);
  const geometry = geometryWithOpenings(source, openings);
  mesh.userData.ownsGeometry = geometry !== null;
  mesh.userData.ownsMaterial = false;
  if (geometry) {
    mesh.geometry = geometry;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.setScalar(1);
  } else {
    mesh.matrix.copy(source.matrixWorld);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  }
  return mesh;
}

/** Only walls are cut open above the camera, not furniture: a wall is taller than a low piece and longer than a small one, in model units. */
const WALL_MIN_HEIGHT = 0.4;
const WALL_MIN_LENGTH = 1;

function isWallSized(size: THREE.Vector3): boolean {
  return size.y > WALL_MIN_HEIGHT && Math.max(size.x, size.z) > WALL_MIN_LENGTH;
}

function applyWallCutaway(mesh: THREE.Mesh, size: THREE.Vector3, floorHeight: number, cutawayHeight: number | undefined): void {
  if (!cutawayHeight || !isWallSized(size)) return;
  const height = floorHeight + cutawayHeight;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const clipped = materials.map((material) => {
    const clone = material.clone();
    clone.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), height)];
    return clone;
  });
  mesh.material = Array.isArray(mesh.material) ? clipped : clipped[0]!;
  mesh.userData.cutawayHeight = height;
  mesh.userData.ownsMaterial = true;
}

export function showHouseLevel(group: THREE.Object3D, levelId: string): void {
  group.traverse((node) => {
    if (typeof node.userData.levelId === 'string') node.visible = node.userData.levelId === levelId && node.userData.active !== false;
  });
}
