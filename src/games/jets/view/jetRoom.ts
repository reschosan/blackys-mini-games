import * as THREE from 'three';
import { scatterSurroundings } from '../../../shared/effects/surroundings';
import { setSurfaceUVs, texturedBoxGeometry, texturedMaterial } from '../../../shared/effects/surfaceTextures';

const PROP_COUNT = 16;
const PROP_COLORS = [0xc08a62, 0x7fa6c9, 0xc98aa0, 0x9fc28a];
const TEXTURE_METERS = 10;
/** The floor is seen from high up: its boards are big, so it does not flicker into a fine checker. */
const FLOOR_TEXTURE_METERS = 32;
/** A wooden floor seen from high up; the furniture on it is upholstered. */
const FLOOR_TINT = 0xa8865f;
const VILLAGE_PIECES = 28;

/** A fixed, made-up arrangement from a number: the same room on every screen, no game randomness needed. */
const pseudo = (index: number, salt: number): number => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** The floor with a grid and low pieces of furniture on it so that the pilots see how fast they fly (the planes cannot get that low). */
export function buildRoom(size: number): THREE.Object3D[] {
  const groundGeometry = new THREE.PlaneGeometry(size * 1.6, size * 1.6);
  setSurfaceUVs(groundGeometry, FLOOR_TEXTURE_METERS, true);
  const ground = new THREE.Mesh(groundGeometry, texturedMaterial('planks', FLOOR_TINT));
  ground.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(size, Math.round(size / 10), 0x4b5164, 0x3a3f50);
  grid.position.y = 0.02;
  const props = Array.from({ length: PROP_COUNT }, (_, index) => {
    const width = 8 + pseudo(index, 1) * 14;
    const depth = 8 + pseudo(index, 2) * 14;
    const height = 1.5 + pseudo(index, 3) * 1.5;
    const prop = new THREE.Mesh(
      texturedBoxGeometry(width, height, depth, TEXTURE_METERS / 2),
      texturedMaterial('fabric', PROP_COLORS[index % PROP_COLORS.length]!),
    );
    prop.position.set((pseudo(index, 4) - 0.5) * size * 0.9, height / 2, (pseudo(index, 5) - 0.5) * size * 0.9);
    return prop;
  });
  const village = scatterSurroundings('town', { halfWidth: size / 2, halfDepth: size / 2, centreX: 0, centreZ: 0, reach: size * 0.28, count: VILLAGE_PIECES });
  return [ground, grid, ...props, village];
}
