import type { ModeTuning } from '../../shared/config/modes';
import type { Rng } from '../../shared/core/rng';
import { SOLID, type WalkFloor } from './walkFloor';

export interface FishSpot {
  readonly x: number;
  readonly z: number;
  readonly tile: number;
}

interface Eater {
  readonly x: number;
  readonly z: number;
  readonly y: number;
}

/** The fish on the floor: one turns up every few seconds on a tile that is still safe, a cat that touches it eats it, and a fish whose tile glows is gone. */
export function createFish(floor: WalkFloor, rng: Rng, tuning: ModeTuning['walk']) {
  let spots: FishSpot[] = [];
  let nextAt = tuning.fishSpawnSeconds;

  const spawn = (): void => {
    const free = floor.states.flatMap((state, tile) => (state === SOLID && !spots.some((spot) => spot.tile === tile) ? [tile] : []));
    const tile = free[rng.nextInt(free.length)];
    if (tile === undefined) return;
    spots.push({ ...floor.centreOf(tile), tile });
  };

  return {
    positions: (): readonly FishSpot[] => spots,
    update<T extends Eater>(time: number, cats: readonly T[], onEaten: (cat: T) => void): void {
      spots = spots.filter((spot) => floor.states[spot.tile] === SOLID);
      for (const cat of cats) {
        const eaten = spots.find(
          (spot) => Math.hypot(spot.x - cat.x, spot.z - cat.z) < tuning.fishPickupRadius && Math.abs(cat.y - floor.topOf(spot.tile)) < 1,
        );
        if (!eaten) continue;
        spots = spots.filter((spot) => spot !== eaten);
        onEaten(cat);
      }
      if (time < nextAt || spots.length >= tuning.fishMax) return;
      nextAt = time + tuning.fishSpawnSeconds;
      spawn();
    },
  };
}
