import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

/** One line of the result table: place, cat name in its player colour, finish time and the points (this game and the total). */
export class CResultRow extends CComponent {
  static override properties = {
    place: { type: Number },
    name: { type: String },
    color: { type: String },
    time: { type: String },
    score: { type: String },
  };

  declare place: number;
  declare name: string;
  declare color: string;
  declare time: string;
  declare score: string;

  constructor() {
    super();
    this.place = 1;
    this.name = '';
    this.color = '';
    this.time = '—';
    this.score = '';
  }

  protected override render(): TemplateResult {
    return html`<div class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_5rem] items-center gap-x-4 gap-y-2 rounded-lg bg-[#202028]/90 px-3 py-1.5 text-lg">
      <span class="font-bold">${this.place}.</span>
      <span class="flex items-center gap-2 text-left font-bold"><span class="inline-block size-3 shrink-0 rounded-full" style="background: ${this.color}" aria-hidden="true"></span>${this.name}</span>
      <span class="whitespace-nowrap text-right tabular-nums text-soft">${this.time}</span>
      <span class="text-right tabular-nums font-bold">${this.score}</span>
    </div>`;
  }
}

customElements.define('c-result-row', CResultRow);

declare global {
  interface HTMLElementTagNameMap {
    'c-result-row': CResultRow;
  }
}
