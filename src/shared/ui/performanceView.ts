import type { RuntimeMetricsSnapshot } from '../debug/runtimeMetrics';
import { TARGET_FPS } from '../config/graphics';
import type { PerfTone } from './components/cPerfReadout';

const REFRESH_SECONDS = 0.5;

export function formatPerformance(metrics: RuntimeMetricsSnapshot): string {
  return metrics.fps === null ? 'FPS …' : `${Math.round(metrics.fps)} FPS`;
}

export function toneFor(metrics: RuntimeMetricsSnapshot): PerfTone {
  return metrics.fps !== null && metrics.fps < TARGET_FPS ? 'slow' : 'smooth';
}

/** The always visible frame rate; refreshed twice a second so reading it does not cost frames itself. */
export class PerformanceView {
  private readonly root = document.createElement('c-perf-readout');
  private secondsSinceRefresh = REFRESH_SECONDS;

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'performance';
    this.root.headline = 'FPS …';
    overlay.appendChild(this.root);
  }

  update(frameSeconds: number, metrics: () => RuntimeMetricsSnapshot): void {
    this.secondsSinceRefresh += frameSeconds;
    if (this.secondsSinceRefresh < REFRESH_SECONDS) return;
    this.secondsSinceRefresh = 0;
    const snapshot = metrics();
    this.root.headline = formatPerformance(snapshot);
    this.root.tone = toneFor(snapshot);
  }
}
