import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../src/shared/core/loop';

type FrameCallback = (timestamp: number) => void;

let pendingFrame: FrameCallback | null;
let clockMilliseconds: number;

function runNextFrame(frameMilliseconds = 20): void {
  const frame = pendingFrame;
  pendingFrame = null;
  clockMilliseconds += frameMilliseconds;
  frame?.(clockMilliseconds);
}

beforeEach(() => {
  pendingFrame = null;
  clockMilliseconds = 0;
  vi.stubGlobal('performance', { now: () => clockMilliseconds });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    pendingFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pendingFrame = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GameLoop', () => {
  it('steps the simulation in fixed steps and renders once per frame', () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop({ update, render, onFailure: vi.fn() });
    loop.start();
    runNextFrame(50);
    expect(update).toHaveBeenCalledTimes(3);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('stops after a failing update and reports the error exactly once', () => {
    const failure = new Error('broken update');
    const render = vi.fn();
    const onFailure = vi.fn();
    const loop = new GameLoop({
      update: () => {
        throw failure;
      },
      render,
      onFailure,
    });
    loop.start();
    runNextFrame();
    runNextFrame();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(render).not.toHaveBeenCalled();
    expect(pendingFrame).toBeNull();
  });

  it('stops after a failing render and reports the error exactly once', () => {
    const failure = new Error('broken render');
    const onFailure = vi.fn();
    const loop = new GameLoop({
      update: vi.fn(),
      render: () => {
        throw failure;
      },
      onFailure,
    });
    loop.start();
    runNextFrame();
    runNextFrame();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(pendingFrame).toBeNull();
  });
});
