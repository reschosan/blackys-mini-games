/** Seconds as "0:42". */
export function clockText(seconds: number): string {
  const whole = Math.max(Math.ceil(seconds), 0);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Places from a score where more is better; equal scores share a place. */
export function placesByScoreDescending(scores: readonly number[]): readonly number[] {
  return scores.map((score) => 1 + scores.filter((other) => other > score).length);
}

/** Places from a score where less is better; equal scores share a place. */
export function placesByScoreAscending(scores: readonly number[]): readonly number[] {
  return scores.map((score) => 1 + scores.filter((other) => other < score).length);
}

/** Places for knock-out games: the one who stays longest wins. `outAt[slot]` is the time a seat went out, or null while it is still in. */
export function placesByStaying(outAt: readonly (number | null)[]): readonly number[] {
  return outAt.map((time) => (time === null ? 1 : 1 + outAt.filter((other) => other === null || other > time).length));
}
