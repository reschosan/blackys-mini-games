/** Tuning values of the games on the kart engine; the debug panel changes them live (see `shared/debug/panel/modeControls.ts`). */
export interface ModeTuning {
  readonly driftChallenge: {
    durationSeconds: number;
    /** Points per second of drifting at speed; every drift stage adds this share again. */
    pointsPerSecond: number;
    stageBonusShare: number;
    minimumSpeed: number;
    /** Speed lost within one tick above which a bump counts as a wall hit and the running streak is lost. */
    bumpSpeedDrop: number;
  };
  readonly tag: {
    durationSeconds: number;
    /** Seconds after a catch in which the new hunter cannot be caught back. */
    immunitySeconds: number;
    /** Centre distance (metres) at which two karts count as touching. */
    touchDistance: number;
    arenaSize: number;
  };
  readonly sumo: {
    platformRadius: number;
    shrinkStartSeconds: number;
    shrinkMetersPerSecond: number;
    minimumRadius: number;
    /** The shove (item button): it reaches the nearest kart this far ahead (centre to centre) within this half angle. */
    shoveRange: number;
    shoveConeDegrees: number;
    /** The speed the hit kart flies off with, the seconds it is in the air and the seconds before the next shove. */
    shoveSpeed: number;
    shoveFlightSeconds: number;
    shoveCooldownSeconds: number;
  };
  readonly lava: {
    tileSize: number;
    tilesPerSide: number;
    firstCollapseSeconds: number;
    collapseIntervalSeconds: number;
    minimumIntervalSeconds: number;
    warningSeconds: number;
  };
  readonly memory: {
    /** Seconds an AI cat thinks before it flips a card. */
    thinkSeconds: number;
    /** Seconds a human player has for a card before one is flipped for them. */
    humanThinkSeconds: number;
    /** Seconds the two cards stay up before they turn back or are taken. */
    revealSeconds: number;
    /** The chance an AI cat remembers a card it saw. */
    rememberChance: number;
    /** Seconds before the stick moves the cursor again while it is held. */
    moveRepeatSeconds: number;
  };
  readonly walk: {
    tilesPerSide: number;
    tileSize: number;
    /** How much higher each step of the hills is (a jump reaches one step, not two). */
    levelHeight: number;
    /** Hills of stepped tiles; the first two reach the top level. */
    hillCount: number;
    /** The highest step: the floor is level 0. */
    topLevel: number;
    /** When the lava floods the lowest level, and how long until it floods the next one. */
    floodStartSeconds: number;
    floodIntervalSeconds: number;
    /** How long a level glows before the lava takes it. */
    floodWarningSeconds: number;
    firstCollapseSeconds: number;
    collapseIntervalSeconds: number;
    minimumIntervalSeconds: number;
    warningSeconds: number;
    speed: number;
    acceleration: number;
    jumpSpeed: number;
    gravity: number;
    catRadius: number;
    /** Speed a cat gives another one it runs into. */
    shoveSpeed: number;
    lookTurnRate: number;
    /** How fast the camera swings round behind a cat that runs sideways (per second; 0 keeps it where it is). */
    cameraFollowRate: number;
    fishSpawnSeconds: number;
    fishMax: number;
    fishPickupRadius: number;
    boostSeconds: number;
    boostFactor: number;
    pawCooldownSeconds: number;
    pawRange: number;
    pawKnockSpeed: number;
    pawStunSeconds: number;
  };
  readonly jets: {
    arenaSize: number;
    durationSeconds: number;
    hitsToLose: number;
    speed: number;
    turnRate: number;
    minAltitude: number;
    maxAltitude: number;
    climbSpeed: number;
    bulletSpeed: number;
    bulletSeconds: number;
    fireCooldownSeconds: number;
    hitRadius: number;
    invulnerableSeconds: number;
    /** Seconds at the start in which nobody can be hit, so that a player gets their bearings. */
    startProtectionSeconds: number;
    pickupCount: number;
    pickupRespawnSeconds: number;
    pickupRadius: number;
    boostSeconds: number;
    boostFactor: number;
    shieldSeconds: number;
    missileSeconds: number;
    missileTurnRate: number;
    /** How much a plain shot bends towards an enemy it nearly points at (0 = flies straight). */
    shotAssist: number;
    /** The most an AI pilot is off when it aims, in radians: the higher, the easier the game against AI. */
    aiAimError: number;
  };
  readonly soccer: {
    fieldWidth: number;
    fieldDepth: number;
    goalWidth: number;
    durationSeconds: number;
    goalLimit: number;
    ballRadius: number;
    /** Share of the ball's speed lost per second. */
    ballDrag: number;
    /** How much of a kart's speed the ball takes when it is hit. */
    kickFactor: number;
    wallBounce: number;
    kickoffPauseSeconds: number;
    /** The legs of the slanted blocks in the corners that send the ball back into the field. */
    cornerSize: number;
  };
}

