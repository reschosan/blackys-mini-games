import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { FAMILY_HOUSE_APPEARANCE } from '../../src/games/kart/maps/familyHouse/settings';
import { HouseSurfaceMaterials } from '../../src/games/kart/maps/familyHouse/view/houseSurfaceMaterials';
import { setSurfaceUVs } from '../../src/shared/effects/surfaceTextures';
import { createMapView, disposeMapView } from '../../src/games/kart/maps/shared/view/mapView';

describe('house surface textures', () => {
  it('shares wall and ceiling maps, but keeps color and height in separate color spaces', () => {
    const materials = new HouseSurfaceMaterials(FAMILY_HOUSE_APPEARANCE);
    expect(materials.wall.map).toBe(materials.ceiling.map);
    expect(materials.road.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(materials.road.bumpMap!.colorSpace).toBe(THREE.NoColorSpace);
    expect(materials.road.map!.generateMipmaps).toBe(true);
    expect(materials.road.map!.wrapS).toBe(THREE.RepeatWrapping);
    materials.dispose();
  });

  it('rebuilds identical texture pixels without consuming gameplay randomness', () => {
    const first = new HouseSurfaceMaterials(FAMILY_HOUSE_APPEARANCE);
    const second = new HouseSurfaceMaterials(FAMILY_HOUSE_APPEARANCE);
    expect(first.road.map!.image.data).toEqual(second.road.map!.image.data);
    first.dispose();
    second.dispose();
  });

  it('uses world-space meters instead of stretching textures to each road segment', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([4, 0, 8, 8, 1, 12], 3));
    setSurfaceUVs(geometry, 4);
    expect([...geometry.getAttribute('uv').array]).toEqual([1, 2, 2, 3]);
    geometry.dispose();
  });

  it('releases shared texture maps exactly once when a house view is removed', () => {
    const view = createMapView(FAMILY_HOUSE);
    const road = view.children.find((child) => child.userData.routeBank) as THREE.Mesh;
    const material = road.material as THREE.MeshStandardMaterial;
    const disposeColor = vi.spyOn(material.map!, 'dispose');
    const disposeHeight = vi.spyOn(material.bumpMap!, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    disposeMapView(view);
    disposeMapView(view);
    expect(disposeColor).toHaveBeenCalledOnce();
    expect(disposeHeight).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
