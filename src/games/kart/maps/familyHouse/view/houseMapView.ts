import * as THREE from 'three';
import type { MapLevel, Ramp, Rect, StairTransition, MapConfig } from '../../shared/mapConfig';
import { FAMILY_HOUSE_APPEARANCE } from '../settings';
import { addJumpMarkers } from '../../shared/view/jumpMarkers';
import { createGroundPlane } from '../../shared/view/meshPrimitives';
import { MARKING_COLORS, addBoostFields, createFinishLine, createGateLine } from '../../shared/view/mapOverlays';
import { setSurfaceUVs } from '../../../../../shared/effects/surfaceTextures';
import { HouseSurfaceMaterials } from './houseSurfaceMaterials';
import { addHouseInterior } from './houseInteriorView';
import { addHouseCeiling, addRouteBanks } from './routeBankView';
import { addRouteMarkers } from './routeMarkings';
import { addSurfaceZones } from '../../shared/view/surfaceZoneView';

const COLORS = { houseFloor: 0x9d8064, houseWall: 0xe2d7c8 } as const;

function createRamp(ramp: Ramp, surfaces?: HouseSurfaceMaterials): THREE.Mesh {
  const halfWidth = ramp.rect.width / 2;
  const halfDepth = ramp.rect.depth / 2;
  const [low, high] = [ramp.fromHeight, ramp.toHeight];
  const heights = ramp.axis === 'x' ? [low, high, low, high] : [low, low, high, high];
  const geometry = new THREE.BufferGeometry();
  const corners = [
    -halfWidth,
    heights[0]!,
    -halfDepth,
    halfWidth,
    heights[1]!,
    -halfDepth,
    -halfWidth,
    heights[2]!,
    halfDepth,
    halfWidth,
    heights[3]!,
    halfDepth,
  ];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  if (surfaces) setSurfaceUVs(geometry, surfaces.config.road.tileMeters, false, ramp.rect.x, ramp.rect.z);
  const mesh = new THREE.Mesh(
    geometry,
    surfaces?.road ?? new THREE.MeshStandardMaterial({ color: COLORS.houseFloor, roughness: 0.82, side: THREE.DoubleSide }),
  );
  mesh.userData.ownsMaterial = !surfaces;
  mesh.position.set(ramp.rect.x, 0.02, ramp.rect.z);
  return mesh;
}

function createOutdoorSurface(area: Rect, level: MapLevel, surfaces?: HouseSurfaceMaterials): THREE.Mesh {
  const ground = (level.placementLevel ?? 0) === 0;
  const surface = createGroundPlane(area, ground ? 0x617a43 : 0x7b6952, level.floorHeight);
  if (surfaces) {
    (surface.material as THREE.Material).dispose();
    surface.material = ground ? surfaces.garden : surfaces.terrace;
    const style = ground ? surfaces.config.garden : surfaces.config.terrace;
    setSurfaceUVs(surface.geometry, style.tileMeters, true, area.x, area.z);
    surface.userData.ownsMaterial = false;
  }
  surface.userData.levelId = level.id;
  return surface;
}

function addHouseWallBases(group: THREE.Group, map: MapConfig, level: MapLevel, surfaces?: HouseSurfaceMaterials): void {
  const rects = level.wallRects ?? [];
  if (!rects.length) return;
  const height = (map.routeBanks?.height ?? 0) + (map.routeBanks?.wallHeight ?? map.wallHeight);
  const wallMaterial = surfaces?.wall.clone() ?? new THREE.MeshStandardMaterial({ color: COLORS.houseWall, roughness: 0.9 });
  wallMaterial.polygonOffset = true;
  wallMaterial.polygonOffsetFactor = wallMaterial.polygonOffsetUnits = 2;
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial, rects.length);
  const matrix = new THREE.Matrix4();
  rects.forEach((rect, index) => {
    matrix.makeScale(rect.width, height, rect.depth);
    matrix.setPosition(rect.x, level.floorHeight + height / 2, rect.z);
    walls.setMatrixAt(index, matrix);
  });
  walls.userData.levelId = level.id;
  walls.userData.houseWallBase = true;
  group.add(walls);
}

