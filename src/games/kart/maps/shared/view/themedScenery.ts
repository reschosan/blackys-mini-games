import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../../../../../shared/config/assets';
import type { MapConfig, Rect } from '../mapConfig';
import { keepForShare } from './mapDetail';
import { createSurfaceTexture, type SurfacePattern } from '../../../../../shared/effects/surfaceTextures';
import { clearanceFromRoute, hash, instanceVariant, plane, variantsOf, type InstanceStyle, type ScenerySpot } from './sceneryInstancing';
import { isInsideRect } from '../collision';

/** Building blocks the three newer maps (farm, town, city) share: materials, model loading, scattering models over the ground
 *  beside the route, and the hook that marks a map view as ready once its models are in. */

export interface Disposable {
  dispose(): void;
}

export interface TexturedStyle {
  readonly color: number;
  readonly textureSize: number;
  readonly anisotropy: number;
  readonly roughness: number;
}

export function remember(bin: Disposable[], item: Disposable): void {
  bin.push(item);
}

export function texturedMaterial(bin: Disposable[], pattern: SurfacePattern, style: TexturedStyle, metalness = 0.15): THREE.MeshStandardMaterial {
  const texture = createSurfaceTexture(pattern, style, true);
  const material = new THREE.MeshStandardMaterial({ color: style.color, map: texture, roughness: style.roughness, metalness });
  remember(bin, texture);
  remember(bin, material);
  return material;
}

export function basicMaterial(bin: Disposable[], color: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color });
  remember(bin, material);
  return material;
}

export function litMaterial(bin: Disposable[], color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness });
  remember(bin, material);
  return material;
}

export function flatMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.ownsMaterial = false;
  return mesh;
}

/** A box whose texture coordinates follow the world, so a texture keeps its size on boxes of any length. */
export function boxWithWorldUVs(width: number, height: number, depth: number, tileMeters: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    const facingUp = Math.abs(normals.getY(index)) > 0.5;
    const facingX = Math.abs(normals.getX(index)) > 0.5;
    const u = (facingX ? positions.getZ(index) : positions.getX(index)) / tileMeters;
    const v = (facingUp ? positions.getZ(index) : positions.getY(index)) / tileMeters;
    uv.setXY(index, u, v);
  }
  return geometry;
}

export function matrixAt(x: number, y: number, z: number, yaw = 0, scaleX = 1, scaleY = 1, scaleZ = 1): THREE.Matrix4 {
  const transform = new THREE.Object3D();
  transform.position.set(x, y, z);
  transform.rotation.y = yaw;
  transform.scale.set(scaleX, scaleY, scaleZ);
  transform.updateMatrix();
  return transform.matrix.clone();
}

