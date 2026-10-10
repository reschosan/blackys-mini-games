import type { RacePlayer } from '../race/racePlayer';
import type { RaceWorld } from '../race/raceWorld';
import { ITEM_TYPES } from '../../../shared/config/items';
import type { KartSnapshot, RaceSnapshot } from './snapshotTypes';

export interface SnapshotSource {
  readonly players: readonly RacePlayer[];
  readonly world: RaceWorld;
  readonly countdownSecondsLeft: number;
  readonly goDisplayActive: boolean;
  readonly finishCountdownSeconds: number | null;
  /** The state of the rules of the game (`ModeRules.toExtras`), or nothing in the plain race. */
  readonly extras: readonly number[];
}

function kartSnapshot(player: RacePlayer, place: number): KartSnapshot {
  const { state, progress } = player;
  return {
    x: state.x,
    z: state.z,
    yaw: state.yaw,
    velocityX: state.velocityX,
    velocityZ: state.velocityZ,
    levelId: state.levelId,
    stairTransitionId: state.stairTransitionId,
    driftDirection: state.driftDirection,
    driftStage: state.driftStage,
    driftCharge: state.driftCharge,
    lastBoostFieldId: state.lastBoostFieldId,
    lastWindowJumpId: state.lastWindowJumpId,
    boostSeconds: state.boostSeconds,
    stunSecondsLeft: state.stunSecondsLeft,
    stickySecondsLeft: state.stickySecondsLeft,
    shieldSecondsLeft: state.shieldSecondsLeft,
    catnipSecondsLeft: state.catnipSecondsLeft,
    penaltySecondsLeft: state.penaltySecondsLeft,
    airborneSecondsLeft: state.airborneSecondsLeft,
    airborneSeconds: state.airborneSeconds,
    shoveCooldownSeconds: state.shoveCooldownSeconds,
    onCarpet: state.onCarpet,
    surfaceKind: state.surfaceKind,
    windowJumpId: state.windowJumpId,
    windowJumpElapsedSeconds: state.windowJumpElapsedSeconds,
    lap: progress.lap,
    nextCheckpoint: progress.nextCheckpoint,
    finished: progress.finished,
    finishTimeSeconds: progress.finishTimeSeconds,
    heldItem: player.heldItem !== null && ITEM_TYPES.includes(player.heldItem) ? player.heldItem : null,
    place,
  };
}

/** The picture of the race right now, the same for every guest; `ackInputSequence` is filled in per guest when it is sent. */
export function buildSnapshot(source: SnapshotSource, sequence: number): RaceSnapshot {
  const { world } = source;
  return {
    sequence,
    ackInputSequence: 0,
    raceTimeSeconds: world.raceTimeSeconds,
    countdownSecondsLeft: source.countdownSecondsLeft,
    goDisplayActive: source.goDisplayActive,
    finishCountdownSeconds: source.finishCountdownSeconds,
    karts: source.players.map((player, index) => kartSnapshot(player, world.places[index] ?? 0)),
    hairballs: world.hairballs.map((ball) => ({
      kind: ball.kind,
      x: ball.x,
      z: ball.z,
      vx: ball.vx,
      vz: ball.vz,
      ownerIndex: ball.ownerIndex,
      levelId: ball.levelId,
      elevation: ball.elevation ?? null,
    })),
    traps: world.traps.map((trap) => ({
      kind: trap.kind ?? 'cup',
      x: trap.x,
      z: trap.z,
      ownerIndex: trap.ownerIndex,
      levelId: trap.levelId,
      elevation: trap.elevation ?? null,
    })),
    lasers: world.fieldItems.lasers.map((dot) => ({
      x: dot.x,
      z: dot.z,
      vx: dot.vx,
      vz: dot.vz,
      ownerIndex: dot.ownerIndex,
      levelId: dot.levelId,
      secondsLeft: dot.secondsLeft,
    })),
    gravityBubbles: world.fieldItems.gravityBubbles.map((bubble) => ({
      x: bubble.x,
      z: bubble.z,
      ownerIndex: bubble.ownerIndex,
      levelId: bubble.levelId,
      elevation: bubble.elevation,
      secondsLeft: bubble.secondsLeft,
    })),
    vacuumPulses: world.fieldItems.vacuumPulses.map((pulse) => ({
      x: pulse.x,
      z: pulse.z,
      yaw: pulse.yaw,
      levelId: pulse.levelId,
      ageSeconds: pulse.ageSeconds,
    })),
    shells: world.tankFire.shells.map((shell) => ({
      x: shell.x,
      z: shell.z,
      heading: shell.heading,
      ageSeconds: shell.ageSeconds,
      ownerIndex: shell.ownerIndex,
      targetIndex: shell.targetIndex,
      levelId: shell.levelId,
      elevation: shell.elevation,
    })),
    explosions: world.tankFire.explosions.map((explosion) => ({
      x: explosion.x,
      z: explosion.z,
      levelId: explosion.levelId,
      elevation: explosion.elevation,
      ageSeconds: explosion.ageSeconds,
    })),
    itemBoxCollected: world.itemBoxes.map((box) => box.collected),
    extras: [...source.extras],
  };
}