function createStairSideWall(map: MapConfig, stair: StairTransition, rect: Rect, surfaces?: HouseSurfaceMaterials): THREE.Mesh {
  const height = (map.routeBanks?.height ?? 0) + (map.routeBanks?.wallHeight ?? map.wallHeight);
  const geometry = new THREE.BoxGeometry(rect.width, 1, rect.depth);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const top = stairWallHeightAt(stair, rect.x + positions.getX(index), rect.z + positions.getZ(index)) + height;
    positions.setY(index, positions.getY(index) > 0 ? top : Math.min(stair.fromHeight, stair.toHeight));
  }
  geometry.computeVertexNormals();
  const wall = new THREE.Mesh(geometry, surfaces?.wall ?? new THREE.MeshStandardMaterial({ color: 0xb9ae97, roughness: 0.9 }));
  wall.userData.ownsMaterial = !surfaces;
  wall.position.set(rect.x, 0, rect.z);
  wall.userData.levelId = stair.fromLevelId;
  wall.userData.stairSideWall = true;
  return wall;
}

function addStairSideWalls(group: THREE.Group, map: MapConfig, stair: StairTransition, surfaces?: HouseSurfaceMaterials): void {
  for (const rect of stair.sideWalls ?? []) group.add(createStairSideWall(map, stair, rect, surfaces));
}

function stairWallHeightAt(stair: StairTransition, x: number, z: number): number {
  const coordinate = stair.axis === 'x' ? x : z;
  const span = stair.axis === 'x' ? stair.rect.width : stair.rect.depth;
  const centre = stair.axis === 'x' ? stair.rect.x : stair.rect.z;
  const t = Math.max(0, Math.min(1, (coordinate - centre + span / 2) / span));
  return stair.fromHeight + (stair.toHeight - stair.fromHeight) * t;
}

function createStairMarkers(stair: StairTransition): THREE.LineSegments {
  const vertices: number[] = [];
  for (let index = 0; index <= 12; index += 1) {
    const t = index / 12;
    const height = stair.fromHeight + (stair.toHeight - stair.fromHeight) * t + 0.1;
    const x = stair.rect.x - stair.rect.width / 2;
    const z = stair.rect.z - stair.rect.depth / 2;
    if (stair.axis === 'z') vertices.push(x, height, z + stair.rect.depth * t, x + stair.rect.width, height, z + stair.rect.depth * t);
    else vertices.push(x + stair.rect.width * t, height, z, x + stair.rect.width * t, height, z + stair.rect.depth);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xe8d0a7 }));
  lines.userData.levelId = stair.fromLevelId;
  return lines;
}

function addLevelDetails(group: THREE.Group, map: MapConfig, level: MapLevel, surfaces?: HouseSurfaceMaterials): void {
  addHouseWallBases(group, map, level, surfaces);
  addRouteBanks(group, map, level, surfaces);
  addHouseCeiling(group, map, level, surfaces);
  for (const area of level.driveableSurfaces?.slice(1) ?? []) group.add(createOutdoorSurface(area, level, surfaces));
}

function addStairs(group: THREE.Group, map: MapConfig, surfaces?: HouseSurfaceMaterials): void {
  for (const stair of map.stairTransitions ?? []) {
    const ramp = createRamp(stair, surfaces);
    ramp.userData.levelId = stair.fromLevelId;
    group.add(ramp, createStairMarkers(stair));
    addStairSideWalls(group, map, stair, surfaces);
  }
  for (const ramp of map.ramps ?? []) group.add(createRamp(ramp, surfaces));
}

function addRaceMarkings(group: THREE.Group, map: MapConfig): void {
  addRouteMarkers(group, map);
  addJumpMarkers(group, map);
  addBoostFields(group, map);
  addSurfaceZones(group, map);
  group.add(createGateLine(map, 0, MARKING_COLORS.startLine, 0.8));
  if (map.checkpoints.length > 1) group.add(createFinishLine(map));
}

export function createHouseMapView(map: MapConfig): THREE.Group {
  const group = new THREE.Group();
  const surfaces = new HouseSurfaceMaterials(FAMILY_HOUSE_APPEARANCE);
  if (surfaces) group.userData.disposeSurfaceMaterials = () => surfaces.dispose();
  addHouseInterior(group, map);
  for (const level of map.levels ?? []) addLevelDetails(group, map, level, surfaces);
  addStairs(group, map, surfaces);
  addRaceMarkings(group, map);
  return group;
}
