import { NEUTRAL_INPUT, type InputFrame } from '../../../../shared/input/actions';
import { steerToward } from '../../ai/driver/steeringMath';
import { speedOf, type KartState } from '../../kart/kartState';
import type { AimPoint } from '../rules/modeRules';

const ARRIVED_METERS = 2.5;
const TURN_AROUND_ANGLE = 2.3;

/** A kart that drives to a point: turns towards it, gives gas, brakes when it points the wrong way or has arrived at speed. */
export function arenaInputFrame(state: KartState, aim: AimPoint | null, steerGain: number): InputFrame {
  const speed = speedOf(state);
  if (!aim) return { ...NEUTRAL_INPUT, brake: speed > 1 };
  const steer = steerToward(steerGain, state, aim);
  const tooFast = Math.hypot(aim.x - state.x, aim.z - state.z) < ARRIVED_METERS && speed > 4;
  const wrongWay = Math.abs(steer) >= 1 && Math.abs(Math.atan2(aim.z - state.z, aim.x - state.x) - state.yaw) > TURN_AROUND_ANGLE && speed > 5;
  const brake = tooFast || wrongWay;
  return { ...NEUTRAL_INPUT, steer, accelerate: !brake, brake };
}
