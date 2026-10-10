import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { showRouteGuidance } from '../../src/games/kart/maps/familyHouse/view/routeMarkings';
import { createMapView, disposeMapView } from '../../src/games/kart/maps/shared/view/mapView';
import type { RouteNode } from '../../src/games/kart/maps/shared/mapConfig';
import { currentRouteSegment, routeDistanceAt, routeDrivingHint, routeSection } from '../../src/games/kart/maps/shared/routeGuidance';

function overlapOpposite(a: RouteNode, b: RouteNode, c: RouteNode, d: RouteNode): boolean {
  if (a.levelId !== b.levelId || c.levelId !== d.levelId || a.levelId !== c.levelId) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (dx * (d.x - c.x) + dz * (d.z - c.z) >= 0) return false;
  if (Math.abs(dx * (c.z - a.z) - dz * (c.x - a.x)) > 0.001) return false;
  if (Math.abs(dx * (d.z - a.z) - dz * (d.x - a.x)) > 0.001) return false;
  const from = ((c.x - a.x) * dx + (c.z - a.z) * dz) / length;
  const to = ((d.x - a.x) * dx + (d.z - a.z) * dz) / length;
  return Math.min(length, Math.max(from, to)) - Math.max(0, Math.min(from, to)) > 0.001;
}

