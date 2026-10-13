import * as THREE from 'three';
import type { Rect, MapConfig } from '../mapConfig';
import { setSurfaceUVs } from '../../../../../shared/effects/surfaceTextures';
import { isOnRouteSurface, routeSurfaceSpeedFactor } from '../surface';
import { isInsideRect } from '../collision';

export interface ScenerySpot {
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
  readonly scale?: number;
  readonly y?: number;
}

export interface InstanceStyle {
  readonly toned: boolean;
  readonly maxFootprint: number;
}

/** Side of the squares scenery is split into. One instanced mesh covering a whole map is never hidden by the camera,
 *  so every tree is drawn all the time; one per square is hidden as soon as the square is out of view. */
const SCENERY_CHUNK_METERS = 96;

export function groupByChunk<T extends { readonly x: number; readonly z: number }>(points: readonly T[]): T[][] {
  const chunks = new Map<string, T[]>();
  for (const point of points) {
    const key = `${Math.floor(point.x / SCENERY_CHUNK_METERS)},${Math.floor(point.z / SCENERY_CHUNK_METERS)}`;
    const chunk = chunks.get(key);
    if (chunk) chunk.push(point);
    else chunks.set(key, [point]);
  }
  return [...chunks.values()];
}

export interface SurfacePointBounds {
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export function hash(x: number, z: number): number {
  return (Math.imul(x + 701, 73856093) ^ Math.imul(z + 911, 19349663)) >>> 0;
}

export function clearanceFromRoute(map: MapConfig, x: number, z: number): number {
  return Math.min(
    ...map.driveableSurfaces.map((rect) => {
      const dx = Math.max(Math.abs(x - rect.x) - rect.width / 2, 0);
      const dz = Math.max(Math.abs(z - rect.z) - rect.depth / 2, 0);
      return Math.hypot(dx, dz);
    }),
  );
}

export function plane(rect: Rect, material: THREE.Material, y: number, worldTileMeters?: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(rect.width, rect.depth);
  if (worldTileMeters) setSurfaceUVs(geometry, worldTileMeters, true, rect.x, rect.z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(rect.x, y, rect.z);
  mesh.userData.ownsMaterial = false;
  return mesh;
}

export function variantMeshes(variant: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  variant.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  return meshes;
}

export function variantsOf(source: THREE.Group): THREE.Object3D[] {
  const root = source.children[0] ?? source;
  return root.children.length ? root.children : [root];
}

function natureInstanceStyle(targetHeight: number): InstanceStyle {
  return { toned: targetHeight < 10, maxFootprint: 13 };
}

function tonedMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone();
  if ('color' in clone && clone.color instanceof THREE.Color) clone.color.multiplyScalar(0.75);
  if ('metalness' in clone) clone.metalness = 0;
  if ('roughness' in clone) clone.roughness = 1;
  return clone;
}

function materialsFor(source: THREE.Mesh, style: InstanceStyle): THREE.Material | THREE.Material[] {
  const materials = Array.isArray(source.material) ? source.material : [source.material];
  const styled = style.toned ? materials.map(tonedMaterial) : materials;
  return Array.isArray(source.material) ? styled : styled[0]!;
}

interface PlacedSpot {
  readonly spot: ScenerySpot;
  /** Position in the full list, so the size variation does not change with the chunking. */
  readonly index: number;
}

function placeInstances(mesh: THREE.InstancedMesh, placed: readonly PlacedSpot[], baseScale: number): void {
  const transform = new THREE.Object3D();
  placed.forEach(({ spot, index }, instance) => {
    transform.position.set(spot.x, spot.y ?? 0, spot.z);
    transform.rotation.y = spot.yaw ?? ((hash(Math.round(spot.x), Math.round(spot.z)) % 360) * Math.PI) / 180;
    transform.scale.setScalar(baseScale * (spot.scale ?? 0.85 + (index % 5) * 0.07));
    transform.updateMatrix();
    mesh.setMatrixAt(instance, transform.matrix);
  });
  mesh.computeBoundingSphere();
}

export function instanceVariant(
  group: THREE.Group,
  variant: THREE.Object3D,
  positions: readonly ScenerySpot[],
  targetHeight: number,
  style: InstanceStyle = natureInstanceStyle(targetHeight),
): void {
  if (!positions.length) return;
  const bounds = new THREE.Box3().setFromObject(variant);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(targetHeight / Math.max(size.y, 0.01), style.maxFootprint / Math.max(size.x, size.z, 0.01));
  const chunks = groupByChunk(positions.map((spot, index): PlacedSpot & { x: number; z: number } => ({ spot, index, x: spot.x, z: spot.z })));
  for (const source of variantMeshes(variant)) {
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    geometry.translate(-centre.x, -bounds.min.y, -centre.z);
    const materials = materialsFor(source, style);
    for (const chunk of chunks) {
      const mesh = new THREE.InstancedMesh(geometry, materials, chunk.length);
      placeInstances(mesh, chunk, scale);
      mesh.userData.ownsMaterial = style.toned;
      group.add(mesh);
    }
  }
}

export function isFreeOfMarkings(map: MapConfig, x: number, z: number): boolean {
  const onBoostField = map.boostFields?.some((field) => isInsideRect(field.rect, x, z, 1));
  const onLaunchRamp = map.windowJumps?.some((jump) => isInsideRect(jump.launchRect, x, z));
  return !onBoostField && !onLaunchRamp;
}

function gridAxis(centre: number, halfExtent: number, spacing: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil((centre - halfExtent) / spacing) * spacing; value <= centre + halfExtent; value += spacing) values.push(value);
  return values;
}

/** Jittered grid points on the driveable surface, split into normal and slowed (shoulder) ground. */
export function surfacePoints(map: MapConfig, bounds: SurfacePointBounds, spacing = 2): { short: THREE.Vector3[]; tall: THREE.Vector3[] } {
  const short: THREE.Vector3[] = [];
  const tall: THREE.Vector3[] = [];
  const zValues = gridAxis(map.room.z, bounds.halfDepth, spacing);
  for (const x of gridAxis(map.room.x, bounds.halfWidth, spacing)) {
    for (const z of zValues) {
      const value = hash(x, z);
      const px = x + ((value % 7) - 3) * 0.12;
      const pz = z + ((Math.floor(value / 7) % 7) - 3) * 0.12;
      if (!isOnRouteSurface(map, px, pz) || !isFreeOfMarkings(map, px, pz)) continue;
      (routeSurfaceSpeedFactor(map, px, pz) < 1 ? tall : short).push(new THREE.Vector3(px, 0, pz));
    }
  }
  return { short, tall };
}
