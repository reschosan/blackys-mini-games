import { CHostComponent } from './base';

const LEVEL_CLASSES: readonly string[] = [
  'block text-[clamp(1.8rem,min(5vw,6.5dvh),3rem)] font-bold uppercase tracking-[0.08em] text-ink',
  'block text-2xl font-bold uppercase tracking-wide text-ink',
  'block text-xl font-bold text-ink',
  'block text-base font-bold text-ink',
  'block text-[0.95rem] font-bold text-soft',
  'block text-[0.95rem] font-bold text-soft',
];

/** `<c-header level="2">Titel</c-header>`; level 1 (the default) is the largest, `tone="muted"`
 *  greys it out (e.g. an empty slot). */
export class CHeader extends CHostComponent {
  static override properties = { level: { type: Number }, tone: { type: String } };

  declare level: number;
  declare tone: 'default' | 'muted';

  constructor() {
    super();
    this.level = 1;
    this.tone = 'default';
  }

  private clampedLevel(): number {
    return Math.min(Math.max(Math.round(this.level), 1), LEVEL_CLASSES.length);
  }

  protected override hostClasses(): string {
    const tone = this.tone === 'muted' ? 'text-muted!' : '';
    return `${LEVEL_CLASSES[this.clampedLevel() - 1]!} ${tone}`;
  }

  protected override hostAttributes(): Readonly<Record<string, string>> {
    return { role: 'heading', 'aria-level': String(this.clampedLevel()) };
  }
}

customElements.define('c-header', CHeader);

declare global {
  interface HTMLElementTagNameMap {
    'c-header': CHeader;
  }
}
