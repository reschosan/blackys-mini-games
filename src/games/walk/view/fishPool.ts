import * as THREE from 'three';

const POOL_SIZE = 8;
const FISH_COLOR = 0xffb347;

/** A few little fish that lie on the floor and bob; the pool is reused, the game decides where they are. */
export class FishPool {
  private readonly fish: THREE.Group[];
  private readonly material = new THREE.MeshLambertMaterial({ color: FISH_COLOR, emissive: FISH_COLOR, emissiveIntensity: 0.35 });
  private readonly geometries = [new THREE.SphereGeometry(0.7, 10, 8), new THREE.ConeGeometry(0.5, 0.9, 8)];

  constructor(private readonly scene: THREE.Scene) {
    this.fish = Array.from({ length: POOL_SIZE }, () => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.geometries[0]!, this.material);
      body.scale.set(1.6, 0.8, 0.7);
      const tail = new THREE.Mesh(this.geometries[1]!, this.material);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -1.5;
      group.add(body, tail);
      group.visible = false;
      scene.add(group);
      return group;
    });
  }

  /** `spots` are the fish of the game as `[x, z, height of the tile they lie on]`. */
  show(spots: readonly (readonly number[])[]): void {
    const bob = Math.sin(performance.now() / 280) * 0.18;
    this.fish.forEach((group, index) => {
      const spot = spots[index];
      group.visible = spot !== undefined;
      if (spot) group.position.set(spot[0]!, (spot[2] ?? 0) + 1.2 + bob, spot[1]!);
      group.rotation.y += 0.02;
    });
  }

  dispose(): void {
    for (const group of this.fish) this.scene.remove(group);
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
  }
}
