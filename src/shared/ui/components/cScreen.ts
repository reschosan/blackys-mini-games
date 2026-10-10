import { CHostComponent } from './base';

export type ScreenTone = 'dim' | 'solid';

const TONE_CLASSES: Readonly<Record<ScreenTone, string>> = {
  dim: 'bg-surface/92',
  solid: 'bg-surface',
};

/** Full-screen overlay surface that centres its children (and scrolls when they are taller than the screen): `<c-screen tone="solid">…</c-screen>`;
 *  `enter` flies it in when it appears. */
export class CScreen extends CHostComponent {
  static override properties = { tone: { type: String }, enter: { type: Boolean } };

  declare tone: ScreenTone;
  declare enter: boolean;

  constructor() {
    super();
    this.tone = 'dim';
    this.enter = false;
  }

  protected override hostClasses(): string {
    return `pointer-events-auto absolute inset-0 flex flex-col items-center justify-center-safe gap-6 overflow-y-auto px-2 pb-[max(2.5rem,40px)] pt-2 text-center [&>*:not(c-scroll)]:shrink-0 ${TONE_CLASSES[this.tone] ?? TONE_CLASSES.dim} ${this.enter ? 'animate-fly-in' : ''}`;
  }
}

customElements.define('c-screen', CScreen);

declare global {
  interface HTMLElementTagNameMap {
    'c-screen': CScreen;
  }
}
