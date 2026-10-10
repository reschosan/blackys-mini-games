import * as THREE from 'three';
import type { MapConfig, Rect } from '../../shared/mapConfig';
import { CITY_BOUNDARIES, CITY_CORNERS } from '../course';
import { CITY_APPEARANCE } from '../settings';
import { CITY_LANDMARKS, CITY_MODELS, CITY_PARK, CITY_SCATTER, CITY_STREETLIGHT } from '../scenery';
import { FULL_MAP_DETAIL, keepForShare, type MapDetail } from '../../shared/view/mapDetail';
import { clearanceFromRoute, hash, instanceVariant } from '../../shared/view/sceneryInstancing';
import {
  addLandmarks,
  addPropsWhenLoaded,
  addScatter,
  basicMaterial,
  boxWithWorldUVs,
  directionToRoute,
  flatMesh,
  groundAndRoute,
  instanced,
  isAlongX,
  matrixAt,
  isNearAny,
  modelOf,
  pointsAlong,
  remember,
  scatterPlacements,
  texturedMaterial,
  type Disposable,
} from '../../shared/view/themedScenery';

const { centreDashes: DASHES, barrier: BARRIER, kerb: KERB, kerbHeightMeters: KERB_HEIGHT, skyline: SKYLINE } = CITY_APPEARANCE;
const GROUND_SIZE = { width: 1200, depth: 1100 } as const;
const GROUND_LEVEL = -0.12;
const WINDOW_CELLS = 8;
const WINDOW_CELL_PIXELS = 8;
const WINDOW_CELL_METERS = 3.4;
const NEON_BAND_SHARE = 40;

interface DashMatrices {
  readonly alongX: THREE.Matrix4[];
  readonly alongZ: THREE.Matrix4[];
}

function isNearGate(course: MapConfig, x: number, z: number): boolean {
  return course.checkpoints.some((gate) => Math.hypot((gate.ax + gate.bx) / 2 - x, (gate.az + gate.bz) / 2 - z) < 10);
}

/** Dashed lane marking along the middle of every straight, left out around corners, roadworks, boost pads and gates. */
function centreDashSpots(course: MapConfig): DashMatrices {
  const barriers = course.walls.slice(CITY_BOUNDARIES.length);
  const boosts = (course.boostFields ?? []).map((field) => field.rect);
  const result: DashMatrices = { alongX: [], alongZ: [] };
  CITY_CORNERS.forEach((from, index) => {
    const to = CITY_CORNERS[(index + 1) % CITY_CORNERS.length]!;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    for (let distance = DASHES.cornerClearanceMeters; distance <= length - DASHES.cornerClearanceMeters; distance += DASHES.spacingMeters) {
      const x = from.x + ((to.x - from.x) * distance) / length;
      const z = from.z + ((to.z - from.z) * distance) / length;
      if (isNearAny(barriers, DASHES.obstacleClearanceMeters, x, z) || isNearAny(boosts, 3, x, z) || isNearGate(course, x, z)) continue;
      (from.z === to.z ? result.alongX : result.alongZ).push(matrixAt(x, 0.04, z));
    }
  });
  return result;
}

function addLaneMarkings(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const dashes = centreDashSpots(course);
  const paint = basicMaterial(bin, DASHES.color);
  group.add(instanced(bin, new THREE.BoxGeometry(DASHES.lengthMeters, 0.04, DASHES.widthMeters), paint, dashes.alongX));
  group.add(instanced(bin, new THREE.BoxGeometry(DASHES.widthMeters, 0.04, DASHES.lengthMeters), paint, dashes.alongZ));
}

/** A kerb along every street edge, with a neon strip on top (cyan on one side, magenta on the other). */
function addKerbs(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const concrete = texturedMaterial(bin, 'hull', KERB, 0.2);
  const left = basicMaterial(bin, CITY_APPEARANCE.glowLeft);
  const right = basicMaterial(bin, CITY_APPEARANCE.glowRight);
  rects.forEach((rect, index) => {
    const body = flatMesh(boxWithWorldUVs(rect.width, KERB_HEIGHT, rect.depth, KERB.tileMeters), concrete);
    body.position.set(rect.x, KERB_HEIGHT / 2, rect.z);
    const strip = flatMesh(new THREE.BoxGeometry(rect.width * 0.98, 0.14, rect.depth * 0.98), index < rects.length / 2 ? left : right);
    strip.position.set(rect.x, KERB_HEIGHT + 0.07, rect.z);
    group.add(body, strip);
  });
}

