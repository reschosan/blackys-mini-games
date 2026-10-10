export type GameAction = 'accelerate' | 'brake' | 'drift' | 'useItem' | 'pause' | 'confirm' | 'settings';

export const GAMEPAD_ACTION_BUTTONS: Readonly<Record<number, GameAction>> = {
  0: 'accelerate',
  1: 'brake',
  2: 'useItem',
  4: 'useItem',
  5: 'drift',
  9: 'pause',
  8: 'settings',
};

export const GAMEPAD_STEER_LEFT_BUTTON = 14;
export const GAMEPAD_STEER_RIGHT_BUTTON = 15;
export const GAMEPAD_STEER_AXIS = 0;
export const GAMEPAD_VERTICAL_AXIS = 1;
export const GAMEPAD_LOOK_AXIS = 2;
export const GAMEPAD_DPAD_UP_BUTTON = 12;
export const GAMEPAD_DPAD_DOWN_BUTTON = 13;
export const STICK_DEADZONE = 0.15;

export interface MenuScrollConfig {
  pixelsPerSecond: number;
}

const DEFAULT_MENU_SCROLL: Readonly<MenuScrollConfig> = Object.freeze({
  pixelsPerSecond: 600,
} satisfies MenuScrollConfig);

export function createRuntimeMenuScroll(): MenuScrollConfig {
  return { ...DEFAULT_MENU_SCROLL };
}

export function resetRuntimeMenuScroll(target: MenuScrollConfig): void {
  Object.assign(target, createRuntimeMenuScroll());
}
