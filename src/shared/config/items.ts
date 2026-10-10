/** Every item has the same chance in a box; only the race leader never gets a speed boost. */
export type ItemType = 'hairball' | 'trap' | 'nap' | 'boost' | 'catnip' | 'laser' | 'yarn' | 'vacuum' | 'gravity' | 'cowpat';

export const ITEM_TYPES: readonly ItemType[] = ['hairball', 'trap', 'nap', 'boost', 'catnip', 'laser', 'yarn', 'vacuum', 'gravity', 'cowpat'];

/** Items that only appear in the boxes of the maps that list them in their `mapItems`. */
export const MAP_ITEM_TYPES: readonly ItemType[] = ['yarn', 'vacuum', 'gravity', 'cowpat'];

/** Items that grant a speed boost; the race leader never receives them. */
export const SPEED_REWARD_ITEM_TYPES: readonly ItemType[] = ['boost', 'catnip'];

/** Shared shape of a hit's spin-out effect (hairball and trap both use it). */
export interface StunEffectConfig {
  /** Seconds a hit kart ignores input and coasts (spin-out). */
  stunSeconds: number;
  /** Fraction of velocity a hit kart keeps on impact (0 = full stop, 1 = no loss). */
  velocityLossFactor: number;
  /** Fixed yaw kick applied on impact for a visible "spun around" feel; sign follows hit side. */
  spinYawRadians: number;
}

interface HairballConfig extends StunEffectConfig {
  /** Flight speed in meters/second, deliberately faster than a kart's top speed. */
  speedMetersPerSecond: number;
  /** Max travel distance before the hairball despawns unused. */
  rangeMeters: number;
  /** Number of wall or furniture bounces before the next impact removes the hairball. */
  maxBounces: number;
  /** Velocity preserved when a hairball bounces off a wall or furniture. */
  bounceRestitution: number;
}

/** The tank's automatic explosive hairball: homes in on a random kart ahead of the tank. */
interface TankConfig extends StunEffectConfig {
  /** Seconds between two automatic shots. */
  shotIntervalSeconds: number;
  /** Seconds the tank holds fire after it lost a place to another kart. */
  overtakenHoldoffSeconds: number;
  shellSpeedMetersPerSecond: number;
  /** How fast the shell can bend its flight path toward its target. */
  shellTurnRateRadiansPerSecond: number;
  /** Shells that have not hit anything by then explode in place. */
  shellLifetimeSeconds: number;
  explosionRadiusMeters: number;
  /** How long the explosion stays visible. */
  explosionVisibleSeconds: number;
  /** Indexed by the tank's own place (1 = first): chance weights for the karts ahead, place 1 first. */
  targetWeightsByPlace: readonly (readonly number[])[];
}

interface NapConfig {
  /** Seconds the shield blocks the next hairball/trap hit before expiring unused. */
  shieldSeconds: number;
}

/** Nitro plus a short stretch of wobbly steering once the boost runs out. */
interface CatnipConfig {
  boostSeconds: number;
  /** Seconds of wobbly steering at the end of the effect. */
  chaosSeconds: number;
  /** Steering offset at the wobble's peak (0..1). */
  chaosSteerAmplitude: number;
  /** Wobble speed in radians per second of remaining effect time. */
  chaosFrequency: number;
}

/** A red dot that drifts ahead of the user; other karts nearby steer after it. */
interface LaserConfig {
  speedMetersPerSecond: number;
  lifetimeSeconds: number;
  /** Karts closer than this to the dot are lured. */
  lureRadiusMeters: number;
  /** How strongly the lure overrides the driver's own steering (0..1). */
  lureStrength: number;
  /** Steering response per radian of angle to the dot. */
  lureSteerGain: number;
  spawnDistanceMeters: number;
}

/** One-shot suction cone in front of the user: stuns, slows and pulls karts toward the user. */
interface VacuumConfig extends StunEffectConfig {
  rangeMeters: number;
  coneHalfAngleRadians: number;
  pullSpeedMetersPerSecond: number;
  pulseVisibleSeconds: number;
}

/** Stationary zone: every other kart entering it once floats helplessly for a moment. */
interface GravityConfig extends StunEffectConfig {
  radiusMeters: number;
  lifetimeSeconds: number;
  /** Extra distance behind the dropping kart's collider the bubble spawns at. */
  spawnOffsetMeters: number;
}

interface TrapConfig extends StunEffectConfig {
  /** Pickup/hit radius of a dropped trap, added to the kart's own collider radius. */
  radius: number;
  /** Extra distance behind the dropping kart's collider the trap spawns at. */
  spawnOffsetMeters: number;
}

