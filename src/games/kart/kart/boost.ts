import type { KartState } from './kartState';

export function activateBoost(state: KartState, durationSeconds: number): void {
  state.boostSeconds = Math.max(state.boostSeconds, durationSeconds);
}
