import type { Rng } from '../core/rng';
import { SURFACE_KINDS, SURFACE_STATS, type SurfaceKind, type SurfaceStats } from './surfaces';

export type KartTypeId = 'car' | 'sportsCar' | 'tank' | 'motorcycle' | 'skateboard';
export type WheelTypeId = 'standard' | 'offroad' | 'driftTires' | 'slick';

/** Multipliers on the shared driving config; 1 means "like the standard kart". */
export interface DriveModifiers {
  readonly topSpeedFactor: number;
  readonly accelerationFactor: number;
  readonly steerRateFactor: number;
  readonly driftYawRateFactor: number;
  readonly driftBoostFactor: number;
  /** Share of a surface's slowdown the kart suffers: 0 ignores offroad, 1 is normal, above 1 is worse. */
  readonly offroadPenaltyShare: number;
  /** Heavier karts are pushed less in a tackle. */
  readonly massFactor: number;
  /** How hard the kart rams other karts. */
  readonly rammingFactor: number;
}

interface KartTypeStats extends DriveModifiers {
  readonly hasWheelChoice: boolean;
}

type WheelStats = DriveModifiers;

export const KART_TYPES: readonly KartTypeId[] = ['car', 'sportsCar', 'tank', 'motorcycle', 'skateboard'];
export const WHEEL_TYPES: readonly WheelTypeId[] = ['standard', 'offroad', 'driftTires', 'slick'];

export const NEUTRAL_DRIVE_MODIFIERS: DriveModifiers = Object.freeze({
  topSpeedFactor: 1,
  accelerationFactor: 1,
  steerRateFactor: 1,
  driftYawRateFactor: 1,
  driftBoostFactor: 1,
  offroadPenaltyShare: 1,
  massFactor: 1,
  rammingFactor: 1,
});

const KART_TYPE_STATS: Readonly<Record<KartTypeId, KartTypeStats>> = Object.freeze({
  car: { ...NEUTRAL_DRIVE_MODIFIERS, hasWheelChoice: true },
  sportsCar: {
    ...NEUTRAL_DRIVE_MODIFIERS,
    hasWheelChoice: true,
    topSpeedFactor: 1.1,
    accelerationFactor: 1.1,
    steerRateFactor: 0.9,
    massFactor: 0.85,
    rammingFactor: 0.8,
  },
  tank: {
    ...NEUTRAL_DRIVE_MODIFIERS,
    hasWheelChoice: false,
    topSpeedFactor: 0.98,
    accelerationFactor: 0.95,
    steerRateFactor: 0.92,
    massFactor: 2.2,
    rammingFactor: 1.6,
  },
  motorcycle: {
    ...NEUTRAL_DRIVE_MODIFIERS,
    hasWheelChoice: true,
    topSpeedFactor: 1.1,
    accelerationFactor: 1.12,
    steerRateFactor: 1.1,
    driftYawRateFactor: 0.65,
    driftBoostFactor: 0.6,
    massFactor: 0.6,
    rammingFactor: 0.6,
  },
  skateboard: {
    ...NEUTRAL_DRIVE_MODIFIERS,
    hasWheelChoice: false,
    topSpeedFactor: 0.92,
    steerRateFactor: 1.3,
    massFactor: 0.7,
    rammingFactor: 0.6,
  },
});

const WHEEL_STATS: Readonly<Record<WheelTypeId, WheelStats>> = Object.freeze({
  standard: { ...NEUTRAL_DRIVE_MODIFIERS },
  offroad: { ...NEUTRAL_DRIVE_MODIFIERS, topSpeedFactor: 0.95, accelerationFactor: 0.95, offroadPenaltyShare: 0 },
  driftTires: { ...NEUTRAL_DRIVE_MODIFIERS, driftYawRateFactor: 1.1, driftBoostFactor: 1.25, offroadPenaltyShare: 1.4 },
  slick: { ...NEUTRAL_DRIVE_MODIFIERS, topSpeedFactor: 1.06, accelerationFactor: 1.06, offroadPenaltyShare: 1.6 },
});

/** A paint of the karts; the texts name it by its place in this list (`lobby.kartColors`). */
export interface KartColor {
  readonly hex: number;
}

export interface KartStatsTable {
  readonly kartTypes: Record<KartTypeId, KartTypeStats>;
  readonly wheels: Record<WheelTypeId, WheelStats>;
  readonly surfaces: Record<SurfaceKind, SurfaceStats>;
}

export const DEFAULT_KART_STATS: Readonly<KartStatsTable> = Object.freeze({ kartTypes: KART_TYPE_STATS, wheels: WHEEL_STATS, surfaces: SURFACE_STATS });

export function createRuntimeKartStats(): KartStatsTable {
  return {
    kartTypes: Object.fromEntries(KART_TYPES.map((id) => [id, { ...KART_TYPE_STATS[id] }])) as Record<KartTypeId, KartTypeStats>,
    wheels: Object.fromEntries(WHEEL_TYPES.map((id) => [id, { ...WHEEL_STATS[id] }])) as Record<WheelTypeId, WheelStats>,
    surfaces: Object.fromEntries(SURFACE_KINDS.map((kind) => [kind, { ...SURFACE_STATS[kind] }])) as Record<SurfaceKind, SurfaceStats>,
  };
}

/** Writes into the existing nested objects, so controllers bound to them keep working. */
export function resetRuntimeKartStats(target: KartStatsTable): void {
  const fresh = createRuntimeKartStats();
  for (const id of KART_TYPES) Object.assign(target.kartTypes[id], fresh.kartTypes[id]);
  for (const id of WHEEL_TYPES) Object.assign(target.wheels[id], fresh.wheels[id]);
  for (const kind of SURFACE_KINDS) Object.assign(target.surfaces[kind], fresh.surfaces[kind]);
}

