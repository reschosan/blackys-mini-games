import { CHostComponent } from './base';

export type ListDirection = 'column' | 'row';

export type ListGap = 's' | 'm';

const DIRECTION_CLASSES: Readonly<Record<ListDirection, string>> = {
  column: 'flex flex-col',
  row: 'flex flex-wrap justify-center',
};

const GAP_CLASSES: Readonly<Record<ListDirection, Readonly<Record<ListGap, string>>>> = {
  column: { s: 'gap-1', m: 'gap-2' },
  row: { s: 'gap-2', m: 'gap-4' },
};

/** List of rows or cards: `<c-list direction="row" gap="m">…</c-list>`; `inset` pads it inside a
 *  card, `align="center"` centres mixed children vertically, `reserve` keeps room for one
 *  line even when empty. */
export class CList extends CHostComponent {
  static override properties = {
    direction: { type: String },
    gap: { type: String },
    inset: { type: Boolean },
    align: { type: String },
    reserve: { type: Boolean },
  };

  declare direction: ListDirection;
  declare gap: ListGap;
  declare inset: boolean;
  declare align: 'start' | 'center';
  declare reserve: boolean;

  constructor() {
    super();
    this.direction = 'column';
    this.gap = 's';
    this.inset = false;
    this.align = 'start';
    this.reserve = false;
  }

  //we do not use <ul> or <ol> - we use own style list
  protected override hostClasses(): string {
    const direction = DIRECTION_CLASSES[this.direction] ? this.direction : 'column';
    const inset = this.inset ? 'px-3 pb-3' : '';
    const align = this.align === 'center' ? 'items-center' : '';
    return `${DIRECTION_CLASSES[direction]} ${GAP_CLASSES[direction][this.gap] ?? GAP_CLASSES[direction].s} ${inset} ${align} ${this.reserve ? 'min-h-[1.6rem]' : ''}`;
  }

  protected override hostAttributes(): Readonly<Record<string, string>> {
    return { role: 'list' };
  }
}

customElements.define('c-list', CList);

declare global {
  interface HTMLElementTagNameMap {
    'c-list': CList;
  }
}
