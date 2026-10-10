import { describe, expect, it } from 'vitest';
import { DEFAULT_TOUCH_STEERING } from '../../src/shared/config/touch';
import { kartRelativeFrame, screenRelativeFrame, simplifiedModeFor } from '../../src/shared/input/touch/touchSteering';

const config = DEFAULT_TOUCH_STEERING;

// Kart faces "up" on screen (world -z), matching a kart driving away from the camera.
const FACING_SCREEN_UP = -Math.PI / 2;

describe('third-person simplified touch steering', () => {
  it('accelerates straight up and brakes or reverses down', () => {
    expect(kartRelativeFrame(0, -1, config)).toEqual({ steer: 0, accelerate: true, brake: false });
    expect(kartRelativeFrame(0, 1, config)).toEqual({ steer: 0, accelerate: false, brake: true });
  });
  it('combines throttle and proportional left or right steering', () => {
    const left = kartRelativeFrame(-0.5, -0.8, config);
    expect(left.accelerate).toBe(true);
    expect(left.steer).toBeLessThan(0);
    expect(left.steer).toBeGreaterThan(-1);
    expect(kartRelativeFrame(0.5, -0.8, config).steer).toBeCloseTo(-left.steer);
    expect(kartRelativeFrame(-0.9, -0.4, config).steer).toBeLessThan(left.steer);
  });
  it('does not accelerate sideways and keeps the deadzone neutral', () => {
    expect(kartRelativeFrame(1, 0, config)).toEqual({ steer: 1, accelerate: false, brake: false });
    expect(kartRelativeFrame(0.1, 0.1, config)).toEqual({ steer: 0, accelerate: false, brake: false });
  });
});

describe('screen-relative touch steering', () => {
  it('drives straight when the stick matches the kart heading', () => {
    const frame = screenRelativeFrame(0, -1, FACING_SCREEN_UP, 10, config);
    expect(frame.steer).toBeCloseTo(0);
    expect(frame.accelerate).toBe(true);
    expect(frame.brake).toBe(false);
  });

  it('steers left when the stick points to the screen-left', () => {
    const frame = screenRelativeFrame(-1, 0, FACING_SCREEN_UP, 10, config);
    expect(frame.steer).toBeLessThan(0);
    expect(frame.accelerate).toBe(true);
  });

  it('steers right when the stick points to the screen-right', () => {
    const frame = screenRelativeFrame(1, 0, FACING_SCREEN_UP, 10, config);
    expect(frame.steer).toBeGreaterThan(0);
    expect(frame.accelerate).toBe(true);
  });

  it('reverses when the stick points opposite the heading and the kart is slow', () => {
    const frame = screenRelativeFrame(0, 1, FACING_SCREEN_UP, 0.2, config);
    expect(frame.brake).toBe(true);
    expect(frame.accelerate).toBe(false);
  });

  it('turns around instead of reversing when the kart is fast', () => {
    const frame = screenRelativeFrame(0, 1, FACING_SCREEN_UP, 10, config);
    expect(frame.accelerate).toBe(true);
    expect(frame.brake).toBe(false);
    expect(Math.abs(frame.steer)).toBe(1);
  });

  it('is neutral inside the deadzone', () => {
    const frame = screenRelativeFrame(config.deadzone / 4, config.deadzone / 4, 0, 10, config);
    expect(frame).toEqual({ steer: 0, accelerate: false, brake: false });
  });

  it('steers toward the same screen direction regardless of the kart heading', () => {
    // Stick right (+x) is screen-right no matter which way the kart currently points,
    // but the steering sign needed to reach it depends on the current heading.
    const facingScreenDown = screenRelativeFrame(1, 0, Math.PI / 2, 10, config);
    const facingScreenRight = screenRelativeFrame(1, 0, 0, 10, config);
    const facingScreenUp = screenRelativeFrame(1, 0, FACING_SCREEN_UP, 10, config);

    expect(Math.sign(facingScreenDown.steer)).toBe(-1);
    expect(facingScreenRight.steer).toBeCloseTo(0);
    expect(Math.sign(facingScreenUp.steer)).toBe(1);
  });
});

describe('simplified phone mode follows the camera', () => {
  it('steers relative to the kart whenever the camera turns with it, on every map', () => {
    expect(simplifiedModeFor('follow')).toBe('kartRelative');
  });
  it('keeps screen directions only for the fixed overview camera', () => {
    expect(simplifiedModeFor('overview')).toBe('screenRelative');
  });
});
