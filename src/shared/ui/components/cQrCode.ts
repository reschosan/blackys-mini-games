import { html, nothing, svg, type TemplateResult } from 'lit';
import QRCode from 'qrcode';
import { CComponent } from './base';

const QUIET_ZONE_MODULES = 4;

/** Black modules of the code as one SVG path, so it stays sharp at any size. */
export function qrModulePath(text: string): { readonly path: string; readonly size: number } {
  const code = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const { size, data } = code.modules;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (data[row * size + column]) path += `M${column + QUIET_ZONE_MODULES} ${row + QUIET_ZONE_MODULES}h1v1h-1z`;
    }
  }
  return { path, size: size + QUIET_ZONE_MODULES * 2 };
}

/** A QR code, always black on white with its quiet zone (cameras need it): `<c-qr-code value="…" label="…"></c-qr-code>`.
 *  It fills the width of its parent up to 22rem and stays square; `large` lets it use half the screen height instead of 40 percent. */
export class CQrCode extends CComponent {
  static override properties = { value: { type: String }, label: { type: String }, large: { type: Boolean } };

  declare value: string;
  declare label: string;
  declare large: boolean;

  constructor() {
    super();
    this.value = '';
    this.label = 'QR-Code';
    this.large = false;
  }

  protected override hostClassNames(): string {
    return 'block aspect-square w-full max-w-[min(100%,22rem)] rounded-lg bg-white';
  }

  protected override willUpdate(): void {
    this.classList.toggle('max-h-[40dvh]', !this.large);
    this.classList.toggle('max-h-[50dvh]', this.large);
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.value) return nothing;
    const { path, size } = qrModulePath(this.value);
    return html`<svg class="block size-full" viewBox=${`0 0 ${size} ${size}`} role="img" aria-label=${this.label} shape-rendering="crispEdges">
      ${svg`<path d=${path} fill="#000"></path>`}
    </svg>`;
  }
}

customElements.define('c-qr-code', CQrCode);

declare global {
  interface HTMLElementTagNameMap {
    'c-qr-code': CQrCode;
  }
}