function beaconPositions(rect: Rect): THREE.Vector3[] {
  const alongX = isAlongX(rect);
  const reach = (alongX ? rect.width : rect.depth) / 2 - 0.6;
  return [-1, 1].map((sign) => new THREE.Vector3(rect.x + (alongX ? sign * reach : 0), BARRIER.height + 0.45, rect.z + (alongX ? 0 : sign * reach)));
}

/** Roadworks: a concrete block with a hazard band and a red light at each end. */
function addRoadworks(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const concrete = texturedMaterial(bin, 'hull', { ...KERB, color: BARRIER.color }, 0.2);
  const hazard = texturedMaterial(bin, 'hazard', { ...KERB, color: BARRIER.stripeColor, roughness: 0.7 }, 0.1);
  const beacon = basicMaterial(bin, BARRIER.beacon);
  for (const rect of rects) {
    const body = flatMesh(boxWithWorldUVs(rect.width, BARRIER.height, rect.depth, KERB.tileMeters), concrete);
    body.position.set(rect.x, BARRIER.height / 2, rect.z);
    const band = flatMesh(boxWithWorldUVs(rect.width + 0.12, 0.9, rect.depth + 0.12, 4), hazard);
    band.position.set(rect.x, 0.95, rect.z);
    group.add(body, band);
    for (const position of beaconPositions(rect)) {
      const light = flatMesh(new THREE.SphereGeometry(0.45, 10, 8), beacon);
      light.position.copy(position);
      group.add(light);
    }
  }
}

interface FacadePixels {
  readonly colour: Uint8Array;
  readonly glow: Uint8Array;
}

function isWindowPixel(x: number, y: number): boolean {
  const column = x % WINDOW_CELL_PIXELS;
  const row = y % WINDOW_CELL_PIXELS;
  return column >= 2 && column < 7 && row >= 2 && row < 7;
}

function windowIsLit(cellX: number, cellY: number, seed: number): boolean {
  return hash(cellX + seed * 31, cellY + seed * 17) % 100 < 58;
}

function windowIsWarm(cellX: number, cellY: number, seed: number, warmShare: number): boolean {
  return (hash(cellX + seed * 31, cellY + seed * 17) >>> 8) % 100 < warmShare;
}

function writePixel(pixels: FacadePixels, index: number, colour: readonly number[], glow: readonly number[]): void {
  pixels.colour.set([...colour, 255], index);
  pixels.glow.set([...glow, 255], index);
}

function paintFacadePixel(pixels: FacadePixels, x: number, y: number, seed: number, warmShare: number, lights: { warm: THREE.Color; cool: THREE.Color }): void {
  const index = (y * WINDOW_CELLS * WINDOW_CELL_PIXELS + x) * 4;
  if (!isWindowPixel(x, y)) {
    const wall = 30 + (hash(x, y + seed) % 14);
    writePixel(pixels, index, [wall, wall + 2, wall + 14], [0, 0, 0]);
    return;
  }
  const cellX = Math.floor(x / WINDOW_CELL_PIXELS);
  const cellY = Math.floor(y / WINDOW_CELL_PIXELS);
  if (!windowIsLit(cellX, cellY, seed)) {
    writePixel(pixels, index, [20, 26, 40], [0, 0, 0]);
    return;
  }
  const light = windowIsWarm(cellX, cellY, seed, warmShare) ? lights.warm : lights.cool;
  const lit = [light.r * 255, light.g * 255, light.b * 255];
  writePixel(pixels, index, lit, lit);
}

function facadeTexture(pixels: Uint8Array): THREE.DataTexture {
  const size = WINDOW_CELLS * WINDOW_CELL_PIXELS;
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** One tile of a tower block's walls: a grid of windows, some lit warm, some lit cool. Returns the colour and the glow map. */
function createFacadeTextures(seed: number, warmShare: number): { readonly map: THREE.DataTexture; readonly glow: THREE.DataTexture } {
  const size = WINDOW_CELLS * WINDOW_CELL_PIXELS;
  const pixels: FacadePixels = { colour: new Uint8Array(size * size * 4), glow: new Uint8Array(size * size * 4) };
  const lights = { warm: new THREE.Color(SKYLINE.windowColor), cool: new THREE.Color(SKYLINE.windowColorCool) };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) paintFacadePixel(pixels, x, y, seed, warmShare, lights);
  }
  return { map: facadeTexture(pixels.colour), glow: facadeTexture(pixels.glow) };
}

