import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** A loader for `public/models/`, whose files are compressed with EXT_meshopt_compression (`scripts/compressModels.mjs`). */
export function createModelLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
