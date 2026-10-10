/** Decides when the loading screen shows and which tip it displays. Pure logic (render-time driven),
 *  so it can be tested without a DOM. A wait shorter than `showDelaySeconds` never shows the screen. */
export class LoadingGate {
  private waitedSeconds = 0;
  private tipSeconds = 0;
  private tipIndex: number;

  /** `tips` is asked each time, so the tips follow a change of language. */
  constructor(
    private readonly tips: () => readonly string[],
    private readonly showDelaySeconds: number,
    private readonly tipRotationSeconds: number,
    firstTipIndex = 0,
  ) {
    this.tipIndex = tips().length === 0 ? 0 : firstTipIndex % tips().length;
  }

  get visible(): boolean {
    return this.waitedSeconds >= this.showDelaySeconds;
  }

  get tip(): string {
    return this.tips()[this.tipIndex] ?? '';
  }

  update(waiting: boolean, frameSeconds: number): void {
    if (!waiting) {
      this.waitedSeconds = 0;
      this.tipSeconds = 0;
      return;
    }
    this.waitedSeconds += frameSeconds;
    if (!this.visible) return;
    this.tipSeconds += frameSeconds;
    if (this.tipSeconds < this.tipRotationSeconds) return;
    this.tipSeconds = 0;
    this.tipIndex = (this.tipIndex + 1) % Math.max(this.tips().length, 1);
  }
}
