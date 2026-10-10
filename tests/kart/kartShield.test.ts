import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { KartView } from '../../src/games/kart/kart/views/kartView';

function shieldOf(view: KartView): THREE.Mesh<THREE.SphereGeometry, THREE.MeshLambertMaterial> {
  return view.object.children.find((child) => {
    const mesh = child as THREE.Mesh;
    return mesh.geometry instanceof THREE.SphereGeometry && (mesh.material as THREE.Material).transparent;
  }) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshLambertMaterial>;
}

describe('nap shield bubble', () => {
  it('is hidden without a shield and clearly visible with one', () => {
    const view = new KartView(createKartLoadout(), 0xff0000);
    view.update(0.016, 5, 0, 0);
    expect(shieldOf(view).visible).toBe(false);
    view.update(0.016, 5, 0, 3);
    expect(shieldOf(view).visible).toBe(true);
    expect(shieldOf(view).material.opacity).toBeGreaterThanOrEqual(0.4);
  });

  it('pulses while it is up', () => {
    const view = new KartView(createKartLoadout(), 0xff0000);
    const scales = new Set<number>();
    for (let step = 0; step < 12; step += 1) {
      view.update(0.05, 5, 0, 3);
      scales.add(Number(shieldOf(view).scale.x.toFixed(3)));
    }
    expect(scales.size).toBeGreaterThan(3);
  });
});
