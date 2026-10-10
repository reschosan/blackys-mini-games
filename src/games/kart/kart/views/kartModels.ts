import * as THREE from 'three';
import type { CatPose } from '../../../../shared/cat/catView';
import { KART_DIMENSIONS as KART } from '../../../../shared/config/kart';
import { kartColorHex, type KartLoadout, type KartTypeId } from '../../../../shared/config/kartLoadout';
import {
  DARK_COLOR,
  LAMP_COLOR,
  LIGHT_COLOR,
  TAIL_LAMP_COLOR,
  addBarStrip,
  addBox,
  addCylinder,
  addRod,
  addSphere,
  addTreadmillBelt,
  createWheelFactory,
  lambert,
  texturedLambert,
  shade,
  type BarStrip,
  type KartWheel,
  type TreadmillBelt,
  type WheelFactory,
} from './kartParts';

/** Where the cat sits on a kart and how it holds itself there. */
interface CatSeat {
  readonly x: number;
  readonly y: number;
  readonly pose: CatPose;
}

export interface KartModel {
  readonly seat: CatSeat;
  readonly belt: TreadmillBelt | null;
  readonly treads: readonly BarStrip[];
  readonly wheels: readonly KartWheel[];
  readonly tireMaterial: THREE.MeshLambertMaterial;
  readonly tireBaseColor: number;
}

interface ModelContext {
  readonly parent: THREE.Group;
  readonly body: THREE.MeshLambertMaterial;
  readonly bodyShade: THREE.MeshLambertMaterial;
  readonly accent: THREE.MeshLambertMaterial;
  readonly accentColor: number;
  readonly dark: THREE.MeshLambertMaterial;
  readonly light: THREE.MeshLambertMaterial;
  readonly lamp: THREE.MeshBasicMaterial;
  readonly tailLamp: THREE.MeshBasicMaterial;
  readonly wheels: WheelFactory;
}

const SIDE_SIGNS = [-1, 1] as const;

function createContext(parent: THREE.Group, loadout: KartLoadout, accentColor: number): ModelContext {
  const bodyColor = kartColorHex(loadout);
  return {
    parent,
    body: texturedLambert(bodyColor, 'paint'),
    bodyShade: texturedLambert(shade(bodyColor, 0.8), 'paint'),
    accent: lambert(accentColor),
    accentColor,
    dark: lambert(DARK_COLOR),
    light: lambert(LIGHT_COLOR),
    lamp: new THREE.MeshBasicMaterial({ color: LAMP_COLOR }),
    tailLamp: new THREE.MeshBasicMaterial({ color: TAIL_LAMP_COLOR }),
    wheels: createWheelFactory(loadout.wheels),
  };
}

function finishModel(context: ModelContext, model: Pick<KartModel, 'seat' | 'belt' | 'treads' | 'wheels'>): KartModel {
  return { ...model, tireMaterial: context.wheels.tireMaterial, tireBaseColor: context.wheels.tireBaseColor };
}

function addFourWheels(context: ModelContext, radius: number, thickness: number, insetX: number, outZ: number): KartWheel[] {
  return SIDE_SIGNS.flatMap((xSide) => SIDE_SIGNS.map((zSide) => context.wheels.add(context.parent, radius, thickness, [xSide * insetX, 0, zSide * outZ])));
}

function buildCar(context: ModelContext, accentColor: number): KartModel {
  const { parent } = context;
  addBox(parent, [KART.length * 0.98, 0.34, 1.1], context.body, [0, 0.3, 0], 0.12);
  addBox(parent, [1.4, 0.25, 0.86], context.bodyShade, [0, KART.height - 0.125, 0], 0.08);
  for (const xSide of SIDE_SIGNS) {
    addBox(parent, [0.12, 0.14, 1.0], context.light, [xSide * 0.93, 0.25, 0], 0.05);
  }
  for (const zSide of SIDE_SIGNS) {
    addSphere(parent, 0.08, context.lamp, [0.9, 0.38, zSide * 0.38]);
    addBox(parent, [0.04, 0.08, 0.16], context.tailLamp, [-0.9, 0.38, zSide * 0.38], 0.015);
  }
  const wheels = addFourWheels(context, KART.wheelRadius, KART.wheelThickness, (KART.length / 2) * KART.wheelInset, KART.width / 2 + KART.wheelThickness / 2);
  const belt = addTreadmillBelt(parent, accentColor, KART.length * KART.stripeLengthFactor, 0, KART.height);
  return finishModel(context, { seat: { x: 0, y: KART.height + KART.stripeHeight, pose: 'walk' }, belt, treads: [], wheels });
}

