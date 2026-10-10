import type { SurfaceKind } from '../../../shared/config/surfaces';
import { createKartState, type KartState } from '../kart/kartState';
import { createProgress, type KartProgress } from '../race/raceState';
import type { RaceWorld } from '../race/raceWorld';
import type { ItemType } from '../../../shared/config/items';
import type { KartSnapshot, RaceSnapshot } from './snapshotTypes';

/** What the rest of the game sees of one kart on a guest phone: the same shape as a racer on the host. */
export interface RemoteRacer {
  readonly state: KartState;
  readonly progress: KartProgress;
  isAi: boolean;
  heldItem: ItemType | null;
  /** Out of the game: not drawn. */
  hidden?: boolean;
}

export function createRemoteRacer(isAi: boolean): RemoteRacer {
  return { state: createKartState(0, 0, 0), progress: createProgress(0, 0), isAi, heldItem: null };
}

/** Writes a kart snapshot into a state in place; the views hold on to the state object, so it must stay the same object. */
export function applyKartSnapshot(target: KartState, kart: KartSnapshot): void {
  target.x = kart.x;
  target.z = kart.z;
  target.yaw = kart.yaw;
  target.velocityX = kart.velocityX;
  target.velocityZ = kart.velocityZ;
  target.levelId = kart.levelId;
  target.stairTransitionId = kart.stairTransitionId;
  target.driftDirection = kart.driftDirection;
  target.driftStage = kart.driftStage;
  target.driftCharge = kart.driftCharge;
  target.lastBoostFieldId = kart.lastBoostFieldId;
  target.lastWindowJumpId = kart.lastWindowJumpId;
  target.boostSeconds = kart.boostSeconds;
  target.stunSecondsLeft = kart.stunSecondsLeft;
  target.stickySecondsLeft = kart.stickySecondsLeft;
  target.shieldSecondsLeft = kart.shieldSecondsLeft;
  target.catnipSecondsLeft = kart.catnipSecondsLeft;
  target.penaltySecondsLeft = kart.penaltySecondsLeft;
  target.airborneSecondsLeft = kart.airborneSecondsLeft;
  target.airborneSeconds = kart.airborneSeconds;
  target.shoveCooldownSeconds = kart.shoveCooldownSeconds;
  target.onCarpet = kart.onCarpet;
  target.surfaceKind = kart.surfaceKind as SurfaceKind | null;
  target.windowJumpId = kart.windowJumpId;
  target.windowJumpElapsedSeconds = kart.windowJumpElapsedSeconds;
}

/** The own kart as the guest shows it: the predicted state, moved by the correction that is still melting away. */
export function copyKartState(target: KartState, source: Readonly<KartState>, offset: { readonly x: number; readonly z: number; readonly yaw: number }): void {
  Object.assign(target, source);
  target.x += offset.x;
  target.z += offset.z;
  target.yaw += offset.yaw;
}

export function applyKartProgress(racer: RemoteRacer, kart: KartSnapshot): void {
  racer.progress.lap = kart.lap;
  racer.progress.nextCheckpoint = kart.nextCheckpoint;
  racer.progress.finished = kart.finished;
  racer.progress.finishTimeSeconds = kart.finishTimeSeconds;
  racer.heldItem = kart.heldItem;
}

/** Replaces the moving things of a race world by what the snapshot shows; the arrays stay the same objects (the views hold them). */
export function applyWorldSnapshot(world: RaceWorld, snapshot: RaceSnapshot): void {
  world.hairballs.length = 0;
  for (const ball of snapshot.hairballs) {
    const { elevation, ...rest } = ball;
    world.hairballs.push({ ...rest, ...(elevation === null ? {} : { elevation }), distanceTraveled: 0, bouncesRemaining: 0 });
  }
  world.traps.length = 0;
  for (const trap of snapshot.traps) {
    world.traps.push({
      ...(trap.kind === 'cowpat' ? { kind: trap.kind } : {}),
      x: trap.x,
      z: trap.z,
      ownerIndex: trap.ownerIndex,
      levelId: trap.levelId,
      ...(trap.elevation === null ? {} : { elevation: trap.elevation }),
    });
  }
  world.fieldItems.lasers.length = 0;
  world.fieldItems.lasers.push(...snapshot.lasers);
  world.fieldItems.gravityBubbles.length = 0;
  for (const bubble of snapshot.gravityBubbles) world.fieldItems.gravityBubbles.push({ ...bubble, caughtKartIndices: [] });
  world.fieldItems.vacuumPulses.length = 0;
  world.fieldItems.vacuumPulses.push(...snapshot.vacuumPulses);
  world.tankFire.shells.length = 0;
  world.tankFire.shells.push(...snapshot.shells);
  world.tankFire.explosions.length = 0;
  world.tankFire.explosions.push(...snapshot.explosions);
  world.itemBoxes = snapshot.itemBoxCollected.map((collected) => ({ collected, respawnSecondsLeft: 0 }));
  world.places = snapshot.karts.map((kart) => kart.place);
  world.raceTimeSeconds = snapshot.raceTimeSeconds;
}
