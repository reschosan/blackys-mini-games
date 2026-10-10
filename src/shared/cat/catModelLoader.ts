import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CAT_MODEL } from '../config/catModel';

export interface CatModelSource {
  readonly scene: THREE.Group;
  readonly furMesh: THREE.SkinnedMesh;
  readonly boundsMin: THREE.Vector3;
  readonly boundsMax: THREE.Vector3;
  readonly animations: readonly THREE.AnimationClip[];
}

function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if (!found && (child as THREE.SkinnedMesh).isSkinnedMesh) found = child as THREE.SkinnedMesh;
  });
  if (!found) throw new Error('cat model has no skinned mesh');
  return found;
}

function loadSource(): Promise<CatModelSource> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      CAT_MODEL.url,
      (gltf) => {
        const furMesh = findSkinnedMesh(gltf.scene);
        furMesh.geometry.computeBoundingBox();
        const box = furMesh.geometry.boundingBox ?? new THREE.Box3();
        resolve({
          scene: gltf.scene,
          furMesh,
          boundsMin: box.min.clone(),
          boundsMax: box.max.clone(),
          animations: gltf.animations,
        });
      },
      undefined,
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

let sourcePromise: Promise<CatModelSource> | null = null;

/** Loads the shared cat GLB once; every caller awaits the same cached promise. */
export function loadCatModelSource(): Promise<CatModelSource> {
  if (!sourcePromise) sourcePromise = loadSource();
  return sourcePromise;
}

export interface ClonedCatModel {
  readonly scene: THREE.Group;
  readonly furMesh: THREE.SkinnedMesh;
}

/** Clones the model, sharing geometry but giving each cat its own skeleton to pose independently. */
export function cloneCatModel(source: CatModelSource): ClonedCatModel {
  const scene = cloneSkeleton(source.scene) as THREE.Group;
  return { scene, furMesh: findSkinnedMesh(scene) };
}