/** The cow pat: a dropped trap that does not spin the kart out but holds it like mud for a while. */
interface CowpatConfig {
  /** Pickup/hit radius, added to the kart's own collider radius. */
  radius: number;
  /** Extra distance behind the dropping kart's collider the pat lands at. */
  spawnOffsetMeters: number;
  /** Seconds a hit kart drives as if on mud. */
  stickySeconds: number;
  /** Fraction of velocity a hit kart keeps on impact. */
  velocityLossFactor: number;
}

/** How strongly the screen reacts when an item hits a kart (cosmetic only). */
interface HitFeedbackConfig {
  /** Camera shake strength on a hit. */
  shakeStrength: number;
  /** Sparks shot out of the hit kart. */
  burstCount: number;
}

/** Sparks when a kart picks up or uses an item (cosmetic only). */
interface ItemFeedbackConfig {
  pickupBurstCount: number;
  useBurstCount: number;
}

export interface ItemConfig {
  /** Seconds an emptied item box stays gone before it respawns. */
  boxRespawnSeconds: number;
  /** Pickup radius of an item box, added to the kart's own collider radius. */
  boxRadius: number;
  /** Extra seconds the race leader stays stunned after any item hit. */
  leaderStunBonusSeconds: number;
  hairball: HairballConfig;
  nap: NapConfig;
  trap: TrapConfig;
  tank: TankConfig;
  boost: { durationSeconds: number };
  catnip: CatnipConfig;
  laser: LaserConfig;
  yarn: HairballConfig;
  vacuum: VacuumConfig;
  gravity: GravityConfig;
  cowpat: CowpatConfig;
  hitFeedback: HitFeedbackConfig;
  itemFeedback: ItemFeedbackConfig;
}

export const DEFAULT_ITEMS: Readonly<ItemConfig> = Object.freeze({
  boxRespawnSeconds: 6,
  boxRadius: 0.9,
  leaderStunBonusSeconds: 2,
  hairball: Object.freeze({
    speedMetersPerSecond: 45,
    rangeMeters: 140,
    maxBounces: 2,
    bounceRestitution: 0.9,
    stunSeconds: 0.8,
    velocityLossFactor: 0.35,
    spinYawRadians: 0.6,
  } satisfies HairballConfig),
  nap: Object.freeze({
    shieldSeconds: 5,
  } satisfies NapConfig),
  trap: Object.freeze({
    stunSeconds: 0.8,
    velocityLossFactor: 0.35,
    spinYawRadians: 0.6,
    radius: 0.4,
    spawnOffsetMeters: 0.4,
  } satisfies TrapConfig),
  tank: Object.freeze({
    shotIntervalSeconds: 20,
    overtakenHoldoffSeconds: 10,
    shellSpeedMetersPerSecond: 38,
    shellTurnRateRadiansPerSecond: 2.6,
    shellLifetimeSeconds: 6,
    explosionRadiusMeters: 5,
    explosionVisibleSeconds: 0.6,
    stunSeconds: 1,
    velocityLossFactor: 0.3,
    spinYawRadians: 0.8,
    targetWeightsByPlace: Object.freeze([[], [], [1], [0.7, 0.3], [0.5, 0.3, 0.2]].map((weights) => Object.freeze(weights))),
  } satisfies TankConfig),
  boost: Object.freeze({ durationSeconds: 3 }),
  catnip: Object.freeze({
    boostSeconds: 3.5,
    chaosSeconds: 2,
    chaosSteerAmplitude: 0.9,
    chaosFrequency: 14,
  } satisfies CatnipConfig),
  laser: Object.freeze({
    speedMetersPerSecond: 16,
    lifetimeSeconds: 4.5,
    lureRadiusMeters: 10,
    lureStrength: 0.75,
    lureSteerGain: 3,
    spawnDistanceMeters: 8,
  } satisfies LaserConfig),
  yarn: Object.freeze({
    speedMetersPerSecond: 18,
    rangeMeters: 260,
    maxBounces: 8,
    bounceRestitution: 0.95,
    stunSeconds: 1,
    velocityLossFactor: 0.35,
    spinYawRadians: 0.8,
  } satisfies HairballConfig),
  vacuum: Object.freeze({
    rangeMeters: 12,
    coneHalfAngleRadians: 0.9,
    pullSpeedMetersPerSecond: 12,
    pulseVisibleSeconds: 0.6,
    stunSeconds: 0.9,
    velocityLossFactor: 0.3,
    spinYawRadians: 0,
  } satisfies VacuumConfig),
  gravity: Object.freeze({
    radiusMeters: 3.2,
    lifetimeSeconds: 12,
    spawnOffsetMeters: 1,
    stunSeconds: 1.6,
    velocityLossFactor: 0.85,
    spinYawRadians: 0,
  } satisfies GravityConfig),
  cowpat: Object.freeze({
    radius: 0.7,
    spawnOffsetMeters: 0.4,
    stickySeconds: 3,
    velocityLossFactor: 0.6,
  } satisfies CowpatConfig),
  hitFeedback: Object.freeze({ shakeStrength: 0.55, burstCount: 48 } satisfies HitFeedbackConfig),
  itemFeedback: Object.freeze({ pickupBurstCount: 16, useBurstCount: 28 } satisfies ItemFeedbackConfig),
} satisfies ItemConfig);