export function instanced(
  bin: Disposable[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  matrices: readonly THREE.Matrix4[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.computeBoundingSphere();
  mesh.userData.ownsMaterial = false;
  remember(bin, material);
  return mesh;
}

/** Is the point within `margin` metres of any of the rects? */
export function isNearAny(rects: readonly Rect[], margin: number, x: number, z: number): boolean {
  return rects.some((rect) => isInsideRect(rect, x, z, margin));
}

export function isAlongX(rect: Rect): boolean {
  return rect.width >= rect.depth;
}

/** Points every `spacingMeters` along the long axis of a rect, starting half a step in. */
export function pointsAlong(rect: Rect, spacingMeters: number): { x: number; z: number }[] {
  const alongX = isAlongX(rect);
  const length = alongX ? rect.width : rect.depth;
  const count = Math.max(Math.floor(length / spacingMeters), 1);
  return Array.from({ length: count }, (_, index) => {
    const along = ((index + 0.5) / count - 0.5) * length;
    return { x: rect.x + (alongX ? along : 0), z: rect.z + (alongX ? 0 : along) };
  });
}

/** The direction from a point to the nearest bit of driveable route, so a house can turn its front towards the street. */
export function directionToRoute(course: MapConfig, x: number, z: number): { x: number; z: number } {
  let best = { x: 0, z: 1, distance: Number.POSITIVE_INFINITY };
  for (const rect of course.driveableSurfaces ?? []) {
    const nearestX = Math.min(Math.max(x, rect.x - rect.width / 2), rect.x + rect.width / 2);
    const nearestZ = Math.min(Math.max(z, rect.z - rect.depth / 2), rect.z + rect.depth / 2);
    const distance = Math.hypot(nearestX - x, nearestZ - z);
    if (distance < best.distance) best = { x: nearestX - x, z: nearestZ - z, distance };
  }
  const length = Math.hypot(best.x, best.z) || 1;
  return { x: best.x / length, z: best.z / length };
}

export interface ModelRef {
  /** Folder below `public/`, for example `models/farm-pack`. */
  readonly directory: string;
  readonly name: string;
}

const modelKey = (ref: ModelRef): string => `${ref.directory}/${ref.name}`;

export interface LoadedModel {
  readonly scene: THREE.Group;
  readonly animations: readonly THREE.AnimationClip[];
}
export type LoadedModels = ReadonlyMap<string, LoadedModel>;

const modelPromises = new Map<string, Promise<LoadedModel>>();

/** One load per file for the whole session; the scenes are shared by every map view that asks, so they are never changed or disposed. */
function loadModels(refs: readonly ModelRef[]): Promise<LoadedModels> {
  return Promise.all(
    refs.map(async (ref) => {
      const key = modelKey(ref);
      let promise = modelPromises.get(key);
      if (!promise) {
        promise = new GLTFLoader()
          .loadAsync(assetUrl(`${ref.directory}/${encodeURIComponent(ref.name)}.glb`))
          .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
        modelPromises.set(key, promise);
      }
      return [key, await promise] as const;
    }),
  ).then((entries) => new Map(entries));
}

export function modelOf(models: LoadedModels, ref: ModelRef): LoadedModel {
  const model = models.get(modelKey(ref));
  if (!model) throw new Error(`Model missing: ${modelKey(ref)}`);
  return model;
}

export function markShared(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.userData.ownsGeometry = false;
    node.userData.ownsMaterial = false;
  });
}

export function sizeOf(object: THREE.Object3D): THREE.Vector3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
}

interface ScatterGroup {
  readonly models: readonly ModelRef[];
  readonly weight: number;
  /** How far from the driveable route (metres) the models stay. */
  readonly clearanceMeters: number;
  readonly heightMeters: number;
  /** Biggest footprint (metres) a model may get; the model is shrunk to fit. */
  readonly maxFootprintMeters: number;
  /** Turn the front of the model towards the nearest street. */
  readonly facesRoute?: boolean;
  /** The model file holds several variants side by side (trees, bushes): each variant is placed on its own. */
  readonly splitVariants?: boolean;
}

export interface ScatterSpec {
  readonly cellMeters: number;
  readonly fillShare: number;
  readonly groups: readonly ScatterGroup[];
}

interface PlacedModel {
  readonly group: ScatterGroup;
  readonly model: ModelRef;
  readonly spot: ScenerySpot;
}

function pickGroup(spec: ScatterSpec, value: number): ScatterGroup {
  const total = spec.groups.reduce((sum, group) => sum + group.weight, 0);
  let roll = (value >>> 12) % total;
  return spec.groups.find((group) => (roll -= group.weight) < 0) ?? spec.groups[0]!;
}

function placedAt(course: MapConfig, spec: ScatterSpec, x: number, z: number, sceneryShare: number): PlacedModel | null {
  const value = hash(x, z);
  if (value % 100 >= spec.fillShare * 100) return null;
  const px = x + (value % 7) - 3;
  const pz = z + ((value >>> 3) % 7) - 3;
  if (!keepForShare(hash(Math.round(px * 10), Math.round(pz * 10)), sceneryShare)) return null;
  const group = pickGroup(spec, value);
  if (clearanceFromRoute(course, px, pz) < group.clearanceMeters) return null;
  const model = group.models[(value >>> 8) % group.models.length]!;
  const towards = group.facesRoute ? directionToRoute(course, px, pz) : null;
  const yaw = towards ? Math.atan2(towards.x, towards.z) : ((value % 360) * Math.PI) / 180;
  return { group, model, spot: { x: px, z: pz, yaw, scale: 0.9 + ((value >>> 16) % 20) / 100 } };
}

