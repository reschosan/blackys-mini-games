import { roundForSnapshot } from '../../shared/game/engine';
import { NOT_OUT, type WalkCat } from './walkCat';

/** A cat as the screen reads it from the snapshot. */
export interface CatPicture {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly facing: number;
  readonly out: boolean;
  readonly speed: number;
  readonly yaw: number;
  readonly boosting: boolean;
  readonly pawFlashing: boolean;
  readonly stunned: boolean;
  readonly watching: number;
}

const flag = (on: boolean): number => (on ? 1 : 0);

/** A cat in the snapshot is a flat row of numbers in this order: short on the wire. */
export function catRow(cat: WalkCat): number[] {
  return [
    roundForSnapshot(cat.x),
    roundForSnapshot(cat.z),
    roundForSnapshot(cat.y),
    roundForSnapshot(cat.facing),
    flag(cat.outAt !== NOT_OUT),
    roundForSnapshot(Math.hypot(cat.vx, cat.vz), 10),
    roundForSnapshot(cat.yaw),
    flag(cat.boostLeft > 0),
    flag(cat.pawFlashLeft > 0),
    flag(cat.stunLeft > 0),
    cat.watching,
  ];
}

export function readCatRow(row: readonly number[]): CatPicture {
  const [x = 0, z = 0, y = 0, facing = 0, out = 1, speed = 0, yaw = 0, boosting = 0, pawFlashing = 0, stunned = 0, watching = -1] = row;
  return { x, z, y, facing, out: out === 1, speed, yaw, boosting: boosting === 1, pawFlashing: pawFlashing === 1, stunned: stunned === 1, watching };
}
