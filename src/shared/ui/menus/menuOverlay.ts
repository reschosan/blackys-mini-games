import { html, nothing, render, type TemplateResult } from 'lit';
import { t } from '../../i18n';
import type { ScreenTone } from '../components/cScreen';

export interface MenuOption {
  readonly id: string;
  readonly label: string;
  readonly checked?: boolean;
}

export class MenuOverlay {
  private readonly root = document.createElement('c-screen');
  private options: readonly MenuOption[] = [];
  private selectedIndex = 0;
  private title = '';
  private body: TemplateResult | typeof nothing = nothing;
  private tone: ScreenTone = 'dim';
  private hint: TemplateResult = t().menus.defaultHint;

  constructor(
    overlay: HTMLElement,
    private readonly onOptionSelect: (id: string) => void,
  ) {
    this.root.dataset.testid = 'menu';
    this.root.hidden = true;
    overlay.appendChild(this.root);
    this.root.addEventListener('pointerup', this.onPointerUp);
  }

  open(
    title: string,
    body: TemplateResult | typeof nothing,
    options: readonly MenuOption[],
    tone: ScreenTone = 'dim',
    hint: TemplateResult = t().menus.defaultHint,
  ): void {
    this.title = title;
    this.hint = hint;
    this.body = body;
    this.tone = tone;
    this.options = options;
    this.selectedIndex = 0;
    this.root.hidden = false;
    this.render();
  }

  /** New content for the page that is open, e.g. a fresh QR code; the selected option stays selected. */
  refresh(body: TemplateResult | typeof nothing, options: readonly MenuOption[]): void {
    const selected = this.selectedOptionId;
    this.body = body;
    this.options = options;
    this.selectedIndex = Math.max(
      options.findIndex((option) => option.id === selected),
      0,
    );
    this.render();
    this.keepSelectionInView();
  }

  close(): void {
    this.root.hidden = true;
  }

  selectOption(id: string): void {
    const index = this.options.findIndex((option) => option.id === id);
    if (index < 0) return;
    this.selectedIndex = index;
    this.render();
  }

  moveSelection(direction: number): void {
    if (direction === 0 || this.options.length === 0) return;
    const count = this.options.length;
    this.selectedIndex = (this.selectedIndex + direction + count) % count;
    this.render();
    this.keepSelectionInView();
  }

  /** A page taller than the screen scrolls, so the option the cursor moved to is brought into view. */
  private keepSelectionInView(): void {
    this.root.querySelectorAll<HTMLElement>('[data-option-id]')[this.selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
  }

  scrollContent(pixels: number): void {
    if (pixels === 0) return;
    this.root.querySelector('c-scroll')?.scrollBy({ top: pixels });
  }

  get selectedOptionId(): string | null {
    return this.options[this.selectedIndex]?.id ?? null;
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const option = target.closest<HTMLElement>('[data-option-id]');
    if (option?.dataset.optionId) this.onOptionSelect(option.dataset.optionId);
  };

  private render(): void {
    const options = this.options.map(
      (option, index) => html`
      <c-list-item>
        <c-button
          grow
          data-option-id=${option.id}
          label=${option.checked === undefined ? option.label : `${option.checked ? '☑' : '☐'} ${option.label}`}
          ?active=${index === this.selectedIndex}
        ></c-button>
      </c-list-item>`,
    );
    this.root.tone = this.tone;
    render(
      html`
      <c-header>${this.title}</c-header>
      ${this.body}
      <c-list gap="m">${options}</c-list>
      <c-text tone="muted" size="s">${this.hint}</c-text>`,
      this.root,
    );
  }
}
