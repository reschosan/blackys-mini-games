import { CHostComponent } from './base';

/** Big centred "3", "2", "1", "Los!" before the race: `<c-start-countdown>3</c-start-countdown>`. */
export class CStartCountdown extends CHostComponent {
  protected override hostClasses(): string {
    return 'pointer-events-none fixed inset-0 flex items-center justify-center text-[clamp(4rem,16vw,10rem)] font-extrabold tracking-[0.05em] text-accent [text-shadow:0_0_1.5rem_rgba(0,0,0,0.6)]';
  }
}

customElements.define('c-start-countdown', CStartCountdown);

declare global {
  interface HTMLElementTagNameMap {
    'c-start-countdown': CStartCountdown;
  }
}
