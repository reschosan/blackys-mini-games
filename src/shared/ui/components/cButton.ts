import { html, type PropertyValues, type TemplateResult } from 'lit';
import { CComponent } from './base';

export type ButtonMode = 'success' | 'cancel' | 'default';
export type ButtonSize = 's' | 'm' | 'l';

const BASE = 'cursor-pointer select-none items-center justify-center rounded-lg border-2 font-sans transition-colors min-h-[24px] pointer-coarse:min-h-[44px]';

const MODE_CLASSES: Readonly<Record<ButtonMode, { readonly idle: string; readonly active: string; readonly solid: string }>> = {
  default: {
    idle: 'border-line bg-transparent text-soft hover:border-ink hover:text-ink',
    active: 'border-ink bg-ink font-bold text-surface',
    solid: 'border-ink bg-ink font-bold text-surface',
  },
  success: {
    idle: 'border-success bg-transparent text-success hover:bg-success/20',
    active: 'border-success bg-success font-bold text-surface',
    solid: 'border-success bg-success font-bold text-surface',
  },
  cancel: {
    idle: 'border-cancel bg-transparent text-[#ee6a53] hover:bg-cancel/20',
    active: 'border-cancel bg-cancel font-bold text-surface',
    solid: 'border-cancel bg-cancel font-bold text-surface',
  },
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, { readonly regular: string; readonly compact: string }>> = {
  s: { regular: 'px-4 py-1.5 text-[0.95rem]', compact: 'px-3 py-0.5 text-[0.95rem]' },
  m: { regular: 'px-6 py-2.5 text-base', compact: 'px-4 py-1 text-[0.95rem]' },
  l: { regular: 'px-6 py-4 text-lg', compact: 'px-5 py-2 text-base' },
};

/** `<c-button label="Back" mode="cancel" size="l" compact></c-button>`; `active` marks the
 *  option currently selected with keyboard, gamepad or phone. */
export class CButton extends CComponent {
  static override properties = {
    label: { type: String },
    mode: { type: String },
    size: { type: String },
    compact: { type: Boolean },
    block: { type: Boolean },
    grow: { type: Boolean },
    solid: { type: Boolean },
    active: { type: Boolean },
    disabled: { type: Boolean },
  };

  declare label: string;
  declare mode: ButtonMode;
  declare size: ButtonSize;
  declare compact: boolean;
  declare block: boolean;
  declare grow: boolean;
  declare solid: boolean;
  declare active: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.label = '';
    this.mode = 'default';
    this.size = 'm';
    this.compact = false;
    this.block = false;
    this.grow = false;
    this.solid = false;
    this.active = false;
    this.disabled = false;
  }

  protected override hostClassNames(): string {
    return this.grow ? 'min-w-0 flex-1' : '';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('disabled')) return;
    this.classList.toggle('pointer-events-none', this.disabled);
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  /** `block` fills the row, `grow` fills the space its host gets, otherwise the button is as wide as its text. */
  private widthClasses(): string {
    if (this.block) return 'flex w-full';
    return this.grow ? 'flex h-full w-full' : 'inline-flex';
  }

  protected override render(): TemplateResult {
    const mode = MODE_CLASSES[this.mode] ?? MODE_CLASSES.default;
    const size = SIZE_CLASSES[this.size] ?? SIZE_CLASSES.m;
    const classes = [this.widthClasses(), BASE, this.active || this.solid ? mode.active : mode.idle, this.compact ? size.compact : size.regular];
    if (this.disabled) classes.push('opacity-40');
    return html`<button type="button" class=${classes.join(' ')} ?disabled=${this.disabled}>${this.label}</button>`;
  }
}

customElements.define('c-button', CButton);

declare global {
  interface HTMLElementTagNameMap {
    'c-button': CButton;
  }
}
