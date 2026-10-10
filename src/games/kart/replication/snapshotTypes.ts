import type { ItemType } from '../../../shared/config/items';

/** The shapes of a race snapshot: what the host sends of the race many times a second (`snapshot.ts` packs them into bytes). */

/** Everything the picture of one kart needs. The rest of the simulation state stays on the host. */
export interface KartSnapshot {
  x: number;
  z: number;
  yaw: number;
  velocityX: number;
  velocityZ: number;
  levelId: string;
  stairTransitionId: string | null;
  driftDirection: -1 | 0 | 1;
  driftStage: number;
  /** Not drawn, but replaying the own kart after a snapshot needs it to land where the host would. */
  driftCharge: number;
  lastBoostFieldId: string | null;
  lastWindowJumpId: string | null;
  boostSeconds: number;
  stunSecondsLeft: number;
  stickySecondsLeft: number;
  shieldSecondsLeft: number;
  catnipSecondsLeft: number;
  penaltySecondsLeft: number;
  airborneSecondsLeft: number;
  airborneSeconds: number;
  shoveCooldownSeconds: number;
  onCarpet: boolean;
  surfaceKind: string | null;
  windowJumpId: string | null;
  windowJumpElapsedSeconds: number;
  lap: number;
  nextCheckpoint: number;
  finished: boolean;
  finishTimeSeconds: number | null;
  heldItem: ItemType | null;
  place: number;
}

export interface HairballSnapshot {
  kind: 'hairball' | 'yarn';
  x: number;
  z: number;
  vx: number;
  vz: number;
  ownerIndex: number;
  levelId: string;
  elevation: number | null;
}
export interface TrapSnapshot {
  kind: 'cup' | 'cowpat';
  x: number;
  z: number;
  ownerIndex: number;
  levelId: string;
  elevation: number | null;
}
export interface LaserSnapshot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  ownerIndex: number;
  levelId: string;
  secondsLeft: number;
}
export interface GravityBubbleSnapshot {
  x: number;
  z: number;
  ownerIndex: number;
  levelId: string;
  elevation: number;
  secondsLeft: number;
}
export interface VacuumSnapshot {
  x: number;
  z: number;
  yaw: number;
  levelId: string;
  ageSeconds: number;
}
export interface ShellSnapshot {
  x: number;
  z: number;
  heading: number;
  ageSeconds: number;
  ownerIndex: number;
  targetIndex: number;
  levelId: string;
  elevation: number;
}
export interface ExplosionSnapshot {
  x: number;
  z: number;
  levelId: string;
  elevation: number;
  ageSeconds: number;
}

export interface RaceSnapshot {
  /** Counts up with every snapshot (wraps at 65536); older ones that arrive late are dropped. */
  sequence: number;
  /** The last input of the receiving guest the host had applied when it made this snapshot; 0 for everyone else. */
  ackInputSequence: number;
  raceTimeSeconds: number;
  /** Seconds left of the start countdown, 0 once it is over. */
  countdownSecondsLeft: number;
  goDisplayActive: boolean;
  finishCountdownSeconds: number | null;
  karts: KartSnapshot[];
  hairballs: HairballSnapshot[];
  traps: TrapSnapshot[];
  lasers: LaserSnapshot[];
  gravityBubbles: GravityBubbleSnapshot[];
  vacuumPulses: VacuumSnapshot[];
  shells: ShellSnapshot[];
  explosions: ExplosionSnapshot[];
  /** Per item box: collected right now. */
  itemBoxCollected: boolean[];
  /** The state of the rules of a game with its own rules (`ModeRules.toExtras`); empty in the plain race. */
  extras: number[];
}
