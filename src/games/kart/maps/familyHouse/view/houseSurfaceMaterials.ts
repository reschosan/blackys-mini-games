import * as THREE from 'three';
import type { HouseAppearance, HouseSurfaceStyle } from '../settings';
import { createSurfaceTexture, type SurfacePattern } from '../../../../../shared/effects/surfaceTextures';

export class HouseSurfaceMaterials {
  private readonly textures = new Map<SurfacePattern, readonly [THREE.DataTexture, THREE.DataTexture]>();
  readonly road: THREE.MeshStandardMaterial;
  readonly wall: THREE.MeshStandardMaterial;
  readonly ceiling: THREE.MeshStandardMaterial;
  readonly garden: THREE.MeshStandardMaterial;
  readonly terrace: THREE.MeshStandardMaterial;

  constructor(readonly config: HouseAppearance) {
    this.road = this.createMaterial('planks', config.road);
    this.wall = this.createMaterial('plaster', config.wall);
    this.ceiling = this.createMaterial('plaster', config.ceiling);
    this.garden = this.createMaterial('grass', config.garden);
    this.terrace = this.createMaterial('pavers', config.terrace);
  }

  private createMaterial(pattern: SurfacePattern, style: HouseSurfaceStyle): THREE.MeshStandardMaterial {
    let textures = this.textures.get(pattern);
    if (!textures) {
      textures = [createSurfaceTexture(pattern, this.config, true), createSurfaceTexture(pattern, this.config, false)];
      this.textures.set(pattern, textures);
    }
    return new THREE.MeshStandardMaterial({
      name: `house-${pattern}`,
      color: style.color,
      map: textures[0],
      bumpMap: textures[1],
      bumpScale: style.bumpScale,
      roughness: style.roughness,
      side: THREE.DoubleSide,
    });
  }

  dispose(): void {
    for (const material of [this.road, this.wall, this.ceiling, this.garden, this.terrace]) material.dispose();
    for (const textures of this.textures.values()) textures.forEach((texture) => texture.dispose());
  }
}