interface TowerClass {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

const TOWER_CLASSES: readonly TowerClass[] = [
  { width: SKYLINE.minFootprint, height: SKYLINE.minHeight, depth: SKYLINE.minFootprint },
  { width: 16, height: 40, depth: 16 },
  { width: 18, height: 52, depth: 18 },
  { width: 20, height: 64, depth: 18 },
  { width: SKYLINE.maxFootprint, height: 76, depth: SKYLINE.maxFootprint },
  { width: 18, height: SKYLINE.maxHeight, depth: 18 },
];

interface Tower {
  readonly x: number;
  readonly z: number;
  readonly towerClass: number;
  readonly facade: number;
}

function towerAt(course: MapConfig, x: number, z: number, sceneryShare: number): Tower | null {
  const value = hash(x, z);
  if (value % 100 >= SKYLINE.fillShare * 100) return null;
  const px = x + (value % 5) - 2;
  const pz = z + ((value >>> 3) % 5) - 2;
  if (clearanceFromRoute(course, px, pz) < SKYLINE.clearanceMeters || isNearAny([CITY_PARK], 6, px, pz)) return null;
  if (!keepForShare(hash(Math.round(px * 10), Math.round(pz * 10)), sceneryShare)) return null;
  return { x: px, z: pz, towerClass: (value >>> 6) % TOWER_CLASSES.length, facade: (value >>> 12) % 3 };
}

function gridAxis(centre: number, size: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil((centre - size / 2) / SKYLINE.cellMeters) * SKYLINE.cellMeters; value <= centre + size / 2; value += SKYLINE.cellMeters)
    values.push(value);
  return values;
}

function towerSpots(course: MapConfig, sceneryShare: number): Tower[] {
  const zValues = gridAxis(course.room.z, course.room.depth);
  return gridAxis(course.room.x, course.room.width).flatMap((x) => zValues.flatMap((z) => towerAt(course, x, z, sceneryShare) ?? []));
}

function createWallMaterials(bin: Disposable[]): THREE.MeshStandardMaterial[] {
  return [createFacadeTextures(1, 70), createFacadeTextures(2, 35), createFacadeTextures(3, 55)].map((facade) => {
    remember(bin, facade.map);
    remember(bin, facade.glow);
    const material = new THREE.MeshStandardMaterial({ map: facade.map, emissive: 0xffffff, emissiveMap: facade.glow, emissiveIntensity: 1.1, roughness: 0.8 });
    remember(bin, material);
    return material;
  });
}

function addTowersOfClass(group: THREE.Group, towers: readonly Tower[], classIndex: number, walls: readonly THREE.Material[], roof: THREE.Material): void {
  const towerClass = TOWER_CLASSES[classIndex]!;
  walls.forEach((wall, facadeIndex) => {
    const spots = towers.filter((tower) => tower.towerClass === classIndex && tower.facade === facadeIndex);
    if (!spots.length) return;
    const geometry = boxWithWorldUVs(towerClass.width, towerClass.height, towerClass.depth, WINDOW_CELLS * WINDOW_CELL_METERS);
    const mesh = new THREE.InstancedMesh(geometry, [wall, wall, roof, roof, wall, wall], spots.length);
    spots.forEach((tower, index) => mesh.setMatrixAt(index, matrixAt(tower.x, towerClass.height / 2, tower.z)));
    mesh.computeBoundingSphere();
    mesh.userData.ownsMaterial = false;
    group.add(mesh);
  });
}

/** A neon band around some of the towers, at a height that depends on the tower; the sides alternate between the two neon colours. */
function neonBandOf(tower: Tower): { readonly matrix: THREE.Matrix4; readonly left: boolean } | null {
  const value = hash(Math.round(tower.x), Math.round(tower.z));
  if (value % 100 >= NEON_BAND_SHARE) return null;
  const towerClass = TOWER_CLASSES[tower.towerClass]!;
  const matrix = matrixAt(tower.x, towerClass.height * (0.55 + (value % 4) * 0.1), tower.z, 0, towerClass.width + 0.5, 1, towerClass.depth + 0.5);
  return { matrix, left: value % 2 === 0 };
}

