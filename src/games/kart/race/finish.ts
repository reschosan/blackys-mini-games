export interface FinishStatus {
  readonly deadlineSeconds: number | null;
  readonly raceOver: boolean;
}

export function evaluateFinish(
  finishedFlags: readonly boolean[],
  raceTimeSeconds: number,
  countdownSeconds: number,
  currentDeadline: number | null,
): FinishStatus {
  if (finishedFlags.length === 0) return { deadlineSeconds: currentDeadline, raceOver: false };
  if (finishedFlags.every(Boolean)) return { deadlineSeconds: currentDeadline, raceOver: true };
  if (!finishedFlags.some(Boolean)) return { deadlineSeconds: currentDeadline, raceOver: false };

  const deadlineSeconds = currentDeadline ?? raceTimeSeconds + countdownSeconds;
  return { deadlineSeconds, raceOver: raceTimeSeconds >= deadlineSeconds };
}
