import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';
import { t } from '../../i18n';

export type MemoryCardState = 'hidden' | 'open' | 'matched';

const STATE_CLASSES: Readonly<Record<MemoryCardState, string>> = {
  hidden: 'border-line bg-[#2c2c3a] text-soft',
  open: 'border-ink bg-[#f2f2f2] text-[#101014]',
  matched: 'border-[#4caf6a] bg-[#1d3a28] text-ink opacity-80',
};

/** One card of the memory board: `<c-memory-card face="🐟" label="Fisch" state="open" cursor="#e0533d"></c-memory-card>`; `cursor` is the colour of the
 *  player who points at it (empty for nobody). A face down card shows a question mark and never its face. */
export class CMemoryCard extends CComponent {
  static override properties = {
    face: { type: String },
    label: { type: String },
    state: { type: String },
    cursor: { type: String },
  };

  declare face: string;
  declare label: string;
  declare state: MemoryCardState;
  declare cursor: string;

  constructor() {
    super();
    this.face = '';
    this.label = '';
    this.state = 'hidden';
    this.cursor = '';
  }

  protected override hostClassNames(): string {
    return 'block [container-type:inline-size]';
  }

  protected override render(): TemplateResult {
    const shown = this.state === 'hidden' ? '?' : this.face;
    const name = this.state === 'hidden' ? t().games.memoryHidden : this.label;
    const ring = this.cursor ? `box-shadow: 0 0 0 0.3rem ${this.cursor};` : '';
    return html`<div role="img" aria-label=${name} style=${ring}
      class="flex aspect-[3/4] items-center justify-center rounded-xl border-2 text-[min(45cqw,5rem)] font-bold transition-colors ${STATE_CLASSES[this.state] ?? STATE_CLASSES.hidden}">${shown}</div>`;
  }
}

customElements.define('c-memory-card', CMemoryCard);

declare global {
  interface HTMLElementTagNameMap {
    'c-memory-card': CMemoryCard;
  }
}
