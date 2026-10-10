import * as THREE from 'three';
import { itemLookOf, type YarnShape } from '../../../../shared/config/itemLooks';
import type { MapConfig } from '../../maps/shared/mapConfig';
import type { Hairball } from '../hairballs';
import { routeElevationAt } from '../../maps/shared/surface';

const HAIRBALL_RADIUS = 0.4;
const YARN_RADIUS = 0.6;
const YARN_ROLL_PER_METER = 2.4;
const OWNER_COLOR = new THREE.Color();

const HAIRBALL_GEOMETRY = new THREE.SphereGeometry(HAIRBALL_RADIUS, 12, 12);
const YARN_GEOMETRY: Readonly<Record<YarnShape, THREE.BufferGeometry>> = {
  knot: new THREE.TorusKnotGeometry(YARN_RADIUS * 0.7, YARN_RADIUS * 0.3, 48, 8, 2, 3),
  bale: new THREE.CylinderGeometry(YARN_RADIUS, YARN_RADIUS, 1.3, 14).rotateZ(Math.PI / 2),
  cannonball: new THREE.SphereGeometry(YARN_RADIUS * 0.9, 16, 12),
  cable: new THREE.TorusKnotGeometry(YARN_RADIUS * 0.7, YARN_RADIUS * 0.16, 80, 6, 3, 5),
};

type HairballMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

/** Graybox placeholder for airborne hairballs and yarn balls: a mesh pool that grows with the
 *  number of projectiles in flight, positioned/hidden each frame to match `hairballs`. A yarn ball is dressed as the map wants
 *  (hay bale, cannonball, cable tangle); a hairball always looks the same. */
export class HairballView {
  readonly object = new THREE.Group();
  private readonly meshes: HairballMesh[] = [];

  update(map: MapConfig, hairballs: readonly Hairball[], ownerColors: readonly number[]): void {
    while (this.meshes.length < hairballs.length) this.addMesh();
    this.meshes.forEach((mesh, index) => {
      const hairball = hairballs[index];
      mesh.visible = hairball !== undefined;
      mesh.userData.active = mesh.visible;
      if (hairball) this.place(mesh, map, hairball, ownerColors[hairball.ownerIndex] ?? 0xffffff);
    });
  }

  private addMesh(): void {
    const mesh = new THREE.Mesh(HAIRBALL_GEOMETRY, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mesh.visible = false;
    this.meshes.push(mesh);
    this.object.add(mesh);
  }

  private place(mesh: HairballMesh, map: MapConfig, hairball: Hairball, ownerColor: number): void {
    const yarn = hairball.kind === 'yarn';
    const look = itemLookOf(map, 'yarn');
    const radius = yarn ? YARN_RADIUS : HAIRBALL_RADIUS;
    mesh.geometry = yarn ? YARN_GEOMETRY[look.shape] : HAIRBALL_GEOMETRY;
    mesh.userData.levelId = hairball.levelId;
    mesh.position.set(hairball.x, (hairball.elevation ?? routeElevationAt(map, hairball.x, hairball.z, hairball.levelId)) + radius, hairball.z);
    mesh.rotation.set(yarn ? hairball.distanceTraveled * YARN_ROLL_PER_METER : 0, 0, 0);
    if (yarn) mesh.material.color.set(look.color).lerp(OWNER_COLOR.set(ownerColor), look.ownerTint);
    else mesh.material.color.set(ownerColor);
    mesh.material.emissive.set(yarn && look.shape === 'cable' ? look.accent : 0x000000);
  }
}
