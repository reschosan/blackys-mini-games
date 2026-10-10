import type { ItemConfig } from '../../../shared/config/items';
import type { InputFrame } from '../../../shared/input/actions';
import type { KartState } from '../kart/kartState';
import { activateBoost } from '../kart/boost';

export function activateCatnip(state: KartState, items: ItemConfig): void {
  state.catnipSecondsLeft = items.catnip.boostSeconds + items.catnip.chaosSeconds;
  activateBoost(state, items.catnip.boostSeconds);
}

export function stepCatnip(state: KartState, stepSeconds: number): void {
  state.catnipSecondsLeft = Math.max(state.catnipSecondsLeft - stepSeconds, 0);
}

/** Deterministic wobble: a sine of the remaining effect time, active only for the final stretch. */
export function catnipSteerOffset(state: KartState, items: ItemConfig): number {
  const { chaosSeconds, chaosSteerAmplitude, chaosFrequency } = items.catnip;
  if (state.catnipSecondsLeft <= 0 || state.catnipSecondsLeft > chaosSeconds) return 0;
  return Math.sin(state.catnipSecondsLeft * chaosFrequency) * chaosSteerAmplitude;
}

export function withCatnipWobble(frame: InputFrame, state: KartState, items: ItemConfig): InputFrame {
  const offset = catnipSteerOffset(state, items);
  if (offset === 0) return frame;
  return { ...frame, steer: Math.max(-1, Math.min(1, frame.steer + offset)) };
}