const DEFAULT_MODE_TUNING: Readonly<ModeTuning> = Object.freeze({
  driftChallenge: { durationSeconds: 60, pointsPerSecond: 10, stageBonusShare: 0.6, minimumSpeed: 7, bumpSpeedDrop: 2.5 },
  tag: { durationSeconds: 60, immunitySeconds: 2, touchDistance: 2.6, arenaSize: 90 },
  sumo: {
    platformRadius: 38,
    shrinkStartSeconds: 12,
    shrinkMetersPerSecond: 0.5,
    minimumRadius: 2,
    shoveRange: 7,
    shoveConeDegrees: 55,
    shoveSpeed: 14,
    shoveFlightSeconds: 0.5,
    shoveCooldownSeconds: 2,
  },
  lava: { tileSize: 9, tilesPerSide: 8, firstCollapseSeconds: 6, collapseIntervalSeconds: 2.4, minimumIntervalSeconds: 0.7, warningSeconds: 1.6 },
  memory: { thinkSeconds: 0.7, humanThinkSeconds: 7, revealSeconds: 1, rememberChance: 0.75, moveRepeatSeconds: 0.22 },
  walk: {
    tilesPerSide: 9,
    tileSize: 6,
    levelHeight: 1.4,
    hillCount: 4,
    topLevel: 2,
    floodStartSeconds: 18,
    floodIntervalSeconds: 14,
    floodWarningSeconds: 4,
    firstCollapseSeconds: 9,
    collapseIntervalSeconds: 6,
    minimumIntervalSeconds: 1.4,
    warningSeconds: 2,
    speed: 8,
    acceleration: 45,
    jumpSpeed: 9.5,
    gravity: 28,
    catRadius: 1,
    shoveSpeed: 7,
    lookTurnRate: 2.4,
    cameraFollowRate: 1.6,
    fishSpawnSeconds: 4,
    fishMax: 3,
    fishPickupRadius: 2,
    boostSeconds: 4,
    boostFactor: 1.45,
    pawCooldownSeconds: 1.6,
    pawRange: 3.6,
    pawKnockSpeed: 14,
    pawStunSeconds: 0.35,
  },
  jets: {
    arenaSize: 190,
    durationSeconds: 120,
    hitsToLose: 5,
    speed: 26,
    turnRate: 1.9,
    minAltitude: 4,
    maxAltitude: 34,
    climbSpeed: 14,
    bulletSpeed: 75,
    bulletSeconds: 1.1,
    fireCooldownSeconds: 0.5,
    hitRadius: 2.8,
    invulnerableSeconds: 2.5,
    startProtectionSeconds: 4,
    pickupCount: 7,
    pickupRespawnSeconds: 6,
    pickupRadius: 4,
    boostSeconds: 2.5,
    boostFactor: 1.6,
    shieldSeconds: 7,
    missileSeconds: 2.6,
    missileTurnRate: 2.6,
    shotAssist: 2,
    aiAimError: 0.3,
  },
  soccer: {
    fieldWidth: 130,
    fieldDepth: 76,
    goalWidth: 26,
    durationSeconds: 90,
    goalLimit: 3,
    ballRadius: 1.4,
    ballDrag: 0.55,
    kickFactor: 1.25,
    wallBounce: 0.8,
    kickoffPauseSeconds: 2,
    cornerSize: 10,
  },
} satisfies ModeTuning);

function copyTuning(): ModeTuning {
  return {
    driftChallenge: { ...DEFAULT_MODE_TUNING.driftChallenge },
    tag: { ...DEFAULT_MODE_TUNING.tag },
    sumo: { ...DEFAULT_MODE_TUNING.sumo },
    lava: { ...DEFAULT_MODE_TUNING.lava },
    memory: { ...DEFAULT_MODE_TUNING.memory },
    walk: { ...DEFAULT_MODE_TUNING.walk },
    jets: { ...DEFAULT_MODE_TUNING.jets },
    soccer: { ...DEFAULT_MODE_TUNING.soccer },
  };
}

export function createRuntimeModes(): ModeTuning {
  return copyTuning();
}

export function resetRuntimeModes(target: ModeTuning): void {
  const fresh = copyTuning();
  for (const key of Object.keys(fresh) as (keyof ModeTuning)[]) Object.assign(target[key], fresh[key]);
}
