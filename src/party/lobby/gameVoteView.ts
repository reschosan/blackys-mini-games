import { html, nothing, render, type TemplateResult } from 'lit';
import { PLAYER_APPEARANCES } from '../../shared/config/players';
import { hexColor } from '../../shared/core/color';
import type { GameCard } from '../../shared/game/gameCard';
import type { JoinedPlayer } from '../../shared/input/inputManager';
import type { LobbyClickHandlers } from './lobby';
import type { MapVotePick } from './mapVote';
import { t } from '../../shared/i18n';

/** The full-screen "Choose game" overlay shown once everyone is ready: one card per game, every player's colored marker on the card they point at.
 *  It works like the map vote (`MapVoteView`), without previews. */
export class GameVoteView {
  private readonly root = document.createElement('c-screen');

  constructor(
    overlay: HTMLElement,
    private readonly handlers: Pick<LobbyClickHandlers, 'onGameClick' | 'onBackClick'>,
  ) {
    this.root.dataset.testid = 'game-vote';
    this.root.setAttribute('role', 'region');
    this.root.hidden = true;
    this.root.tone = 'solid';
    this.root.enter = true;
    overlay.appendChild(this.root);
    this.root.addEventListener('pointerup', this.onPointerUp);
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('[data-back-button]')) {
      this.handlers.onBackClick();
      return;
    }
    const card = event.target.closest<HTMLElement>('[data-game-index]');
    if (card) this.handlers.onGameClick(Number(card.dataset.gameIndex));
  };

  update(
    games: readonly GameCard[],
    joined: readonly JoinedPlayer[],
    pickFor: (player: JoinedPlayer) => MapVotePick | undefined,
    nameFor: (index: number) => string,
  ): void {
    const markersByGame: TemplateResult[][] = [...games.map(() => []), []];
    joined.forEach((player, index) => {
      const pick = pickFor(player);
      const appearance = PLAYER_APPEARANCES[index];
      if (!pick || !appearance) return;
      markersByGame[pick.mapIndex]?.push(this.renderMarker(nameFor(index), appearance.bodyColor, pick.confirmed));
    });
    const cards = games.map(
      (game, index) => html`
      <c-map-vote-card data-game-index=${index} ?active=${(markersByGame[index]?.length ?? 0) > 0}>
        <c-header level="3">${game.title}</c-header>
        <c-text tone="soft" size="s" measure="prose">${game.summary}</c-text>
        <c-list direction="row" gap="s" reserve>${markersByGame[index]}</c-list>
      </c-map-vote-card>`,
    );
    this.root.setAttribute('aria-label', t().lobby.chooseGame);
    render(
      html`
      <c-header>${t().lobby.chooseGame}</c-header>
      <c-list direction="row" gap="m">${cards}</c-list>
      <c-stack align="center" gap="s">
        <c-button data-back-button label=${t().lobby.back} mode="cancel" ?active=${(markersByGame[games.length]?.length ?? 0) > 0}></c-button>
        <c-list direction="row" gap="s" reserve>${markersByGame[games.length]}</c-list>
      </c-stack>
      <c-text tone="soft" relaxed>${t().lobby.gameVoteHint}</c-text>`,
      this.root,
    );
  }

  private renderMarker(label: string, color: number, confirmed: boolean): TemplateResult {
    return html`<c-chip mode="color" color=${hexColor(color)} ?dim=${!confirmed} ?outlined=${confirmed}>${label}${confirmed ? ' ✓' : ''}</c-chip>`;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    render(nothing, this.root);
  }
}
