/** Where the on-screen controls sit: over the game picture, or in their own half next to it. */
export type TouchLayout = 'overlay' | 'split';

export const TOUCH_LAYOUTS: readonly TouchLayout[] = ['overlay', 'split'];
const DEFAULT_TOUCH_LAYOUT: TouchLayout = 'overlay';

/** auto = the kart gives gas by itself, the stick steers left/right and there is a brake button;
 *  simple = free stick incl. screen-relative auto-steer; classic = stick steers left/right only, gas/brake are buttons. */
export type TouchControlMode = 'auto' | 'simple' | 'classic';

export const TOUCH_CONTROL_MODES: readonly TouchControlMode[] = ['auto', 'simple', 'classic'];
const DEFAULT_TOUCH_CONTROL_MODE: TouchControlMode = 'auto';

export interface TouchSettings {
  mode: TouchControlMode;
  layout: TouchLayout;
}

export function createRuntimeTouchSettings(): TouchSettings {
  return { mode: DEFAULT_TOUCH_CONTROL_MODE, layout: DEFAULT_TOUCH_LAYOUT };
}

function nextOf<T>(items: readonly T[], current: T): T {
  return items[(items.indexOf(current) + 1) % items.length]!;
}

export function nextTouchControlMode(mode: TouchControlMode): TouchControlMode {
  return nextOf(TOUCH_CONTROL_MODES, mode);
}

export function nextTouchLayout(layout: TouchLayout): TouchLayout {
  return nextOf(TOUCH_LAYOUTS, layout);
}

/** Modes in which the stick only steers left/right; the vertical axis is not used. */
export function isHorizontalStickMode(mode: TouchControlMode): boolean {
  return mode !== 'simple';
}

/** A screen with a shorter side under this (CSS px) counts as a phone: the touch controls start by themselves.
 *  A 10-inch tablet is 768 px or more and plays like a big screen. */
export const PHONE_MAX_SHORT_SIDE_PX = 768;

export const TOUCH_STICK_RADIUS_PX = 70;
export const TOUCH_STICK_GRAB_TOLERANCE_PX = 40;

export interface TouchSteeringConfig {
  deadzone: number;
  reverseAngle: number;
  reverseMaxSpeed: number;
  steerGain: number;
}

export const DEFAULT_TOUCH_STEERING: Readonly<TouchSteeringConfig> = Object.freeze({
  deadzone: 0.15,
  reverseAngle: 2.4,
  reverseMaxSpeed: 3,
  steerGain: 2,
} satisfies TouchSteeringConfig);

export function createRuntimeTouchSteering(): TouchSteeringConfig {
  return { ...DEFAULT_TOUCH_STEERING };
}

export function resetRuntimeTouchSteering(target: TouchSteeringConfig): void {
  Object.assign(target, createRuntimeTouchSteering());
}