/** Tower blocks all around: boxes with lit windows, a few with a neon band. The windows glow by themselves (emissive), so the night stays dark but not black. */
function addSkyline(group: THREE.Group, course: MapConfig, bin: Disposable[], sceneryShare: number): void {
  const roof = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.9 });
  remember(bin, roof);
  const walls = createWallMaterials(bin);
  const towers = towerSpots(course, sceneryShare);
  TOWER_CLASSES.forEach((_, classIndex) => addTowersOfClass(group, towers, classIndex, walls, roof));
  const bands = towers.flatMap((tower) => neonBandOf(tower) ?? []);
  const band = new THREE.BoxGeometry(1, 0.7, 1);
  group.add(
    instanced(
      bin,
      band,
      basicMaterial(bin, CITY_APPEARANCE.glowLeft),
      bands.filter((entry) => entry.left).map((entry) => entry.matrix),
    ),
  );
  group.add(
    instanced(
      bin,
      band,
      basicMaterial(bin, CITY_APPEARANCE.glowRight),
      bands.filter((entry) => !entry.left).map((entry) => entry.matrix),
    ),
  );
}

/** The park in the middle: a floor of glowing grid lines in the two neon colours. */
function addParkGrid(group: THREE.Group, bin: Disposable[]): void {
  const { spacingMeters, widthMeters, colors } = CITY_APPEARANCE.parkGrid;
  const alongX: THREE.Matrix4[][] = colors.map(() => []);
  const alongZ: THREE.Matrix4[][] = colors.map(() => []);
  const columns = Math.floor(CITY_PARK.width / spacingMeters);
  const rows = Math.floor(CITY_PARK.depth / spacingMeters);
  for (let column = 0; column <= columns; column += 1)
    alongZ[column % colors.length]!.push(matrixAt(CITY_PARK.x + (column / columns - 0.5) * CITY_PARK.width, 0.03, CITY_PARK.z));
  for (let row = 0; row <= rows; row += 1) alongX[row % colors.length]!.push(matrixAt(CITY_PARK.x, 0.03, CITY_PARK.z + (row / rows - 0.5) * CITY_PARK.depth));
  colors.forEach((color, index) => {
    const glow = basicMaterial(bin, color);
    group.add(instanced(bin, new THREE.BoxGeometry(CITY_PARK.width, 0.03, widthMeters), glow, alongX[index]!));
    group.add(instanced(bin, new THREE.BoxGeometry(widthMeters, 0.03, CITY_PARK.depth), glow, alongZ[index]!));
  });
}

function addStreetlights(group: THREE.Group, course: MapConfig, models: Parameters<typeof modelOf>[0]): void {
  const { model, spacingMeters, heightMeters, maxFootprintMeters, offsetOutsideMeters } = CITY_STREETLIGHT;
  const scene = modelOf(models, model).scene;
  const spots = CITY_BOUNDARIES.flatMap((rect) => pointsAlong(rect, spacingMeters)).map((point) => {
    const towards = directionToRoute(course, point.x, point.z);
    return { x: point.x - towards.x * offsetOutsideMeters, z: point.z - towards.z * offsetOutsideMeters, yaw: Math.atan2(towards.x, towards.z), scale: 1 };
  });
  instanceVariant(group, scene, spots, heightMeters, { toned: false, maxFootprint: maxFootprintMeters });
}

function addCityProps(group: THREE.Group, course: MapConfig, detail: MapDetail): void {
  addPropsWhenLoaded(group, CITY_MODELS, 'City', (models) => {
    const blocked = (x: number, z: number): boolean => isNearAny([CITY_PARK], 2, x, z);
    addStreetlights(group, course, models);
    addScatter(group, models, scatterPlacements(course, CITY_SCATTER, detail.sceneryShare, blocked));
    addLandmarks(group, models, CITY_LANDMARKS);
  });
}

export function createCityView(course: MapConfig, loadAssets: boolean, detail: MapDetail = FULL_MAP_DETAIL): THREE.Group {
  const group = new THREE.Group();
  const bin: Disposable[] = [];
  groundAndRoute(
    group,
    course,
    bin,
    { pattern: 'plating', style: CITY_APPEARANCE.ground, size: GROUND_SIZE, level: GROUND_LEVEL },
    { pattern: 'asphalt', style: CITY_APPEARANCE.route },
  );
  addLaneMarkings(group, course, bin);
  addKerbs(group, CITY_BOUNDARIES, bin);
  addRoadworks(group, course.walls.slice(CITY_BOUNDARIES.length), bin);
  addParkGrid(group, bin);
  addSkyline(group, course, bin, detail.sceneryShare);
  group.userData.disposeResources = () => bin.forEach((item) => item.dispose());
  if (loadAssets) addCityProps(group, course, detail);
  return group;
}
