import { html, nothing, render, type TemplateResult } from 'lit';
import { resultsTitle, scoreLegend } from '../../../shared/ui/menus/menuContent';
import type { ResultChoice } from '../../../shared/net/messages';
import type { ResultEntry } from '../../../games/kart/replication/raceSetup';
import { t } from '../../../shared/i18n';

/** The result page drawn over the picture; on a host without a player it also offers the choice what happens next. */
export class ClientResults {
  private readonly root = document.createElement('div');
  private rows: readonly ResultEntry[] | null = null;
  private decision: { readonly canDecide: boolean; readonly selected: ResultChoice } = { canDecide: false, selected: 'again' };

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'client-results';
    overlay.appendChild(this.root);
  }

  get shownRows(): readonly ResultEntry[] | null {
    return this.rows;
  }

  show(rows: readonly ResultEntry[]): void {
    this.rows = rows;
    this.draw();
  }

  /** Does this phone choose what happens next (a host without a player), and which choice is under the cross? */
  setDecision(canDecide: boolean, selected: ResultChoice): void {
    if (canDecide === this.decision.canDecide && selected === this.decision.selected) return;
    this.decision = { canDecide, selected };
    this.draw();
  }

  clear(): void {
    render(nothing, this.root);
  }

  reset(): void {
    this.rows = null;
    this.clear();
  }

  private decisionTemplate(): TemplateResult {
    const { join, menus } = t();
    if (!this.decision.canDecide) return html`<c-text tone="muted" size="s">${join.hostDecides}</c-text>`;
    const option = (id: 'again' | 'next' | 'lobby', label: string): TemplateResult =>
      html`<c-list-item><c-button grow data-result-option=${id} label=${label} ?active=${this.decision.selected === id}></c-button></c-list-item>`;
    return html`<c-list gap="m">${option('again', menus.again)} ${option('next', menus.nextGame)} ${option('lobby', menus.backToLobby)}</c-list>
      <c-text tone="muted" size="s" measure="prose">${join.youDecide}</c-text>`;
  }

  private draw(): void {
    const rows = this.rows;
    if (!rows) return;
    render(
      html`<c-screen tone="dim"><c-header>${resultsTitle(rows)}</c-header>
      <c-list gap="m">${rows.map((row) => html`<c-result-row place=${row.place} name=${row.name} color=${row.color} time=${row.time} score=${row.score}></c-result-row>`)}</c-list>
      ${scoreLegend()}
      ${this.decisionTemplate()}</c-screen>`,
      this.root,
    );
  }
}
