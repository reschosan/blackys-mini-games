import { html, nothing, type TemplateResult } from 'lit';
import { CComponent, itemsChanged } from './base';

/** One selectable setting in a card: label on the left, value (optionally with colour swatches)
 *  on the right, and ◀/▶ arrows while it is the active row.
 *  `<c-setting-row label="Fellfarbe" value="Schwarz" .swatches=${['#000']} active></c-setting-row>` */
export class CSettingRow extends CComponent {
  static override properties = {
    label: { type: String },
    value: { type: String },
    swatches: { attribute: false, hasChanged: itemsChanged },
    active: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare value: string;
  declare swatches: readonly string[];
  declare active: boolean;

  constructor() {
    super();
    this.label = '';
    this.value = '';
    this.swatches = [];
    this.active = false;
  }

  private arrow(direction: 'left' | 'right'): TemplateResult | typeof nothing {
    if (!this.active) return nothing;
    return html`<button type="button" class="min-h-[24px] min-w-[24px] cursor-pointer border-none bg-transparent px-0 text-inherit [font:inherit] hover:text-accent pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]" data-arrow=${direction}>${direction === 'left' ? '◀' : '▶'}</button>`;
  }

  protected override render(): TemplateResult {
    const tone = this.active ? 'bg-white/10 font-bold text-ink hover:bg-white/15' : 'text-soft hover:bg-white/5';
    return html`<div class="flex cursor-pointer flex-wrap items-center justify-between gap-x-1 rounded-md px-1.5 py-1 text-[0.95rem] pointer-coarse:min-h-[44px] ${tone}">
      <span>${this.label}</span>
      <span class="flex items-center gap-1 whitespace-nowrap">
        ${this.arrow('left')}
        ${this.swatches.map((color) => html`<span class="inline-block size-[0.7rem] rounded-full border border-white/40" style="background: ${color}"></span>`)}
        ${this.value}
        ${this.arrow('right')}
      </span>
    </div>`;
  }
}

customElements.define('c-setting-row', CSettingRow);

declare global {
  interface HTMLElementTagNameMap {
    'c-setting-row': CSettingRow;
  }
}
