import * as THREE from 'three';
import type { Rect, MapConfig } from '../../shared/mapConfig';
import { SPACE_BOUNDARIES, SPACE_CORNERS } from '../course';
import { SPACE_APPEARANCE } from '../settings';
import { SPACE_STARS } from '../scenery';
import { clearanceFromRoute, hash, plane, surfacePoints } from '../../shared/view/sceneryInstancing';
import { addSpaceProps } from './spaceProps';
import { basicMaterial, boxWithWorldUVs, flatMesh, instanced, matrixAt, remember, texturedMaterial, type Disposable } from '../../shared/view/themedScenery';
import { isInsideRect } from '../../shared/collision';

const {
  centreDashes: SPACE_CENTRE_DASHES,
  craters: SPACE_CRATERS,
  ground: SPACE_GROUND,
  hazard: SPACE_HAZARD,
  hull: SPACE_HULL,
  rail: SPACE_RAIL,
  route: SPACE_ROUTE,
  shoulderRubble: SPACE_SHOULDER_RUBBLE,
} = SPACE_APPEARANCE;

const GROUND_SIZE = { width: 1100, depth: 1000 } as const;
const GROUND_LEVEL = -0.12;
const BARRIER_HEIGHT = 2.4;

function craterSpots(course: MapConfig): { x: number; z: number; radius: number }[] {
  const spots: { x: number; z: number; radius: number }[] = [];
  const { cellMeters, fillShare, minimumRadius, maximumRadius, clearanceMeters } = SPACE_CRATERS;
  const reach = 300;
  for (let x = -reach; x <= reach; x += cellMeters) {
    for (let z = -reach; z <= reach; z += cellMeters) {
      const value = hash(x, z);
      if (value % 100 >= fillShare * 100) continue;
      const radius = minimumRadius + (((value >>> 8) % 100) / 100) * (maximumRadius - minimumRadius);
      const cx = course.room.x + x + (value % 13) - 6;
      const cz = course.room.z + z + ((value >>> 4) % 13) - 6;
      if (clearanceFromRoute(course, cx, cz) < radius + clearanceMeters) continue;
      spots.push({ x: cx, z: cz, radius });
    }
  }
  return spots;
}

function addGround(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const ground: Rect = { x: course.room.x, z: course.room.z, width: GROUND_SIZE.width, depth: GROUND_SIZE.depth };
  group.add(plane(ground, texturedMaterial(bin, 'regolith', SPACE_GROUND, 0), GROUND_LEVEL, SPACE_GROUND.tileMeters));
  const spots = craterSpots(course);
  const discGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const rimGeometry = new THREE.RingGeometry(1, 1.22, 28).rotateX(-Math.PI / 2);
  const discs = spots.map((spot) => matrixAt(spot.x, GROUND_LEVEL + 0.02, spot.z, 0, spot.radius, 1, spot.radius));
  const rims = spots.map((spot) => matrixAt(spot.x, GROUND_LEVEL + 0.03, spot.z, 0, spot.radius, 1, spot.radius));
  group.add(instanced(bin, discGeometry, new THREE.MeshStandardMaterial({ color: SPACE_CRATERS.groundColor, roughness: 1 }), discs));
  group.add(instanced(bin, rimGeometry, new THREE.MeshStandardMaterial({ color: SPACE_CRATERS.rimColor, roughness: 1 }), rims));
}

function nearAny(rects: readonly Rect[], padding: number, x: number, z: number): boolean {
  return rects.some((rect) => isInsideRect(rect, x, z, padding));
}

function isNearGate(course: MapConfig, x: number, z: number): boolean {
  return course.checkpoints.some((gate) => Math.hypot((gate.ax + gate.bx) / 2 - x, (gate.az + gate.bz) / 2 - z) < 8);
}

interface DashMatrices {
  readonly alongX: THREE.Matrix4[];
  readonly alongZ: THREE.Matrix4[];
}

