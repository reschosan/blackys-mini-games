import { LitElement, ReactiveElement } from 'lit';

/** Base of all `c-…` components. Renders into the element itself (no shadow DOM) so that the
 *  Tailwind utility classes of the page apply to the component's markup. */
/** `hasChanged` for list properties: views build a fresh array every frame, so compare the items
 *  or every frame would re-render the component. */
export function itemsChanged(next: readonly unknown[] | undefined, previous: readonly unknown[] | undefined): boolean {
  if (!next || !previous) return next !== previous;
  return next.length !== previous.length || next.some((item, index) => item !== previous[index]);
}

export abstract class CComponent extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Tailwind classes for the host element itself (layout inside a parent); template components
   *  style their own markup, this is only for how they sit in their surroundings. */
  protected hostClassNames(): string {
    return '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const classNames = this.hostClassNames().split(/\s+/).filter(Boolean);
    if (classNames.length > 0) this.classList.add(...classNames);
  }
}

/** A component that only styles itself and keeps whatever children the view puts inside, e.g.
 *  `<c-header level="2">Titel</c-header>`. Subclasses return the Tailwind classes for the host.
 *  Has no template of its own, so views can render freely into it. */
export abstract class CHostComponent extends ReactiveElement {
  private appliedClasses: string[] = [];

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected abstract hostClasses(): string;

  /** Extra attributes for the host, e.g. ARIA roles. */
  protected hostAttributes(): Readonly<Record<string, string>> {
    return {};
  }

  protected override willUpdate(): void {
    this.classList.remove(...this.appliedClasses);
    this.appliedClasses = this.hostClasses().split(/\s+/).filter(Boolean);
    this.classList.add(...this.appliedClasses);
    for (const [name, value] of Object.entries(this.hostAttributes())) this.setAttribute(name, value);
  }
}
