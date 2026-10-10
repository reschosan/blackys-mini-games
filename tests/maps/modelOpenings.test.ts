import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { geometryWithOpenings } from '../../src/games/kart/maps/familyHouse/view/modelOpenings';

describe('configured house model openings', () => {
  function wall(): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.x = 10;
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  it('opens only the configured doorway and preserves the source geometry and attributes', () => {
    const mesh = wall();
    const original = Array.from(mesh.geometry.getAttribute('position').array);
    const opening = new THREE.Box3(new THREE.Vector3(9, -2.1, -0.1), new THREE.Vector3(11, 1, 0.1));
    const geometry = geometryWithOpenings(mesh, [opening])!;
    const opened = new THREE.Mesh(geometry, mesh.material);
    opened.updateMatrixWorld(true);
    const hits = (x: number, y: number) => new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(opened);
    expect(hits(10, 0)).toHaveLength(0);
    expect(hits(8, 0).length).toBeGreaterThan(0);
    expect(hits(10, 1.5).length).toBeGreaterThan(0);
    expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
    expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(original);
  });

  it('does not clone unrelated geometry', () => {
    expect(geometryWithOpenings(wall(), [new THREE.Box3(new THREE.Vector3(20, 20, 20), new THREE.Vector3(21, 21, 21))])).toBeNull();
  });

  it('removes triangles fully enclosed by an opening', () => {
    const geometry = geometryWithOpenings(wall(), [new THREE.Box3(new THREE.Vector3(6, -3, -1), new THREE.Vector3(14, 3, 1))])!;
    expect(geometry.getAttribute('position').count).toBe(0);
  });
});