function isDashBlocked(course: MapConfig, blockers: { barriers: readonly Rect[]; boosts: readonly Rect[] }, x: number, z: number): boolean {
  return nearAny(blockers.barriers, SPACE_CENTRE_DASHES.obstacleClearanceMeters, x, z) || nearAny(blockers.boosts, 3, x, z) || isNearGate(course, x, z);
}

function dashesAlongSegment(course: MapConfig, blockers: { barriers: readonly Rect[]; boosts: readonly Rect[] }, index: number, result: DashMatrices): void {
  const from = SPACE_CORNERS[index]!;
  const to = SPACE_CORNERS[(index + 1) % SPACE_CORNERS.length]!;
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const { cornerClearanceMeters, spacingMeters } = SPACE_CENTRE_DASHES;
  for (let distance = cornerClearanceMeters; distance <= length - cornerClearanceMeters; distance += spacingMeters) {
    const x = from.x + ((to.x - from.x) * distance) / length;
    const z = from.z + ((to.z - from.z) * distance) / length;
    if (!isDashBlocked(course, blockers, x, z)) (from.z === to.z ? result.alongX : result.alongZ).push(matrixAt(x, 0.03, z));
  }
}

function centreDashSpots(course: MapConfig): DashMatrices {
  const blockers = { barriers: course.walls.slice(SPACE_BOUNDARIES.length), boosts: (course.boostFields ?? []).map((field) => field.rect) };
  const result: DashMatrices = { alongX: [], alongZ: [] };
  SPACE_CORNERS.forEach((_, index) => dashesAlongSegment(course, blockers, index, result));
  return result;
}

function addRoute(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const route = texturedMaterial(bin, 'plating', SPACE_ROUTE, 0.3);
  for (const surface of course.driveableSurfaces ?? []) group.add(plane(surface, route, 0, SPACE_ROUTE.tileMeters));
  const dashes = centreDashSpots(course);
  const glow = basicMaterial(bin, SPACE_CENTRE_DASHES.color);
  const { lengthMeters, widthMeters } = SPACE_CENTRE_DASHES;
  group.add(instanced(bin, new THREE.BoxGeometry(lengthMeters, 0.04, widthMeters), glow, dashes.alongX));
  group.add(instanced(bin, new THREE.BoxGeometry(widthMeters, 0.04, lengthMeters), glow, dashes.alongZ));
}

function addShoulderRubble(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const { spacingMeters, radiusMeters, color } = SPACE_SHOULDER_RUBBLE;
  const points = surfacePoints(course, { halfWidth: course.room.width / 2, halfDepth: course.room.depth / 2 }, spacingMeters).tall;
  const matrices = points.map((point) => {
    const value = hash(Math.round(point.x * 10), Math.round(point.z * 10));
    const size = radiusMeters * (0.6 + (value % 5) * 0.18);
    return matrixAt(point.x, size * 0.3, point.z, ((value % 360) * Math.PI) / 180, size, size * 0.6, size);
  });
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  group.add(instanced(bin, new THREE.IcosahedronGeometry(1, 0), material, matrices));
}

function railEnds(rect: Rect): { x: number; z: number }[] {
  const horizontal = rect.width > rect.depth;
  const half = (horizontal ? rect.width : rect.depth) / 2;
  return [-half, half].map((offset) => ({ x: rect.x + (horizontal ? offset : 0), z: rect.z + (horizontal ? 0 : offset) }));
}

function addRailPieces(group: THREE.Group, rect: Rect, hull: THREE.Material, glow: THREE.Material): void {
  const body = flatMesh(boxWithWorldUVs(rect.width, SPACE_RAIL.height, rect.depth, SPACE_RAIL.tileMeters), hull);
  body.position.set(rect.x, SPACE_RAIL.height / 2, rect.z);
  const strip = flatMesh(new THREE.BoxGeometry(rect.width * 0.98, 0.14, rect.depth * 0.98), glow);
  strip.position.set(rect.x, SPACE_RAIL.height + 0.07, rect.z);
  group.add(body, strip);
}

