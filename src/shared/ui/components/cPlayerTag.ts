import { CHostComponent } from './base';

/** Coloured label bar at the top of a player's card: `<c-player-tag color="#e0533d">Sootpaw</c-player-tag>`.
 *  `selected` marks it as the row the cursor is on: the name can then be changed with left/right. */
export class CPlayerTag extends CHostComponent {
  static override properties = { color: { type: String }, selected: { type: Boolean } };

  declare color: string;
  declare selected: boolean;

  constructor() {
    super();
    this.color = '#a5a5b5';
    this.selected = false;
  }

  private stateClasses(): string {
    if (!this.selected) return '';
    return "shadow-[inset_0_0_0_999px_rgba(255,255,255,0.26)] outline-2 -outline-offset-2 outline-white before:mr-2 before:text-[0.85em] before:content-['◀'] after:ml-2 after:text-[0.85em] after:content-['▶']";
  }

  protected override hostClasses(): string {
    this.style.background = this.color;
    return `block px-3 py-2 text-[1.05rem] font-extrabold text-surface [text-shadow:0_1px_0_rgba(255,255,255,0.25)] ${this.stateClasses()}`;
  }
}

customElements.define('c-player-tag', CPlayerTag);

declare global {
  interface HTMLElementTagNameMap {
    'c-player-tag': CPlayerTag;
  }
}
