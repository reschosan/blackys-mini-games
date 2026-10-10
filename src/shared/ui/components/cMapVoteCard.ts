import { CHostComponent } from './base';

/** Card of the map vote: `<c-map-vote-card active><c-preview-frame …/><c-header level="3">Name</c-header>
 *  <c-list …>markers</c-list></c-map-vote-card>`. `active` while a player points at it. */
export class CMapVoteCard extends CHostComponent {
  static override properties = {
    active: { type: Boolean, reflect: true },
  };

  declare active: boolean;

  constructor() {
    super();
    this.active = false;
  }

  protected override hostClasses(): string {
    const border = this.active ? 'border-ink' : 'border-line';
    return `flex scroll-m-4 w-72 max-w-[calc(50%-0.5rem)] cursor-pointer flex-col gap-2.5 rounded-[0.7rem] border-2 ${border} bg-[#202028]/90 p-3`;
  }
}

customElements.define('c-map-vote-card', CMapVoteCard);

declare global {
  interface HTMLElementTagNameMap {
    'c-map-vote-card': CMapVoteCard;
  }
}
