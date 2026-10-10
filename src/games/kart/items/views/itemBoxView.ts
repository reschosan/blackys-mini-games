import * as THREE from 'three';
import type { ItemBoxLook } from '../../maps/shared/mapConfig';
import type { MapConfig } from '../../maps/shared/mapConfig';
import type { ItemBoxState } from '../itemBoxes';
import { DEFAULT_ITEM_BOX_LOOK } from '../../maps/shared/mapDefaults';
import { routeElevationAt } from '../../maps/shared/surface';

/** Graybox placeholder pickup: a spinning cube per spawn, hidden while collected. Purely
 *  cosmetic (own render-tick rotation, doesn't read/write simulation state). */
export class ItemBoxView {
  readonly object = new THREE.Group();
  private readonly meshes: readonly THREE.Mesh[];
  private readonly map: MapConfig;
  private readonly look: Readonly<ItemBoxLook>;

  constructor(map: MapConfig) {
    this.map = map;
    this.look = map.itemBoxLook ?? DEFAULT_ITEM_BOX_LOOK;
    this.meshes = map.itemBoxes.map((spawn) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(this.look.size, this.look.size, this.look.size),
        new THREE.MeshLambertMaterial({ color: this.look.color }),
      );
      mesh.position.set(spawn.x, routeElevationAt(map, spawn.x, spawn.z, spawn.levelId) + (spawn.heightOffset ?? 0) + this.look.size / 2, spawn.z);
      if (spawn.levelId) mesh.userData.levelId = spawn.levelId;
      this.object.add(mesh);
      return mesh;
    });
  }

  update(frameSeconds: number, states: readonly ItemBoxState[]): void {
    this.meshes.forEach((mesh, index) => {
      mesh.visible = !(states[index]?.collected ?? false);
      mesh.userData.active = mesh.visible;
      mesh.rotation.y += this.look.spinSpeed * frameSeconds;
      const spawn = this.map.itemBoxes[index]!;
      mesh.position.y = routeElevationAt(this.map, spawn.x, spawn.z, spawn.levelId) + (spawn.heightOffset ?? 0) + this.look.size / 2;
    });
  }
}
