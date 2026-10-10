import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

/** `<c-checkbox label="Sound" ?checked=${on}></c-checkbox>`; the native `change` event bubbles up. */
export class CCheckbox extends CComponent {
  static override properties = { label: { type: String }, checked: { type: Boolean } };

  declare label: string;
  declare checked: boolean;

  constructor() {
    super();
    this.label = '';
    this.checked = false;
  }

  private readonly onChange = (event: Event): void => {
    this.checked = (event.target as HTMLInputElement).checked;
  };

  protected override render(): TemplateResult {
    return html`<label class="flex min-h-[24px] cursor-pointer items-center gap-2 font-bold text-ink pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]">
      <input type="checkbox" class="size-[1.15rem] accent-accent" .checked=${this.checked} @change=${this.onChange} />
      ${this.label}
    </label>`;
  }
}

customElements.define('c-checkbox', CCheckbox);

declare global {
  interface HTMLElementTagNameMap {
    'c-checkbox': CCheckbox;
  }
}
