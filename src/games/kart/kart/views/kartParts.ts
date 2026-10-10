import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KART_DIMENSIONS as KART } from '../../../../shared/config/kart';
import type { WheelTypeId } from '../../../../shared/config/kartLoadout';
import { sharedSurfaceTexture, type SurfacePattern } from '../../../../shared/effects/surfaceTextures';

export type Vec3 = readonly [number, number, number];

export const DARK_COLOR = 0x2a2a30;
export const LIGHT_COLOR = 0xe9e9ee;
export const LAMP_COLOR = 0xfff2a0;
export const TAIL_LAMP_COLOR = 0xe0302a;

const ROUNDED_SEGMENTS = 3;
const ROLLER_COLOR = 0x3a3a3f;
const TREAD_BAR_COLOR = 0x1c1c20;

export function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** A part with a surface: lacquer on the body, rubber on the tyres. The texture is shared by all karts and never disposed with one. */
export function texturedLambert(color: number, pattern: SurfacePattern): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, map: sharedSurfaceTexture(pattern) });
}

export function shade(color: number, factor: number): number {
  return new THREE.Color(color).multiplyScalar(factor).getHex();
}

export function addBox(parent: THREE.Object3D, size: Vec3, material: THREE.Material, position: Vec3, radius = 0.05): THREE.Mesh {
  const safeRadius = Math.min(radius, Math.min(...size) / 2 - 0.001);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], ROUNDED_SEGMENTS, safeRadius), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

