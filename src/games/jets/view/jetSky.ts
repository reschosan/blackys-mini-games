import * as THREE from 'three';
import { sceneryGround } from '../../../shared/effects/surroundings';

/** The world around the fighter jets' room: an evening sky with a low sun, drifting clouds and a ring of hazy mountains on the horizon.
 *  Only looks; it is built from a fixed made-up arrangement, so every screen shows the same sky. */

export const HORIZON_COLOR = 0xf2b48c;
const ZENITH_COLOR = 0x29407a;
const HIGH_SKY_COLOR = 0x6f7fc0;
/** Small enough that a camera at the edge of the room still sees the far side of the dome (the cameras see 600 m). */
const SKY_RADIUS = 430;
const SUN_COLOR = 0xffe6a8;
const MOUNTAIN_COLORS = [0x6b5a8e, 0x7a6497, 0x5d5383];
const MOUNTAIN_COUNT = 26;
const CLOUD_COUNT = 16;
const CLOUD_DRIFT_RADIANS_PER_SECOND = 0.004;
const FAR_GROUND_SIZE = 1400;

const pseudo = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.7 + salt * 47.3) * 24634.6345;
  return value - Math.floor(value);
};

/** A dome coloured from the warm horizon up through a soft blue to the deep evening blue overhead. */
function skyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const horizon = new THREE.Color(HORIZON_COLOR);
  const high = new THREE.Color(HIGH_SKY_COLOR);
  const zenith = new THREE.Color(ZENITH_COLOR);
  const colour = new THREE.Color();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const height = Math.max(position.getY(vertex) / SKY_RADIUS, 0);
    if (height < 0.35) colour.lerpColors(horizon, high, height / 0.35);
    else colour.lerpColors(high, zenith, (height - 0.35) / 0.65);
    colour.toArray(colours, vertex * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -2;
  return dome;
}

/** The low evening sun and its glow, in the warm part of the sky. */
function sun(): THREE.Group {
  const group = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: SUN_COLOR, transparent: true, opacity: 0.25, fog: false, depthWrite: false }),
  );
  const disc = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: SUN_COLOR, fog: false, depthWrite: false }));
  disc.position.z = 1;
  group.add(glow, disc);
  group.traverse((part) => {
    part.renderOrder = -1;
  });
  group.position.set(-SKY_RADIUS * 0.75, 55, -SKY_RADIUS * 0.45);
  group.lookAt(0, 60, 0);
  return group;
}

/** Faceted peaks all around the horizon; the fog makes the far ones fade into the sky. */
function mountains(): THREE.Group {
  const group = new THREE.Group();
  const materials = MOUNTAIN_COLORS.map((color) => new THREE.MeshLambertMaterial({ color, flatShading: true }));
  for (let peak = 0; peak < MOUNTAIN_COUNT; peak += 1) {
    const angle = (peak / MOUNTAIN_COUNT) * Math.PI * 2 + pseudo(peak, 1) * 0.2;
    const distance = 310 + pseudo(peak, 2) * 90;
    const height = 35 + pseudo(peak, 3) * 50;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(height * 1.5, height, 5 + Math.floor(pseudo(peak, 4) * 3)), materials[peak % materials.length]);
    mountain.position.set(Math.cos(angle) * distance, height / 2 - 4, Math.sin(angle) * distance);
    mountain.rotation.y = pseudo(peak, 5) * Math.PI;
    group.add(mountain);
  }
  return group;
}

/** Puffy clouds of a few soft balls each, high and low, all outside the room, so that no cloud hides a plane or the floor. */
function clouds(roomSize: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffd9c2, emissiveIntensity: 0.35, flatShading: true });
  const ball = new THREE.IcosahedronGeometry(1, 1);
  for (let cloud = 0; cloud < CLOUD_COUNT; cloud += 1) {
    const high = cloud % 2 === 0;
    const angle = pseudo(cloud, 6) * Math.PI * 2;
    const distance = roomSize * (0.75 + pseudo(cloud, 7) * 0.9);
    const puff = new THREE.Group();
    puff.position.set(Math.cos(angle) * distance, high ? 70 + pseudo(cloud, 8) * 50 : 25 + pseudo(cloud, 8) * 30, Math.sin(angle) * distance);
    const size = 8 + pseudo(cloud, 9) * 10;
    for (let part = 0; part < 5; part += 1) {
      const piece = new THREE.Mesh(ball, material);
      piece.position.set((part - 2) * size * 0.6, pseudo(cloud * 5 + part, 10) * size * 0.4, (pseudo(cloud * 5 + part, 11) - 0.5) * size * 0.6);
      piece.scale.set(size * (0.7 + pseudo(cloud * 5 + part, 12) * 0.5), size * 0.55, size * 0.7);
      puff.add(piece);
    }
    group.add(puff);
  }
  return group;
}

function farGround(): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FAR_GROUND_SIZE, FAR_GROUND_SIZE), new THREE.MeshLambertMaterial({ color: sceneryGround('town') }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  return ground;
}

export interface JetSky {
  readonly objects: readonly THREE.Object3D[];
  /** The clouds drift slowly around the room. */
  drift(frameSeconds: number): void;
}

export function buildSky(roomSize: number): JetSky {
  const cloudGroup = clouds(roomSize);
  return {
    objects: [skyDome(), sun(), mountains(), cloudGroup, farGround()],
    drift: (frameSeconds) => {
      cloudGroup.rotation.y += CLOUD_DRIFT_RADIANS_PER_SECOND * frameSeconds;
    },
  };
}
