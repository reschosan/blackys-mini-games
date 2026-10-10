import {
  GAMEPAD_ACTION_BUTTONS,
  GAMEPAD_DPAD_DOWN_BUTTON,
  GAMEPAD_DPAD_UP_BUTTON,
  GAMEPAD_LOOK_AXIS,
  GAMEPAD_STEER_AXIS,
  GAMEPAD_STEER_LEFT_BUTTON,
  GAMEPAD_STEER_RIGHT_BUTTON,
  GAMEPAD_VERTICAL_AXIS,
  STICK_DEADZONE,
} from '../config/input';
import type { GameAction } from '../config/input';
import type { InputFrame } from './actions';

export interface GamepadLike {
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < STICK_DEADZONE) return 0;
  const scaled = (Math.abs(value) - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return Math.sign(value) * Math.min(scaled, 1);
}

function isButtonPressed(pad: GamepadLike, index: number): boolean {
  return pad.buttons[index]?.pressed ?? false;
}

function readSteer(pad: GamepadLike): number {
  const digitalSteer = (isButtonPressed(pad, GAMEPAD_STEER_RIGHT_BUTTON) ? 1 : 0) - (isButtonPressed(pad, GAMEPAD_STEER_LEFT_BUTTON) ? 1 : 0);
  if (digitalSteer !== 0) return digitalSteer;
  return applyDeadzone(pad.axes[GAMEPAD_STEER_AXIS] ?? 0);
}

function readMenuVertical(pad: GamepadLike): { menuUp: boolean; menuDown: boolean } {
  const verticalAxis = applyDeadzone(pad.axes[GAMEPAD_VERTICAL_AXIS] ?? 0);
  return {
    menuUp: isButtonPressed(pad, GAMEPAD_DPAD_UP_BUTTON) || verticalAxis < 0,
    menuDown: isButtonPressed(pad, GAMEPAD_DPAD_DOWN_BUTTON) || verticalAxis > 0,
  };
}

function readMove(pad: GamepadLike): { x: number; y: number } {
  const digitalY = (isButtonPressed(pad, GAMEPAD_DPAD_DOWN_BUTTON) ? 1 : 0) - (isButtonPressed(pad, GAMEPAD_DPAD_UP_BUTTON) ? 1 : 0);
  return { x: readSteer(pad), y: digitalY !== 0 ? digitalY : applyDeadzone(pad.axes[GAMEPAD_VERTICAL_AXIS] ?? 0) };
}

export function readGamepadFrame(pad: GamepadLike): InputFrame {
  const actions = new Set<GameAction>();
  for (const [index, action] of Object.entries(GAMEPAD_ACTION_BUTTONS)) {
    if (isButtonPressed(pad, Number(index))) actions.add(action);
  }

  return {
    steer: readSteer(pad),
    accelerate: actions.has('accelerate'),
    brake: actions.has('brake'),
    drift: actions.has('drift'),
    useItem: actions.has('useItem'),
    pause: actions.has('pause'),
    confirm: actions.has('accelerate'),
    settings: actions.has('settings'),
    move: readMove(pad),
    look: applyDeadzone(pad.axes[GAMEPAD_LOOK_AXIS] ?? 0),
    ...readMenuVertical(pad),
  };
}

export function hasAnyButtonPressed(pad: GamepadLike): boolean {
  return pad.buttons.some((button) => button.pressed);
}

export function connectedGamepads(): readonly (Gamepad | null)[] {
  return navigator.getGamepads?.() ?? [];
}