export function addSphere(parent: THREE.Object3D, radius: number, material: THREE.Material, position: Vec3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

/** A cylinder whose axis lies along the given world axis of the kart (x forward, y up, z sideways). */
export function addCylinder(
  parent: THREE.Object3D,
  axis: 'x' | 'y' | 'z',
  radius: number,
  length: number,
  material: THREE.Material,
  position: Vec3,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

/** A thin rod between two points in the kart's x/y plane (e.g. a motorcycle fork). */
export function addRod(
  parent: THREE.Object3D,
  from: readonly [number, number],
  to: readonly [number, number],
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const rod = addCylinder(parent, 'y', radius, length, material, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0]);
  rod.rotation.z = Math.atan2(from[0] - to[0], to[1] - from[1]);
  return rod;
}

export interface BarStrip {
  readonly bars: readonly THREE.Mesh[];
  readonly barBaseX: readonly number[];
  readonly length: number;
}

interface BarStripSpec {
  readonly length: number;
  readonly count: number;
  readonly barWidth: number;
  readonly barHeight: number;
  readonly barDepth: number;
  readonly color: number;
}

function wrapWithin(value: number, half: number): number {
  const range = half * 2;
  let wrapped = (value + half) % range;
  if (wrapped < 0) wrapped += range;
  return wrapped - half;
}

/** Evenly spaced bars along x; `scrollBars` shifts them so the strip visibly runs. */
export function addBarStrip(parent: THREE.Object3D, spec: BarStripSpec, position: Vec3): BarStrip {
  const material = lambert(spec.color);
  const geometry = new THREE.BoxGeometry(spec.barWidth, spec.barHeight, spec.barDepth);
  const spacing = spec.length / (spec.count + 1);
  const bars: THREE.Mesh[] = [];
  const barBaseX: number[] = [];
  for (let index = 1; index <= spec.count; index += 1) {
    const baseX = -spec.length / 2 + spacing * index;
    const bar = new THREE.Mesh(geometry, material);
    bar.position.set(position[0] + baseX, position[1], position[2]);
    parent.add(bar);
    bars.push(bar);
    barBaseX.push(baseX);
  }
  return { bars, barBaseX, length: spec.length };
}

export function scrollBars(strip: BarStrip, centerX: number, scroll: number): void {
  const half = strip.length / 2;
  strip.bars.forEach((bar, index) => {
    bar.position.x = centerX + wrapWithin(strip.barBaseX[index]! - scroll, half);
  });
}

export interface TreadmillBelt {
  readonly strip: BarStrip;
  readonly centerX: number;
  readonly rollers: readonly THREE.Mesh[];
}

/** A motorized-looking treadmill deck (belt + end rollers + tread bars) in the player's color. */
export function addTreadmillBelt(parent: THREE.Object3D, playerColor: number, length: number, centerX: number, baseY: number): TreadmillBelt {
  const width = KART.width * KART.stripeWidthFactor;
  const topY = baseY + KART.stripeHeight;
  addBox(parent, [length, KART.stripeHeight, width], lambert(playerColor), [centerX, baseY + KART.stripeHeight / 2, 0], 0.008);

  const rollerMaterial = lambert(ROLLER_COLOR);
  const rollers = [-1, 1].map((side) =>
    addCylinder(parent, 'z', KART.beltRollerRadius, width, rollerMaterial, [
      centerX + side * (length / 2),
      topY - KART.stripeHeight / 2 + KART.beltRollerRadius * 0.4,
      0,
    ]),
  );

  const strip = addBarStrip(
    parent,
    {
      length,
      count: KART.beltTreadBarCount,
      barWidth: KART.beltTreadBarWidth,
      barHeight: KART.beltTreadBarHeight,
      barDepth: width * 0.92,
      color: TREAD_BAR_COLOR,
    },
    [centerX, topY + KART.beltTreadBarHeight / 2, 0],
  );
  return { strip, centerX, rollers };
}

export interface KartWheel {
  readonly object: THREE.Group;
  readonly radius: number;
}

interface WheelLook {
  readonly radiusFactor: number;
  readonly thicknessFactor: number;
  readonly tireColor: number;
  readonly hubColor: number;
  readonly knobs: boolean;
}

const WHEEL_LOOKS: Readonly<Record<WheelTypeId, WheelLook>> = {
  standard: { radiusFactor: 1, thicknessFactor: 1, tireColor: 0x2b2b2b, hubColor: 0xb8b8c0, knobs: false },
  offroad: { radiusFactor: 1.14, thicknessFactor: 1.2, tireColor: 0x3a2f24, hubColor: 0x6fa84a, knobs: true },
  driftTires: { radiusFactor: 0.95, thicknessFactor: 0.8, tireColor: 0xd8d8dc, hubColor: 0xff8a2a, knobs: false },
  slick: { radiusFactor: 1, thicknessFactor: 1.5, tireColor: 0x151515, hubColor: 0xe0302a, knobs: false },
};

const KNOB_COUNT = 8;

export interface WheelFactory {
  readonly tireMaterial: THREE.MeshLambertMaterial;
  readonly tireBaseColor: number;
  readonly add: (parent: THREE.Object3D, baseRadius: number, baseThickness: number, position: Vec3) => KartWheel;
}

/** Wheels of one kart share their tire material, so the drift tint recolors all of them at once. */
export function createWheelFactory(wheels: WheelTypeId): WheelFactory {
  const look = WHEEL_LOOKS[wheels];
  const tireMaterial = texturedLambert(look.tireColor, 'rubber');
  const hubMaterial = lambert(look.hubColor);
  const add = (parent: THREE.Object3D, baseRadius: number, baseThickness: number, position: Vec3): KartWheel => {
    const radius = baseRadius * look.radiusFactor;
    const thickness = baseThickness * look.thicknessFactor;
    const group = new THREE.Group();
    addCylinder(group, 'z', radius, thickness, tireMaterial, [0, 0, 0]);
    addCylinder(group, 'z', radius * 0.55, thickness * 1.08, hubMaterial, [0, 0, 0]);
    if (look.knobs) addKnobs(group, radius, thickness, tireMaterial);
    group.position.set(position[0], radius, position[2]);
    parent.add(group);
    return { object: group, radius };
  };
  return { tireMaterial, tireBaseColor: look.tireColor, add };
}

/** The tire knobs are merged into one mesh so an offroad wheel costs three draw calls, not ten. */
function addKnobs(group: THREE.Group, radius: number, thickness: number, material: THREE.Material): void {
  const knobs = Array.from({ length: KNOB_COUNT }, (_, index) => {
    const angle = (index / KNOB_COUNT) * Math.PI * 2;
    const knob = new THREE.BoxGeometry(radius * 0.32, 0.07, thickness * 0.9);
    knob.rotateZ(angle + Math.PI / 2);
    knob.translate(Math.cos(angle) * (radius + 0.015), Math.sin(angle) * (radius + 0.015), 0);
    return knob;
  });
  const merged = mergeGeometries(knobs);
  for (const knob of knobs) knob.dispose();
  group.add(new THREE.Mesh(merged, material));
}
