import { CHostComponent } from './base';

export type CatCardVariant = 'player' | 'empty' | 'ai';

const VARIANT_CLASSES: Readonly<Record<CatCardVariant, string>> = {
  player: 'gap-2 border-line text-left',
  empty: 'cursor-pointer items-center self-start gap-2 border-line p-5 text-center',
  ai: 'items-center self-start gap-2 border-[#5a4a7a] p-5 text-center',
};

/** Card of one lobby slot with the cat view: `<c-cat-preview-card variant="player" color="#e0533d">
 *  <c-player-tag>…</c-player-tag> <c-preview-frame>…</c-preview-frame> …</c-cat-preview-card>`.
 *  `color` sets the border of a player card. */
export class CCatPreviewCard extends CHostComponent {
  static override properties = { variant: { type: String }, color: { type: String } };

  declare variant: CatCardVariant;
  declare color: string;

  constructor() {
    super();
    this.variant = 'player';
    this.color = '';
  }

  protected override hostClasses(): string {
    this.style.borderColor = this.variant === 'player' ? this.color : '';
    return `flex w-[max(15rem,168px)] flex-col pointer-coarse:w-[max(17rem,236px)] overflow-hidden rounded-[0.6rem] border-2 bg-[#202028]/90 ${VARIANT_CLASSES[this.variant] ?? VARIANT_CLASSES.player}`;
  }
}

customElements.define('c-cat-preview-card', CCatPreviewCard);

declare global {
  interface HTMLElementTagNameMap {
    'c-cat-preview-card': CCatPreviewCard;
  }
}
