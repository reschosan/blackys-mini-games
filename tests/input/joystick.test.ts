import { describe, expect, it } from 'vitest';
import { clampToUnitCircle } from '../../src/shared/touch/joystick';

describe('clampToUnitCircle', () => {
  it('returns a proportional vector inside the radius', () => {
    expect(clampToUnitCircle(30, 0, 60)).toEqual({ x: 0.5, y: 0 });
    expect(clampToUnitCircle(0, -60, 60)).toEqual({ x: 0, y: -1 });
  });

  it('clamps a vector reaching past the radius to the unit circle', () => {
    const result = clampToUnitCircle(120, 0, 60);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });

  it('preserves direction while clamping a diagonal vector', () => {
    const result = clampToUnitCircle(90, 90, 60);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(result.y);
  });

  it('returns zero for no movement', () => {
    expect(clampToUnitCircle(0, 0, 60)).toEqual({ x: 0, y: 0 });
  });
});
