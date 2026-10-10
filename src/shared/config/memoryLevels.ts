/** The levels of memory the players choose from before the start: how many pairs lie on the board. */
export const MEMORY_LEVELS: readonly number[] = [5, 7, 10, 12];

export const DEFAULT_MEMORY_LEVEL = 1;

/** The columns of the board for a level: two even rows for the small boards, more rows for the big ones. */
export function memoryColumnsFor(pairs: number): number {
  if (pairs <= 5) return 5;
  if (pairs <= 7) return 7;
  return pairs <= 10 ? 5 : 6;
}
