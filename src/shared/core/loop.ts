/** The rate the simulation runs at, whatever the frame rate. */
export const SIMULATION_HZ = 60;
const FIXED_STEP_SECONDS = 1 / SIMULATION_HZ;
const MAX_STEPS_PER_FRAME = 5;

export interface LoopCallbacks {
  readonly update: (stepSeconds: number) => void;
  /** `frameSeconds` is clamped for cosmetic updates; `elapsedFrameSeconds` preserves the real
   * browser interval for diagnostics such as runtime frame-time metrics. */
  readonly render: (alpha: number, frameSeconds: number, elapsedFrameSeconds: number) => void;
  /** Called once when `update` or `render` throws; the loop has stopped by then. */
  readonly onFailure: (error: unknown) => void;
}

export class GameLoop {
  private accumulator = 0;
  private lastTimestamp = 0;
  private frameHandle = 0;
  private running = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.frameHandle = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  private readonly onFrame = (timestamp: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);
    try {
      this.advance(timestamp);
    } catch (error) {
      this.stop();
      this.callbacks.onFailure(error);
    }
  };

  private advance(timestamp: number): void {
    const elapsedFrameSeconds = (timestamp - this.lastTimestamp) / 1000;
    const frameSeconds = Math.min(elapsedFrameSeconds, 0.25);
    this.lastTimestamp = timestamp;
    this.accumulator += frameSeconds;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.callbacks.update(FIXED_STEP_SECONDS);
      this.accumulator -= FIXED_STEP_SECONDS;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.callbacks.render(this.accumulator / FIXED_STEP_SECONDS, frameSeconds, elapsedFrameSeconds);
  }
}
