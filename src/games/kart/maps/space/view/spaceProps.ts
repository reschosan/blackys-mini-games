import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createModelLoader } from '../../../../../shared/effects/modelLoader';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../../../../../shared/config/assets';
import type { MapConfig } from '../../shared/mapConfig';
import { SPACE_CORNERS } from '../course';
import {
  SPACE_ALL_MODELS,
  SPACE_CHARACTER_PLACEMENTS,
  SPACE_FLYING_SHIPS,
  SPACE_LANDMARKS,
  SPACE_MODEL_DIRECTORY,
  SPACE_PLANET_PLACEMENTS,
  SPACE_SCATTER,
  type NoseAxis,
  type SpaceCharacter,
  type SpaceFlyingShip,
  type SpaceScatterGroup,
} from '../scenery';
import { clearanceFromRoute, hash, instanceVariant, type InstanceStyle, type ScenerySpot } from '../../shared/view/sceneryInstancing';

type Models = ReadonlyMap<string, GLTF>;
type Animator = (seconds: number) => void;

interface Disposable {
  dispose(): void;
}

interface LoopPath {
  readonly length: number;
  at(distance: number): { x: number; z: number; tangentX: number; tangentZ: number };
}

const FULL_SIZE_STYLE: InstanceStyle = { toned: false, maxFootprint: Number.POSITIVE_INFINITY };
const NOSE_YAW: Record<NoseAxis, number> = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
const NOSE_VECTOR: Record<NoseAxis, THREE.Vector3> = {
  '+z': new THREE.Vector3(0, 0, 1),
  '-z': new THREE.Vector3(0, 0, -1),
  '+x': new THREE.Vector3(1, 0, 0),
  '-x': new THREE.Vector3(-1, 0, 0),
};
const SHIP_BOB_METERS = 1.1;
const GLOW_TEXTURE_SIZE = 32;

let modelsPromise: Promise<Models> | null = null;

function loadSpaceModels(): Promise<Models> {
  modelsPromise ??= Promise.all(
    SPACE_ALL_MODELS.map(async (name) => {
      const gltf = await createModelLoader().loadAsync(assetUrl(`${SPACE_MODEL_DIRECTORY}/${encodeURIComponent(name)}.glb`));
      return [name, gltf] as const;
    }),
  ).then((entries) => new Map(entries));
  return modelsPromise;
}

function modelOf(models: Models, name: string): GLTF {
  const model = models.get(name);
  if (!model) throw new Error(`Space model missing: ${name}`);
  return model;
}

function sizeOf(object: THREE.Object3D): THREE.Vector3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
}

function markShared(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.userData.ownsGeometry = false;
    node.userData.ownsMaterial = false;
  });
}

function pickGroup(value: number): SpaceScatterGroup {
  const groups = SPACE_SCATTER.groups;
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  let roll = (value >>> 12) % total;
  return groups.find((group) => (roll -= group.weight) < 0) ?? groups[0]!;
}

function isNearLandmark(x: number, z: number): boolean {
  return (
    SPACE_LANDMARKS.some((landmark) => Math.hypot(landmark.x - x, landmark.z - z) < landmark.radius + 5) ||
    SPACE_CHARACTER_PLACEMENTS.some((placement) => Math.hypot(placement.x - x, placement.z - z) < 7)
  );
}

interface ScatterSpot {
  readonly asset: string;
  readonly spot: ScenerySpot;
}

function scatterSpotAt(course: MapConfig, x: number, z: number): ScatterSpot | null {
  const value = hash(x, z);
  if (value % 100 >= SPACE_SCATTER.fillShare * 100) return null;
  const px = x + (value % 7) - 3;
  const pz = z + ((value >>> 3) % 7) - 3;
  const group = pickGroup(value);
  if (clearanceFromRoute(course, px, pz) < group.clearanceMeters || isNearLandmark(px, pz)) return null;
  return {
    asset: group.assets[(value >>> 8) % group.assets.length]!,
    spot: { x: px, z: pz, scale: 0.85 + ((value >>> 16) % 30) / 100 },
  };
}

