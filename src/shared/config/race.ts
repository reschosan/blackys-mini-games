export interface RaceConfig {
  lapCount: number;
  finishCountdownSeconds: number;
  resultsAutoReturnSeconds: number;
  /** Seconds of the "3-2-1-Los" countdown before a race, during which karts stay locked. */
  startCountdownSeconds: number;
  /** How long the "Los!" text stays on screen after the countdown ends (cosmetic only). */
  startGoDisplaySeconds: number;
  /** Window (seconds) right before "Los" during which pressing accelerate counts as a good-timed
   *  start; pressing accelerate earlier than that disqualifies the boost for this start. */
  earlyBoostWindowSeconds: number;
  /** `KartState.boostSeconds` granted for a well-timed start (same effect as the drift boost). */
  earlyBoostSeconds: number;
}

export const DEFAULT_RACE: Readonly<RaceConfig> = Object.freeze({
  lapCount: 3,
  finishCountdownSeconds: 20,
  resultsAutoReturnSeconds: 60,
  startCountdownSeconds: 3,
  startGoDisplaySeconds: 0.6,
  earlyBoostWindowSeconds: 0.35,
  earlyBoostSeconds: 1,
} satisfies RaceConfig);

export function createRuntimeRace(): RaceConfig {
  return { ...DEFAULT_RACE };
}

export function resetRuntimeRace(target: RaceConfig): void {
  Object.assign(target, createRuntimeRace());
}
