import { roundForSnapshot } from '../../shared/game/engine';
import { NOT_OUT, type Jet } from './jetsTypes';

/** A jet as the screen reads it from the snapshot. */
export interface JetPicture {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly hits: number;
  readonly out: boolean;
  readonly flashing: boolean;
  readonly y: number;
  readonly vertical: number;
  readonly boosting: boolean;
  readonly shielded: boolean;
  readonly item: number;
  readonly watching: number;
}

const flag = (on: boolean): number => (on ? 1 : 0);

/** A jet in the snapshot is a flat row of numbers in this order: short on the wire. */
export function jetRow(jet: Jet): number[] {
  return [
    roundForSnapshot(jet.x),
    roundForSnapshot(jet.z),
    roundForSnapshot(jet.heading),
    jet.hits,
    flag(jet.outAt !== NOT_OUT),
    flag(jet.invulnerableLeft > 0),
    roundForSnapshot(jet.y),
    roundForSnapshot(jet.vertical),
    flag(jet.boostLeft > 0),
    flag(jet.shieldLeft > 0),
    jet.item,
    jet.watching,
  ];
}

export function readJetRow(row: readonly number[]): JetPicture {
  const [x = 0, z = 0, heading = 0, hits = 0, out = 1, flashing = 0, y = 0, vertical = 0, boosting = 0, shielded = 0, item = 0, watching = -1] = row;
  return { x, z, heading, hits, out: out === 1, flashing: flashing === 1, y, vertical, boosting: boosting === 1, shielded: shielded === 1, item, watching };
}