/** Jittered grid over the whole room, the same every time: models in groups by weight, kept clear of the route. */
export function scatterPlacements(
  course: MapConfig,
  spec: ScatterSpec,
  sceneryShare: number,
  blocked: (x: number, z: number) => boolean = () => false,
): PlacedModel[] {
  const placements: PlacedModel[] = [];
  const { room } = course;
  const first = (centre: number, size: number): number => Math.ceil((centre - size / 2) / spec.cellMeters) * spec.cellMeters;
  for (let x = first(room.x, room.width); x <= room.x + room.width / 2; x += spec.cellMeters) {
    for (let z = first(room.z, room.depth); z <= room.z + room.depth / 2; z += spec.cellMeters) {
      const placed = placedAt(course, spec, x, z, sceneryShare);
      if (placed && !blocked(placed.spot.x, placed.spot.z)) placements.push(placed);
    }
  }
  return placements;
}

/** Draws the placements as instanced models: one set of instanced meshes per model and group. `style` is the footprint rule. */
export function addScatter(group: THREE.Group, models: LoadedModels, placements: readonly PlacedModel[]): void {
  const byModel = new Map<string, PlacedModel[]>();
  for (const placed of placements) {
    const key = `${modelKey(placed.model)}|${placed.group.heightMeters}|${placed.group.maxFootprintMeters}`;
    const list = byModel.get(key);
    if (list) list.push(placed);
    else byModel.set(key, [placed]);
  }
  for (const list of byModel.values()) {
    const first = list[0]!;
    const scene = modelOf(models, first.model).scene;
    scene.updateMatrixWorld(true);
    const style: InstanceStyle = { toned: false, maxFootprint: first.group.maxFootprintMeters };
    const variants = first.group.splitVariants ? variantsOf(scene) : [scene];
    variants.forEach((variant, index) => {
      const selected = list.filter((placed) => hash(Math.round(placed.spot.x * 10), Math.round(placed.spot.z * 10)) % variants.length === index);
      instanceVariant(
        group,
        variant,
        selected.map((placed) => placed.spot),
        first.group.heightMeters,
        style,
      );
    });
  }
}

export interface Landmark {
  readonly model: ModelRef;
  readonly x: number;
  readonly z: number;
  readonly yawDegrees: number;
  readonly heightMeters: number;
  readonly maxFootprintMeters: number;
}

export function addLandmarks(group: THREE.Group, models: LoadedModels, landmarks: readonly Landmark[]): void {
  for (const landmark of landmarks) {
    const scene = modelOf(models, landmark.model).scene;
    const spot: ScenerySpot = { x: landmark.x, z: landmark.z, yaw: (landmark.yawDegrees * Math.PI) / 180, scale: 1 };
    instanceVariant(group, scene, [spot], landmark.heightMeters, { toned: false, maxFootprint: landmark.maxFootprintMeters });
  }
}

export type Animator = (seconds: number) => void;

/** Loads the models of a map view when a browser is there (tests build views headless), then lets `build` add them to the group. The
 *  view counts as ready (`houseModelLoaded`) once that is done, or as failed so that the race never waits for a missing file. */
export function addPropsWhenLoaded(
  group: THREE.Group,
  refs: readonly ModelRef[],
  label: string,
  build: (models: LoadedModels) => readonly Animator[] | void,
): void {
  if (typeof window === 'undefined') return;
  void loadModels(refs)
    .then((models) => {
      if (group.userData.disposed) return;
      const animators = build(models) ?? [];
      group.userData.animate = (seconds: number) => animators.forEach((animate) => animate(seconds));
      group.userData.houseModelLoaded = true;
    })
    .catch((error: unknown) => {
      group.userData.assetsFailed = true;
      console.error(`${label} assets failed to load`, error);
    });
}

/** Flat ground and route planes, with the textures of the map. */
export function groundAndRoute(
  group: THREE.Group,
  course: MapConfig,
  bin: Disposable[],
  ground: {
    readonly pattern: SurfacePattern;
    readonly style: TexturedStyle & { readonly tileMeters: number };
    readonly size: { readonly width: number; readonly depth: number };
    readonly level: number;
  },
  route: { readonly pattern: SurfacePattern; readonly style: TexturedStyle & { readonly tileMeters: number }; readonly metalness?: number },
): void {
  const groundRect: Rect = { x: course.room.x, z: course.room.z, width: ground.size.width, depth: ground.size.depth };
  group.add(plane(groundRect, texturedMaterial(bin, ground.pattern, ground.style, 0), ground.level, ground.style.tileMeters));
  const routeMaterial = texturedMaterial(bin, route.pattern, route.style, route.metalness ?? 0.05);
  for (const surface of course.driveableSurfaces ?? []) group.add(plane(surface, routeMaterial, 0, route.style.tileMeters));
}
