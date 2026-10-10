import * as THREE from 'three';
import * as BUILT_PATTERNS from './builtPatterns';
import * as GROUND_PATTERNS from './groundPatterns';
import type { ToneFunction } from './groundPatterns';

export interface TextureQuality {
  readonly textureSize: number;
  readonly anisotropy: number;
}

export type SurfacePattern =
  | 'asphalt'
  | 'plaster'
  | 'grass'
  | 'turf'
  | 'sand'
  | 'pavers'
  | 'cobble'
  | 'bark'
  | 'planks'
  | 'tiles'
  | 'brick'
  | 'carpet'
  | 'regolith'
  | 'lava'
  | 'plating'
  | 'hull'
  | 'hazard'
  | 'rubber'
  | 'paint'
  | 'fabric';

const TONE_BY_PATTERN: Readonly<Record<SurfacePattern, ToneFunction>> = {
  ...GROUND_PATTERNS,
  ...BUILT_PATTERNS,
};

/** The pixels of a pattern are the same every time: they are worked out once per pattern and size. */
const pixelCache = new Map<string, Uint8Array>();

function patternPixels(pattern: SurfacePattern, size: number): Uint8Array {
  const key = `${pattern}-${size}`;
  const cached = pixelCache.get(key);
  if (cached) return cached;
  const tone = TONE_BY_PATTERN[pattern];
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = Math.round(Math.min(Math.max(tone(x, y, size), 0), 1) * 255);
      pixels.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  pixelCache.set(key, pixels);
  return pixels;
}

export function createSurfaceTexture(pattern: SurfacePattern, config: TextureQuality, colorMap: boolean): THREE.DataTexture {
  const size = config.textureSize;
  const texture = new THREE.DataTexture(patternPixels(pattern, size), size, size);
  texture.name = `house-${pattern}-${colorMap ? 'color' : 'height'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = config.anisotropy;
  if (colorMap) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function setSurfaceUVs(geometry: THREE.BufferGeometry, tileMeters: number, plane = false, offsetX = 0, offsetZ = 0): void {
  const positions = geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index += 1) {
    uv[index * 2] = (positions.getX(index) + offsetX) / tileMeters;
    uv[index * 2 + 1] = ((plane ? -positions.getY(index) : positions.getZ(index)) + offsetZ) / tileMeters;
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

const DEFAULT_TEXTURE_QUALITY: TextureQuality = { textureSize: 256, anisotropy: 4 };

/** Lava glows by itself: its bright cracks light up even in the shade. */
const GLOWING_PATTERNS: ReadonlySet<SurfacePattern> = new Set(['lava']);

/** A lit material with a procedural texture (the pattern is a grey tone map, `color` tints it). The caller disposes the material and its `map`. */
export function texturedMaterial(pattern: SurfacePattern, color: number): THREE.MeshLambertMaterial {
  const map = createSurfaceTexture(pattern, DEFAULT_TEXTURE_QUALITY, true);
  if (!GLOWING_PATTERNS.has(pattern)) return new THREE.MeshLambertMaterial({ color, map });
  return new THREE.MeshLambertMaterial({ color, map, emissive: color, emissiveMap: map });
}

/** A box whose texture keeps its size on every face, whatever the box measures (`tileMeters` per repeat). */
export function texturedBoxGeometry(width: number, height: number, depth: number, tileMeters: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    const facingUp = Math.abs(normals.getY(index)) > 0.5;
    const facingX = Math.abs(normals.getX(index)) > 0.5;
    uv.setXY(
      index,
      (facingX ? positions.getZ(index) : positions.getX(index)) / tileMeters,
      (facingUp ? positions.getZ(index) : positions.getY(index)) / tileMeters,
    );
  }
  return geometry;
}

const sharedTextures = new Map<SurfacePattern, THREE.DataTexture>();

/** One texture per pattern for the many small parts that come and go (kart bodies, tyres, seats): nobody disposes it, it is made only once. */
export function sharedSurfaceTexture(pattern: SurfacePattern): THREE.DataTexture {
  let texture = sharedTextures.get(pattern);
  if (!texture) {
    texture = createSurfaceTexture(pattern, DEFAULT_TEXTURE_QUALITY, true);
    sharedTextures.set(pattern, texture);
  }
  return texture;
}
