import { html, nothing, type TemplateResult } from 'lit';
import { CComponent, itemsChanged } from './base';

const HOST_CLASSES =
  'flex min-w-[clamp(6rem,9vw,9rem)] flex-col items-center overflow-hidden rounded-[0.7rem] bg-[#0c0c10]/80 shadow-[0_0.2rem_0.6rem_rgba(0,0,0,0.4)] max-[600px]:min-w-0 max-[600px]:flex-1';

/** Race status of one player: `<c-hud-card color="#e0533d" place="1/4" status="Runde 1/3" item="Haarball"
 *  .notes=${['→ Start/Ziel']}></c-hud-card>`. */
export class CHudCard extends CComponent {
  static override properties = {
    color: { type: String },
    place: { type: String },
    name: { type: String },
    status: { type: String },
    item: { type: String },
    notes: { attribute: false, hasChanged: itemsChanged },
    penalty: { type: String },
  };

  declare color: string;
  declare place: string;
  /** The cat's name, shown in place of the place in a game where the place says nothing until the end. */
  declare name: string;
  declare status: string;
  declare item: string;
  declare notes: readonly string[];
  declare penalty: string;

  constructor() {
    super();
    this.color = '';
    this.place = '';
    this.name = '';
    this.status = '';
    this.item = '';
    this.notes = [];
    this.penalty = '';
  }

  protected override hostClassNames(): string {
    return HOST_CLASSES;
  }

  private renderChip(text: string): TemplateResult | typeof nothing {
    return text ? html`<c-chip mode="accent" size="l" class="mt-1.5 max-[600px]:mt-1">${text}</c-chip>` : nothing;
  }

  protected override render(): TemplateResult {
    const line =
      'mt-0.5 text-[clamp(1rem,1.3vw,1.2rem)] font-semibold text-[#e6e6ee] max-[600px]:text-[0.95rem] max-[600px]:leading-[1.15] [overflow-wrap:anywhere]';
    return html`
      <div class="h-[0.45rem] w-full max-[600px]:h-1" style="background: ${this.color}"></div>
      <div class="flex flex-col items-center px-3.5 pb-3 pt-2 max-[600px]:px-0.5 max-[600px]:pb-1 max-[600px]:pt-0.5">
        ${this.place ? html`<span class="text-[clamp(1.8rem,3vw,2.6rem)] font-extrabold leading-none tracking-[0.02em] max-[600px]:text-[1.1rem]">${this.place}</span>` : nothing}
        ${!this.place && this.name ? html`<span class="max-w-full truncate text-[clamp(1.05rem,1.5vw,1.35rem)] font-extrabold leading-tight max-[600px]:text-[0.95rem]">${this.name}</span>` : nothing}
        <span class=${line}>${this.status}</span>
        ${this.renderChip(this.item)}
        ${this.notes.map((note) => html`<span class=${line}>${note}</span>`)}
        ${this.renderChip(this.penalty)}
      </div>`;
  }
}

customElements.define('c-hud-card', CHudCard);

declare global {
  interface HTMLElementTagNameMap {
    'c-hud-card': CHudCard;
  }
}
