import { html, svg, type TemplateResult } from 'lit';
import { CComponent } from './base';
import { t } from '../../i18n';

const WHEEL_CENTRES = [
  { x: 64, y: 94 },
  { x: 128, y: 94 },
] as const;
const SPEED_LINES = [
  { y: 66, delay: '0s' },
  { y: 78, delay: '0.25s' },
  { y: 90, delay: '0.5s' },
] as const;
const MOTION = 'motion-reduce:animate-none';

function wheel(centre: { x: number; y: number }): TemplateResult {
  return svg`<g transform="translate(${centre.x} ${centre.y})">
    <g class="animate-loading-wheel ${MOTION} origin-center [transform-box:fill-box]">
      <circle r="12" class="fill-line" />
      <circle r="5.5" class="fill-soft" />
      <rect x="-1.5" y="-10" width="3" height="20" rx="1.5" class="fill-surface" />
    </g>
  </g>`;
}

function cat(): TemplateResult {
  return svg`<g class="animate-loading-tail ${MOTION} origin-[60px_62px] [transform-box:view-box]">
      <path d="M62 62 C44 62 40 44 52 38" fill="none" stroke-width="6" stroke-linecap="round" class="stroke-ink" />
    </g>
    <circle cx="100" cy="46" r="19" class="fill-ink" />
    <path d="M84 36 L87 18 L99 30 Z M116 36 L113 18 L101 30 Z" class="fill-ink" />
    <path d="M87.5 25 L89 24 L95 30 Z M112.5 25 L111 24 L105 30 Z" class="fill-cancel/60" />
    <circle cx="93" cy="45" r="2.6" class="fill-surface" />
    <circle cx="107" cy="45" r="2.6" class="fill-surface" />
    <path d="M98 52 L102 52 L100 55 Z" class="fill-cancel" />
    <path d="M70 52 L88 54 M70 58 L88 57 M130 52 L112 54 M130 58 L112 57" stroke-width="1.2" stroke-linecap="round" class="stroke-soft" />`;
}

/** Full-screen loading screen with a cat kart driving on the spot: `<c-loading-screen
 *  label="Loading nature trail" tip="…"></c-loading-screen>`. `leaving` fades it out. */
export class CLoadingScreen extends CComponent {
  static override properties = { label: { type: String }, tip: { type: String }, leaving: { type: Boolean, reflect: true }, contained: { type: Boolean } };

  declare label: string;
  declare tip: string;
  declare leaving: boolean;
  declare contained: boolean;

  constructor() {
    super();
    this.label = t().controls.loading;
    this.tip = '';
    this.leaving = false;
    this.contained = false;
  }

  protected override hostClassNames(): string {
    const placement = this.contained ? 'relative h-96 w-full overflow-hidden rounded-md' : 'fixed inset-0 z-50';
    return `pointer-events-auto ${placement} flex flex-col items-center justify-center gap-7 bg-[radial-gradient(ellipse_at_center,#1e1e29_0%,#101014_72%)] px-6 text-center`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');
  }

  protected override updated(): void {
    this.classList.toggle('animate-loading-in', !this.leaving);
    this.classList.toggle('animate-loading-out', this.leaving);
    this.classList.toggle('pointer-events-none', this.leaving);
  }

  protected override render(): TemplateResult {
    return html`
      <svg viewBox="0 0 200 124" class="w-[min(30rem,82vw)] drop-shadow-[0_1.2rem_1.4rem_rgba(0,0,0,0.45)]" aria-hidden="true">
        <line x1="0" y1="112" x2="200" y2="112" stroke-width="3" stroke-dasharray="14 14" class="animate-loading-road ${MOTION} stroke-line" />
        ${SPEED_LINES.map(
          (line) => svg`<line x1="46" y1="${line.y}" x2="34" y2="${line.y}" stroke-width="2.5" stroke-linecap="round"
          style="animation-delay:${line.delay}" class="animate-loading-speed ${MOTION} stroke-soft" />`,
        )}
        <g class="animate-loading-bob ${MOTION}">
          ${cat()}
          <rect x="46" y="64" width="102" height="30" rx="12" class="fill-accent" />
          <rect x="52" y="73" width="90" height="5" rx="2.5" class="fill-surface/35" />
          <rect x="140" y="70" width="12" height="9" rx="3" class="fill-ink" />
          ${WHEEL_CENTRES.map(wheel)}
        </g>
      </svg>
      <div class="flex flex-col items-center gap-3">
        <div class="text-3xl font-extrabold tracking-wide text-ink">${this.label}</div>
        <div class="h-2 w-64 overflow-hidden rounded-full bg-line">
          <div class="animate-loading-bar ${MOTION} h-full w-2/5 rounded-full bg-accent"></div>
        </div>
      </div>
      <div class="min-h-[3rem] max-w-[30rem] text-base leading-snug text-soft">${this.tip}</div>
    `;
  }
}

customElements.define('c-loading-screen', CLoadingScreen);

declare global {
  interface HTMLElementTagNameMap {
    'c-loading-screen': CLoadingScreen;
  }
}
