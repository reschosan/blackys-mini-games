import * as THREE from 'three';
import { createModelLoader } from '../effects/modelLoader';
import { assetUrl } from '../config/assets';
import { PLANE_MODELS, type PlaneTypeId } from '../config/planeTypes';

const loader = createModelLoader();
const loaded = new Map<PlaneTypeId, Promise<THREE.Object3D>>();

/** A plane model, centred and scaled to its length with the nose along +x (the way a plane flies in the game). The files are loaded once and cloned for every pilot. */
export async function loadPlaneModel(type: PlaneTypeId): Promise<THREE.Object3D> {
  let source = loaded.get(type);
  if (!source) {
    const { file, length, turn } = PLANE_MODELS[type];
    source = loader.loadAsync(assetUrl(`models/space-pack/${file}`)).then((gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = length / Math.max(size.x, size.z);
      const holder = new THREE.Group();
      model.scale.setScalar(scale);
      model.position.set(-box.getCenter(new THREE.Vector3()).x * scale, -box.min.y * scale, -box.getCenter(new THREE.Vector3()).z * scale);
      holder.add(model);
      holder.rotation.y = turn;
      return holder;
    });
    loaded.set(type, source);
  }
  return (await source).clone(true);
}
