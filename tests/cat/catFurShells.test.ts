import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFurShellGeometry } from '../../src/shared/cat/catFurShells';

function skinnedTriangle(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 1, 2, 0, 0, 2, 3, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0], 4));
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

describe('fur shell geometry', () => {
  it('repeats the body once per layer, with every layer pointing at its own copy of the vertices', () => {
    const shells = createFurShellGeometry(skinnedTriangle(), 4);

    expect(shells.getAttribute('position').count).toBe(12);
    expect(shells.getAttribute('skinIndex').count).toBe(12);
    expect(Array.from(shells.getIndex()!.array)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('tags the layers from the innermost shell to 1 at the hair tips', () => {
    const layers = Array.from(createFurShellGeometry(skinnedTriangle(), 4).getAttribute('aShellLayer').array);

    expect(layers).toEqual([0.25, 0.25, 0.25, 0.5, 0.5, 0.5, 0.75, 0.75, 0.75, 1, 1, 1]);
  });

  it('keeps the skinning data of the source so the shells move with the skeleton', () => {
    const source = skinnedTriangle();
    const shells = createFurShellGeometry(source, 2);

    expect(Array.from(shells.getAttribute('skinWeight').array.slice(0, 12))).toEqual(Array.from(source.getAttribute('skinWeight').array));
    expect(Array.from(shells.getAttribute('skinWeight').array.slice(12))).toEqual(Array.from(source.getAttribute('skinWeight').array));
  });

  it('is built once per source geometry and shared by every cat', () => {
    const source = skinnedTriangle();
    expect(createFurShellGeometry(source, 3)).toBe(createFurShellGeometry(source, 3));
  });
});
