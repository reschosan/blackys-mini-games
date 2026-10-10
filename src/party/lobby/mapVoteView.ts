import { html, render, type TemplateResult } from 'lit';
import { PLAYER_APPEARANCES } from '../../shared/config/players';
import type { GameCard } from '../../shared/game/gameCard';
import type { JoinedPlayer } from '../../shared/input/inputManager';
import { hexColor } from '../../shared/core/color';
import type { LobbyClickHandlers } from './lobby';
import type { MapVotePick } from './mapVote';
import { placeName, t } from '../../shared/i18n';

/** "So wird gespielt": the name of the chosen game and its few rules, on the screen where the map is chosen. */
export function rulesTemplate(game: GameCard): TemplateResult {
  return html`<c-stack align="center" gap="s" data-game-rules>
    <c-header level="2">${t().lobby.howToPlay(game.title)}</c-header>
    ${game.rules.map((rule) => html`<c-text tone="soft" size="s" measure="prose">${rule}</c-text>`)}
  </c-stack>`;
}

export interface MapVoteCard {
  readonly name: string;
}

/** The full-screen "Choose map" overlay shown once everyone has finished customizing their
 *  cat (see `MapVoteStage`): one card per map with a live preview, plus every joined player's
 *  own colored marker on whichever card they're currently pointing at. */
export class MapVoteView {
  private readonly root = document.createElement('c-screen');
  private previousPicks: readonly number[] = [];

  constructor(
    overlay: HTMLElement,
    private readonly handlers: Pick<LobbyClickHandlers, 'onMapClick' | 'onBackClick'>,
  ) {
    this.root.dataset.testid = 'map-vote';
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
    const card = event.target.closest<HTMLElement>('[data-map-index]');
    if (card) this.handlers.onMapClick(Number(card.dataset.mapIndex));
  };

  update(
    maps: readonly MapVoteCard[],
    joined: readonly JoinedPlayer[],
    pickFor: (player: JoinedPlayer) => MapVotePick | undefined,
    nameFor: (index: number) => string,
    game: GameCard,
  ): void {
    const markersByMap: TemplateResult[][] = [...maps.map(() => []), []];
    joined.forEach((player, index) => {
      const pick = pickFor(player);
      const appearance = PLAYER_APPEARANCES[index];
      if (!pick || !appearance) return;
      markersByMap[pick.mapIndex]?.push(this.renderMarker(nameFor(index), appearance.bodyColor, pick.confirmed));
    });

    const cards = maps.map(
      (map, index) => html`
      <c-map-vote-card data-map-index=${index} ?active=${(markersByMap[index]?.length ?? 0) > 0}>
        <c-preview-frame size="map" data-map-preview-index=${index}></c-preview-frame>
        <c-header level="3">${placeName(map.name)}</c-header>
        <c-list direction="row" gap="s" reserve>${markersByMap[index]}</c-list>
      </c-map-vote-card>`,
    );

    this.root.setAttribute('aria-label', t().lobby.chooseMap);
    render(
      html`
      <c-header>${t().lobby.chooseMap}</c-header>
      ${rulesTemplate(game)}
      <c-list direction="row" gap="m">${cards}</c-list>
      <c-stack align="center" gap="s">
        <c-button data-back-button label=${t().lobby.back} mode="cancel" ?active=${(markersByMap[maps.length]?.length ?? 0) > 0}></c-button>
        <c-list direction="row" gap="s" reserve>${markersByMap[maps.length]}</c-list>
      </c-stack>
      <c-text tone="soft" relaxed>${t().lobby.mapVoteHint}</c-text>`,
      this.root,
    );
    this.scrollToMovedPick(
      joined.map((player) => pickFor(player)?.mapIndex ?? -1),
      maps.length,
    );
  }

  /** With more maps than fit on the screen (more are coming, and tablets show less), the card someone just moved to scrolls into view. */
  private scrollToMovedPick(picks: readonly number[], backIndex: number): void {
    const movedTo = picks.find((mapIndex, player) => mapIndex !== -1 && mapIndex !== this.previousPicks[player]);
    this.previousPicks = picks;
    if (movedTo === undefined) return;
    const target =
      movedTo === backIndex ? this.root.querySelector('[data-back-button]')?.closest('c-stack') : this.root.querySelector(`[data-map-index="${movedTo}"]`);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private renderMarker(label: string, color: number, confirmed: boolean): TemplateResult {
    return html`<c-chip mode="color" color=${hexColor(color)} ?dim=${!confirmed} ?outlined=${confirmed}>${label}${confirmed ? ' ✓' : ''}</c-chip>`;
  }

  /** The placeholder for a map card's live preview canvas. The caller mounts its own persistent
   *  canvas into this element after every update. */
  previewContainer(index: number): HTMLElement | null {
    return this.root.querySelector(`[data-map-preview-index="${index}"]`);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
