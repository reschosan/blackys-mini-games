import * as THREE from 'three';
import type { Rect, MapConfig } from '../mapConfig';
import { routeElevationAt } from '../surface';
import { createGroundPlane } from './meshPrimitives';
import { addJumpMarkers } from './jumpMarkers';
import { addSurfaceZones } from './surfaceZoneView';

export const MARKING_COLORS = { startLine: 0xf2f2f2, checkpoint: 0xf2c744 } as const;

const OUTDOOR_GATE_THICKNESS = 0.3;

export function createGateLine(map: MapConfig, gateIndex: number, color: number, thickness: number): THREE.Mesh {
  const gate = map.checkpoints[gateIndex];
  if (!gate) throw new Error(`map has no checkpoint at index ${gateIndex}`);
  const length = Math.hypot(gate.bx - gate.ax, gate.bz - gate.az);
  const rect: Rect = { x: (gate.ax + gate.bx) / 2, z: (gate.az + gate.bz) / 2, width: length, depth: thickness };
  const mesh = createGroundPlane(rect, color, routeElevationAt(map, rect.x, rect.z, gate.levelId) + 0.12);
  mesh.rotation.z = -Math.atan2(gate.bz - gate.az, gate.bx - gate.ax);
  if (gate.levelId) mesh.userData.levelId = gate.levelId;
  mesh.userData.checkpointIndex = gateIndex;
  return mesh;
}

export function createFinishLine(map: MapConfig, index = map.checkpoints.length - 1): THREE.Group {
  const group = new THREE.Group();
  const gate = map.checkpoints[index]!;
  const width = Math.hypot(gate.bx - gate.ax, gate.bz - gate.az);
  const geometry = new THREE.PlaneGeometry(width / 16, 1);
  geometry.rotateX(-Math.PI / 2);
  const tiles = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 32);
  const transform = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      transform.makeTranslation(-width / 2 + ((column + 0.5) * width) / 16, 0, row - 0.5);
      tiles.setMatrixAt(row * 16 + column, transform);
      tiles.setColorAt(row * 16 + column, color.set((row + column) % 2 === 0 ? 0xffffff : 0x161616));
    }
  }
  group.add(tiles);
  const x = (gate.ax + gate.bx) / 2;
  const z = (gate.az + gate.bz) / 2;
  group.position.set(x, routeElevationAt(map, x, z, gate.levelId) + 0.4, z);
  group.rotation.y = -Math.atan2(gate.bz - gate.az, gate.bx - gate.ax);
  group.userData.levelId = gate.levelId;
  group.userData.checkpointIndex = index;
  group.userData.finishLine = true;
  return group;
}

export function addBoostFields(group: THREE.Group, map: MapConfig): void {
  for (const field of map.boostFields ?? []) {
    const pad = createGroundPlane(field.rect, 0x078ba8, routeElevationAt(map, field.rect.x, field.rect.z, field.levelId) + 0.045);
    pad.userData.levelId = field.levelId;
    pad.userData.boostFieldId = field.id;
    group.add(pad);
    for (const offset of [-0.5, 0, 0.5]) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.65, 3), new THREE.MeshBasicMaterial({ color: 0xccffff }));
      arrow.rotation.set(Math.PI / 2, 0, field.yaw - Math.PI / 2);
      arrow.position.set(field.rect.x + Math.cos(field.yaw) * offset, pad.position.y + 0.025, field.rect.z + Math.sin(field.yaw) * offset);
      arrow.userData.levelId = field.levelId;
      arrow.userData.boostFieldId = field.id;
      group.add(arrow);
    }
  }
}

/** Finish line, checkpoint gates, jump markers and boost pads for wide-open outdoor courses. */
export function addOutdoorRaceMarkings(group: THREE.Group, map: MapConfig): void {
  group.add(createFinishLine(map, 0));
  for (let index = 1; index < map.checkpoints.length; index += 1) group.add(createGateLine(map, index, MARKING_COLORS.checkpoint, OUTDOOR_GATE_THICKNESS));
  addJumpMarkers(group, map);
  addBoostFields(group, map);
  addSurfaceZones(group, map);
}