describe('house route guidance', () => {
  it('renders the configured stair barriers at the same x/z bounds as their colliders', () => {
    const view = createMapView(FAMILY_HOUSE);
    const walls = view.children.filter((node) => node.userData.stairSideWall) as THREE.Mesh[];
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      wall.geometry.computeBoundingBox();
      const rect = FAMILY_HOUSE.stairTransitions!.find((stair) => stair.fromLevelId === wall.userData.levelId)!.sideWalls!.find(
        (rect) => rect.x === wall.position.x,
      )!;
      expect(wall.geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(rect.width, 3);
      expect(wall.geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(rect.depth, 3);
    }
    disposeMapView(view);
  });
  it('marks the complete jump width before takeoff and keeps the finish visible on its floor', () => {
    const view = createMapView(FAMILY_HOUSE);
    for (const jump of FAMILY_HOUSE.windowJumps!) {
      const marker = view.children.find((node) => node.userData.jumpMarker === jump.id)!;
      expect(marker.children.length).toBeGreaterThanOrEqual(5);
      const stripe = marker.children[0] as THREE.Mesh<THREE.PlaneGeometry>;
      const yaw = jump.launchYaw ?? 0;
      expect(stripe.geometry.parameters.height).toBeCloseTo(
        Math.abs(Math.sin(yaw)) * jump.launchRect.width + Math.abs(Math.cos(yaw)) * jump.launchRect.depth,
        3,
      );
      expect(marker.children[1]!.position.x).toBeLessThan(marker.children[0]!.position.x);
    }
    showRouteGuidance(view, FAMILY_HOUSE, 'second', 10, { x: 24, z: 0 });
    expect(view.children.find((node) => node.userData.finishLine)?.visible).toBe(true);
    showRouteGuidance(view, FAMILY_HOUSE, 'first', 7, { x: 0, z: 60 });
    expect(view.children.find((node) => node.userData.finishLine)?.visible).toBe(false);
    disposeMapView(view);
  });
  it('keeps rotating item boxes clear of all direction arrows on their floor', () => {
    const view = createMapView(FAMILY_HOUSE);
    for (const arrow of view.children.filter((node) => typeof node.userData.routeSegmentIndex === 'number' && !node.userData.routeEdge)) {
      for (const box of FAMILY_HOUSE.itemBoxes.filter((box) => box.levelId === arrow.userData.levelId)) {
        expect(Math.hypot(arrow.position.x - box.x, arrow.position.z - box.z)).toBeGreaterThanOrEqual(FAMILY_HOUSE.routeMarkings!.arrowSize + 0.8);
      }
    }
    disposeMapView(view);
  });
  it('gives every configured architectural wall a matching visible collision base', () => {
    const view = createMapView(FAMILY_HOUSE);
    for (const level of FAMILY_HOUSE.levels!) {
      const walls = view.children.find((node) => node.userData.houseWallBase && node.userData.levelId === level.id) as THREE.InstancedMesh;
      expect(walls.count).toBe(level.wallRects!.length);
      for (const [index, rect] of level.wallRects!.entries()) {
        const matrix = new THREE.Matrix4();
        walls.getMatrixAt(index, matrix);
        expect(matrix.elements[12]).toBeCloseTo(rect.x, 4);
        expect(matrix.elements[14]).toBeCloseTo(rect.z, 4);
        expect(matrix.elements[0]).toBeCloseTo(rect.width, 4);
        expect(matrix.elements[10]).toBeCloseTo(rect.depth, 4);
      }
    }
    disposeMapView(view);
  });
  it('has no non-adjacent same-floor crossings or retraced route segments', () => {
    const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;
    const nodes = FAMILY_HOUSE.routeNodes!;
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1]!;
      const b = nodes[i]!;
      if (a.levelId !== b.levelId) continue;
      for (let j = i + 2; j < nodes.length; j += 1) {
        const c = nodes[j - 1]!;
        const d = nodes[j]!;
        if (c.levelId !== d.levelId || c.levelId !== a.levelId) continue;
        const denominator = cross(b.x - a.x, b.z - a.z, d.x - c.x, d.z - c.z);
        if (Math.abs(denominator) < 0.001) {
          expect(overlapOpposite(a, b, c, d)).toBe(false);
          continue;
        }
        const t = cross(c.x - a.x, c.z - a.z, d.x - c.x, d.z - c.z) / denominator;
        const u = cross(c.x - a.x, c.z - a.z, b.x - a.x, b.z - a.z) / denominator;
        expect(t >= 0 && t <= 1 && u >= 0 && u <= 1, `Route crossing ${i}/${j}`).toBe(false);
      }
    }
  });
  it('announces the first right turn and distinguishes an overshot turn from the intended approach', () => {
    expect(routeDrivingHint(FAMILY_HOUSE, { x: -63, z: 86.4, yaw: 0, levelId: 'ground' }, 1)).toBe('↱ Rechts in 36 m');
    expect(routeDrivingHint(FAMILY_HOUSE, { x: 14, z: 86.4, yaw: 0, levelId: 'ground' }, 1)).toBe('↶ Zur Streckenmarkierung');
    expect(currentRouteSegment(FAMILY_HOUSE, 'first', 7, { x: -1.8, z: 60, yaw: Math.PI / 2 })).toBe(32);
  });

  it('keeps boundaries visible while fading arrows by continuous route distance', () => {
    const view = createMapView(FAMILY_HOUSE);
    const pose = { x: 40, z: -85.8, yaw: 0 };
    showRouteGuidance(view, FAMILY_HOUSE, 'first', 6, pose);
    const visible: THREE.Object3D[] = [];
    view.traverse((node) => {
      if (node.visible && typeof node.userData.routeSegmentIndex === 'number') visible.push(node);
    });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((node) => node.userData.levelId === 'first')).toBe(true);
    const arrows = visible.filter((node) => !node.userData.routeEdge);
    expect(arrows.length).toBeGreaterThan(0);
    const progress = routeDistanceAt(FAMILY_HOUSE, currentRouteSegment(FAMILY_HOUSE, 'first', 6, pose), pose);
    expect(
      arrows.every(
        (node) =>
          node.userData.routeDistance > progress - FAMILY_HOUSE.routeMarkings!.fadeDistance &&
          node.userData.routeDistance < progress + FAMILY_HOUSE.routeMarkings!.lookAheadDistance,
      ),
    ).toBe(true);
    expect(arrows.some((node) => ((node as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity < 1)).toBe(true);
    expect(view.children.some((node) => node.visible && node.userData.routeEdge && node.userData.levelId === 'first')).toBe(true);
    disposeMapView(view);
  });
  it('does not pop nearby arrows when a door or window gate changes the mandatory section', () => {
    const view = createMapView(FAMILY_HOUSE);
    const pose = { x: -27, z: 111.4, yaw: Math.PI / 2 };
    const arrows: THREE.Mesh[] = [];
    view.traverse((node) => {
      if (node instanceof THREE.Mesh && typeof node.userData.routeDistance === 'number') arrows.push(node);
    });
    showRouteGuidance(view, FAMILY_HOUSE, 'ground', 1, pose);
    const before = arrows.map((arrow) => ({ visible: arrow.visible, opacity: (arrow.material as THREE.MeshBasicMaterial).opacity }));
    showRouteGuidance(view, FAMILY_HOUSE, 'ground', 2, pose);
    arrows.forEach((arrow, index) => {
      expect(arrow.visible).toBe(before[index]!.visible);
      expect((arrow.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(before[index]!.opacity, 5);
    });
    disposeMapView(view);
  });
  it('does not paint opposing arrows on the same corridor within a mandatory section', () => {
    const nodes = FAMILY_HOUSE.routeNodes!;
    FAMILY_HOUSE.checkpoints.slice(1).forEach((gate, index) => {
      const first = FAMILY_HOUSE.checkpoints[index]!.routeNodeIndex!;
      const last = gate.routeNodeIndex!;
      for (let a = first; a < last; a += 1) {
        for (let b = a + 1; b < last; b += 1)
          expect(overlapOpposite(nodes[a]!, nodes[a + 1]!, nodes[b]!, nodes[b + 1]!), `${gate.name}: segments ${a}/${b}`).toBe(false);
      }
    });
  });
  it('shows only the current mandatory section and updates independently for split-screen views', () => {
    const view = createMapView(FAMILY_HOUSE);
    const arrows: THREE.Object3D[] = [];
    view.traverse((node) => {
      if (typeof node.userData.routeSegmentIndex === 'number') arrows.push(node);
    });
    showRouteGuidance(view, FAMILY_HOUSE, 'ground', 1);
    expect(arrows.some((node) => node.visible)).toBe(true);
    for (const arrow of arrows)
      expect(arrow.visible).toBe(arrow.userData.levelId === 'ground' && arrow.userData.routeSegmentIndex < routeSection(FAMILY_HOUSE, 1).last);
    showRouteGuidance(view, FAMILY_HOUSE, 'first', 6);
    const section = routeSection(FAMILY_HOUSE, 6);
    for (const arrow of arrows)
      expect(arrow.visible).toBe(
        arrow.userData.levelId === 'first' && arrow.userData.routeSegmentIndex >= section.first && arrow.userData.routeSegmentIndex < section.last,
      );
    showRouteGuidance(view, FAMILY_HOUSE, 'ground', 1);
    expect(arrows.filter((node) => node.visible).every((node) => node.userData.levelId === 'ground')).toBe(true);
    disposeMapView(view);
  });
});
