export type AiDifficulty = 'easy' | 'medium' | 'hard';

export const AI_DIFFICULTIES: readonly AiDifficulty[] = ['easy', 'medium', 'hard'];

export interface AiDifficultyTuning {
  /** Fraction of the shared top speed the AI lets itself reach on a straight. */
  topSpeedFactor: number;
  /** Fraction of the shared forward acceleration, including boost acceleration. */
  accelerationFactor: number;
  /** Converts the angle to the steering target into a steering input (radians -> [-1, 1] gain). */
  steerGain: number;
  /** Turn sharpness (radians) beyond which the AI starts slowing for the corner at all. */
  brakeAngleThreshold: number;
  /** Turn sharpness (radians) beyond which the AI drifts through the corner instead of braking. */
  driftAngleThreshold: number;
  /** Fraction of the shared top speed the AI still allows itself through the sharpest corners
   *  (turn sharpness of 180°/pi radians); softer corners get a proportionally higher target. */
  minCornerSpeedFactor: number;
  /** Chance (0-1) the AI times the 3-2-1-Los start well enough to earn the early-boost, rolled
   *  once per race via the seeded simulation RNG (not `Math.random()`). */
  startBoostChance: number;
}

export type AiDifficultyTunings = Record<AiDifficulty, AiDifficultyTuning>;

export const DEFAULT_AI_DIFFICULTY: Readonly<AiDifficultyTunings> = Object.freeze({
  easy: Object.freeze({
    topSpeedFactor: 1.14,
    accelerationFactor: 1.14,
    steerGain: 1.9,
    brakeAngleThreshold: 0.35,
    driftAngleThreshold: 0.75,
    minCornerSpeedFactor: 0.4,
    startBoostChance: 0.15,
  } satisfies AiDifficultyTuning),
  medium: Object.freeze({
    topSpeedFactor: 1.2,
    accelerationFactor: 1.2,
    steerGain: 1.9,
    brakeAngleThreshold: 0.35,
    driftAngleThreshold: 0.75,
    minCornerSpeedFactor: 0.4,
    startBoostChance: 0.5,
  } satisfies AiDifficultyTuning),
  hard: Object.freeze({
    topSpeedFactor: 1.32,
    accelerationFactor: 1.32,
    steerGain: 1.9,
    brakeAngleThreshold: 0.35,
    driftAngleThreshold: 0.75,
    minCornerSpeedFactor: 0.4,
    startBoostChance: 0.85,
  } satisfies AiDifficultyTuning),
});

export function createRuntimeAiDifficulty(): AiDifficultyTunings {
  return {
    easy: { ...DEFAULT_AI_DIFFICULTY.easy },
    medium: { ...DEFAULT_AI_DIFFICULTY.medium },
    hard: { ...DEFAULT_AI_DIFFICULTY.hard },
  };
}

export function resetRuntimeAiDifficulty(target: AiDifficultyTunings): void {
  Object.assign(target, createRuntimeAiDifficulty());
}