export interface ItemOverrides {
  readonly boxRespawnSeconds?: number;
  readonly boxRadius?: number;
  readonly leaderStunBonusSeconds?: number;
  readonly hairball?: Partial<HairballConfig>;
  readonly nap?: Partial<NapConfig>;
  readonly trap?: Partial<TrapConfig>;
  readonly tank?: Partial<TankConfig>;
  readonly boost?: Partial<ItemConfig['boost']>;
  readonly catnip?: Partial<CatnipConfig>;
  readonly laser?: Partial<LaserConfig>;
  readonly yarn?: Partial<HairballConfig>;
  readonly vacuum?: Partial<VacuumConfig>;
  readonly gravity?: Partial<GravityConfig>;
  readonly cowpat?: Partial<CowpatConfig>;
}

export function createRuntimeItems(overrides: ItemOverrides = {}): ItemConfig {
  return {
    boxRespawnSeconds: overrides.boxRespawnSeconds ?? DEFAULT_ITEMS.boxRespawnSeconds,
    boxRadius: overrides.boxRadius ?? DEFAULT_ITEMS.boxRadius,
    leaderStunBonusSeconds: overrides.leaderStunBonusSeconds ?? DEFAULT_ITEMS.leaderStunBonusSeconds,
    hairball: { ...DEFAULT_ITEMS.hairball, ...overrides.hairball },
    nap: { ...DEFAULT_ITEMS.nap, ...overrides.nap },
    trap: { ...DEFAULT_ITEMS.trap, ...overrides.trap },
    tank: { ...DEFAULT_ITEMS.tank, targetWeightsByPlace: DEFAULT_ITEMS.tank.targetWeightsByPlace.map((weights) => [...weights]), ...overrides.tank },
    boost: { ...DEFAULT_ITEMS.boost, ...overrides.boost },
    catnip: { ...DEFAULT_ITEMS.catnip, ...overrides.catnip },
    laser: { ...DEFAULT_ITEMS.laser, ...overrides.laser },
    yarn: { ...DEFAULT_ITEMS.yarn, ...overrides.yarn },
    vacuum: { ...DEFAULT_ITEMS.vacuum, ...overrides.vacuum },
    gravity: { ...DEFAULT_ITEMS.gravity, ...overrides.gravity },
    cowpat: { ...DEFAULT_ITEMS.cowpat, ...overrides.cowpat },
    hitFeedback: { ...DEFAULT_ITEMS.hitFeedback },
    itemFeedback: { ...DEFAULT_ITEMS.itemFeedback },
  };
}

/** Writes into the existing nested objects, so controllers bound to them keep working. */
export function resetRuntimeItems(target: ItemConfig, overrides: ItemOverrides = {}): void {
  const fresh = createRuntimeItems(overrides);
  target.boxRespawnSeconds = fresh.boxRespawnSeconds;
  target.boxRadius = fresh.boxRadius;
  target.leaderStunBonusSeconds = fresh.leaderStunBonusSeconds;
  Object.assign(target.hairball, fresh.hairball);
  Object.assign(target.nap, fresh.nap);
  Object.assign(target.trap, fresh.trap);
  Object.assign(target.tank, fresh.tank);
  Object.assign(target.boost, fresh.boost);
  Object.assign(target.catnip, fresh.catnip);
  Object.assign(target.laser, fresh.laser);
  Object.assign(target.yarn, fresh.yarn);
  Object.assign(target.vacuum, fresh.vacuum);
  Object.assign(target.gravity, fresh.gravity);
  Object.assign(target.cowpat, fresh.cowpat);
  Object.assign(target.hitFeedback, fresh.hitFeedback);
  Object.assign(target.itemFeedback, fresh.itemFeedback);
}
