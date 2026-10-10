import * as THREE from 'three';
import type { Rect } from '../mapConfig';

export function createGroundPlane(rect: Rect, color: number, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.width, rect.depth), new THREE.MeshStandardMaterial({ color, roughness: 0.86 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(rect.x, y, rect.z);
  return mesh;
}
