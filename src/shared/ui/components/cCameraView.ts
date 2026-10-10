import { html, type TemplateResult } from 'lit';
import { CComponent } from './base';
import { t } from '../../i18n';

/** A live camera picture of 16:9 that keeps its place while the page around it is redrawn: `<c-camera-view mirrored></c-camera-view>`.
 *  The scanner writes the stream into `video`; `mirrored` flips the picture like a mirror, the way a front camera is expected to look. */
export class CCameraView extends CComponent {
  static override properties = { mirrored: { type: Boolean } };

  declare mirrored: boolean;
  readonly video = document.createElement('video');

  constructor() {
    super();
    this.mirrored = false;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.className = 'h-full w-full object-cover';
    this.video.setAttribute('aria-label', t().controls.camera);
  }

  protected override hostClassNames(): string {
    return 'block aspect-video w-[min(18rem,70vw)] max-h-[24dvh] overflow-hidden rounded-lg bg-black';
  }

  protected override render(): TemplateResult {
    this.video.style.transform = this.mirrored ? 'scaleX(-1)' : '';
    return html`${this.video}`;
  }
}

customElements.define('c-camera-view', CCameraView);

declare global {
  interface HTMLElementTagNameMap {
    'c-camera-view': CCameraView;
  }
}