export function scatterSpots(course: MapConfig): Map<string, ScenerySpot[]> {
  const spotsByAsset = new Map<string, ScenerySpot[]>();
  const { cellMeters, extentMeters } = SPACE_SCATTER;
  const { room } = course;
  const firstX = Math.ceil((room.x - room.width / 2 - extentMeters.west) / cellMeters) * cellMeters;
  const firstZ = Math.ceil((room.z - room.depth / 2 - extentMeters.north) / cellMeters) * cellMeters;
  for (let x = firstX; x <= room.x + room.width / 2 + extentMeters.east; x += cellMeters) {
    for (let z = firstZ; z <= room.z + room.depth / 2 + extentMeters.south; z += cellMeters) {
      const placed = scatterSpotAt(course, x, z);
      if (placed) spotsByAsset.set(placed.asset, [...(spotsByAsset.get(placed.asset) ?? []), placed.spot]);
    }
  }
  return spotsByAsset;
}

function groupScaleOf(asset: string): number {
  return SPACE_SCATTER.groups.find((group) => (group.assets as readonly string[]).includes(asset))?.scale ?? 1;
}

function addScatter(group: THREE.Group, course: MapConfig, models: Models): void {
  for (const [asset, spots] of scatterSpots(course)) {
    const scene = modelOf(models, asset).scene;
    instanceVariant(group, scene, spots, sizeOf(scene).y * groupScaleOf(asset), FULL_SIZE_STYLE);
  }
}

function addLandmarks(group: THREE.Group, models: Models): void {
  for (const landmark of SPACE_LANDMARKS) {
    const scene = modelOf(models, landmark.asset).scene;
    const spot: ScenerySpot = { x: landmark.x, z: landmark.z, yaw: (landmark.yawDegrees * Math.PI) / 180, scale: 1 };
    instanceVariant(group, scene, [spot], sizeOf(scene).y * landmark.scale, FULL_SIZE_STYLE);
  }
}

function addPlanets(group: THREE.Group, course: MapConfig, models: Models): void {
  for (const placement of SPACE_PLANET_PLACEMENTS) {
    const planet = modelOf(models, placement.asset).scene.clone(true);
    const size = sizeOf(planet);
    const azimuth = (placement.azimuthDegrees * Math.PI) / 180;
    const elevation = (placement.elevationDegrees * Math.PI) / 180;
    planet.scale.setScalar(placement.diameterMeters / Math.max(size.x, size.y, size.z));
    planet.position.set(
      course.room.x + Math.sin(azimuth) * Math.cos(elevation) * placement.distanceMeters,
      Math.sin(elevation) * placement.distanceMeters,
      course.room.z - Math.cos(azimuth) * Math.cos(elevation) * placement.distanceMeters,
    );
    markShared(planet);
    group.add(planet);
  }
}

function clipFor(gltf: GLTF, clipName: string): THREE.AnimationClip | undefined {
  const armature = gltf.animations[0]?.name.split('|')[0] ?? '';
  return THREE.AnimationClip.findByName(gltf.animations, `${armature}|${clipName}`) ?? gltf.animations[0];
}

function createCharacter(models: Models, placement: SpaceCharacter, index: number): { object: THREE.Object3D; animate: Animator } {
  const gltf = modelOf(models, placement.asset);
  const object = cloneSkinned(gltf.scene);
  const baseHeight = placement.hoverHeight ?? 0;
  object.scale.setScalar(placement.scale);
  object.position.set(placement.x, baseHeight, placement.z);
  object.rotation.y = Math.atan2(placement.lookAtX - placement.x, placement.lookAtZ - placement.z);
  markShared(object);
  const mixer = new THREE.AnimationMixer(object);
  const clip = clipFor(gltf, placement.clip);
  if (clip) mixer.clipAction(clip).play();
  mixer.setTime(index * 0.7);
  let elapsed = index;
  const animate: Animator = (seconds) => {
    elapsed += seconds;
    mixer.update(seconds);
    if (baseHeight > 0) object.position.y = baseHeight + Math.sin(elapsed * 1.6) * 0.6;
  };
  return { object, animate };
}

function addCharacters(group: THREE.Group, models: Models): Animator[] {
  return SPACE_CHARACTER_PLACEMENTS.map((placement, index) => {
    const character = createCharacter(models, placement, index);
    group.add(character.object);
    return character.animate;
  });
}

