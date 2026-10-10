import { CHostComponent } from './base';

/** Boxed surface for grouped content, e.g. inside a modal: `<c-panel>…</c-panel>`. */
export class CPanel extends CHostComponent {
  protected override hostClasses(): string {
    return 'flex max-h-[calc(100dvh-1.5rem)] min-w-[220px] flex-col gap-3 overflow-y-auto rounded-xl bg-[#1c1c22] p-6';
  }
}

customElements.define('c-panel', CPanel);

declare global {
  interface HTMLElementTagNameMap {
    'c-panel': CPanel;
  }
}
