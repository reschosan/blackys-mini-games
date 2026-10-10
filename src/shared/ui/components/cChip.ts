import { CHostComponent } from './base';

export type ChipMode = 'default' | 'success' | 'cancel' | 'accent' | 'color';
export type ChipSize = 'm' | 'l';

const MODE_CLASSES: Readonly<Record<ChipMode, string>> = {
  default: 'bg-white/10 text-soft',
  success: 'bg-success/25 text-[#a3e0a0]',
  cancel: 'bg-cancel/25 text-[#f0a396]',
  accent: 'bg-accent/30 text-[#ffd94d]',
  color: 'text-surface [text-shadow:0_1px_0_rgba(255,255,255,0.25)]',
};

/** Small status label: `<c-chip mode="success">Ready</c-chip>`. `mode="color"` paints it in
 *  `color` (a player colour); `dim` fades it, `outlined` adds a ring (e.g. a locked-in vote). */
export class CChip extends CHostComponent {
  static override properties = {
    mode: { type: String },
    color: { type: String },
    dim: { type: Boolean },
    outlined: { type: Boolean },
    size: { type: String },
  };

  declare mode: ChipMode;
  declare color: string;
  declare dim: boolean;
  declare outlined: boolean;
  declare size: ChipSize;

  constructor() {
    super();
    this.mode = 'default';
    this.color = '';
    this.dim = false;
    this.outlined = false;
    this.size = 'm';
  }

  protected override hostClasses(): string {
    this.style.background = this.mode === 'color' ? this.color : '';
    const fade = this.dim ? 'opacity-55' : '';
    const ring = this.outlined ? 'ring-2 ring-white/60' : '';
    const size =
      this.size === 'l'
        ? 'px-2.5 py-0.5 text-[clamp(0.95rem,1.1vw,1.05rem)] max-[600px]:px-1 max-[600px]:py-0.5 max-[600px]:text-[0.95rem]'
        : 'px-2.5 py-0.5 text-[0.95rem]';
    return `inline-block rounded-md ${size} font-bold ${MODE_CLASSES[this.mode] ?? MODE_CLASSES.default} ${fade} ${ring}`;
  }
}

customElements.define('c-chip', CChip);

declare global {
  interface HTMLElementTagNameMap {
    'c-chip': CChip;
  }
}