export const KART_COLORS: readonly KartColor[] = [
  { hex: 0xe0533d },
  { hex: 0x3d8fe0 },
  { hex: 0x5ec25a },
  { hex: 0xe0c33d },
  { hex: 0xe8883a },
  { hex: 0x9a5fd0 },
  { hex: 0xe86fa8 },
  { hex: 0x35b8b0 },
];

export interface KartLoadout {
  readonly kartType: KartTypeId;
  readonly wheels: WheelTypeId;
  readonly colorIndex: number;
}

const DEFAULT_WHEELS: WheelTypeId = 'standard';

export function createKartLoadout(colorIndex = 0, kartType: KartTypeId = 'car', wheels: WheelTypeId = DEFAULT_WHEELS): KartLoadout {
  return normalizeKartLoadout({ kartType, wheels, colorIndex });
}

/** Kart types without a wheel choice always carry the standard wheel entry, so equal loadouts compare equal. */
export function normalizeKartLoadout(loadout: KartLoadout): KartLoadout {
  const colorIndex = ((loadout.colorIndex % KART_COLORS.length) + KART_COLORS.length) % KART_COLORS.length;
  const wheels = hasWheelChoice(loadout) ? loadout.wheels : DEFAULT_WHEELS;
  return { kartType: loadout.kartType, wheels, colorIndex };
}

export function isValidKartLoadout(loadout: KartLoadout): boolean {
  return (
    KART_TYPES.includes(loadout.kartType) &&
    WHEEL_TYPES.includes(loadout.wheels) &&
    (hasWheelChoice(loadout) || loadout.wheels === DEFAULT_WHEELS) &&
    Number.isInteger(loadout.colorIndex) &&
    loadout.colorIndex >= 0 &&
    loadout.colorIndex < KART_COLORS.length
  );
}

export function hasWheelChoice(loadout: KartLoadout): boolean {
  return KART_TYPE_STATS[loadout.kartType].hasWheelChoice;
}

export function sameKartLoadout(first: KartLoadout, second: KartLoadout): boolean {
  return first.kartType === second.kartType && first.wheels === second.wheels && first.colorIndex === second.colorIndex;
}

export function kartColorHex(loadout: KartLoadout): number {
  return KART_COLORS[loadout.colorIndex]!.hex;
}

/** Combined multipliers of kart type and wheels; unmodified for the plain car on standard wheels. */
export function driveModifiersFor(loadout: KartLoadout, stats: KartStatsTable = DEFAULT_KART_STATS): DriveModifiers {
  const kart = stats.kartTypes[loadout.kartType];
  const wheels = stats.wheels[loadout.wheels];
  return {
    topSpeedFactor: kart.topSpeedFactor * wheels.topSpeedFactor,
    accelerationFactor: kart.accelerationFactor * wheels.accelerationFactor,
    steerRateFactor: kart.steerRateFactor * wheels.steerRateFactor,
    driftYawRateFactor: kart.driftYawRateFactor * wheels.driftYawRateFactor,
    driftBoostFactor: kart.driftBoostFactor * wheels.driftBoostFactor,
    offroadPenaltyShare: kart.offroadPenaltyShare * wheels.offroadPenaltyShare,
    massFactor: kart.massFactor * wheels.massFactor,
    rammingFactor: kart.rammingFactor * wheels.rammingFactor,
  };
}

export type StatId = 'speed' | 'acceleration' | 'steering' | 'drift' | 'offroad' | 'impact';

export interface StatBar {
  /** The texts name the bar by this id (`lobby.stats`). */
  readonly id: StatId;
  /** Position within the usual range of all karts, 0 (weakest possible) to 1 (strongest possible). */
  readonly ratio: number;
}

const STAT_RANGE_MIN = 0.5;
const STAT_RANGE_MAX = 1.3;

const WUCHT_RANGE_MIN = 0.5;
const WUCHT_RANGE_MAX = 1.9;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function statRatio(factor: number): number {
  return clamp01((factor - STAT_RANGE_MIN) / (STAT_RANGE_MAX - STAT_RANGE_MIN));
}

/** The driving values of a loadout for the lobby bars. Offroad counts the surface penalty the other way
 *  round: no penalty fills the bar, a worse-than-normal penalty leaves it short. */
export function statBarsFor(loadout: KartLoadout, stats: KartStatsTable = DEFAULT_KART_STATS): readonly StatBar[] {
  const modifiers = driveModifiersFor(loadout, stats);
  return [
    { id: 'speed', ratio: statRatio(modifiers.topSpeedFactor) },
    { id: 'acceleration', ratio: statRatio(modifiers.accelerationFactor) },
    { id: 'steering', ratio: statRatio(modifiers.steerRateFactor) },
    { id: 'drift', ratio: statRatio((modifiers.driftYawRateFactor + modifiers.driftBoostFactor) / 2) },
    { id: 'offroad', ratio: statRatio(1.3 - 0.3 * modifiers.offroadPenaltyShare) },
    {
      id: 'impact',
      ratio: clamp01((Math.sqrt(modifiers.massFactor * modifiers.rammingFactor) - WUCHT_RANGE_MIN) / (WUCHT_RANGE_MAX - WUCHT_RANGE_MIN)),
    },
  ];
}

/** Seeded: AI loadouts are gameplay-affecting randomness. Each AI kart gets its own paint color. */
export function randomKartLoadout(rng: Rng, colorIndex: number): KartLoadout {
  const kartType = KART_TYPES[rng.nextInt(KART_TYPES.length)]!;
  const wheels = WHEEL_TYPES[rng.nextInt(WHEEL_TYPES.length)]!;
  return createKartLoadout(colorIndex, kartType, wheels);
}
