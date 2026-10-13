import * as THREE from 'three';
import { createModelLoader } from '../../../../../shared/effects/modelLoader';
import { assetUrl } from '../../../../../shared/config/assets';
import type { Rect, MapConfig } from '../../shared/mapConfig';
import { NATURE_BOUNDARIES } from '../course';
import { NATURE_APPEARANCE } from '../settings';
import { createSurfaceTexture } from '../../../../../shared/effects/surfaceTextures';
import { createBirdFlock } from './birds';
import { FULL_MAP_DETAIL, keepForShare, type MapDetail } from '../../shared/view/mapDetail';
import { addFlowerFields, addLawnInstances, addTallGrassInstances } from './natureGroundCover';
import { clearanceFromRoute, hash, instanceVariant, plane, variantsOf, type ScenerySpot } from '../../shared/view/sceneryInstancing';

const { bark: NATURE_BARK, ground: NATURE_GROUND, route: NATURE_ROUTE } = NATURE_APPEARANCE;

const ASSETS = [
  'Pine Trees',
  'Maple Trees',
  'Birch Trees',
  'Trees',
  'Dead Trees',
  'Dead Trees-F5I0Q7TwO5',
  'Rocks',
  'Bushes',
  'Flowers',
  'Flower Bushes',
  'Grass',
] as const;
const HEIGHTS = [20, 19, 18, 19, 15, 16, 6, 3.5, 1.8, 3.5] as const;

interface SceneryPoint extends ScenerySpot {
  readonly asset: number;
  readonly variant: number;
}

let assetPromise: Promise<THREE.Group[]> | null = null;

const TEXTURES_PER_GROUND = 3;
const TEXTURES_PER_GROUND_WITHOUT_DETAIL = 1;

function countedCallback(times: number, callback: () => void): () => void {
  let calls = 0;
  return () => {
    calls += 1;
    if (calls === times) callback();
  };
}

type GroundMaps = Partial<Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>>;

function loadGroundMaps(folder: 'mud' | 'forest', tileMeters: number, width: number, depth: number, onLoaded: () => void, detailMaps: boolean): GroundMaps {
  const loader = new THREE.ImageLoader();
  const load = (file: string, colorMap: boolean): THREE.Texture => {
    const texture = new THREE.Texture();
    if (typeof document !== 'undefined')
      loader.load(assetUrl(`textures/${folder}/${file}.jpg`), (image) => {
        texture.image = image;
        texture.needsUpdate = true;
        onLoaded();
      });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / tileMeters, depth / tileMeters);
    texture.anisotropy = detailMaps ? 8 : 1;
    if (colorMap) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const color = load('Color', true);
  return detailMaps ? { map: color, normalMap: load('NormalGL', false), roughnessMap: load('Roughness', false) } : { map: color };
}

function groundMaterial(color: number, maps: GroundMaps, detailMaps: boolean): THREE.Material {
  return detailMaps ? new THREE.MeshStandardMaterial({ color, ...maps }) : new THREE.MeshLambertMaterial({ color, ...maps });
}

function addTerrain(group: THREE.Group, map: MapConfig, detailMaps: boolean): void {
  const ground = { x: 0, z: 0, width: 560, depth: 440 };
  const texturesPerGround = detailMaps ? TEXTURES_PER_GROUND : TEXTURES_PER_GROUND_WITHOUT_DETAIL;
  const markLoadedWhenComplete = countedCallback(2 * texturesPerGround, () => {
    group.userData.groundTexturesLoaded = true;
  });
  const groundMaps = loadGroundMaps('forest', NATURE_GROUND.tileMeters, ground.width, ground.depth, markLoadedWhenComplete, detailMaps);
  const floor = groundMaterial(NATURE_GROUND.color, groundMaps, detailMaps);
  const routeMaps = loadGroundMaps('mud', NATURE_ROUTE.tileMeters, 1, 1, markLoadedWhenComplete, detailMaps);
  const route = groundMaterial(NATURE_ROUTE.color, routeMaps, detailMaps);
  group.userData.disposeNatureMaterials = () => {
    floor.dispose();
    route.dispose();
    for (const texture of [...Object.values(groundMaps), ...Object.values(routeMaps)]) texture?.dispose();
  };
  group.add(plane(ground, floor, -0.12));
  for (const surface of map.driveableSurfaces) group.add(plane(surface, route, 0, NATURE_ROUTE.tileMeters));
}

function layLogAlongAxis(log: THREE.Mesh, alongX: boolean): void {
  log.rotation.z = alongX ? Math.PI / 2 : 0;
  if (!alongX) log.rotation.x = Math.PI / 2;
}

function addFallenLog(group: THREE.Group, wall: Rect, wood: THREE.Material, bark: THREE.Material): void {
  const alongX = wall.width >= wall.depth;
  const length = alongX ? wall.width : wall.depth;
  for (const offset of [-1.8, 0, 1.8]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, length, 8), wood);
    layLogAlongAxis(log, alongX);
    log.position.set(wall.x + (alongX ? 0 : offset), 1, wall.z + (alongX ? offset : 0));
    log.userData.ownsMaterial = false;
    group.add(log);
  }
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 2.4, 9), bark);
  stump.position.set(wall.x, 1.2, wall.z);
  stump.userData.ownsMaterial = false;
  group.add(stump);
}