function createLoopPath(points: readonly { readonly x: number; readonly z: number }[]): LoopPath {
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
  const length = lengths.reduce((sum, value) => sum + value, 0);
  return {
    length,
    at(distance) {
      let remaining = ((distance % length) + length) % length;
      let index = 0;
      while (remaining > lengths[index]!) remaining -= lengths[index++]!;
      const from = points[index]!;
      const to = points[(index + 1) % points.length]!;
      const fraction = remaining / lengths[index]!;
      return {
        x: from.x + (to.x - from.x) * fraction,
        z: from.z + (to.z - from.z) * fraction,
        tangentX: (to.x - from.x) / lengths[index]!,
        tangentZ: (to.z - from.z) / lengths[index]!,
      };
    },
  };
}

function createOrbitPath(course: MapConfig, ship: SpaceFlyingShip): LoopPath {
  const radii = ship.orbitRadii ?? { x: 250, z: 200 };
  const steps = 96;
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return { x: course.room.x + Math.cos(angle) * radii.x, z: course.room.z + Math.sin(angle) * radii.z };
  });
  return createLoopPath(points);
}

function createGlowTexture(): THREE.DataTexture {
  const pixels = new Uint8Array(GLOW_TEXTURE_SIZE * GLOW_TEXTURE_SIZE * 4);
  for (let y = 0; y < GLOW_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < GLOW_TEXTURE_SIZE; x += 1) {
      const distance = Math.hypot(x - GLOW_TEXTURE_SIZE / 2 + 0.5, y - GLOW_TEXTURE_SIZE / 2 + 0.5) / (GLOW_TEXTURE_SIZE / 2);
      const strength = Math.max(0, 1 - distance) ** 2;
      pixels.set([255, 255, 255, Math.round(strength * 255)], (y * GLOW_TEXTURE_SIZE + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE);
  texture.needsUpdate = true;
  return texture;
}

function createShip(models: Models, ship: SpaceFlyingShip, glow: THREE.SpriteMaterial): THREE.Group {
  const holder = new THREE.Group();
  const model = modelOf(models, ship.asset).scene.clone(true);
  markShared(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const noseVector = NOSE_VECTOR[ship.nose];
  const halfLength = Math.abs(noseVector.dot(size)) / 2;
  const engine = new THREE.Sprite(glow);
  engine.position.copy(bounds.getCenter(new THREE.Vector3())).addScaledVector(noseVector, -halfLength);
  engine.scale.setScalar(Math.max(size.x, size.z) * 0.55);
  holder.add(model, engine);
  holder.rotation.y = NOSE_YAW[ship.nose];
  holder.scale.setScalar(ship.scale);
  const pivot = new THREE.Group();
  pivot.add(holder);
  return pivot;
}

function flyShip(pivot: THREE.Group, ship: SpaceFlyingShip, path: LoopPath, index: number): Animator {
  const direction = ship.reverse ? -1 : 1;
  let travelled = ship.startFraction * path.length;
  let elapsed = index * 1.7;
  return (seconds) => {
    elapsed += seconds;
    travelled += direction * ship.speedMetersPerSecond * seconds;
    const spot = path.at(travelled);
    pivot.position.set(spot.x, ship.heightMeters + Math.sin(elapsed * 0.9) * SHIP_BOB_METERS, spot.z);
    pivot.rotation.y = Math.atan2(direction * spot.tangentX, direction * spot.tangentZ);
    pivot.rotation.z = Math.sin(elapsed * 0.6) * 0.1;
  };
}

function addShips(group: THREE.Group, course: MapConfig, models: Models, bin: Disposable[]): Animator[] {
  const glowTexture = createGlowTexture();
  const glow = new THREE.SpriteMaterial({ map: glowTexture, color: 0x7fd8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  bin.push(glowTexture, glow);
  const coursePath = createLoopPath(SPACE_CORNERS);
  return SPACE_FLYING_SHIPS.map((ship, index) => {
    const pivot = createShip(models, ship, glow);
    group.add(pivot);
    return flyShip(pivot, ship, ship.path === 'course' ? coursePath : createOrbitPath(course, ship), index);
  });
}

export function addSpaceProps(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  if (typeof window === 'undefined') return;
  void loadSpaceModels()
    .then((models) => {
      if (group.userData.disposed) return;
      addScatter(group, course, models);
      addLandmarks(group, models);
      addPlanets(group, course, models);
      const animators = [...addCharacters(group, models), ...addShips(group, course, models, bin)];
      group.userData.animate = (seconds: number) => animators.forEach((animate) => animate(seconds));
      group.userData.houseModelLoaded = true;
    })
    .catch((error: unknown) => {
      group.userData.assetsFailed = true;
      console.error('Space assets failed to load', error);
    });
}
