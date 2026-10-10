import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';
import { t } from '../../i18n';

export type DpadKeyState = 'on' | 'dim';

const KEY_BASE =
  'size-[max(44px,4.75rem)] cursor-pointer select-none border-none text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [@media(max-height:360px)]:size-[max(44px,4.1rem)] disabled:cursor-default disabled:opacity-40';
const ARROW = `${KEY_BASE} rounded-[0.8rem] bg-white/10 text-[1.6rem] active:bg-white/25`;
const OK = `${KEY_BASE} rounded-lg bg-success font-bold text-surface active:brightness-90`;

/** The same cross on every phone screen that is not the race: four arrows around a round OK. Keys that do nothing on the
 *  current screen stay where they are but are dimmed and disabled, so the thumb always finds the same place.
 *  `<c-dpad up="on" down="on" left="dim" right="dim" ok="on" ok-label="Back"></c-dpad>`. The buttons have the ids
 *  `pad-up`, `pad-down`, `pad-left`, `pad-right` and `pad-ok`; the controller script binds them by screen. */
export class CDpad extends CComponent {
  static override properties = {
    up: { type: String },
    down: { type: String },
    left: { type: String },
    right: { type: String },
    ok: { type: String },
    okLabel: { type: String, attribute: 'ok-label' },
  };

  declare up: DpadKeyState;
  declare down: DpadKeyState;
  declare left: DpadKeyState;
  declare right: DpadKeyState;
  declare ok: DpadKeyState;
  declare okLabel: string;

  constructor() {
    super();
    this.up = this.down = this.left = this.right = this.ok = 'on';
    this.okLabel = 'OK';
  }

  protected override hostClassNames(): string {
    return 'block';
  }

  private key(id: string, symbol: string, name: string, state: DpadKeyState, classes: string): TemplateResult {
    const dim = state === 'dim';
    return html`<button type="button" id=${id} class=${classes} aria-label=${name} ?disabled=${dim} aria-disabled=${dim ? 'true' : 'false'}>${symbol}</button>`;
  }

  protected override render(): TemplateResult {
    const { controls } = t();
    const okSize = this.okLabel.length > 3 ? 'text-[0.95rem]' : 'text-[1.2rem]';
    return html`<div role="group" aria-label=${controls.dpad} class="grid grid-cols-[repeat(3,max-content)] place-items-center gap-1">
      <span></span>${this.key('pad-up', '▲', controls.up, this.up, ARROW)}<span></span>
      ${this.key('pad-left', '◀', controls.left, this.left, ARROW)}${this.key('pad-ok', this.okLabel, this.okLabel === 'OK' ? controls.confirm : this.okLabel, this.ok, `${OK} ${okSize}`)}${this.key('pad-right', '▶', controls.right, this.right, ARROW)}
      <span></span>${this.key('pad-down', '▼', controls.down, this.down, ARROW)}<span></span>
    </div>`;
  }
}

customElements.define('c-dpad', CDpad);

declare global {
  interface HTMLElementTagNameMap {
    'c-dpad': CDpad;
  }
}
