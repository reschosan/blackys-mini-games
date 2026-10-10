import * as THREE from 'three';
import type { MapConfig, Rect } from '../../shared/mapConfig';
import { TOWN_BOUNDARIES } from '../course';
import { TOWN_APPEARANCE } from '../settings';
import { TOWN_LANDMARKS, TOWN_MODELS, TOWN_SCATTER, TOWN_SQUARE } from '../scenery';
import { FULL_MAP_DETAIL, type MapDetail } from '../../shared/view/mapDetail';
import {
  addLandmarks,
  addPropsWhenLoaded,
  addScatter,
  boxWithWorldUVs,
  directionToRoute,
  flatMesh,
  groundAndRoute,
  instanced,
  isAlongX,
  litMaterial,
  matrixAt,
  isNearAny,
  pointsAlong,
  scatterPlacements,
  texturedMaterial,
  type Disposable,
} from '../../shared/view/themedScenery';

const { wall: WALL, wallHeightMeters: WALL_HEIGHT, stall: STALL, banners: BANNERS } = TOWN_APPEARANCE;
const GROUND_SIZE = { width: 1100, depth: 1000 } as const;
const GROUND_LEVEL = -0.12;
const MERLON_SPACING_METERS = 3.2;
const WALL_THICKNESS = 2;

/** A stone wall along every edge of the street, with a battlement on top. */
function addWalls(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const stone = texturedMaterial(bin, 'pavers', WALL, 0.05);
  for (const rect of rects) {
    const alongX = isAlongX(rect);
    const length = (alongX ? rect.width : rect.depth) + WALL_THICKNESS;
    const body = flatMesh(boxWithWorldUVs(alongX ? length : WALL_THICKNESS, WALL_HEIGHT, alongX ? WALL_THICKNESS : length, WALL.tileMeters), stone);
    body.position.set(rect.x, WALL_HEIGHT / 2, rect.z);
    group.add(body);
  }
  const merlons = rects.flatMap((rect) =>
    pointsAlong(rect, MERLON_SPACING_METERS).map((point) => matrixAt(point.x, WALL_HEIGHT + 0.35, point.z, isAlongX(rect) ? 0 : Math.PI / 2)),
  );
  group.add(instanced(bin, new THREE.BoxGeometry(1.1, 0.7, WALL_THICKNESS + 0.3), litMaterial(bin, 0x8d8576, 0.9), merlons));
}

/** A market stall: a counter, four posts, a striped awning and a pair of crates, filling the block the karts bump into. */
function addStalls(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const wood = litMaterial(bin, STALL.woodColor);
  const awnings = STALL.awningColors.map((color) => litMaterial(bin, color, 0.9));
  rects.forEach((rect, index) => {
    const stall = new THREE.Group();
    const length = Math.max(rect.width, rect.depth);
    const counter = flatMesh(new THREE.BoxGeometry(length - 2, 1.3, STALL.depth - 1), wood);
    counter.position.y = 0.65;
    stall.add(counter);
    for (const x of [-length / 2 + 1, length / 2 - 1]) {
      for (const z of [-STALL.depth / 2 + 0.3, STALL.depth / 2 - 0.3]) {
        const post = flatMesh(new THREE.BoxGeometry(0.3, STALL.height, 0.3), wood);
        post.position.set(x, STALL.height / 2, z);
        stall.add(post);
      }
    }
    const stripes = 6;
    for (let stripe = 0; stripe < stripes; stripe += 1) {
      const piece = flatMesh(new THREE.BoxGeometry((length - 0.6) / stripes, 0.22, STALL.depth + 0.6), awnings[(stripe + index) % awnings.length]!);
      piece.position.set(-length / 2 + 0.3 + ((stripe + 0.5) * (length - 0.6)) / stripes, STALL.height, 0);
      piece.rotation.z = 0.08;
      stall.add(piece);
    }
    for (const x of [-length / 2 + 2.5, length / 2 - 3.5]) {
      const crate = flatMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), wood);
      crate.position.set(x, 2, 0);
      stall.add(crate);
    }
    stall.position.set(rect.x, 0, rect.z);
    stall.rotation.y = isAlongX(rect) ? 0 : Math.PI / 2;
    group.add(stall);
  });
}

/** Cloth banners hanging on the street side of the wall. */
function addBanners(group: THREE.Group, course: MapConfig, rects: readonly Rect[], bin: Disposable[]): void {
  const byColor = BANNERS.colors.map(() => [] as THREE.Matrix4[]);
  let counter = 0;
  for (const rect of rects) {
    const alongX = isAlongX(rect);
    for (const point of pointsAlong(rect, BANNERS.spacingMeters)) {
      const towards = directionToRoute(course, point.x, point.z);
      const offset = WALL_THICKNESS / 2 + 0.15;
      byColor[counter % byColor.length]!.push(
        matrixAt(point.x + towards.x * offset, WALL_HEIGHT - 1.4, point.z + towards.z * offset, alongX ? 0 : Math.PI / 2),
      );
      counter += 1;
    }
  }
  const geometry = new THREE.BoxGeometry(1.8, 2.6, 0.12);
  BANNERS.colors.forEach((color, index) => group.add(instanced(bin, geometry, litMaterial(bin, color, 0.9), byColor[index]!)));
}

function addTownProps(group: THREE.Group, course: MapConfig, detail: MapDetail): void {
  addPropsWhenLoaded(group, TOWN_MODELS, 'Town', (models) => {
    const blocked = (x: number, z: number): boolean =>
      isNearAny([TOWN_SQUARE], 4, x, z) || TOWN_LANDMARKS.some((landmark) => Math.hypot(landmark.x - x, landmark.z - z) < landmark.maxFootprintMeters / 2 + 6);
    addScatter(group, models, scatterPlacements(course, TOWN_SCATTER, detail.sceneryShare, blocked));
    addLandmarks(group, models, TOWN_LANDMARKS);
  });
}

export function createTownView(course: MapConfig, loadAssets: boolean, detail: MapDetail = FULL_MAP_DETAIL): THREE.Group {
  const group = new THREE.Group();
  const bin: Disposable[] = [];
  groundAndRoute(
    group,
    course,
    bin,
    { pattern: 'grass', style: TOWN_APPEARANCE.ground, size: GROUND_SIZE, level: GROUND_LEVEL },
    { pattern: 'cobble', style: TOWN_APPEARANCE.route },
  );
  addWalls(group, TOWN_BOUNDARIES, bin);
  addBanners(group, course, TOWN_BOUNDARIES, bin);
  addStalls(group, course.walls.slice(TOWN_BOUNDARIES.length), bin);
  group.userData.disposeResources = () => bin.forEach((item) => item.dispose());
  if (loadAssets) addTownProps(group, course, detail);
  return group;
}
