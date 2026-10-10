import * as THREE from 'three';
import type { MapLevel, Rect, MapConfig } from '../../shared/mapConfig';
import { routeBankHeight, routeBankLayout, type BankLayout } from '../../shared/routeBanks';
import type { HouseSurfaceMaterials } from './houseSurfaceMaterials';
import { setSurfaceUVs } from '../../../../../shared/effects/surfaceTextures';

const vertexCache = new WeakMap<BankLayout, { height: number; positions: Float32Array }>();

export function addRouteBanks(group: THREE.Group, map: MapConfig, level: MapLevel, surfaces?: HouseSurfaceMaterials): void {
  if (!map.routeBanks) return;
  const layout = routeBankLayout(map, level.id);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(bankVertices(map, level.id, layout), 3));
  geometry.computeVertexNormals();
  if (surfaces) setSurfaceUVs(geometry, surfaces.config.road.tileMeters);
  const slope = new THREE.Mesh(geometry, surfaces?.road ?? new THREE.MeshStandardMaterial({ color: 0x8d8068, roughness: 0.95, side: THREE.DoubleSide }));
  slope.userData.ownsMaterial = !surfaces;
  slope.position.y = level.floorHeight + 0.02;
  slope.userData.levelId = level.id;
  slope.userData.routeBank = true;
  group.add(slope);
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    surfaces?.wall ?? new THREE.MeshStandardMaterial({ color: 0xb9ae97, roughness: 0.9 }),
    layout.walls.length,
  );
  walls.userData.ownsMaterial = !surfaces;
  const transform = new THREE.Object3D();
  layout.walls.forEach((wall, index) => {
    const height = map.routeBanks!.height + map.routeBanks!.wallHeight;
    transform.position.set(wall.x, level.floorHeight + height / 2, wall.z);
    transform.scale.set(wall.width, height, wall.depth);
    transform.updateMatrix();
    walls.setMatrixAt(index, transform.matrix);
  });
  walls.userData.levelId = level.id;
  walls.userData.routeBoundary = true;
  group.add(walls);
  const markings: number[] = [];
  for (const edge of layout.edges) {
    const x0 = edge.x - edge.width / 2;
    const x1 = edge.x + edge.width / 2;
    const z0 = edge.z - edge.depth / 2;
    const z1 = edge.z + edge.depth / 2;
    markings.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markings, 3));
  const edges = new THREE.Mesh(edgeGeometry, new THREE.MeshBasicMaterial({ color: 0xeadfbe, side: THREE.DoubleSide }));
  edges.position.y = level.floorHeight + 0.3;
  edges.userData.levelId = level.id;
  edges.userData.routeEdge = true;
  group.add(edges);
}

function bankVertices(map: MapConfig, levelId: string, layout: BankLayout): Float32Array {
  const banks = map.routeBanks!;
  const cached = vertexCache.get(layout);
  if (cached?.height === banks.height) return cached.positions;
  const vertices: number[] = [];
  const heights = new Map<string, number>();
  for (const cell of layout.cells) appendBankCell(vertices, map, levelId, cell.x * banks.gridSize, cell.z * banks.gridSize, banks.gridSize, heights);
  const positions = new Float32Array(vertices);
  vertexCache.set(layout, { height: banks.height, positions });
  return positions;
}

function appendBankCell(vertices: number[], map: MapConfig, levelId: string, x: number, z: number, step: number, cache: Map<string, number>): void {
  const points = [
    [x, z],
    [x + step, z],
    [x, z + step],
    [x + step, z + step],
  ] as const;
  const heights = points.map(([px, pz]) => {
    const key = `${px},${pz}`;
    let height = cache.get(key);
    if (height === undefined) {
      height = routeBankHeight(map, levelId, px, pz);
      cache.set(key, height);
    }
    return height;
  });
  for (const index of [0, 2, 1, 1, 2, 3]) vertices.push(points[index]![0], heights[index]!, points[index]![1]);
}

export function addHouseCeiling(group: THREE.Group, map: MapConfig, level: MapLevel, surfaces?: HouseSurfaceMaterials): void {
  const room = level.driveableSurfaces?.[0];
  if (!map.closedCeilings || !room) return;
  const stair = map.stairTransitions?.find((entry) => entry.fromLevelId === level.id);
  const hole =
    stair &&
    (level.modelCutouts?.find(({ rect }) => Math.abs(rect.x - stair.rect.x) < rect.width / 2 && Math.abs(rect.z - stair.rect.z) < rect.depth / 2)?.rect ??
      stair.rect);
  const panels = hole ? ceilingPanels(room, hole) : [room];
  for (const panel of panels) {
    const geometry = new THREE.PlaneGeometry(panel.width, panel.depth);
    if (surfaces) setSurfaceUVs(geometry, surfaces.config.ceiling.tileMeters, true, panel.x, panel.z);
    const mesh = new THREE.Mesh(geometry, surfaces?.ceiling ?? new THREE.MeshStandardMaterial({ color: 0xe2d7c8, roughness: 1, side: THREE.DoubleSide }));
    mesh.userData.ownsMaterial = !surfaces;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(panel.x, level.ceilingHeight, panel.z);
    mesh.userData.levelId = level.id;
    mesh.userData.ceiling = true;
    group.add(mesh);
  }
}

function ceilingPanels(room: Rect, hole: Rect): Rect[] {
  const left = room.x - room.width / 2;
  const right = room.x + room.width / 2;
  const back = room.z - room.depth / 2;
  const front = room.z + room.depth / 2;
  const hx0 = hole.x - hole.width / 2;
  const hx1 = hole.x + hole.width / 2;
  const hz0 = hole.z - hole.depth / 2;
  const hz1 = hole.z + hole.depth / 2;
  return [
    { x: (left + hx0) / 2, z: room.z, width: hx0 - left, depth: room.depth },
    { x: (right + hx1) / 2, z: room.z, width: right - hx1, depth: room.depth },
    { x: hole.x, z: (back + hz0) / 2, width: hole.width, depth: hz0 - back },
    { x: hole.x, z: (front + hz1) / 2, width: hole.width, depth: front - hz1 },
  ].filter((panel) => panel.width > 0 && panel.depth > 0);
}
