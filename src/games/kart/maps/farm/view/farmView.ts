import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { MapConfig, Rect } from '../../shared/mapConfig';
import { FARM_BOUNDARIES } from '../course';
import { FARM_APPEARANCE } from '../settings';
import { FARM_FIELDS, FARM_GRAZERS, FARM_LANDMARKS, FARM_MODELS, FARM_PASTURE_FENCES, FARM_SCATTER, type Grazer } from '../scenery';
import { FULL_MAP_DETAIL, type MapDetail } from '../../shared/view/mapDetail';
import {
  addLandmarks,
  addPropsWhenLoaded,
  addScatter,
  flatMesh,
  groundAndRoute,
  instanced,
  isAlongX,
  litMaterial,
  markShared,
  matrixAt,
  isNearAny,
  modelOf,
  pointsAlong,
  scatterPlacements,
  sizeOf,
  type Animator,
  type Disposable,
  type LoadedModels,
} from '../../shared/view/themedScenery';

const { fenceHeightMeters: FENCE_HEIGHT, haybale: HAYBALE, furrows: FURROWS } = FARM_APPEARANCE;
const GROUND_SIZE = { width: 1100, depth: 1000 } as const;
const GROUND_LEVEL = -0.12;
const POST_SPACING_METERS = 4;
const WOOD_COLOR = 0x8a6a45;
const WOOD_DARK_COLOR = 0x5e4630;
const GRAZER_STAGGER_SECONDS = 0.7;

/** A post-and-rail fence along every edge of the route: two rails per stretch and posts in a row. */
function addFences(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const rail = litMaterial(bin, WOOD_COLOR);
  for (const rect of rects) addRails(group, rect, rail);
  const posts = rects.flatMap((rect) => pointsAlong(rect, POST_SPACING_METERS).map((point) => matrixAt(point.x, FENCE_HEIGHT / 2, point.z)));
  group.add(instanced(bin, new THREE.BoxGeometry(0.34, FENCE_HEIGHT, 0.34), litMaterial(bin, WOOD_DARK_COLOR), posts));
}

function addRails(group: THREE.Group, rect: Rect, rail: THREE.Material): void {
  const alongX = isAlongX(rect);
  const length = (alongX ? rect.width : rect.depth) + 0.4;
  for (const height of [FENCE_HEIGHT * 0.42, FENCE_HEIGHT * 0.85]) {
    const mesh = flatMesh(new THREE.BoxGeometry(alongX ? length : 0.16, 0.18, alongX ? 0.16 : length), rail);
    mesh.position.set(rect.x, height, rect.z);
    group.add(mesh);
  }
}

/** A bale is a round, lying cylinder; two rows of two with a bale on top fill the 16 by 6 metre block the karts bump into. */
function addHayBales(group: THREE.Group, rects: readonly Rect[], bin: Disposable[]): void {
  const { radius, length, color } = HAYBALE;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 14).rotateZ(Math.PI / 2);
  const matrices: THREE.Matrix4[] = [];
  for (const rect of rects) {
    const yaw = isAlongX(rect) ? 0 : Math.PI / 2;
    const place = (along: number, across: number, height: number): void => {
      const x = Math.cos(yaw) * along - Math.sin(yaw) * across;
      const z = -Math.sin(yaw) * along - Math.cos(yaw) * across;
      matrices.push(matrixAt(rect.x + x, height, rect.z + z, yaw));
    };
    for (const across of [-radius, radius]) {
      for (const along of [-length / 2 - 0.2, length / 2 + 0.2]) place(along, across, radius);
      place(0, across, radius * 2 - 0.15);
    }
  }
  group.add(instanced(bin, geometry, litMaterial(bin, color, 0.95), matrices));
}

