import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { CComponent } from './base';
import { controlsDiagramHtml } from './controlsGuideMarkup';

/** Drawn gamepad overview: `<c-controls-guide></c-controls-guide>`. */
export class CControlsGuide extends CComponent {
  protected override render(): TemplateResult {
    return html`${unsafeHTML(controlsDiagramHtml())}`;
  }
}

customElements.define('c-controls-guide', CControlsGuide);

declare global {
  interface HTMLElementTagNameMap {
    'c-controls-guide': CControlsGuide;
  }
}