const SPORTS_DECK_TOP = 0.54;

function buildSportsCar(context: ModelContext, accentColor: number): KartModel {
  const { parent } = context;
  addBox(parent, [1.9, 0.24, 1.16], context.body, [0, 0.24, 0], 0.1);
  addBox(parent, [0.7, 0.16, 1.0], context.body, [0.85, 0.28, 0], 0.07);
  addBox(parent, [1.1, 0.2, 0.66], context.bodyShade, [-0.1, SPORTS_DECK_TOP - 0.1, 0], 0.07);
  for (const zSide of SIDE_SIGNS) {
    addBox(parent, [1.7, 0.012, 0.07], context.light, [0, 0.366, zSide * 0.16], 0.004);
    addBox(parent, [0.05, 0.18, 0.05], context.dark, [-0.9, 0.42, zSide * 0.4], 0.015);
    addBox(parent, [0.06, 0.06, 0.2], context.lamp, [0.99, 0.3, zSide * 0.32], 0.02);
    addBox(parent, [0.04, 0.06, 0.18], context.tailLamp, [-0.96, 0.3, zSide * 0.4], 0.015);
  }
  addBox(parent, [0.3, 0.05, 1.1], context.accent, [-0.92, 0.53, 0], 0.02);
  const wheels = addFourWheels(context, 0.3, 0.2, 0.62, 0.64);
  const belt = addTreadmillBelt(parent, accentColor, 1.0, -0.1, SPORTS_DECK_TOP);
  return finishModel(context, { seat: { x: -0.1, y: SPORTS_DECK_TOP + KART.stripeHeight, pose: 'walk' }, belt, treads: [], wheels });
}

const TANK_HULL_TOP = 0.6;
const TANK_TRACK_Z = 0.46;
const TANK_TURRET_X = 0.5;

function addTankTracks(context: ModelContext): { readonly treads: BarStrip[]; readonly wheels: KartWheel[] } {
  const treads: BarStrip[] = [];
  const wheels: KartWheel[] = [];
  for (const zSide of SIDE_SIGNS) {
    addBox(context.parent, [1.8, 0.42, 0.3], context.dark, [0, 0.21, zSide * TANK_TRACK_Z], 0.14);
    treads.push(
      addBarStrip(context.parent, { length: 1.5, count: 8, barWidth: 0.06, barHeight: 0.02, barDepth: 0.26, color: 0x6b6b74 }, [0, 0.43, zSide * TANK_TRACK_Z]),
    );
    for (const xSide of SIDE_SIGNS) wheels.push(context.wheels.add(context.parent, 0.19, 0.34, [xSide * 0.78, 0, zSide * TANK_TRACK_Z]));
  }
  return { treads, wheels };
}

function addTankTurret(context: ModelContext): void {
  const { parent } = context;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), context.bodyShade);
  dome.position.set(TANK_TURRET_X, TANK_HULL_TOP, 0);
  parent.add(dome);
  addCylinder(parent, 'x', 0.07, 0.85, context.dark, [TANK_TURRET_X + 0.45, TANK_HULL_TOP + 0.1, 0]);
  addCylinder(parent, 'x', 0.1, 0.12, context.light, [TANK_TURRET_X + 0.85, TANK_HULL_TOP + 0.1, 0]);
}

function buildTank(context: ModelContext, accentColor: number): KartModel {
  addBox(context.parent, [1.5, 0.3, 0.7], context.body, [0, 0.45, 0], 0.1);
  const { treads, wheels } = addTankTracks(context);
  addTankTurret(context);
  const beltCenterX = -0.25;
  const belt = addTreadmillBelt(context.parent, accentColor, 0.9, beltCenterX, TANK_HULL_TOP);
  return finishModel(context, { seat: { x: beltCenterX, y: TANK_HULL_TOP + KART.stripeHeight, pose: 'walk' }, belt, treads, wheels });
}

