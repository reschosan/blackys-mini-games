import { catNameLabel } from '../../../shared/i18n/labels';
import { html, nothing, type TemplateResult } from 'lit';
import type { StatusMessage } from '../../../shared/net/messages';
import { PLAYER_APPEARANCES } from '../../../shared/config/players';
import type { JoinProblem } from './joinTexts';
import { t } from '../../../shared/i18n';

export type JoinView =
  | { readonly kind: JoinProblem }
  | { readonly kind: 'answer'; readonly answerCode: string }
  | { readonly kind: 'connected'; readonly status: StatusMessage | null };

export function answerContent(answerCode: string): TemplateResult {
  return html`
    <c-header>${t().join.almostThere}</c-header>
    <c-text tone="soft" measure="prose" aria-live="polite">${t().join.showYourCode}</c-text>
    <c-qr-code value=${answerCode} label=${t().join.yourCodeLabel} large data-join-answer></c-qr-code>
    <c-text tone="muted" size="s">${t().join.waitingForConnection}</c-text>`;
}

/** The page while connected: the own seat, what the host is doing, a problem if there is one, and the page's own buttons. */
export function connectedContent(page: {
  readonly status: StatusMessage | null;
  /** The host has the invitation open: the lobby comes once it is back. */
  readonly waitingForHost: boolean;
  readonly notice: string | null;
  readonly buttons: TemplateResult;
}): TemplateResult {
  const { status, notice } = page;
  const seat = status ? PLAYER_APPEARANCES[status.seatIndex] : undefined;
  const { join } = t();
  const label = status ? join.seatLabel(seat?.symbol ?? '', status.seatIndex + 1, catNameLabel(status.name)) : join.connected;
  const showsStatus = status !== null && !(page.waitingForHost && status.phase === 'lobby');
  return html`
    <c-chip mode="color" color=${status?.color ?? '#ffffff'} size="l" data-join-seat>${label}</c-chip>
    ${showsStatus ? statusText(status) : html`<c-text tone="soft">${join.waitingForHost}</c-text>`}
    ${notice ? html`<c-text tone="warn" measure="prose" role="alert" data-join-notice>${join.oops(notice)}</c-text>` : nothing}
    ${page.buttons}`;
}

export function problemContent(kind: JoinProblem): TemplateResult {
  return html`<c-header>Blacky's Mini Games</c-header><c-text tone="soft" measure="prose" role="alert">${problemText(kind)}</c-text>`;
}

function problemText(kind: JoinProblem): string {
  const { join, problems } = t();
  if (kind === 'noCode') return join.noCode;
  return problems.join[kind === 'failed' ? 'connectionFailed' : kind];
}

function statusText(status: StatusMessage): TemplateResult {
  if (status.phase !== 'racing') {
    return html`<c-header level="2">${t().join.phaseHeadlines[status.phase]}</c-header>
      <c-text tone="soft" measure="prose">${t().join.phaseDetails[status.phase]}</c-text>`;
  }
  if (status.gameStatus !== null) {
    return html`<c-header level="2" data-join-race>${status.gameStatus}</c-header>
      ${status.item ? html`<c-text tone="soft">${t().join.item(status.item)}</c-text>` : nothing}`;
  }
  const { join } = t();
  const headline = status.finished ? join.finished : join.placeAndLap(status.place, status.lap, status.lapCount);
  return html`<c-header level="2" data-join-race>${headline}</c-header>
    <c-text tone="soft">${status.item ? join.item(status.item) : join.noItem}</c-text>`;
}
