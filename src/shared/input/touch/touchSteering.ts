import type { CameraConfig } from '../../config/camera';
import type { TouchSteeringConfig } from '../../config/touch';

export interface ScreenRelativeFrame {
  readonly steer: number;
  readonly accelerate: boolean;
  readonly brake: boolean;
}

const NEUTRAL_SCREEN_RELATIVE_FRAME: ScreenRelativeFrame = { steer: 0, accelerate: false, brake: false };

export function kartRelativeFrame(stickX: number, stickY: number, config: TouchSteeringConfig): ScreenRelativeFrame {
  return {
    steer: Math.abs(stickX) <= config.deadzone ? 0 : Math.sign(stickX) * Math.min(1, (Math.abs(stickX) - config.deadzone) / (1 - config.deadzone)),
    accelerate: stickY < -config.deadzone,
    brake: stickY > config.deadzone,
  };
}

/** The follow camera turns with the kart, so the stick steers relative to the kart; only the fixed overview camera keeps screen directions. */
export function simplifiedModeFor(cameraMode: CameraConfig['mode']): 'kartRelative' | 'screenRelative' {
  return cameraMode === 'overview' ? 'screenRelative' : 'kartRelative';
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Translates a phone stick vector into kart-local steering.
 * Stick direction is the desired travel direction on screen (camera does not
 * rotate): stick up = -z, stick right = +x, regardless of the kart's heading.
 */
export function screenRelativeFrame(stickX: number, stickY: number, kartYaw: number, forwardSpeed: number, config: TouchSteeringConfig): ScreenRelativeFrame {
  if (Math.hypot(stickX, stickY) < config.deadzone) return NEUTRAL_SCREEN_RELATIVE_FRAME;

  const desiredYaw = Math.atan2(stickY, stickX);
  const angleDiff = normalizeAngle(desiredYaw - kartYaw);
  const steer = clamp((angleDiff / Math.PI) * config.steerGain, -1, 1);

  const shouldReverse = Math.abs(angleDiff) > config.reverseAngle && Math.abs(forwardSpeed) < config.reverseMaxSpeed;

  return { steer, accelerate: !shouldReverse, brake: shouldReverse };
}
