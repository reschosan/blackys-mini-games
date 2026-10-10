export interface RuntimeMetricsSnapshot {
  readonly fps: number | null;
  readonly averageFrameMilliseconds: number | null;
  readonly worstFrameMilliseconds: number | null;
  /** Average CPU time per frame spent in simulation steps (all steps of the frame added up). */
  readonly simulationMilliseconds: number | null;
  /** Average CPU time per frame spent preparing and submitting the drawing; the GPU works on after this. */
  readonly renderMilliseconds: number | null;
  readonly renderedFrames: number;
  readonly simulationTicks: number;
  readonly heapBytes: number | null;
  readonly heapSupported: boolean;
}

interface PerformanceMemory {
  readonly usedJSHeapSize: number;
}

export type HeapReader = () => number | null;

const SAMPLE_WINDOW_SIZE = 120;

function browserHeapReader(): number | null {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pushWindowed(values: number[], value: number): void {
  values.push(value);
  if (values.length > SAMPLE_WINDOW_SIZE) values.shift();
}

export class RuntimeMetrics {
  private readonly frameMilliseconds: number[] = [];
  private readonly simulationWorkMilliseconds: number[] = [];
  private readonly renderWorkMilliseconds: number[] = [];
  private renderedFrames = 0;
  private simulationTicks = 0;

  constructor(private readonly readHeap: HeapReader = browserHeapReader) {}

  recordFrame(frameSeconds: number): void {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0) return;
    this.frameMilliseconds.push(frameSeconds * 1000);
    if (this.frameMilliseconds.length > SAMPLE_WINDOW_SIZE) this.frameMilliseconds.shift();
    this.renderedFrames += 1;
  }

  /** CPU time of one frame: all simulation steps together, and the render call. */
  recordWork(simulationMilliseconds: number, renderMilliseconds: number): void {
    pushWindowed(this.simulationWorkMilliseconds, simulationMilliseconds);
    pushWindowed(this.renderWorkMilliseconds, renderMilliseconds);
  }

  recordSimulationTick(): void {
    this.simulationTicks += 1;
  }

  snapshot(): RuntimeMetricsSnapshot {
    const heapBytes = this.readHeap();
    if (this.frameMilliseconds.length === 0) {
      return {
        fps: null,
        averageFrameMilliseconds: null,
        worstFrameMilliseconds: null,
        simulationMilliseconds: average(this.simulationWorkMilliseconds),
        renderMilliseconds: average(this.renderWorkMilliseconds),
        renderedFrames: this.renderedFrames,
        simulationTicks: this.simulationTicks,
        heapBytes,
        heapSupported: heapBytes !== null,
      };
    }

    const total = this.frameMilliseconds.reduce((sum, value) => sum + value, 0);
    const averageFrameMilliseconds = total / this.frameMilliseconds.length;
    return {
      fps: averageFrameMilliseconds > 0 ? 1000 / averageFrameMilliseconds : null,
      averageFrameMilliseconds,
      worstFrameMilliseconds: Math.max(...this.frameMilliseconds),
      simulationMilliseconds: average(this.simulationWorkMilliseconds),
      renderMilliseconds: average(this.renderWorkMilliseconds),
      renderedFrames: this.renderedFrames,
      simulationTicks: this.simulationTicks,
      heapBytes,
      heapSupported: heapBytes !== null,
    };
  }
}