/** Ploughed fields: dark furrows over the grass, in rows that follow the long side of the field. */
function addFields(group: THREE.Group, rects: readonly Rect[], bin: Disposable[], coverShare: number): void {
  const material = litMaterial(bin, FURROWS.color, 1);
  const spacing = FURROWS.spacingMeters / Math.sqrt(Math.max(coverShare, 0.01));
  for (const field of rects) {
    const alongX = isAlongX(field);
    const across = alongX ? field.depth : field.width;
    const length = alongX ? field.width : field.depth;
    const count = Math.floor(across / spacing);
    const strips = Array.from({ length: count }, (_, index) => {
      const offset = ((index + 0.5) / count - 0.5) * across;
      return matrixAt(field.x + (alongX ? 0 : offset), 0.03, field.z + (alongX ? offset : 0));
    });
    group.add(instanced(bin, new THREE.BoxGeometry(alongX ? length - 2 : 1.3, 0.06, alongX ? 1.3 : length - 2), material, strips));
  }
}

function clipFor(animations: readonly THREE.AnimationClip[], clipName: string): THREE.AnimationClip | undefined {
  return animations.find((clip) => clip.name === clipName) ?? animations[0];
}

function createGrazer(models: LoadedModels, grazer: Grazer, index: number): { object: THREE.Object3D; animate: Animator } {
  const model = modelOf(models, grazer.model);
  const object = cloneSkinned(model.scene);
  object.scale.setScalar(grazer.heightMeters / Math.max(sizeOf(object).y, 0.01));
  object.position.set(grazer.x, 0, grazer.z);
  object.rotation.y = (grazer.yawDegrees * Math.PI) / 180;
  markShared(object);
  const mixer = new THREE.AnimationMixer(object);
  const clip = clipFor(model.animations, grazer.clip);
  if (clip) mixer.clipAction(clip).play();
  mixer.setTime(index * GRAZER_STAGGER_SECONDS);
  return { object, animate: (seconds) => mixer.update(seconds) };
}

function addFarmProps(group: THREE.Group, course: MapConfig, detail: MapDetail): void {
  addPropsWhenLoaded(group, FARM_MODELS, 'Farm', (models) => {
    const blocked = (x: number, z: number): boolean =>
      isNearAny(FARM_FIELDS, 4, x, z) ||
      isNearAny(FARM_PASTURE_FENCES, 3, x, z) ||
      FARM_LANDMARKS.some((landmark) => Math.hypot(landmark.x - x, landmark.z - z) < landmark.maxFootprintMeters + 8);
    addScatter(group, models, scatterPlacements(course, FARM_SCATTER, detail.sceneryShare, blocked));
    addLandmarks(group, models, FARM_LANDMARKS);
    return FARM_GRAZERS.map((grazer, index) => {
      const animal = createGrazer(models, grazer, index);
      group.add(animal.object);
      return animal.animate;
    });
  });
}

export function createFarmView(course: MapConfig, loadAssets: boolean, detail: MapDetail = FULL_MAP_DETAIL): THREE.Group {
  const group = new THREE.Group();
  const bin: Disposable[] = [];
  groundAndRoute(
    group,
    course,
    bin,
    { pattern: 'grass', style: FARM_APPEARANCE.ground, size: GROUND_SIZE, level: GROUND_LEVEL },
    { pattern: 'sand', style: FARM_APPEARANCE.route },
  );
  addFences(group, [...FARM_BOUNDARIES, ...FARM_PASTURE_FENCES.flatMap(fenceEdges)], bin);
  addHayBales(group, course.walls.slice(FARM_BOUNDARIES.length), bin);
  addFields(group, FARM_FIELDS, bin, detail.groundCoverShare);
  group.userData.disposeResources = () => bin.forEach((item) => item.dispose());
  if (loadAssets) addFarmProps(group, course, detail);
  return group;
}

/** The four edges of a pasture as thin rects, so the fence code treats them like route edges. */
function fenceEdges(pasture: Rect): Rect[] {
  const thickness = 2;
  return [
    { x: pasture.x, z: pasture.z - pasture.depth / 2, width: pasture.width, depth: thickness },
    { x: pasture.x, z: pasture.z + pasture.depth / 2, width: pasture.width, depth: thickness },
    { x: pasture.x - pasture.width / 2, z: pasture.z, width: thickness, depth: pasture.depth },
    { x: pasture.x + pasture.width / 2, z: pasture.z, width: thickness, depth: pasture.depth },
  ];
}