function pylonMatrices(rails: readonly Rect[]): THREE.Matrix4[] {
  const ends = new Map<string, { x: number; z: number }>();
  for (const end of rails.flatMap(railEnds)) ends.set(`${Math.round(end.x)},${Math.round(end.z)}`, end);
  return [...ends.values()].map((end) => matrixAt(end.x, 1.6, end.z));
}

function addRails(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const hull = texturedMaterial(bin, 'hull', SPACE_RAIL, 0.35);
  const glowLeft = basicMaterial(bin, SPACE_RAIL.glowLeft);
  const glowRight = basicMaterial(bin, SPACE_RAIL.glowRight);
  const rails = course.walls.slice(0, SPACE_BOUNDARIES.length);
  rails.forEach((rect, index) => addRailPieces(group, rect, hull, index < rails.length / 2 ? glowLeft : glowRight));
  const pylons = pylonMatrices(rails);
  const pylonMaterial = new THREE.MeshStandardMaterial({ color: 0x8b95a8, roughness: 0.5, metalness: 0.4 });
  group.add(instanced(bin, new THREE.CylinderGeometry(0.7, 0.95, 3.2, 10), pylonMaterial, pylons));
  const caps = pylons.map((matrix) => matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.8, 0)));
  group.add(instanced(bin, new THREE.SphereGeometry(0.6, 10, 8), basicMaterial(bin, 0xfff2b0), caps));
}

function beaconPositions(rect: Rect): THREE.Vector3[] {
  const alongX = rect.width >= rect.depth;
  const reach = (alongX ? rect.width : rect.depth) / 2 - 0.6;
  return [-1, 1].map((sign) => new THREE.Vector3(rect.x + (alongX ? sign * reach : 0), BARRIER_HEIGHT + 0.45, rect.z + (alongX ? 0 : sign * reach)));
}

function addBarriers(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const hull = texturedMaterial(bin, 'hull', SPACE_HULL, 0.35);
  const hazard = texturedMaterial(bin, 'hazard', SPACE_HAZARD, 0.1);
  const beacon = basicMaterial(bin, 0xff3b30);
  for (const rect of course.walls.slice(SPACE_BOUNDARIES.length)) {
    const body = flatMesh(boxWithWorldUVs(rect.width, BARRIER_HEIGHT, rect.depth, SPACE_HULL.tileMeters), hull);
    body.position.set(rect.x, BARRIER_HEIGHT / 2, rect.z);
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

function addStars(group: THREE.Group, course: MapConfig, bin: Disposable[]): void {
  const positions = new Float32Array(SPACE_STARS.count * 3);
  const colors = new Float32Array(SPACE_STARS.count * 3);
  for (let index = 0; index < SPACE_STARS.count; index += 1) {
    const azimuth = ((hash(index, 1) % 100000) / 100000) * Math.PI * 2;
    const height = ((hash(index, 2) % 100000) / 100000) * 2 - 1;
    const ring = Math.sqrt(1 - height * height);
    positions.set(
      [Math.cos(azimuth) * ring, Math.abs(height) * 0.9 + 0.02, Math.sin(azimuth) * ring].map((value) => value * SPACE_STARS.radiusMeters),
      index * 3,
    );
    const tint = 0.7 + (hash(index, 3) % 30) / 100;
    colors.set([tint, tint, Math.min(tint + 0.15, 1)], index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: SPACE_STARS.sizePixels, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false });
  const stars = new THREE.Points(geometry, material);
  stars.position.set(course.room.x, 0, course.room.z);
  stars.frustumCulled = false;
  remember(bin, geometry);
  remember(bin, material);
  group.add(stars);
}

export function createSpaceView(course: MapConfig, loadAssets: boolean): THREE.Group {
  const group = new THREE.Group();
  const bin: Disposable[] = [];
  addGround(group, course, bin);
  addRoute(group, course, bin);
  addShoulderRubble(group, course, bin);
  addRails(group, course, bin);
  addBarriers(group, course, bin);
  addStars(group, course, bin);
  group.userData.disposeResources = () => bin.forEach((item) => item.dispose());
  if (loadAssets) addSpaceProps(group, course, bin);
  return group;
}
