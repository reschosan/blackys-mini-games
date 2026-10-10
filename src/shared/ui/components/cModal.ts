import { CHostComponent } from './base';

/** Dimmed full-viewport layer that centres its content above the page: `<c-modal><c-panel>…</c-panel></c-modal>`. */
export class CModal extends CHostComponent {
  protected override hostClasses(): string {
    return 'fixed inset-0 z-10 flex items-center justify-center bg-black/60';
  }
}

customElements.define('c-modal', CModal);

declare global {
  interface HTMLElementTagNameMap {
    'c-modal': CModal;
  }
}
