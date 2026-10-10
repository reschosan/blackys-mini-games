import { CHostComponent } from './base';

/** One row of a `<c-list>`; children are laid out left to right, the last one pushed right.
 *  `active` marks the keyboard/gamepad selection, `interactive` makes it clickable. */
export class CListItem extends CHostComponent {
  static override properties = {
    active: { type: Boolean },
    interactive: { type: Boolean },
    boxed: { type: Boolean },
  };

  declare active: boolean;
  declare interactive: boolean;
  declare boxed: boolean;

  constructor() {
    super();
    this.active = false;
    this.interactive = false;
    this.boxed = false;
  }

  protected override hostClasses(): string {
    const layout = this.boxed ? 'rounded-lg bg-[#202028]/90 px-3 py-2 text-lg' : 'rounded-md px-2 py-1 text-[0.95rem]';
    const tone = this.active ? 'bg-white/10 font-bold text-ink' : 'text-soft';
    const hover = this.interactive ? 'cursor-pointer hover:bg-white/15' : '';
    return `flex items-center justify-between gap-2 ${layout} ${tone} ${hover}`;
  }

  protected override hostAttributes(): Readonly<Record<string, string>> {
    return { role: 'listitem' };
  }
}

customElements.define('c-list-item', CListItem);

declare global {
  interface HTMLElementTagNameMap {
    'c-list-item': CListItem;
  }
}
