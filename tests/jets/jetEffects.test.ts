import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { JetEffects } from '../../src/games/jets/view/jetEffects';

describe('jet effects', () => {
  it('draws shots wherever they are in the room: the instanced meshes are not culled by a sphere around the origin', () => {
    const scene = new THREE.Scene();
    const effects = new JetEffects(scene);
    effects.show(
      [
        [80, -60, 20, 0],
        [10, 10, 5, 1],
      ],
      [],
      0.016,
    );
    const instanced = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    expect(instanced).toHaveLength(2);
    expect(instanced.every((mesh) => !mesh.frustumCulled)).toBe(true);
    expect(instanced.map((mesh) => mesh.count)).toEqual([1, 1]);
    effects.dispose();
  });
});
