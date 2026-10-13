import { unlockOnGestures, type SoundEngine } from '../../../shared/audio/soundEngine';
import { audioUnavailable, gameLoopFailed, graphicsInterrupted, graphicsLost, GRAPHICS_RESTORE_WAIT_SECONDS } from '../../../shared/ui/problemTexts';
import type { ProblemView } from '../../../shared/ui/problemView';

interface BrowserGuardsDeps {
  readonly canvas: HTMLCanvasElement;
  readonly problems: ProblemView;
  readonly sound: SoundEngine;
  readonly pauseRunningRace: () => void;
}

/** What the browser does to the game from outside: losing focus, hiding the tab, losing the graphics context, the autoplay policy. */
export class BrowserGuards {
  private readonly startAudio: () => void;
  private audioTriedByGamepad = false;
  private graphicsRestoreTimer: number | null = null;

  constructor(private readonly deps: BrowserGuardsDeps) {
    window.addEventListener('blur', deps.pauseRunningRace);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) deps.pauseRunningRace();
    });
    this.startAudio = unlockOnGestures(deps.sound, () => deps.problems.showNotice(audioUnavailable()));
    this.watchGraphicsContext();
  }

  /** A gamepad press counts as a user gesture in some browsers, and the first player joining shows that someone pressed. */
  startAudioOnce(): void {
    if (this.audioTriedByGamepad) return;
    this.audioTriedByGamepad = true;
    this.startAudio();
  }

  reportLoopFailure(error: unknown): void {
    console.error('Game loop stopped after an error', error);
    this.deps.problems.showFatal(gameLoopFailed());
  }

  private watchGraphicsContext(): void {
    const { canvas, problems, pauseRunningRace } = this.deps;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      pauseRunningRace();
      problems.showFatal(graphicsInterrupted());
      this.graphicsRestoreTimer = window.setTimeout(() => problems.showFatal(graphicsLost()), GRAPHICS_RESTORE_WAIT_SECONDS * 1000);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      if (this.graphicsRestoreTimer !== null) window.clearTimeout(this.graphicsRestoreTimer);
      this.graphicsRestoreTimer = null;
      problems.clearFatal();
    });
  }
}
