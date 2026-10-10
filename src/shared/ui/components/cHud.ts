import { CHostComponent } from './base';

/** Container of the race HUD in the top left corner; on phone widths it spans the full width. */
export class CHud extends CHostComponent {
  protected override hostClasses(): string {
    return 'absolute left-[1.2rem] top-[1.2rem] flex items-start gap-3.5 max-[600px]:left-2 max-[600px]:right-2 max-[600px]:top-2 max-[600px]:gap-1';
  }
}

customElements.define('c-hud', CHud);

declare global {
  interface HTMLElementTagNameMap {
    'c-hud': CHud;
  }
}
