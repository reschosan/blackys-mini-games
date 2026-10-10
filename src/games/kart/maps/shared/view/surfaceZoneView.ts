import * as THREE from 'three';
import type { SurfaceKind } from '../../../../../shared/config/surfaces';
import type { SurfaceZone, MapConfig } from '../mapConfig';
import { routeElevationAt } from '../surface';

const TEXTURE_SIZE = 64;
const TILE_METERS = 4;
const ZONE_HEIGHT_ABOVE_ROUTE = 0.035;

type Rgb = readonly [number, number, number];
type Pattern = (x: number, y: number, noise: number) => Rgb;

function noiseAt(x: number, y: number): number {
  const value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 71, 668265263);
  return ((Math.imul(value ^ (value >>> 13), 1274126177) >>> 0) % 1024) / 1023;
}

function scaled(color: Rgb, factor: number): Rgb {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

const PATTERNS: Readonly<Record<SurfaceKind, Pattern>> = {
  mud: (x, y, noise) => scaled([104, 72, 44], noise > 0.9 ? 0.6 : 0.85 + noise * 0.3 + Math.sin(x * 0.4 + y * 0.25) * 0.05),
  moondust: (_x, _y, noise) => (noise > 0.96 ? [255, 255, 255] : scaled([176, 200, 226], 0.9 + noise * 0.15)),
  carpet: (x, y, noise) => {
    const edge = Math.min(x, y, TEXTURE_SIZE - 1 - x, TEXTURE_SIZE - 1 - y);
    if (edge < 4) return [232, 214, 170];
    if (edge < 8) return [92, 26, 38];
    return scaled([160, 44, 52], 0.92 + noise * 0.1);
  },
  puddle: (x, y, noise) => {
    const ring = Math.abs(Math.hypot(x - TEXTURE_SIZE / 2, y - TEXTURE_SIZE / 2) - TEXTURE_SIZE * 0.32) < 2;
    return ring ? [170, 214, 245] : scaled([64, 128, 190], 0.92 + noise * 0.12);
  },
};

function zoneTexture(kind: SurfaceKind): THREE.DataTexture {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const [red, green, blue] = PATTERNS[kind](x, y, noiseAt(x, y));
      pixels.set([Math.min(red, 255), Math.min(green, 255), Math.min(blue, 255), 255], (y * TEXTURE_SIZE + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function zoneMesh(map: MapConfig, zone: SurfaceZone): THREE.Mesh {
  const { rect } = zone;
  const geometry = new THREE.PlaneGeometry(rect.width, rect.depth);
  const wholeRug = zone.kind === 'carpet' || zone.kind === 'puddle';
  const repeatU = wholeRug ? 1 : rect.width / TILE_METERS;
  const repeatV = wholeRug ? 1 : rect.depth / TILE_METERS;
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) uv.setXY(index, uv.getX(index) * repeatU, uv.getY(index) * repeatV);
  const material = new THREE.MeshStandardMaterial({
    map: zoneTexture(zone.kind),
    roughness: zone.kind === 'puddle' ? 0.25 : 0.9,
    transparent: zone.kind === 'puddle',
    opacity: zone.kind === 'puddle' ? 0.85 : 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(rect.x, routeElevationAt(map, rect.x, rect.z, zone.levelId) + ZONE_HEIGHT_ABOVE_ROUTE, rect.z);
  mesh.userData.levelId = zone.levelId;
  mesh.userData.surfaceKind = zone.kind;
  mesh.userData.ownsTexture = true;
  return mesh;
}

/** Flat, patterned patches that show where the ground changes (mud, ice, tiles, rugs, puddles). */
export function addSurfaceZones(group: THREE.Group, map: MapConfig): void {
  for (const zone of map.surfaceZones ?? []) group.add(zoneMesh(map, zone));
}
