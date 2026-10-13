import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const MODELS_DIRECTORY = 'public/models';
/** The cat is small and skinned with its own fur shader; it stays as it came. */
const UNTOUCHED = new Set(['cat.glb']);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const modelFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? modelFiles(join(directory, entry.name)) : entry.name.endsWith('.glb') ? [join(directory, entry.name)] : [],
  );

const isCompressed = (document) =>
  document
    .getRoot()
    .listExtensionsUsed()
    .some((extension) => extension.extensionName === EXTMeshoptCompression.EXTENSION_NAME);

for (const file of modelFiles(MODELS_DIRECTORY)) {
  if (UNTOUCHED.has(file.slice(MODELS_DIRECTORY.length + 1))) continue;
  const document = await io.read(file);
  if (isCompressed(document)) continue;
  await document.transform(dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85 }));
  // FILTER keeps positions as float32 after decoding: the map views bake model geometry into world space with applyMatrix4.
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(file, document);
  console.log(`compressed ${file}`);
}