function addBoundaries(group: THREE.Group, map: MapConfig): void {
  const barkTexture = createSurfaceTexture('bark', NATURE_BARK, true);
  barkTexture.repeat.set(NATURE_BARK.repeatAround, 1);
  const wood = new THREE.MeshStandardMaterial({ color: NATURE_BARK.colorLight, map: barkTexture, roughness: NATURE_BARK.roughness });
  const bark = new THREE.MeshStandardMaterial({ color: NATURE_BARK.colorDark, map: barkTexture, roughness: NATURE_BARK.roughness });
  group.userData.disposeNatureWalls = () => {
    wood.dispose();
    bark.dispose();
    barkTexture.dispose();
  };
  map.walls.forEach((wall, index) => {
    if (index >= NATURE_BOUNDARIES.length) {
      addFallenLog(group, wall, wood, bark);
      return;
    }
    const alongX = wall.width > wall.depth;
    const length = Math.max(wall.width, wall.depth) + 0.8;
    for (const y of [0.55, 1.45]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, length, 9), y === 0.55 ? wood : bark);
      layLogAlongAxis(log, alongX);
      log.position.set(wall.x, y, wall.z);
      log.userData.ownsMaterial = false;
      group.add(log);
    }
  });
}

function sceneryPoints(map: MapConfig): SceneryPoint[] {
  return [...gridSceneryPoints(map), ...NATURE_BOUNDARIES.flatMap((wall) => boundarySceneryPoints(map, wall))];
}

function gridSceneryPoints(map: MapConfig): SceneryPoint[] {
  const points: SceneryPoint[] = [];
  for (let x = -260; x <= 260; x += 10) {
    for (let z = -200; z <= 200; z += 10) {
      const point = gridSceneryPointAt(map, x, z);
      if (point) points.push(point);
    }
  }
  return points;
}

function gridSceneryPointAt(map: MapConfig, x: number, z: number): SceneryPoint | null {
  const value = hash(x, z);
  if (value % 3 !== 0) return null;
  const px = x + (value % 7) - 3;
  const pz = z + (Math.floor(value / 7) % 7) - 3;
  if (clearanceFromRoute(map, px, pz) < 7) return null;
  return { x: px, z: pz, asset: gridAssetFor(value % 16), variant: Math.floor(value / 16) % 5 };
}

function gridAssetFor(kind: number): number {
  if (kind < 10) return kind % 6;
  if (kind < 13) return 7;
  if (kind === 13) return 6;
  return kind === 14 ? 8 : 9;
}

function boundarySceneryPoints(map: MapConfig, wall: (typeof NATURE_BOUNDARIES)[number]): SceneryPoint[] {
  const points: SceneryPoint[] = [];
  const horizontal = wall.width > wall.depth;
  const length = horizontal ? wall.width : wall.depth;
  const count = Math.floor(length / 8);
  for (let index = 0; index < count; index += 1) {
    const along = ((index + 0.5) / count) * length - length / 2;
    const position = clearerSideOfWall(map, wall, horizontal, along);
    if (clearanceFromRoute(map, position.x, position.z) < 6) continue;
    const value = hash(Math.round(position.x), Math.round(position.z));
    points.push({ ...position, asset: value % 6, variant: Math.floor(value / 16) % 5 });
  }
  return points;
}

function clearerSideOfWall(map: MapConfig, wall: (typeof NATURE_BOUNDARIES)[number], horizontal: boolean, along: number): { x: number; z: number } {
  const baseX = wall.x + (horizontal ? along : 0);
  const baseZ = wall.z + (horizontal ? 0 : along);
  const first = { x: baseX + (horizontal ? 0 : 9), z: baseZ + (horizontal ? 9 : 0) };
  const second = { x: baseX - (horizontal ? 0 : 9), z: baseZ - (horizontal ? 9 : 0) };
  return clearanceFromRoute(map, first.x, first.z) > clearanceFromRoute(map, second.x, second.z) ? first : second;
}

function addScenery(group: THREE.Group, map: MapConfig, sources: readonly THREE.Group[], sceneryShare: number): void {
  const points = sceneryPoints(map).filter((point) => keepForShare(hash(Math.round(point.x * 10), Math.round(point.z * 10)), sceneryShare));
  for (let asset = 0; asset < HEIGHTS.length; asset += 1) {
    const source = sources[asset]!;
    source.updateMatrixWorld(true);
    const variants = variantsOf(source);
    variants.forEach((variant, index) => {
      const selected = points.filter((point) => point.asset === asset && point.variant % variants.length === index);
      instanceVariant(group, variant, selected, HEIGHTS[asset]!);
    });
  }
}

function addProps(group: THREE.Group, map: MapConfig, detail: MapDetail): void {
  const coverShare = detail.groundCoverShare;
  if (typeof window === 'undefined') return;
  assetPromise ??= Promise.all(
    ASSETS.map((asset) =>
      createModelLoader()
        .loadAsync(assetUrl(`models/nature-pack/${encodeURIComponent(asset)}.glb`))
        .then((gltf) => gltf.scene),
    ),
  );
  void assetPromise
    .then((sources) => {
      if (group.userData.disposed) return;
      addScenery(group, map, sources, detail.sceneryShare);
      addLawnInstances(group, map, coverShare);
      addFlowerFields(group, map, sources[ASSETS.indexOf('Flowers')]!, coverShare);
      addTallGrassInstances(group, map, sources[ASSETS.length - 1]!, coverShare);
      group.userData.houseModelLoaded = true;
    })
    .catch((error: unknown) => {
      group.userData.assetsFailed = true;
      console.error('Nature assets failed to load', error);
    });
}

export function createNatureView(map: MapConfig, loadAssets: boolean, detail: MapDetail = FULL_MAP_DETAIL): THREE.Group {
  const group = new THREE.Group();
  addTerrain(group, map, detail.groundDetailMaps);
  addBoundaries(group, map);
  if (loadAssets) {
    addProps(group, map, detail);
    const birds = createBirdFlock(map);
    group.add(birds.object);
    group.userData.animate = birds.animate;
  }
  return group;
}
