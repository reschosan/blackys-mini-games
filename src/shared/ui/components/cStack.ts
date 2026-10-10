import { CHostComponent } from './base';

export type StackDirection = 'row' | 'column';
export type StackGap = 'none' | 'xs' | 's' | 'm' | 'l' | 'xl';
export type StackAlign = 'stretch' | 'start' | 'center' | 'end';
export type StackJustify = 'start' | 'center' | 'end' | 'between';
/** Layout changes with the device orientation; several can be combined with spaces. */
type StackAdaptation = 'rowInLandscape' | 'columnInPortrait' | 'centerInPortrait' | 'tightInPortrait';

const ADAPTATION_CLASSES: Readonly<Record<StackAdaptation, string>> = {
  rowInLandscape: 'landscape:flex-row',
  columnInPortrait: 'portrait:flex-col',
  centerInPortrait: 'portrait:items-center',
  tightInPortrait: 'portrait:p-2',
};

function adaptationClasses(adapt: string): string[] {
  return adapt.split(/\s+/).map((token) => ADAPTATION_CLASSES[token as StackAdaptation] ?? '');
}

export type StackPadding = 'none' | 's' | 'sX' | 'm' | 'mX' | 'l' | 'lX' | 'bar' | 'bar-under';

const DIRECTION_CLASSES: Readonly<Record<StackDirection, string>> = { row: 'flex-row', column: 'flex-col' };
const GAP_CLASSES: Readonly<Record<StackGap, string>> = { none: 'gap-0', xs: 'gap-1', s: 'gap-2', m: 'gap-4', l: 'gap-6', xl: 'gap-10' };
const ALIGN_CLASSES: Readonly<Record<StackAlign, string>> = { stretch: 'items-stretch', start: 'items-start', center: 'items-center', end: 'items-end' };
const JUSTIFY_CLASSES: Readonly<Record<StackJustify, string>> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};
const PADDING_CLASSES: Readonly<Record<StackPadding, string>> = {
  none: 'p-0',
  s: 'p-2',
  m: 'p-4',
  l: 'p-6',
  bar: 'px-4 py-2.5',
  'bar-under': 'px-4 pb-2.5',
  sX: 'px-2',
  mX: 'px-4',
  lX: 'px-6',
};

/** Layout primitive that lines its children up: `<c-stack direction="row" gap="m" align="center">…</c-stack>`.
 *  `grow` takes the free space of its parent, `fill` the whole viewport, `narrow` a phone-width column, `wrap` lets the children flow onto the next line,
 *  `adapt` changes the layout with the orientation (`rowInLandscape`, `columnInPortrait`, `centerInPortrait`,
 *  `tightInPortrait`). `fill` follows the visible height of a phone browser (dvh), not the one behind its toolbars. */
export class CStack extends CHostComponent {
  static override properties = {
    direction: { type: String },
    gap: { type: String },
    align: { type: String },
    justify: { type: String },
    padding: { type: String },
    grow: { type: Boolean },
    fill: { type: Boolean },
    narrow: { type: Boolean },
    wrap: { type: Boolean },
    adapt: { type: String },
  };

  declare direction: StackDirection;
  declare gap: StackGap;
  declare align: StackAlign;
  declare justify: StackJustify;
  declare padding: StackPadding;
  declare grow: boolean;
  declare fill: boolean;
  declare narrow: boolean;
  declare wrap: boolean;
  declare adapt: string;

  constructor() {
    super();
    this.direction = 'column';
    this.gap = 'none';
    this.align = 'stretch';
    this.justify = 'start';
    this.padding = 'none';
    this.grow = false;
    this.fill = false;
    this.narrow = false;
    this.wrap = false;
    this.adapt = '';
  }

  protected override hostClasses(): string {
    return [
      'flex scroll-m-4',
      DIRECTION_CLASSES[this.direction] ?? DIRECTION_CLASSES.column,
      GAP_CLASSES[this.gap] ?? GAP_CLASSES.none,
      ALIGN_CLASSES[this.align] ?? ALIGN_CLASSES.stretch,
      JUSTIFY_CLASSES[this.justify] ?? JUSTIFY_CLASSES.start,
      PADDING_CLASSES[this.padding] ?? PADDING_CLASSES.none,
      this.grow ? 'flex-1' : '',
      this.fill ? 'h-dvh w-screen' : '',
      this.narrow ? 'w-[min(413px,calc(100vw-24px))]' : '',
      this.wrap ? 'flex-wrap' : '',
      ...adaptationClasses(this.adapt),
    ].join(' ');
  }
}

customElements.define('c-stack', CStack);

declare global {
  interface HTMLElementTagNameMap {
    'c-stack': CStack;
  }
}
