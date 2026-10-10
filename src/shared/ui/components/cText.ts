import { CHostComponent } from './base';

export type TextTone = 'default' | 'soft' | 'muted' | 'warn';
export type TextSize = 's' | 'm';
export type TextMeasure = 'full' | 'column' | 'prose' | 'inset';

const TONE_CLASSES: Readonly<Record<TextTone, string>> = {
  default: 'text-ink',
  soft: 'text-soft',
  muted: 'text-muted',
  warn: 'text-warn',
};

const SIZE_CLASSES: Readonly<Record<TextSize, string>> = { s: 'text-[0.95rem]', m: 'text-base' };
const MEASURE_CLASSES: Readonly<Record<TextMeasure, string>> = { full: '', column: 'max-w-[40rem]', prose: 'max-w-[40rem] px-6', inset: 'px-3' };

/** Paragraph text: `<c-text tone="muted" size="s">…</c-text>`; `relaxed` adds line spacing for
 *  multi-line explanations, `measure="prose"` limits the line length. Links inside are styled too. */
export class CText extends CHostComponent {
  static override properties = {
    tone: { type: String },
    size: { type: String },
    relaxed: { type: Boolean },
    measure: { type: String },
  };

  declare tone: TextTone;
  declare size: TextSize;
  declare relaxed: boolean;
  declare measure: TextMeasure;

  constructor() {
    super();
    this.tone = 'default';
    this.size = 'm';
    this.relaxed = false;
    this.measure = 'full';
  }

  protected override hostClasses(): string {
    const spacing = this.relaxed ? 'leading-relaxed' : '';
    return `block [&_a]:text-accent [&_a]:underline ${TONE_CLASSES[this.tone] ?? TONE_CLASSES.default} ${SIZE_CLASSES[this.size] ?? SIZE_CLASSES.m} ${spacing} ${MEASURE_CLASSES[this.measure] ?? ''}`;
  }
}

customElements.define('c-text', CText);

declare global {
  interface HTMLElementTagNameMap {
    'c-text': CText;
  }
}
