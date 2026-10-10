import { CHostComponent } from './base';

/** Warning at the bottom of the screen: `<c-alert-banner>Gamepad getrennt</c-alert-banner>`;
 *  `raised` sits above a banner that is already there. */
export class CAlertBanner extends CHostComponent {
  static override properties = { raised: { type: Boolean } };

  declare raised: boolean;

  constructor() {
    super();
    this.raised = false;
  }

  protected override hostClasses(): string {
    const bottom = this.raised ? 'bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4rem))]' : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]';
    return `fixed z-10 ${bottom} left-1/2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 text-center rounded-[0.6rem] bg-cancel/95 px-4 py-3 font-extrabold text-white shadow-[0_0.2rem_0.6rem_rgba(0,0,0,0.45)]`;
  }
}

customElements.define('c-alert-banner', CAlertBanner);

declare global {
  interface HTMLElementTagNameMap {
    'c-alert-banner': CAlertBanner;
  }
}
