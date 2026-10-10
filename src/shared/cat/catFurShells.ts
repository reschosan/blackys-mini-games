import * as THREE from 'three';

const SHELL_LAYER_ATTRIBUTE = 'aShellLayer';

const shellGeometries = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

type NumericArray = Float32Array | Uint16Array | Uint32Array | Uint8Array | Int8Array | Int16Array | Int32Array;

function repeated(source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, times: number): THREE.BufferAttribute {
  const values = source.array as NumericArray;
  const Constructor = values.constructor as new (length: number) => NumericArray;
  const result = new Constructor(values.length * times);
  for (let copy = 0; copy < times; copy += 1) result.set(values, copy * values.length);
  return new THREE.BufferAttribute(result, source.itemSize, source.normalized);
}

function layerAttribute(vertexCount: number, layers: number): THREE.BufferAttribute {
  const values = new Float32Array(vertexCount * layers);
  for (let layer = 0; layer < layers; layer += 1) values.fill((layer + 1) / layers, layer * vertexCount, (layer + 1) * vertexCount);
  return new THREE.BufferAttribute(values, 1);
}

function repeatedIndex(index: THREE.BufferAttribute, vertexCount: number, layers: number): THREE.BufferAttribute {
  const result = new Uint32Array(index.count * layers);
  for (let layer = 0; layer < layers; layer += 1) {
    for (let at = 0; at < index.count; at += 1) result[layer * index.count + at] = index.getX(at) + layer * vertexCount;
  }
  return new THREE.BufferAttribute(result, 1);
}

/** All fur shells of a skinned cat mesh as ONE geometry: the source vertices repeated once per
 *  layer, each copy tagged with its layer (0..1) in `aShellLayer`. One draw call per cat, and the
 *  shared skinning attributes keep every shell moving with the skeleton. Cached per source geometry,
 *  so all cats share it. */
export function createFurShellGeometry(source: THREE.BufferGeometry, layers: number): THREE.BufferGeometry {
  const cached = shellGeometries.get(source);
  if (cached) return cached;
  const vertexCount = source.getAttribute('position').count;
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const attribute = source.getAttribute(name);
    if (attribute) geometry.setAttribute(name, repeated(attribute, layers));
  }
  geometry.setAttribute(SHELL_LAYER_ATTRIBUTE, layerAttribute(vertexCount, layers));
  const index = source.getIndex();
  if (index) geometry.setIndex(repeatedIndex(index, vertexCount, layers));
  geometry.boundingBox = source.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  shellGeometries.set(source, geometry);
  return geometry;
}
