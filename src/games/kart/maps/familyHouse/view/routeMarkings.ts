import * as THREE from 'three';
import { isOnLevel, type RouteNode, type MapConfig } from '../../shared/mapConfig';
import { currentRouteSegment, routeDistanceAt, routeSection, type RoutePose } from '../../shared/routeGuidance';

export function addRouteMarkers(group: THREE.Group, map: MapConfig): void {
  const nodes = map.routeNodes ?? [];
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1]!;
    const to = nodes[index]!;
    if (from.levelId !== to.levelId) continue;
    const level = map.levels?.find((entry) => entry.id === from.levelId);
    const height = level?.floorHeight ?? 0;
    if (!map.routeBanks) addEdgeMarkings(group, map, index, height);
    addSegmentArrows(group, map, index, height);
  }
}

function addSegmentArrows(group: THREE.Group, map: MapConfig, index: number, height: number): void {
  const nodes = map.routeNodes!;
  const from = nodes[index - 1]!;
  const to = nodes[index]!;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  for (let distance = 4; distance < length; distance += map.routeMarkings?.arrowSpacing ?? 8) {
    const t = distance / length;
    if (arrowOverlapsItem(map, from.x + dx * t, from.z + dz * t, from.levelId)) continue;
    group.add(createRouteArrow(map, from.x + dx * t, from.z + dz * t, height, Math.atan2(dz, dx), from.levelId, index - 1));
  }
  const next = nodes[index + 1];
  if (next?.levelId !== to.levelId || arrowOverlapsItem(map, to.x, to.z, from.levelId)) return;
  const heading = Math.atan2(next.z - to.z, next.x - to.x);
  group.add(createRouteArrow(map, to.x, to.z, height, heading, from.levelId, index - 1));
}

function arrowOverlapsItem(map: MapConfig, x: number, z: number, levelId: string): boolean {
  return map.itemBoxes.some((spawn) => spawn.levelId === levelId && Math.hypot(spawn.x - x, spawn.z - z) < (map.routeMarkings?.arrowSize ?? 1.8) + 0.8);
}

function createRouteArrow(map: MapConfig, x: number, z: number, height: number, yaw: number, levelId: string, segment: number): THREE.Mesh {
  const size = map.routeMarkings?.arrowSize ?? 1.8;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([size, 0, 0, -size * 0.6, 0, -size * 0.7, -size * 0.2, 0, 0, -size * 0.6, 0, size * 0.7], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const arrow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffda72, side: THREE.DoubleSide }));
  arrow.position.set(x, height + 0.32, z);
  arrow.rotation.y = -yaw;
  arrow.userData.levelId = levelId;
  arrow.userData.routeSegmentIndex = segment;
  arrow.userData.routeDistance = routeDistanceAt(map, segment, { x, z });
  return arrow;
}

function cornerTrim(previous: RouteNode | undefined, corner: RouteNode, next: RouteNode | undefined, radius: number): number {
  if (!isOnLevel(previous, corner.levelId) || !isOnLevel(next, corner.levelId)) return 0;
  return Math.min(radius, Math.hypot(corner.x - previous.x, corner.z - previous.z) / 3, Math.hypot(next.x - corner.x, next.z - corner.z) / 3);
}

function roundedSegment(nodes: readonly RouteNode[], index: number, radius: number): THREE.Vector2[] {
  const from = nodes[index - 1]!;
  const to = nodes[index]!;
  const a = new THREE.Vector2(from.x, from.z);
  const b = new THREE.Vector2(to.x, to.z);
  const direction = b.clone().sub(a).normalize();
  const startTrim = cornerTrim(nodes[index - 2], from, to, radius);
  const endTrim = cornerTrim(from, to, nodes[index + 1], radius);
  const start = a.addScaledVector(direction, startTrim);
  const end = b.clone().addScaledVector(direction, -endTrim);
  if (endTrim === 0) return [start, end];
  const next = nodes[index + 1]!;
  const exit = b.clone().addScaledVector(new THREE.Vector2(next.x - to.x, next.z - to.z).normalize(), endTrim);
  return [start, ...new THREE.QuadraticBezierCurve(end, b, exit).getPoints(6)];
}

