import * as THREE from 'three';
import { NATURE_APPEARANCE } from '../settings';
import type { MapConfig } from '../../shared/mapConfig';
import { hash } from '../../shared/view/sceneryInstancing';

const BIRDS = NATURE_APPEARANCE.birds;
const WING_FLAP_RADIANS = 0.75;
const WING_HINGE = { y: 0.08, z: 0.14 } as const;
type BirdSpecies = (typeof BIRDS.species)[number];
const GLIDE_PERIOD_SECONDS = 7;

interface BirdPath {
  readonly flock: number;
  readonly centre: { readonly x: number; readonly z: number };
  readonly radius: number;
  readonly altitude: number;
  readonly angularSpeed: number;
  readonly phase: number;
  readonly flapPhase: number;
}

function paintedPart(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const tint = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) tint.toArray(colors, index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function placedPart(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  return geometry.applyMatrix4(matrix);
}

/** Songbird body along +x: round back, light belly, orange breast, small beak and a wedge tail. */
function createBodyGeometry(length: number, colors: BirdSpecies): THREE.BufferGeometry {
  const unit = length / 1.5;
  const part = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, scale: THREE.Vector3, rotationZ = 0): THREE.BufferGeometry =>
    paintedPart(
      placedPart(
        geometry,
        new THREE.Matrix4().compose(
          new THREE.Vector3(x * unit, y * unit, 0),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rotationZ)),
          scale.multiplyScalar(unit),
        ),
      ),
      color,
    );
  const sphere = (): THREE.BufferGeometry => new THREE.SphereGeometry(0.5, 12, 8);
  const parts = [
    part(sphere(), colors.back, 0, 0.04, new THREE.Vector3(1.0, 0.5, 0.44)),
    part(sphere(), colors.belly, 0.02, -0.07, new THREE.Vector3(0.8, 0.3, 0.38)),
    part(sphere(), colors.breast, 0.25, -0.04, new THREE.Vector3(0.36, 0.34, 0.4)),
    part(sphere(), colors.back, 0.5, 0.1, new THREE.Vector3(0.3, 0.28, 0.28)),
    part(new THREE.ConeGeometry(0.07, 0.24, 6).rotateZ(-Math.PI / 2), colors.beak, 0.76, 0.1, new THREE.Vector3(1, 1, 1)),
    part(new THREE.BoxGeometry(0.5, 0.035, 0.26), colors.tail, -0.68, 0.05, new THREE.Vector3(1, 1, 1), 0.12),
  ].map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
  const positions = parts.flatMap((geometry) => Array.from(geometry.getAttribute('position').array));
  const vertexColors = parts.flatMap((geometry) => Array.from(geometry.getAttribute('color').array));
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  merged.computeVertexNormals();
  return merged;
}

