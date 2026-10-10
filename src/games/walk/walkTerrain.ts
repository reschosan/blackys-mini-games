import type { ModeTuning } from '../../shared/config/modes';
import type { Rng } from '../../shared/core/rng';

/** How the steps of the floor are laid out: stepped hills (a summit, the step below all round it, and so on down to the floor), the
 *  first two reaching the top level, the others one step lower. Neighbouring tiles differ by one step at most, so every step can be jumped,
 *  and the 3×3 tiles in the middle, where the cats start, stay on the floor (the summits keep far enough away from them). */
export function buildLevels(side: number, tuning: Pick<ModeTuning['walk'], 'hillCount' | 'topLevel'>, rng: Rng): number[] {
  const levels = new Array<number>(side * side).fill(0);
  const middle = Math.floor(side / 2);
  const awayFromStart = levels.map((_, tile) => tile).filter((tile) => chebyshev(tile, middle * side + middle, side) > tuning.topLevel);
  for (let hill = 0; hill < tuning.hillCount && awayFromStart.length > 0; hill += 1) {
    const summit = awayFromStart.splice(rng.nextInt(awayFromStart.length), 1)[0]!;
    const peak = hill < 2 ? tuning.topLevel : Math.max(tuning.topLevel - 1, 1);
    levels.forEach((level, tile) => {
      levels[tile] = Math.max(level, peak - chebyshev(tile, summit, side));
    });
  }
  return levels;
}

/** Steps between two tiles in a grid where diagonal neighbours count as one step. */
function chebyshev(first: number, second: number, side: number): number {
  return Math.max(Math.abs((first % side) - (second % side)), Math.abs(Math.floor(first / side) - Math.floor(second / side)));
}
