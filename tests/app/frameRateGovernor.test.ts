import { describe, expect, it, vi } from 'vitest';
import { FrameRateGovernor } from '../../src/party/app/frameRateGovernor';
import { createRuntimeGraphics, type GraphicsQuality } from '../../src/shared/config/graphics';

function setup(quality: GraphicsQuality) {
  const graphics = { ...createRuntimeGraphics(), quality, emergency: false };
  const onStep = vi.fn();
  return { graphics, onStep, governor: new FrameRateGovernor(graphics, onStep) };
}

/** Runs frames of the given length for that many seconds. */
function run(governor: FrameRateGovernor, seconds: number, fps: number): void {
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame += 1) governor.observe(1 / fps);
}

describe('FrameRateGovernor', () => {
  it('leaves a device alone that keeps up', () => {
    const { governor, graphics, onStep } = setup('low');
    run(governor, 20, 30);
    expect(onStep).not.toHaveBeenCalled();
    expect(graphics.emergency).toBe(false);
  });

  it('draws bare bones when "Niedrig" stays under 15 FPS', () => {
    const { governor, graphics, onStep } = setup('low');
    run(governor, 8, 10);
    expect(onStep).toHaveBeenCalledWith('emergency');
    expect(graphics.emergency).toBe(true);
    expect(graphics.quality).toBe('low');
  });

  it('first switches "Hoch" to "Niedrig", and only then goes bare bones', () => {
    const { governor, graphics, onStep } = setup('high');
    run(governor, 6, 10);
    expect(onStep.mock.calls).toEqual([['lowered']]);
    expect(graphics.quality).toBe('low');
    run(governor, 10, 10);
    expect(onStep.mock.calls).toEqual([['lowered'], ['emergency']]);
  });

  it('ignores the first seconds of a race (loading hitches) and short dips', () => {
    const { governor, onStep } = setup('low');
    run(governor, 1.9, 4);
    governor.observe(0.5);
    run(governor, 1, 60);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('does not step twice at once and not past bare bones', () => {
    const { governor, onStep } = setup('low');
    run(governor, 60, 5);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('measures afresh after a restart', () => {
    const { governor, onStep } = setup('low');
    run(governor, 2.5, 8);
    governor.restart();
    run(governor, 1.5, 8);
    expect(onStep).not.toHaveBeenCalled();
  });
});
