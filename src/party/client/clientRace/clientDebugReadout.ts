import { html, render } from 'lit';

const REFRESH_MILLISECONDS = 500;

export interface DebugFigures {
  readonly roundTripMilliseconds: number;
  readonly lastErrorMeters: number;
  readonly worstErrorMeters: number;
  readonly snaps: number;
}

/** `join.html?debug`: frame rate, round trip, size and number of corrections, to see on the phone what makes the picture stutter. */
export class ClientDebugReadout {
  private readonly root = document.createElement('div');
  private frames = 0;
  private since = performance.now();
  private slowestFrameMilliseconds = 0;
  private longestGapMilliseconds = 0;

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'client-debug';
    overlay.appendChild(this.root);
  }

  noteSnapshotGap(milliseconds: number): void {
    this.longestGapMilliseconds = Math.max(this.longestGapMilliseconds, milliseconds);
  }

  resetGap(): void {
    this.longestGapMilliseconds = 0;
  }

  clear(): void {
    render(html``, this.root);
  }

  frame(frameSeconds: number, figures: () => DebugFigures): void {
    this.frames += 1;
    this.slowestFrameMilliseconds = Math.max(this.slowestFrameMilliseconds, frameSeconds * 1000);
    const now = performance.now();
    if (now - this.since < REFRESH_MILLISECONDS) return;
    const { roundTripMilliseconds, lastErrorMeters, worstErrorMeters, snaps } = figures();
    const text =
      `${Math.round((this.frames * 1000) / (now - this.since))} FPS (slowest frame ${Math.round(this.slowestFrameMilliseconds)} ms) · ` +
      `longest snapshot gap ${Math.round(this.longestGapMilliseconds)} ms · round trip ${Math.round(roundTripMilliseconds)} ms · ` +
      `error ${lastErrorMeters.toFixed(2)} m (max ${worstErrorMeters.toFixed(1)}) · snaps ${snaps}`;
    this.slowestFrameMilliseconds = 0;
    this.longestGapMilliseconds = 0;
    this.frames = 0;
    this.since = now;
    render(html`<c-alert-banner raised>${text}</c-alert-banner>`, this.root);
  }
}
