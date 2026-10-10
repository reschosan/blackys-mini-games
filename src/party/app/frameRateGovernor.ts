import { EMERGENCY_FPS, otherQuality, type GraphicsConfig } from '../../shared/config/graphics';

const WINDOW_SECONDS = 3;
const COOL_DOWN_SECONDS = 5;
const WARM_UP_SECONDS = 2;

export type GovernorStep = 'lowered' | 'emergency';

/** Watches the frame rate during a race: when it stays under `EMERGENCY_FPS` for a few seconds the game draws less, first
 *  by switching "Hoch" to "Niedrig", and when "Niedrig" is still too slow, by a bare-bones preset (`EMERGENCY_PRESET`). A step
 *  is never taken twice within a cool-down, and the first seconds after a race starts are ignored (loading hitches). */
export class FrameRateGovernor {
  private elapsedSeconds = 0;
  private frames = 0;
  private sinceStep = COOL_DOWN_SECONDS;
  private sinceStart = 0;

  constructor(
    private readonly graphics: GraphicsConfig,
    private readonly onStep: (step: GovernorStep) => void,
  ) {}

  /** A new race (or a new map) begins: measuring starts afresh after a short warm-up. */
  restart(): void {
    this.elapsedSeconds = 0;
    this.frames = 0;
    this.sinceStart = 0;
  }

  /** Called for every drawn frame of a running race. */
  observe(frameSeconds: number): void {
    this.sinceStart += frameSeconds;
    this.sinceStep += frameSeconds;
    if (this.sinceStart < WARM_UP_SECONDS) return;
    this.elapsedSeconds += frameSeconds;
    this.frames += 1;
    if (this.elapsedSeconds < WINDOW_SECONDS) return;
    const fps = this.frames / this.elapsedSeconds;
    this.elapsedSeconds = 0;
    this.frames = 0;
    if (fps < EMERGENCY_FPS && this.sinceStep >= COOL_DOWN_SECONDS) this.stepDown();
  }

  private stepDown(): void {
    if (this.graphics.quality === 'high') {
      this.graphics.quality = otherQuality(this.graphics.quality);
      this.sinceStep = 0;
      this.onStep('lowered');
    } else if (!this.graphics.emergency) {
      this.graphics.emergency = true;
      this.sinceStep = 0;
      this.onStep('emergency');
    }
  }
}
