import { describe, expect, it } from 'vitest';
import { STICK_DEADZONE } from '../../src/shared/config/input';
import { readGamepadFrame, hasAnyButtonPressed, type GamepadLike } from '../../src/shared/input/gamepad';

function pad(overrides: { buttons?: number[]; axes?: number[] }): GamepadLike {
  const pressedButtons = new Set(overrides.buttons ?? []);
  return {
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressedButtons.has(index) })),
    axes: overrides.axes ?? [0, 0, 0, 0],
  };
}

describe('gamepad mapping', () => {
  it('maps the standard buttons to actions', () => {
    expect(readGamepadFrame(pad({ buttons: [0, 5] }))).toMatchObject({
      accelerate: true,
      drift: true,
      brake: false,
      useItem: false,
    });
    expect(readGamepadFrame(pad({ buttons: [1, 2, 9] }))).toMatchObject({
      brake: true,
      useItem: true,
      pause: true,
    });
  });

  it('puts drift on the right shoulder button (R) and the item on the left one (L), the item also stays on the square', () => {
    expect(readGamepadFrame(pad({ buttons: [5] }))).toMatchObject({ drift: true, useItem: false });
    expect(readGamepadFrame(pad({ buttons: [4] }))).toMatchObject({ useItem: true, drift: false });
    expect(readGamepadFrame(pad({ buttons: [2] }))).toMatchObject({ useItem: true });
  });

  it('ignores stick noise inside the deadzone', () => {
    expect(readGamepadFrame(pad({ axes: [STICK_DEADZONE / 2, 0] })).steer).toBe(0);
  });

  it('scales the stick beyond the deadzone up to full lock', () => {
    expect(readGamepadFrame(pad({ axes: [1, 0] })).steer).toBe(1);
    expect(readGamepadFrame(pad({ axes: [-1, 0] })).steer).toBe(-1);
    const partial = readGamepadFrame(pad({ axes: [0.6, 0] })).steer;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(0.6);
  });

  it('lets the d-pad override the stick', () => {
    expect(readGamepadFrame(pad({ buttons: [14], axes: [1, 0] })).steer).toBe(-1);
    expect(readGamepadFrame(pad({ buttons: [15], axes: [-1, 0] })).steer).toBe(1);
  });

  it('detects any button for joining the lobby', () => {
    expect(hasAnyButtonPressed(pad({ buttons: [3] }))).toBe(true);
    expect(hasAnyButtonPressed(pad({}))).toBe(false);
  });
});
