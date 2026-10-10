import * as THREE from 'three';
import type { ItemConfig } from '../../../../shared/config/items';
import { MAX_PLAYERS } from '../../../../shared/config/players';
import type { TankFire } from '../tankFire';

const SHELL_RADIUS = 0.5;
const SHELL_COLOR = 0xff6a1a;
const EXPLOSION_COLOR = 0xffa23a;
const EXPLOSION_START_RADIUS = 0.6;

type PoolMesh<M extends THREE.Material> = THREE.Mesh<THREE.SphereGeometry, M>;

function createPool<M extends THREE.Material>(parent: THREE.Group, geometry: THREE.SphereGeometry, material: () => M): readonly PoolMesh<M>[] {
  return Array.from({ length: MAX_PLAYERS }, () => {
    const mesh = new THREE.Mesh(geometry, material());
    mesh.visible = false;
    parent.add(mesh);
    return mesh;
  });
}

/** Graybox look of the tank's homing shells and their expanding fireball: two small mesh pools
 *  positioned/hidden each frame to match `TankFire`. Only reads the simulation. */
export class TankFireView {
  readonly object = new THREE.Group();
  private readonly shells = createPool(this.object, new THREE.SphereGeometry(SHELL_RADIUS, 12, 12), () => new THREE.MeshBasicMaterial({ color: SHELL_COLOR }));
  private readonly explosions = createPool(
    this.object,
    new THREE.SphereGeometry(1, 20, 14),
    () => new THREE.MeshBasicMaterial({ color: EXPLOSION_COLOR, transparent: true, opacity: 0.75 }),
  );

  update(fire: TankFire, items: ItemConfig): void {
    this.shells.forEach((mesh, index) => {
      const shell = fire.shells[index];
      mesh.visible = shell !== undefined;
      mesh.userData.active = mesh.visible;
      if (!shell) return;
      mesh.userData.levelId = shell.levelId;
      mesh.position.set(shell.x, shell.elevation + SHELL_RADIUS + 0.2, shell.z);
    });
    this.explosions.forEach((mesh, index) => {
      const explosion = fire.explosions[index];
      mesh.visible = explosion !== undefined;
      mesh.userData.active = mesh.visible;
      if (!explosion) return;
      const progress = Math.min(explosion.ageSeconds / items.tank.explosionVisibleSeconds, 1);
      mesh.userData.levelId = explosion.levelId;
      mesh.position.set(explosion.x, explosion.elevation + 0.6, explosion.z);
      mesh.scale.setScalar(EXPLOSION_START_RADIUS + (items.tank.explosionRadiusMeters - EXPLOSION_START_RADIUS) * progress);
      mesh.material.opacity = 0.6 * (1 - progress);
    });
  }

  dispose(): void {
    this.object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      (node.material as THREE.Material).dispose();
    });
  }
}
