import { html, nothing, render, type TemplateResult } from 'lit';
import { createRuntimeKartStats } from '../../shared/config/kartLoadout';
import { PLAYER_APPEARANCES } from '../../shared/config/players';
import { CatPreview } from '../../games/kart/kart/views/catPreview';
import { AVAILABLE_MAPS } from '../../games/kart/maps/registry';
import type { GuestLobbyState, LobbyTap, VotePickState } from '../../games/kart/replication/lobbyState';
import { previewSubjectOf } from '../lobby/catCustomization';
import { renderPlayerCard } from '../lobby/lobby';
import { rulesTemplate } from '../lobby/mapVoteView';
import { GAMES } from '../games';
import { placeName, t } from '../../shared/i18n';

const ACTIVE_ROW = 'c-setting-row[active], c-button[active]';

/** A guest's own lobby screen: its cat card to change and ready up, and the map vote, drawn from the state the host sends. The rules stay
 *  on the host (rows, names, votes); this screen shows them and passes taps and the cross on. */
export class LobbyScreen {
  private readonly root = document.createElement('c-screen');
  private readonly kartStats = createRuntimeKartStats();
  private preview: CatPreview | null = null;
  private frame = 0;
  private lastFrameAt = 0;
  private visible = false;

  constructor(
    parent: HTMLElement,
    private readonly sendTap: (tap: LobbyTap) => void,
  ) {
    this.root.dataset.testid = 'guest-lobby';
    this.root.tone = 'solid';
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('pointerup', this.onPointerUp);
  }

