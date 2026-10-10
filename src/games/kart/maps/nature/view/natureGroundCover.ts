import * as THREE from 'three';
import type { MapConfig } from '../../shared/mapConfig';
import { NATURE_APPEARANCE } from '../settings';
import { isOnRouteSurface } from '../../shared/surface';
import { spacingForShare } from '../../shared/view/mapDetail';
import {
  groupByChunk,
  hash,
  instanceVariant,
  isFreeOfMarkings,
  surfacePoints,
  variantMeshes,
  variantsOf,
  type ScenerySpot,
} from '../../shared/view/sceneryInstancing';

/** What grows on the ground of the nature course: lawn tufts, tall grass beside the route and flower fields across it at the gates. */

const SURFACE_BOUNDS = { halfWidth: 244, halfDepth: 194 } as const;
const TALL_GRASS_SPACING_METERS = 2;

export function addTallGrassInstances(group: THREE.Group, map: MapConfig, source: THREE.Group, coverShare: number): void {
  source.updateMatrixWorld(true);
  const variant = variantsOf(source).at(-1)!;
  const bounds = new THREE.Box3().setFromObject(variant);
  const centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const { tall } = surfacePoints(map, SURFACE_BOUNDS, spacingForShare(TALL_GRASS_SPACING_METERS, coverShare));
  for (const meshSource of variantMeshes(variant)) {
    const geometry = meshSource.geometry.clone().applyMatrix4(meshSource.matrixWorld);
    geometry.translate(-centre.x, -bounds.min.y, -centre.z);
    const material = new THREE.MeshBasicMaterial({ color: 0x5f8d3c, side: THREE.DoubleSide });
    for (const chunk of groupByChunk(tall)) {
      const mesh = new THREE.InstancedMesh(geometry, material, chunk.length);
      const transform = new THREE.Object3D();
      chunk.forEach((position, index) => {
        transform.position.copy(position);
        transform.rotation.y = index * 2.4;
        transform.scale.set(1.8 / Math.max(size.x, size.z, 0.01), 1.1 / Math.max(size.y, 0.01), 1.8 / Math.max(size.x, size.z, 0.01));
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
}

const BLADES_PER_TUFT = 4;

function tuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let blade = 0; blade < BLADES_PER_TUFT; blade += 1) {
    const yaw = (blade * Math.PI) / 2 + 0.4;
    const lean = 0.35 + (blade % 2) * 0.2;
    const dx = Math.cos(yaw);
    const dz = Math.sin(yaw);
    positions.push(dx * 0.1 - dz * 0.06, 0, dz * 0.1 + dx * 0.06, dx * 0.1 + dz * 0.06, 0, dz * 0.1 - dx * 0.06, dx * (0.1 + lean), 1, dz * (0.1 + lean));
    colors.push(0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 1, 1, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

export function addLawnInstances(group: THREE.Group, map: MapConfig, coverShare: number): void {
  const { spacingMeters, tuftWidthMeters, tuftHeightMeters, color } = NATURE_APPEARANCE.lawn;
  const { short } = surfacePoints(map, SURFACE_BOUNDS, spacingForShare(spacingMeters, coverShare));
  const material = new THREE.MeshBasicMaterial({ color, vertexColors: true, side: THREE.DoubleSide });
  const geometry = tuftGeometry();
  for (const chunk of groupByChunk(short)) {
    const mesh = new THREE.InstancedMesh(geometry, material, chunk.length);
    const transform = new THREE.Object3D();
    chunk.forEach((position, index) => {
      const variation = 0.75 + (hash(Math.round(position.x * 10), Math.round(position.z * 10)) % 50) / 100;
      transform.position.copy(position);
      transform.rotation.y = index * 2.4;
      transform.scale.set(tuftWidthMeters, tuftHeightMeters * variation, tuftWidthMeters);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

const HEAVY_FLOWER_VARIANT = 'Flower_1_Clump';

function flowerFieldPoints(map: MapConfig, coverShare: number): ScenerySpot[] {
  return map.checkpoints.slice(1).flatMap((gate) => flowerPointsAtGate(map, gate, coverShare));
}

function flowerPointsAtGate(map: MapConfig, gate: MapConfig['checkpoints'][number], coverShare: number): ScenerySpot[] {
  const { lengthMeters } = NATURE_APPEARANCE.flowerFields;
  const spacingMeters = spacingForShare(NATURE_APPEARANCE.flowerFields.spacingMeters, coverShare);
  const centre = { x: (gate.ax + gate.bx) / 2, z: (gate.az + gate.bz) / 2 };
  const gateLength = Math.hypot(gate.bx - gate.ax, gate.bz - gate.az);
  const along = { x: (gate.bx - gate.ax) / gateLength, z: (gate.bz - gate.az) / gateLength };
  const points: ScenerySpot[] = [];
  for (let s = -gateLength / 2; s <= gateLength / 2; s += spacingMeters) {
    for (let t = -lengthMeters / 2; t <= lengthMeters / 2; t += spacingMeters) {
      const point = jitteredFieldPoint(centre, along, s, t);
      if (isOnRouteSurface(map, point.x, point.z) && isFreeOfMarkings(map, point.x, point.z)) points.push(point);
    }
  }
  return points;
}

function jitteredFieldPoint(centre: { x: number; z: number }, along: { x: number; z: number }, s: number, t: number): ScenerySpot {
  const jitter = hash(Math.round(centre.x + s * 10), Math.round(centre.z + t * 10));
  return {
    x: centre.x + along.x * s - along.z * t + ((jitter % 7) - 3) * 0.1,
    z: centre.z + along.z * s + along.x * t + ((Math.floor(jitter / 7) % 7) - 3) * 0.1,
  };
}

export function addFlowerFields(group: THREE.Group, map: MapConfig, source: THREE.Group, coverShare: number): void {
  source.updateMatrixWorld(true);
  const variants = variantsOf(source).filter((variant) => variant.name !== HEAVY_FLOWER_VARIANT);
  const points = flowerFieldPoints(map, coverShare);
  variants.forEach((variant, index) => {
    const selected = points.filter((point) => hash(Math.round(point.x * 10), Math.round(point.z * 10)) % variants.length === index);
    instanceVariant(group, variant, selected, NATURE_APPEARANCE.flowerFields.heightMeters, { toned: false, maxFootprint: 1.8 });
  });
}
