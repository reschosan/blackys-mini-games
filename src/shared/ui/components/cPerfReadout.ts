import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

export type PerfTone = 'smooth' | 'slow';

const TONE_CLASSES: Readonly<Record<PerfTone, string>> = {
  smooth: 'text-ink',
  slow: 'text-warn',
};

/** Frame rate in the bottom left corner, always on top: `<c-perf-readout headline="24 FPS" tone="slow"></c-perf-readout>`.
 *  `tone="slow"` marks a frame rate below the target; the numbers carry the meaning, the colour only underlines it. */
export class CPerfReadout extends CComponent {
  static override properties = { headline: { type: String }, tone: { type: String } };

  declare headline: string;
  declare tone: PerfTone;

  constructor() {
    super();
    this.headline = '';
    this.tone = 'smooth';
  }

  protected override hostClassNames(): string {
    return 'pointer-events-none absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-30 max-w-[calc(100vw-1rem)] rounded-md bg-black/70 px-2 py-1 font-mono text-[0.95rem] tabular-nums';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'off');
  }

  protected override render(): TemplateResult {
    return html`<span class=${TONE_CLASSES[this.tone] ?? TONE_CLASSES.smooth}><b>${this.headline}</b></span>`;
  }
}

customElements.define('c-perf-readout', CPerfReadout);

declare global {
  interface HTMLElementTagNameMap {
    'c-perf-readout': CPerfReadout;
  }
}
