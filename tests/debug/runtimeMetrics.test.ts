import { describe, expect, it } from 'vitest';
import { RuntimeMetrics } from '../../src/shared/debug/runtimeMetrics';

describe('RuntimeMetrics', () => {
  it('reports frame timing, simulation ticks and a supported heap metric', () => {
    const metrics = new RuntimeMetrics(() => 4096);
    metrics.recordFrame(1 / 60);
    metrics.recordFrame(1 / 30);
    metrics.recordSimulationTick();
    metrics.recordSimulationTick();

    const snapshot = metrics.snapshot();
    expect(snapshot.fps).toBeCloseTo(40, 5);
    expect(snapshot.averageFrameMilliseconds).toBeCloseTo(25, 5);
    expect(snapshot.worstFrameMilliseconds).toBeCloseTo(1000 / 30, 5);
    expect(snapshot.renderedFrames).toBe(2);
    expect(snapshot.simulationTicks).toBe(2);
    expect(snapshot.heapBytes).toBe(4096);
    expect(snapshot.heapSupported).toBe(true);
  });

  it('averages the CPU time of simulation and drawing per frame over the recent frames', () => {
    const metrics = new RuntimeMetrics(() => null);
    metrics.recordFrame(1 / 30);
    metrics.recordWork(6, 10);
    metrics.recordWork(2, 14);

    const snapshot = metrics.snapshot();
    expect(snapshot.simulationMilliseconds).toBe(4);
    expect(snapshot.renderMilliseconds).toBe(12);
  });

  it('forgets work times older than the sample window', () => {
    const metrics = new RuntimeMetrics(() => null);
    metrics.recordFrame(1 / 60);
    for (let frame = 0; frame < 120; frame += 1) metrics.recordWork(100, 100);
    for (let frame = 0; frame < 120; frame += 1) metrics.recordWork(1, 2);

    expect(metrics.snapshot().simulationMilliseconds).toBe(1);
    expect(metrics.snapshot().renderMilliseconds).toBe(2);
  });

  it('reports unavailable heap metrics without inventing a value', () => {
    const metrics = new RuntimeMetrics(() => null);

    expect(metrics.snapshot()).toEqual({
      fps: null,
      averageFrameMilliseconds: null,
      worstFrameMilliseconds: null,
      simulationMilliseconds: null,
      renderMilliseconds: null,
      renderedFrames: 0,
      simulationTicks: 0,
      heapBytes: null,
      heapSupported: false,
    });
  });
});