  show(state: GuestLobbyState, footer: TemplateResult): void {
    this.root.hidden = false;
    this.root.dataset.stage = state.stage;
    render(this.templateFor(state, footer), this.root);
    if (state.stage === 'customizing' && state.entry) this.showPreview(state);
    else this.removePreview();
    this.root.querySelector(ACTIVE_ROW)?.scrollIntoView?.({ block: 'nearest' });
    if (!this.visible) {
      this.visible = true;
      this.lastFrameAt = performance.now();
      this.frame = requestAnimationFrame(this.animate);
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.visible = false;
    cancelAnimationFrame(this.frame);
    this.removePreview();
    render(nothing, this.root);
  }

  private templateFor(state: GuestLobbyState, footer: TemplateResult): TemplateResult {
    if (state.stage === 'gameVote') return this.gameVoteTemplate(state, footer);
    return state.stage === 'trackVote' ? this.voteTemplate(state, footer) : this.cardTemplate(state, footer);
  }

  private cardTemplate(state: GuestLobbyState, footer: TemplateResult): TemplateResult {
    return html`
      <c-header>${t().lobby.guestPageTitles[state.entry?.page ?? 'start']}</c-header>
      ${renderPlayerCard(state.seat, t().lobby.thisPhone, state.entry ?? undefined, this.kartStats)}
      <c-text tone="muted" size="s" measure="prose">${t().lobby.guestPageHints[state.entry?.page ?? 'start']}</c-text>
      ${footer}`;
  }

  private gameVoteTemplate(state: GuestLobbyState, footer: TemplateResult): TemplateResult {
    const markers = (index: number): TemplateResult[] => state.picks.filter((pick) => pick.mapIndex === index).map((pick) => this.marker(pick));
    return html`
      <c-header>${t().lobby.chooseGame}</c-header>
      <c-list direction="row" gap="m">${GAMES.map(
        (game, index) => html`
        <c-map-vote-card data-game-index=${index} ?active=${markers(index).length > 0}>
          <c-header level="3">${game.title}</c-header>
          <c-text tone="soft" size="s" measure="prose">${game.summary}</c-text>
          <c-list direction="row" gap="s" reserve>${markers(index)}</c-list>
        </c-map-vote-card>`,
      )}
      </c-list>
      <c-stack align="center" gap="s">
        <c-button data-back-button label=${t().lobby.back} mode="cancel" ?active=${markers(GAMES.length).length > 0}></c-button>
        <c-list direction="row" gap="s" reserve>${markers(GAMES.length)}</c-list>
      </c-stack>
      <c-text tone="muted" size="s" measure="prose">${t().lobby.guestGameVoteHint}</c-text>
      ${footer}`;
  }

  private voteTemplate(state: GuestLobbyState, footer: TemplateResult): TemplateResult {
    const backIndex = AVAILABLE_MAPS.length;
    const markers = (mapIndex: number): TemplateResult[] => state.picks.filter((pick) => pick.mapIndex === mapIndex).map((pick) => this.marker(pick));
    return html`
      <c-header>${t().lobby.chooseMap}</c-header>
      ${rulesTemplate(GAMES[state.game] ?? GAMES[0]!)}
      <c-list direction="row" gap="m">${AVAILABLE_MAPS.map(
        (map, index) => html`
        <c-map-vote-card data-map-index=${index} ?active=${markers(index).length > 0}>
          <c-header level="3">${placeName(map.name)}</c-header>
          <c-list direction="row" gap="s" reserve>${markers(index)}</c-list>
        </c-map-vote-card>`,
      )}
      </c-list>
      <c-stack align="center" gap="s">
        <c-button data-back-button label=${t().lobby.back} mode="cancel" ?active=${markers(backIndex).length > 0}></c-button>
        <c-list direction="row" gap="s" reserve>${markers(backIndex)}</c-list>
      </c-stack>
      <c-text tone="muted" size="s" measure="prose">${t().lobby.guestMapVoteHint}</c-text>
      ${footer}`;
  }

  private marker(pick: VotePickState): TemplateResult {
    const label = `${PLAYER_APPEARANCES[pick.slot]?.symbol ?? ''} ${pick.name}${pick.confirmed ? ' ✓' : ''}`;
    return html`<c-chip mode="color" color=${pick.color} ?dim=${!pick.confirmed} ?outlined=${pick.confirmed}>${label}</c-chip>`;
  }

  private showPreview(state: GuestLobbyState): void {
    const entry = state.entry!;
    const color = PLAYER_APPEARANCES[state.seat]?.bodyColor ?? 0xffffff;
    if (!this.preview) {
      this.preview = new CatPreview(entry.appearance, entry.loadout, color);
      this.preview.setAngle('front');
    } else {
      this.preview.setAppearance(entry.appearance);
      this.preview.setLoadout(entry.loadout);
    }
    this.preview.show(previewSubjectOf(entry));
    this.root.querySelector('[data-preview-index]')?.appendChild(this.preview.canvasElement);
  }

  private removePreview(): void {
    this.preview?.dispose();
    this.preview = null;
  }

  private readonly animate = (now: number): void => {
    if (!this.visible) return;
    this.frame = requestAnimationFrame(this.animate);
    this.preview?.render(Math.min((now - this.lastFrameAt) / 1000, 0.1));
    this.lastFrameAt = now;
  };

  /** Arrows first (they sit inside a row), then the buttons, then the row itself, like the host's lobby. */
  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!(event.target instanceof HTMLElement)) return;
    const { target } = event;
    const arrow = target.closest<HTMLElement>('[data-arrow]');
    const row = target.closest<HTMLElement>('[data-row-index]');
    const map = target.closest<HTMLElement>('[data-map-index]');
    const game = target.closest<HTMLElement>('[data-game-index]');
    if (arrow) this.sendTap({ target: 'arrow', value: arrow.dataset.arrow === 'left' ? -1 : 1 });
    else if (target.closest('[data-leave-button]')) this.sendTap({ target: 'leave' });
    else if (target.closest('[data-back-button]')) this.sendTap({ target: 'back' });
    else if (row) this.sendTap({ target: 'row', value: Number(row.dataset.rowIndex) });
    else if (map) this.sendTap({ target: 'map', value: Number(map.dataset.mapIndex) });
    else if (game) this.sendTap({ target: 'game', value: Number(game.dataset.gameIndex) });
  };
}
