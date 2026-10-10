import type { DrivingConfig } from '../../../shared/config/driving';
import type { KartSurfaceFactors, SurfaceFactors as ZoneFactors, SurfaceKind } from '../../../shared/config/surfaces';
import { NEUTRAL_INPUT, type InputFrame } from '../../../shared/input/actions';

type DriftDirection = -1 | 0 | 1;

export interface KartState {
  x: number;
  z: number;
  levelId: string;
  stairTransitionId: string | null;
  yaw: number;
  velocityX: number;
  velocityZ: number;
  driftDirection: DriftDirection;
  driftCharge: number;
  driftStage: number;
  boostSeconds: number;
  lastBoostFieldId: string | null;
  onCarpet: boolean;
  surfaceSpeedFactor: number;
  /** The surface zone (mud, moondust, ...) the kart is currently driving on, if any. */
  surfaceKind: SurfaceKind | null;
  /** Seconds left of item-hit spin-out (hairball, trap); input is ignored while > 0. */
  stunSecondsLeft: number;
  /** Seconds left of a cow pat hit: the kart drives as if on mud. */
  stickySecondsLeft: number;
  /** Whether the kart was the race leader on the previous tick; set by the race, read by leader-only rules. */
  leading: boolean;
  /** Seconds the kart is safe from the next tackle after being tackled. */
  tackleImmunitySeconds: number;
  /** Seconds left of Nickerchen protection; blocks and consumes the next hairball/trap hit. */
  shieldSecondsLeft: number;
  /** Seconds left of the catnip effect: boost first, wobbly steering for the final stretch. */
  catnipSecondsLeft: number;
  /** Active deterministic window jump. The values are plain state so replays remain reproducible. */
  windowJumpId: string | null;
  /** Prevents a completed jump from immediately retriggering while its launch field is still occupied. */
  lastWindowJumpId: string | null;
  windowJumpElapsedSeconds: number;
  penaltySecondsLeft: number;
  /** A shoved kart flies: it keeps its speed, ignores the input and touches no ground until this runs out. */
  airborneSecondsLeft: number;
  /** The whole flight, for the height of the hop. */
  airborneSeconds: number;
  /** Seconds before this kart can shove again. */
  shoveCooldownSeconds: number;
}

interface SurfaceFactors {
  readonly speedFactor: number;
  readonly accelerationFactor: number;
}

export interface KartDriveFactors {
  readonly topSpeedFactor: number;
  readonly accelerationFactor: number;
  readonly steerRateFactor?: number;
  readonly driftYawRateFactor?: number;
  readonly driftBoostFactor?: number;
  readonly offroadPenaltyShare?: number;
  readonly surfaceFactors?: KartSurfaceFactors;
  /** Mass and ramming power: karts that have them tackle each other instead of just bumping (kartTackle.ts). */
  readonly massFactor?: number;
  readonly rammingFactor?: number;
}

const MIN_SURFACE_FACTOR = 0.2;

function scaledSurfaceFactor(factor: number, penaltyShare: number): number {
  if (penaltyShare === 1) return factor;
  return Math.max(1 - (1 - factor) * penaltyShare, MIN_SURFACE_FACTOR);
}

export const DEFAULT_KART_DRIVE_FACTORS: Readonly<KartDriveFactors> = Object.freeze({
  topSpeedFactor: 1,
  accelerationFactor: 1,
});

export function createKartState(x: number, z: number, yaw: number, levelId = 'ground'): KartState {
  return {
    x,
    z,
    levelId,
    stairTransitionId: null,
    yaw,
    velocityX: 0,
    velocityZ: 0,
    driftDirection: 0,
    driftCharge: 0,
    driftStage: 0,
    boostSeconds: 0,
    lastBoostFieldId: null,
    onCarpet: true,
    surfaceSpeedFactor: 1,
    surfaceKind: null,
    leading: false,
    stunSecondsLeft: 0,
    stickySecondsLeft: 0,
    tackleImmunitySeconds: 0,
    shieldSecondsLeft: 0,
    catnipSecondsLeft: 0,
    windowJumpId: null,
    lastWindowJumpId: null,
    windowJumpElapsedSeconds: 0,
    penaltySecondsLeft: 0,
    airborneSecondsLeft: 0,
    airborneSeconds: 0,
    shoveCooldownSeconds: 0,
  };
}

/** How fast a flying kart falls back: with the flight time it sets how high the hop is. */
const HOP_GRAVITY = 50;

