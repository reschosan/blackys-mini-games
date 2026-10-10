import { describe, expect, it } from 'vitest';
import type { RuntimeMetricsSnapshot } from '../../src/shared/debug/runtimeMetrics';
import { formatPerformance, toneFor } from '../../src/shared/ui/performanceView';

const metrics = (overrides: Partial<RuntimeMetricsSnapshot> = {}): RuntimeMetricsSnapshot => ({
  fps: 30,
  averageFrameMilliseconds: 33.3,
  worstFrameMilliseconds: 50,
  simulationMilliseconds: 4.12,
  renderMilliseconds: 9.26,
  renderedFrames: 100,
  simulationTicks: 200,
  heapBytes: null,
  heapSupported: false,
  ...overrides,
});

describe('performance line', () => {
  it('shows only the rounded frame rate', () => {
    expect(formatPerformance(metrics({ fps: 29.6 }))).toBe('30 FPS');
  });

  it('says it is measuring until the first frames are in', () => {
    expect(formatPerformance(metrics({ fps: null }))).toBe('FPS …');
  });

  it('turns slow below 30 FPS only', () => {
    expect(toneFor(metrics({ fps: 29.4 }))).toBe('slow');
    expect(toneFor(metrics({ fps: 30 }))).toBe('smooth');
    expect(toneFor(metrics({ fps: null }))).toBe('smooth');
  });
});
