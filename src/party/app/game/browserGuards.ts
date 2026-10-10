import type { SoundEngine } from '../../../shared/audio/soundEngine';
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
  private audioStarted = false;
  private graphicsRestoreTimer: number | null = null;

  constructor(private readonly deps: BrowserGuardsDeps) {
    window.addEventListener('blur', deps.pauseRunningRace);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) deps.pauseRunningRace();
    });
    window.addEventListener('pointerdown', this.startAudioOnce);
    this.watchGraphicsContext();
  }

  /** Browser autoplay policy: the AudioContext may only start after a user gesture. A touch or click is one;
   *  a gamepad press is one too, and the first player joining shows that someone pressed. */
  readonly startAudioOnce = (): void => {
    if (this.audioStarted) return;
    this.audioStarted = true;
    window.removeEventListener('pointerdown', this.startAudioOnce);
    this.unlockSound();
  };

  reportLoopFailure(error: unknown): void {
    console.error('Game loop stopped after an error', error);
    this.deps.problems.showFatal(gameLoopFailed());
  }

  private unlockSound(): void {
    try {
      this.deps.sound.unlock();
    } catch (error) {
      console.error('Audio could not be started', error);
      this.deps.problems.showNotice(audioUnavailable());
    }
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
