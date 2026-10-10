import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

export type TouchKind = 'arrow' | 'action' | 'system' | 'ok';
export type TouchMode = 'default' | 'success' | 'cancel' | 'info' | 'warn';
export type TouchSize = 'm' | 'l';

const ACTION_MODE_CLASSES: Readonly<Record<TouchMode, string>> = {
  default: 'bg-ink text-surface active:bg-[#cfcfcf]',
  success: 'bg-success text-surface active:brightness-90',
  cancel: 'bg-cancel text-surface active:brightness-90',
  info: 'bg-info text-surface active:brightness-90',
  warn: 'bg-warn text-surface active:brightness-90',
};

const ACTION_SIZE_CLASSES: Readonly<Record<TouchSize, string>> = {
  m: 'size-24 text-[1.1rem] [@media(max-height:340px)]:size-[max(44px,4.4rem)]',
  l: 'size-30 text-[1.3rem] [@media(max-height:340px)]:size-[max(44px,4.4rem)]',
};

/** Big touch button of the phone controller: `<c-touch-button kind="action" mode="warn" size="l"
 *  label="Drift"></c-touch-button>`. `kind` is the shape: arrow keys, round action buttons or the
 *  small round system buttons, `ok` the round confirm button in the middle of the arrows. `aria` sets the accessible name for icon-only labels. */
export class CTouchButton extends CComponent {
  static override properties = {
    label: { type: String },
    kind: { type: String },
    mode: { type: String },
    size: { type: String },
    aria: { type: String },
  };

  declare label: string;
  declare kind: TouchKind;
  declare mode: TouchMode;
  declare size: TouchSize;
  declare aria: string;

  constructor() {
    super();
    this.label = '';
    this.kind = 'action';
    this.mode = 'default';
    this.size = 'm';
    this.aria = '';
  }

  private classes(): string {
    if (this.kind === 'ok')
      return 'size-[4.75rem] rounded-lg bg-success text-[1.2rem] font-bold text-surface active:brightness-90 [@media(max-height:360px)]:size-[4.1rem]';
    if (this.kind === 'arrow')
      return 'size-[4.75rem] rounded-[0.8rem] bg-white/10 text-[1.6rem] text-ink active:bg-white/25 [@media(max-height:360px)]:size-[4.1rem]';
    if (this.kind === 'system')
      return 'h-[max(44px,2.75rem)] min-w-[max(44px,2.75rem)] rounded-full border border-white/20 bg-white/10 px-3 text-[1rem] text-ink/70 active:bg-white/20';
    return `rounded-full font-bold ${ACTION_SIZE_CLASSES[this.size] ?? ACTION_SIZE_CLASSES.m} ${ACTION_MODE_CLASSES[this.mode] ?? ACTION_MODE_CLASSES.default}`;
  }

  protected override render(): TemplateResult {
    return html`<button type="button" class="cursor-pointer border-none ${this.classes()}" aria-label=${this.aria || this.label}>${this.label}</button>`;
  }
}

customElements.define('c-touch-button', CTouchButton);

declare global {
  interface HTMLElementTagNameMap {
    'c-touch-button': CTouchButton;
  }
}