/** Height of a flying kart above the ground: a parabola over its flight. */
export function hopHeightOf(state: Pick<KartState, 'airborneSecondsLeft' | 'airborneSeconds'>): number {
  if (state.airborneSecondsLeft <= 0 || state.airborneSeconds <= 0) return 0;
  const elapsed = state.airborneSeconds - state.airborneSecondsLeft;
  return (HOP_GRAVITY / 2) * elapsed * state.airborneSecondsLeft;
}

/** A flying kart turns one full roll over its flight. */
export function flightRollOf(state: Pick<KartState, 'airborneSecondsLeft' | 'airborneSeconds'>): number {
  if (state.airborneSecondsLeft <= 0 || state.airborneSeconds <= 0) return 0;
  return (1 - state.airborneSecondsLeft / state.airborneSeconds) * Math.PI * 2;
}

function flyThroughTheAir(state: KartState, stepSeconds: number): void {
  state.x += state.velocityX * stepSeconds;
  state.z += state.velocityZ * stepSeconds;
  state.airborneSecondsLeft = Math.max(state.airborneSecondsLeft - stepSeconds, 0);
}

function countDown(seconds: number, stepSeconds: number): number {
  return seconds > 0 ? Math.max(seconds - stepSeconds, 0) : 0;
}

export function forwardSpeedOf(state: KartState): number {
  return state.velocityX * Math.cos(state.yaw) + state.velocityZ * Math.sin(state.yaw);
}

export function speedOf(state: KartState): number {
  return Math.hypot(state.velocityX, state.velocityZ);
}

/** Sideways component of velocity relative to heading; large during drift, small while gripping. */
export function lateralSpeedOf(state: KartState): number {
  return state.velocityX * -Math.sin(state.yaw) + state.velocityZ * Math.cos(state.yaw);
}

function driftStageForCharge(config: DrivingConfig, charge: number): number {
  let stage = 0;
  for (const threshold of config.driftStageSeconds) {
    if (charge >= threshold) stage += 1;
  }
  return stage;
}

function surfaceFactors(config: DrivingConfig, state: KartState, penaltyShare: number): SurfaceFactors {
  if (state.onCarpet) return { speedFactor: scaledSurfaceFactor(state.surfaceSpeedFactor, penaltyShare), accelerationFactor: 1 };
  return {
    speedFactor: scaledSurfaceFactor(config.offroadSpeedFactor, penaltyShare),
    accelerationFactor: scaledSurfaceFactor(config.offroadAccelerationFactor, penaltyShare),
  };
}

function withZone(surface: SurfaceFactors, zone: ZoneFactors | undefined): SurfaceFactors {
  if (!zone) return surface;
  return { speedFactor: surface.speedFactor * zone.speedFactor, accelerationFactor: surface.accelerationFactor * zone.accelerationFactor };
}

function steerFactorForSpeed(config: DrivingConfig, forwardSpeed: number): number {
  const speedRatio = Math.min(Math.abs(forwardSpeed) / config.maxSpeed, 1);
  return 1 + (config.steerFactorAtTopSpeed - 1) * speedRatio;
}