const MOTORCYCLE_WHEEL_X = 0.66;
const MOTORCYCLE_HANDLEBAR: readonly [number, number] = [0.5, 0.95];

function addMotorcycleFrame(context: ModelContext): void {
  const { parent } = context;
  addBox(parent, [0.95, 0.2, 0.3], context.dark, [0, 0.42, 0], 0.06);
  addBox(parent, [0.5, 0.26, 0.36], context.body, [0.2, 0.62, 0], 0.12);
  addBox(parent, [0.6, 0.1, 0.32], context.dark, [-0.2, 0.58, 0], 0.04);
  addBox(parent, [0.4, 0.18, 0.3], context.body, [-0.62, 0.6, 0], 0.07);
  addBox(parent, [0.04, 0.07, 0.18], context.tailLamp, [-0.84, 0.6, 0], 0.015);
  addCylinder(parent, 'x', 0.05, 0.6, context.light, [-0.4, 0.34, 0.22]);
}

function addMotorcycleSteering(context: ModelContext): void {
  const { parent } = context;
  addRod(parent, [MOTORCYCLE_WHEEL_X, 0.36], MOTORCYCLE_HANDLEBAR, 0.035, context.dark);
  addCylinder(parent, 'z', 0.035, 0.75, context.dark, [MOTORCYCLE_HANDLEBAR[0], MOTORCYCLE_HANDLEBAR[1], 0]);
  for (const zSide of SIDE_SIGNS) {
    addCylinder(parent, 'z', 0.045, 0.14, context.accent, [MOTORCYCLE_HANDLEBAR[0], MOTORCYCLE_HANDLEBAR[1], zSide * 0.34]);
  }
  addSphere(parent, 0.1, context.lamp, [0.66, 0.84, 0]);
  addBox(parent, [0.5, 0.05, 0.2], context.body, [MOTORCYCLE_WHEEL_X, 0.66, 0], 0.02);
}

function buildMotorcycle(context: ModelContext): KartModel {
  const wheels = SIDE_SIGNS.map((xSide) => context.wheels.add(context.parent, 0.36, 0.16, [xSide * MOTORCYCLE_WHEEL_X, 0, 0]));
  addMotorcycleFrame(context);
  addMotorcycleSteering(context);
  return finishModel(context, { seat: { x: 0.04, y: 0.72, pose: 'rideUp' }, belt: null, treads: [], wheels });
}

const SKATEBOARD_DECK_Y = 0.22;

function buildSkateboard(context: ModelContext): KartModel {
  const { parent } = context;
  addBox(parent, [1.5, 0.07, 0.5], context.body, [0, SKATEBOARD_DECK_Y, 0], 0.03);
  for (const xSide of SIDE_SIGNS) {
    const tail = addBox(parent, [0.3, 0.06, 0.5], context.body, [xSide * 0.84, SKATEBOARD_DECK_Y + 0.04, 0], 0.025);
    tail.rotation.z = xSide * 0.4;
    addBox(parent, [0.12, 0.06, 0.3], context.light, [xSide * 0.5, 0.15, 0], 0.02);
  }
  addBox(parent, [1.3, 0.012, 0.38], context.dark, [0, SKATEBOARD_DECK_Y + 0.0385, 0], 0.005);
  addBox(parent, [1.2, 0.014, 0.07], context.accent, [0, SKATEBOARD_DECK_Y + 0.0395, 0], 0.005);
  const wheels = addFourWheels(context, 0.12, 0.1, 0.5, 0.27);
  return finishModel(context, { seat: { x: 0, y: SKATEBOARD_DECK_Y + 0.045, pose: 'stand' }, belt: null, treads: [], wheels });
}

const BUILDERS: Readonly<Record<KartTypeId, (context: ModelContext, accentColor: number) => KartModel>> = {
  car: buildCar,
  sportsCar: buildSportsCar,
  tank: buildTank,
  motorcycle: buildMotorcycle,
  skateboard: buildSkateboard,
};

/** Builds the toy-like kart for `loadout` into `parent`; `accentColor` is the player's identifying color. */
export function buildKartModel(parent: THREE.Group, loadout: KartLoadout, accentColor: number): KartModel {
  return BUILDERS[loadout.kartType](createContext(parent, loadout, accentColor), accentColor);
}