function edgeTapeMesh(map: MapConfig, points: readonly THREE.Vector2[], side: number): THREE.Mesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  points.forEach((point, pointIndex) => {
    const before = points[Math.max(0, pointIndex - 1)]!;
    const after = points[Math.min(points.length - 1, pointIndex + 1)]!;
    const direction = after.clone().sub(before).normalize();
    for (const edge of [-0.5, 0.5]) {
      const offset = (side * map.driveableWidth) / 2 + edge * (map.routeMarkings?.edgeWidth ?? 0.12);
      vertices.push(point.x - direction.y * offset, 0, point.y + direction.x * offset);
    }
    if (pointIndex > 0) {
      const a = (pointIndex - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xeadfbe, side: THREE.DoubleSide }));
}

function addEdgeMarkings(group: THREE.Group, map: MapConfig, index: number, height: number): void {
  const nodes = map.routeNodes!;
  const points = roundedSegment(nodes, index, map.routeMarkings?.cornerRadius ?? 1.2);
  for (const side of [-1, 1]) {
    const tape = edgeTapeMesh(map, points, side);
    tape.position.y = height + 0.3;
    tape.userData.levelId = nodes[index - 1]!.levelId;
    tape.userData.routeSegmentIndex = index - 1;
    tape.userData.routeEdge = true;
    group.add(tape);
  }
}

interface GuidanceView {
  readonly levelId: string;
  readonly nextCheckpoint: number;
  readonly firstSegment: number;
  readonly lastSegment: number;
  readonly progress: number;
  readonly pose: RoutePose | undefined;
}

function showCheckpointMarker(node: THREE.Object3D, map: MapConfig, view: GuidanceView, checkpoint: number): void {
  const isShownGate = checkpoint === 0 || checkpoint === view.nextCheckpoint || checkpoint === map.checkpoints.length - 1;
  node.visible = node.userData.levelId === view.levelId && isShownGate;
}

function fadeRouteArrow(node: THREE.Object3D, map: MapConfig, view: GuidanceView): void {
  const delta = (node.userData.routeDistance as number) - view.progress;
  const range = map.routeMarkings?.lookAheadDistance ?? 80;
  const fade = map.routeMarkings?.fadeDistance ?? 16;
  const opacity = Math.max(0, Math.min(1, (delta + fade) / fade, (range - delta) / fade));
  node.visible = node.userData.levelId === view.levelId && opacity > 0;
  const material = (node as THREE.Mesh).material as THREE.MeshBasicMaterial;
  material.transparent = true;
  material.depthWrite = false;
  material.opacity = opacity;
}

function showRouteMarker(node: THREE.Object3D, map: MapConfig, view: GuidanceView, segment: number): void {
  if (!view.pose) node.visible = node.userData.levelId === view.levelId && segment >= view.firstSegment && segment < view.lastSegment;
  else if (node.userData.routeEdge) node.visible = node.userData.levelId === view.levelId;
  else fadeRouteArrow(node, map, view);
}

export function showRouteGuidance(group: THREE.Group, map: MapConfig, levelId: string, nextCheckpoint: number, pose?: RoutePose): void {
  const section = routeSection(map, nextCheckpoint);
  const first = pose ? currentRouteSegment(map, levelId, nextCheckpoint, pose) : section.first;
  const view: GuidanceView = {
    levelId,
    nextCheckpoint,
    firstSegment: first,
    lastSegment: section.last,
    progress: pose ? routeDistanceAt(map, first, pose) : 0,
    pose,
  };
  group.traverse((node) => {
    const checkpoint = node.userData.checkpointIndex as number | undefined;
    const segment = node.userData.routeSegmentIndex as number | undefined;
    if (checkpoint !== undefined) showCheckpointMarker(node, map, view, checkpoint);
    if (segment !== undefined) showRouteMarker(node, map, view, segment);
  });
}