function updateThrottle(
  config: DrivingConfig,
  surface: SurfaceFactors,
  input: InputFrame,
  forwardSpeed: number,
  boosting: boolean,
  stepSeconds: number,
  driveFactors: KartDriveFactors,
): number {
  const topSpeed = config.maxSpeed * driveFactors.topSpeedFactor * surface.speedFactor * (boosting ? config.boostSpeedFactor : 1);

  if (boosting && input.accelerate && !input.brake) {
    return Math.min(forwardSpeed + config.boostAcceleration * driveFactors.accelerationFactor * stepSeconds, topSpeed);
  }
  if (input.accelerate) {
    const gain = config.acceleration * driveFactors.accelerationFactor * surface.accelerationFactor * stepSeconds;
    return Math.min(forwardSpeed + gain, topSpeed);
  }
  if (input.brake) {
    if (forwardSpeed > 0.2) {
      return Math.max(forwardSpeed - config.brakeDeceleration * stepSeconds, 0);
    }
    const gain = config.reverseAcceleration * surface.accelerationFactor * stepSeconds;
    return Math.max(forwardSpeed - gain, -config.maxReverseSpeed * surface.speedFactor);
  }
  return approachZero(forwardSpeed, config.coastDrag * stepSeconds);
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clampSlipAngle(config: DrivingConfig, state: KartState): void {
  if (state.driftDirection === 0) return;
  if (speedOf(state) < 0.5) return;

  const velocityAngle = Math.atan2(state.velocityZ, state.velocityX);
  const slipAngle = normalizeAngle(state.yaw - velocityAngle);
  if (Math.abs(slipAngle) <= config.driftMaxSlipAngle) return;

  state.yaw = velocityAngle + Math.sign(slipAngle) * config.driftMaxSlipAngle;
}

function approachZero(value: number, amount: number): number {
  if (Math.abs(value) <= amount) return 0;
  return value - Math.sign(value) * amount;
}

function updateDrift(
  config: DrivingConfig,
  state: KartState,
  input: InputFrame,
  forwardSpeed: number,
  stepSeconds: number,
  driveFactors: KartDriveFactors,
): void {
  const canDrift = input.drift && forwardSpeed > config.driftMinSpeed;

  if (state.driftDirection === 0) {
    if (canDrift && input.steer !== 0) {
      state.driftDirection = input.steer > 0 ? 1 : -1;
      state.driftCharge = 0;
      state.driftStage = 0;
    }
    return;
  }

  if (canDrift) {
    state.driftCharge += stepSeconds;
    state.driftStage = driftStageForCharge(config, state.driftCharge);
    return;
  }

  const boostSeconds = (config.driftBoostSeconds[state.driftStage - 1] ?? 0) * (driveFactors.driftBoostFactor ?? 1);
  state.boostSeconds = Math.max(state.boostSeconds, boostSeconds);
  state.driftDirection = 0;
  state.driftCharge = 0;
  state.driftStage = 0;
}

function updateYaw(
  config: DrivingConfig,
  state: KartState,
  input: InputFrame,
  forwardSpeed: number,
  stepSeconds: number,
  driveFactors: KartDriveFactors,
): void {
  if (Math.abs(forwardSpeed) < 0.05) return;

  const yawRate =
    state.driftDirection === 0
      ? input.steer * config.steerRate * (driveFactors.steerRateFactor ?? 1) * steerFactorForSpeed(config, forwardSpeed)
      : state.driftDirection * config.driftYawRate * (driveFactors.driftYawRateFactor ?? 1) + input.steer * config.driftSteerInfluence;

  const drivingBackwards = forwardSpeed < 0 ? -1 : 1;
  state.yaw += yawRate * drivingBackwards * stepSeconds;
}

export function stepKart(
  config: DrivingConfig,
  state: KartState,
  input: InputFrame,
  stepSeconds: number,
  driveFactors: KartDriveFactors = DEFAULT_KART_DRIVE_FACTORS,
): void {
  state.stunSecondsLeft = countDown(state.stunSecondsLeft, stepSeconds);
  state.stickySecondsLeft = countDown(state.stickySecondsLeft, stepSeconds);
  state.shieldSecondsLeft = countDown(state.shieldSecondsLeft, stepSeconds);
  state.tackleImmunitySeconds = countDown(state.tackleImmunitySeconds, stepSeconds);
  state.shoveCooldownSeconds = countDown(state.shoveCooldownSeconds, stepSeconds);
  if (state.airborneSecondsLeft > 0) {
    flyThroughTheAir(state, stepSeconds);
    return;
  }
  const effectiveInput = state.stunSecondsLeft > 0 ? NEUTRAL_INPUT : input;

  const zone = state.surfaceKind ? driveFactors.surfaceFactors?.[state.surfaceKind] : undefined;
  const surface = withZone(surfaceFactors(config, state, driveFactors.offroadPenaltyShare ?? 1), zone);
  const boosting = state.boostSeconds > 0;

  updateDrift(config, state, effectiveInput, forwardSpeedOf(state), stepSeconds, driveFactors);
  updateYaw(config, state, effectiveInput, forwardSpeedOf(state), stepSeconds, driveFactors);

  clampSlipAngle(config, state);

  const forwardX = Math.cos(state.yaw);
  const forwardZ = Math.sin(state.yaw);
  const rightX = -forwardZ;
  const rightZ = forwardX;

  const forwardSpeed = state.velocityX * forwardX + state.velocityZ * forwardZ;
  let lateralSpeed = state.velocityX * rightX + state.velocityZ * rightZ;

  const nextForwardSpeed = updateThrottle(config, surface, effectiveInput, forwardSpeed, boosting, stepSeconds, driveFactors);

  const grip = (state.driftDirection === 0 ? config.grip : config.driftGrip) * (zone?.gripFactor ?? 1);
  lateralSpeed = approachZero(lateralSpeed, Math.abs(lateralSpeed) * grip * stepSeconds);

  state.velocityX = forwardX * nextForwardSpeed + rightX * lateralSpeed;
  state.velocityZ = forwardZ * nextForwardSpeed + rightZ * lateralSpeed;
  state.x += state.velocityX * stepSeconds;
  state.z += state.velocityZ * stepSeconds;

  state.boostSeconds = Math.max(state.boostSeconds - stepSeconds, 0);
}
