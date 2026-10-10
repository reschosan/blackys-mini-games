import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AVAILABLE_MAPS } from '../../../src/games/kart/maps/registry';
import { NATURE } from '../../../src/games/kart/maps/nature/map';
import { createMapView } from '../../../src/games/kart/maps/shared/view/mapView';

describe('boost field markings', () => {
  it.each(AVAILABLE_MAPS)('points the boost arrows along the authored direction on $name', (map) => {
    const view = createMapView(map);
    for (const field of map.boostFields ?? []) {
      const arrow = view.children.find(
        (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.ConeGeometry && child.userData.boostFieldId === field.id,
      );
      expect(arrow).toBeDefined();
      const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow!.quaternion);
      expect(direction.x).toBeCloseTo(Math.cos(field.yaw));
      expect(direction.z).toBeCloseTo(Math.sin(field.yaw));
    }
  });
});

interface GroundRect {
  readonly color: number;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

function groundRects(map: (typeof AVAILABLE_MAPS)[number]): readonly GroundRect[] {
  return createMapView(map).children.flatMap((child) => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.PlaneGeometry) || child.position.y !== 0) return [];
    const geometry = child.geometry as THREE.PlaneGeometry;
    const material = child.material as THREE.MeshLambertMaterial;
    return [
      {
        color: material.color.getHex(),
        x: child.position.x,
        z: child.position.z,
        width: geometry.parameters.width,
        depth: geometry.parameters.height,
      },
    ];
  });
}

function overlapLength(aStart: number, aLength: number, bStart: number, bLength: number): number {
  return Math.min(aStart + aLength / 2, bStart + bLength / 2) - Math.max(aStart - aLength / 2, bStart - bLength / 2);
}

describe('createMapView', () => {
  it('draws the nature finish line on the lap-counting start gate', () => {
    const view = createMapView(NATURE);
    const finish = view.children.find((child) => child.userData.finishLine === true);
    expect(finish?.userData.checkpointIndex).toBe(0);
    expect(finish?.position.z).toBe(0);
  });

  it.each(AVAILABLE_MAPS)('$name has no overlapping sand and road surfaces', (map) => {
    const rects = groundRects(map);

    for (let index = 0; index < rects.length; index += 1) {
      const current = rects[index];
      if (!current) continue;
      for (const other of rects.slice(index + 1)) {
        if (current.color === other.color) continue;
        const overlapArea =
          Math.max(overlapLength(current.x, current.width, other.x, other.width), 0) *
          Math.max(overlapLength(current.z, current.depth, other.z, other.depth), 0);
        expect(overlapArea).toBe(0);
      }
    }
  });
});
