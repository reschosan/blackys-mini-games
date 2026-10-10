import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';

/** Touch stick area of the phone controller. The controller script drives `#stick-knob` and
 *  `#stick-line`, grabs fingers on `#stick-zone` and measures `#stick-base`; the knob and line take
 *  the player colour from the page's `--player-color`. */
export class CStickPad extends CComponent {
  protected override hostClassNames(): string {
    return 'flex flex-1';
  }

  protected override render(): TemplateResult {
    return html`<div id="stick-zone" class="relative flex flex-1 items-center justify-center">
      <div id="stick-base" class="relative size-40 rounded-full border-[3px] border-white/40 bg-white/10">
        <div id="stick-line" class="absolute left-1/2 top-1/2 h-1.5 w-0 origin-left rounded-[3px] bg-[var(--player-color)] opacity-85"></div>
        <div id="stick-knob" class="absolute left-1/2 top-1/2 -ml-8 -mt-8 size-16 rounded-full border-[3px] border-black/30 bg-[var(--player-color)] shadow-[0_0_12px_rgba(0,0,0,0.4)]"></div>
      </div>
    </div>`;
  }
}

customElements.define('c-stick-pad', CStickPad);

declare global {
  interface HTMLElementTagNameMap {
    'c-stick-pad': CStickPad;
  }
}
