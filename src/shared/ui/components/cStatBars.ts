import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

export interface StatBarValue {
  readonly label: string;
  /** Filled share of the bar, 0 to 1. */
  readonly ratio: number;
}

/** Views build a fresh array every frame, so compare label and ratio or every frame would re-render. */
function barsChanged(next: readonly StatBarValue[] | undefined, previous: readonly StatBarValue[] | undefined): boolean {
  if (!next || !previous) return next !== previous;
  return next.length !== previous.length || next.some((bar, index) => bar.label !== previous[index]!.label || bar.ratio !== previous[index]!.ratio);
}

/** Small comparison bars in two columns, e.g. the driving values of a kart:
 *  `<c-stat-bars .bars=${[{ label: 'Speed', ratio: 0.6 }]}></c-stat-bars>` */
export class CStatBars extends CComponent {
  static override properties = { bars: { attribute: false, hasChanged: barsChanged } };

  declare bars: readonly StatBarValue[];

  constructor() {
    super();
    this.bars = [];
  }

  protected override render(): TemplateResult {
    return html`<div class="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2 text-left text-[0.95rem] text-soft">
      ${this.bars.map(
        (bar) => html`<div class="flex flex-col gap-0.5" data-stat=${bar.label}>
        <span>${bar.label}</span>
        <span class="block h-1.5 rounded-full bg-white/10">
          <span class="block h-full rounded-full bg-accent transition-[width] duration-200" style="width: ${Math.round(Math.min(Math.max(bar.ratio, 0), 1) * 100)}%"></span>
        </span>
      </div>`,
      )}
    </div>`;
  }
}

customElements.define('c-stat-bars', CStatBars);

declare global {
  interface HTMLElementTagNameMap {
    'c-stat-bars': CStatBars;
  }
}
