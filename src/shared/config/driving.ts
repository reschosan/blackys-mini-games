export interface DrivingConfig {
  maxSpeed: number;
  acceleration: number;
  brakeDeceleration: number;
  coastDrag: number;
  maxReverseSpeed: number;
  reverseAcceleration: number;

  steerRate: number;
  steerFactorAtTopSpeed: number;

  grip: number;
  driftGrip: number;

  driftMinSpeed: number;
  driftYawRate: number;
  driftSteerInfluence: number;
  driftMaxSlipAngle: number;
  driftStageSeconds: [number, number, number];
  driftBoostSeconds: [number, number, number];

  boostSpeedFactor: number;
  boostAcceleration: number;

  offroadSpeedFactor: number;
  offroadAccelerationFactor: number;

  wallRestitution: number;
  kartRestitution: number;
  kartCollisionSpeedLoss: number;

  /** Karts with a mass and ramming power (see kartLoadout): bounce between them, 0 = no bounce. */
  tackleBounce: number;
  /** Sideways speed (m/s) a victim gets per m/s of ramming advantage, before its mass and the hit angle. */
  tacklePush: number;
  /** Share of the speed a tackled kart loses (more when hit from the side). */
  tackleVictimSpeedLoss: number;
  /** Share of the speed the tackling kart loses. */
  tackleAttackerSpeedLoss: number;
  /** Seconds a tackled kart cannot be tackled again, so two karts do not lock in place. */
  tackleImmunitySeconds: number;
  /** Ramming advantage (m/s) below which the contact is an even clash, not a tackle. */
  tackleMinMargin: number;
}

export const DEFAULT_DRIVING: Readonly<DrivingConfig> = Object.freeze({
  maxSpeed: 22,
  acceleration: 18,
  brakeDeceleration: 30,
  coastDrag: 6,
  maxReverseSpeed: 7,
  reverseAcceleration: 10,

  steerRate: 3.2,
  steerFactorAtTopSpeed: 0.45,

  grip: 7,
  driftGrip: 1.6,

  driftMinSpeed: 7,
  driftYawRate: 2.2,
  driftSteerInfluence: 1.1,
  driftMaxSlipAngle: 0.62,
  driftStageSeconds: [0.6, 1.4, 2.4],
  driftBoostSeconds: [0.45, 0.85, 1.3],

  boostSpeedFactor: 1.3,
  boostAcceleration: 42,

  offroadSpeedFactor: 0.55,
  offroadAccelerationFactor: 0.6,

  wallRestitution: 0.35,
  kartRestitution: 0.5,
  kartCollisionSpeedLoss: 0.12,

  tackleBounce: 0.3,
  tacklePush: 0.5,
  tackleVictimSpeedLoss: 0.25,
  tackleAttackerSpeedLoss: 0.04,
  tackleImmunitySeconds: 0.3,
  tackleMinMargin: 1.5,
} satisfies DrivingConfig);

export function createRuntimeDriving(): DrivingConfig {
  return {
    ...DEFAULT_DRIVING,
    driftStageSeconds: [...DEFAULT_DRIVING.driftStageSeconds],
    driftBoostSeconds: [...DEFAULT_DRIVING.driftBoostSeconds],
  };
}

export function resetRuntimeDriving(target: DrivingConfig): void {
  Object.assign(target, createRuntimeDriving());
}