/** One wing hinged at its root (origin), reaching out along `side` (+1 or -1) on the z axis and swept back. */
function createWingGeometry(length: number, side: 1 | -1): THREE.BufferGeometry {
  const span = length * 0.95 * side;
  const chord = length * 0.6;
  const root = [0.12 * chord, 0, 0] as const;
  const trailingRoot = [-0.45 * chord, 0, 0] as const;
  const trailingMid = [-0.3 * chord, 0, span * 0.55] as const;
  const tip = [-0.55 * chord, 0, span] as const;
  const leadingMid = [0.1 * chord, 0, span * 0.5] as const;
  const triangles = [
    [root, trailingRoot, trailingMid],
    [root, trailingMid, tip],
    [root, tip, leadingMid],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      triangles.flatMap((triangle) => (side === 1 ? triangle : [...triangle].reverse()).flat()),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function birdPaths(map: MapConfig): BirdPath[] {
  const anchors = map.waypoints;
  const paths: BirdPath[] = [];
  for (let flock = 0; flock < BIRDS.flocks; flock += 1) {
    const anchor = anchors[Math.floor(((flock + 0.5) * anchors.length) / BIRDS.flocks)];
    if (!anchor) continue;
    const seed = hash(Math.round(anchor.x), Math.round(anchor.z));
    for (let bird = 0; bird < BIRDS.birdsPerFlock; bird += 1) paths.push(birdPath(anchor, seed, flock, bird));
  }
  return paths;
}

function between(range: { readonly min: number; readonly max: number }, unit: number): number {
  return range.min + (range.max - range.min) * unit;
}

function birdPath(anchor: { x: number; z: number }, seed: number, flock: number, bird: number): BirdPath {
  const unit = (offset: number): number => ((seed >>> offset) % 97) / 97;
  const radius = between(BIRDS.orbitRadiusMeters, unit(flock % 8)) + bird * 2.2;
  const direction = flock % 2 === 0 ? 1 : -1;
  return {
    flock,
    centre: { x: anchor.x + (unit(3) - 0.5) * 24, z: anchor.z + (unit(5) - 0.5) * 24 },
    radius,
    altitude: between(BIRDS.altitudeMeters, unit(7 + bird)) + bird * 0.7,
    angularSpeed: (direction * between(BIRDS.speedMetersPerSecond, unit(9))) / radius,
    phase: unit(11) * Math.PI * 2 + bird * 0.45,
    flapPhase: unit(13 + bird) * Math.PI * 2,
  };
}

export interface BirdFlock {
  readonly object: THREE.Object3D;
  readonly animate: (seconds: number) => void;
}

interface SpeciesFlock {
  readonly paths: readonly BirdPath[];
  readonly bodies: THREE.InstancedMesh;
  readonly wings: readonly THREE.InstancedMesh[];
}

function createSpeciesFlock(species: BirdSpecies, paths: readonly BirdPath[], parent: THREE.Group): SpeciesFlock {
  const bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const wingMaterial = new THREE.MeshLambertMaterial({ color: species.wing, side: THREE.DoubleSide });
  const bodies = new THREE.InstancedMesh(createBodyGeometry(BIRDS.bodyLengthMeters, species), bodyMaterial, paths.length);
  const wings = ([1, -1] as const).map((side) => new THREE.InstancedMesh(createWingGeometry(BIRDS.bodyLengthMeters, side), wingMaterial, paths.length));
  for (const mesh of [bodies, ...wings]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(mesh);
  }
  return { paths, bodies, wings };
}

/** A few small flocks of songbirds circling over the course. Each species (own colors) is three
 *  instanced meshes: bodies, left and right wings. Purely cosmetic; the animation is driven by
 *  elapsed render time only, never by the simulation. */
export function createBirdFlock(map: MapConfig): BirdFlock {
  const group = new THREE.Group();
  const allPaths = birdPaths(map);
  const speciesFlocks = BIRDS.species.map((species, speciesIndex) =>
    createSpeciesFlock(
      species,
      allPaths.filter((path) => path.flock % BIRDS.species.length === speciesIndex),
      group,
    ),
  );
  let elapsed = 0;
  const pose = new THREE.Object3D();
  const hinge = new THREE.Object3D();
  const matrix = new THREE.Matrix4();

  const placeBird = (flock: SpeciesFlock, path: BirdPath, index: number): void => {
    const angle = path.phase + path.angularSpeed * elapsed;
    const direction = Math.sign(path.angularSpeed);
    const heading = Math.atan2(Math.cos(angle) * direction, -Math.sin(angle) * direction);
    pose.position.set(
      path.centre.x + Math.cos(angle) * path.radius,
      path.altitude + Math.sin(elapsed * 0.9 + path.flapPhase) * 0.35,
      path.centre.z + Math.sin(angle) * path.radius,
    );
    pose.rotation.set(direction * BIRDS.bankRadians, -heading, 0, 'YXZ');
    pose.updateMatrix();
    flock.bodies.setMatrixAt(index, pose.matrix);
    const gliding = Math.sin(elapsed * ((Math.PI * 2) / GLIDE_PERIOD_SECONDS) + path.flapPhase) > 0.55;
    const flap = gliding ? 0.12 : Math.sin(elapsed * BIRDS.flapHertz * Math.PI * 2 + path.flapPhase) * WING_FLAP_RADIANS;
    flock.wings.forEach((wing, wingIndex) => {
      const side = wingIndex === 0 ? 1 : -1;
      hinge.position.set(0, WING_HINGE.y, WING_HINGE.z * side);
      hinge.rotation.set(side * flap, 0, 0);
      hinge.updateMatrix();
      wing.setMatrixAt(index, matrix.multiplyMatrices(pose.matrix, hinge.matrix));
    });
  };

  const animate = (seconds: number): void => {
    elapsed += seconds;
    for (const flock of speciesFlocks) {
      flock.paths.forEach((path, index) => placeBird(flock, path, index));
      flock.bodies.instanceMatrix.needsUpdate = true;
      for (const wing of flock.wings) wing.instanceMatrix.needsUpdate = true;
    }
  };
  animate(0);
  return { object: group, animate };
}
