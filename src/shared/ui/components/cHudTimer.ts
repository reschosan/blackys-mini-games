import { CHostComponent } from './base';

export type HudTimerMode = 'default' | 'alert';

const MODE_CLASSES: Readonly<Record<HudTimerMode, string>> = {
  default:
    'bg-[#0c0c10]/80 text-[clamp(1.6rem,2.4vw,2.1rem)] max-[600px]:absolute max-[600px]:right-0 max-[600px]:top-[calc(100%+0.25rem)] max-[600px]:px-1.5 max-[600px]:py-1 max-[600px]:text-base',
  alert: 'bg-cancel/90 text-[clamp(1.5rem,2.2vw,1.9rem)]',
};

/** Time box of the HUD: `<c-hud-timer>0:03.22</c-hud-timer>`; `mode="alert"` is the red finish countdown. */
export class CHudTimer extends CHostComponent {
  static override properties = { mode: { type: String } };

  declare mode: HudTimerMode;

  constructor() {
    super();
    this.mode = 'default';
  }

  protected override hostClasses(): string {
    return `block rounded-[0.7rem] px-4 py-2.5 font-bold tabular-nums shadow-[0_0.2rem_0.6rem_rgba(0,0,0,0.4)] ${MODE_CLASSES[this.mode] ?? MODE_CLASSES.default}`;
  }
}

customElements.define('c-hud-timer', CHudTimer);

declare global {
  interface HTMLElementTagNameMap {
    'c-hud-timer': CHudTimer;
  }
}
