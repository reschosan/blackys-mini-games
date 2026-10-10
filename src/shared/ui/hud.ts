import { html, nothing, render, type TemplateResult } from 'lit';
import type { ItemType } from '../config/items';
import { PLAYER_APPEARANCES } from '../config/players';
import { hexColor } from '../core/color';
import { formatRaceTime } from './format';
import { placeName, t } from '../i18n';

export interface HudPlayer {
  readonly lap: number;
  readonly place: number;
  readonly finished: boolean;
  readonly heldItem: ItemType | null;
  /** The name of the held item on this map; the default name when missing. */
  readonly heldItemLabel?: string;
  readonly objective?: string | null;
  readonly penaltySecondsLeft?: number;
  readonly drivingHint?: string | null;
  /** Which seat's colour the card wears, when it is not the card's position in the list (a guest shows only its own card). */
  readonly slot?: number;
  /** How many karts race, when it is not the number of cards. */
  readonly fieldSize?: number;
  /** What the card says instead of the lap (the score of a game with its own rules). */
  readonly statusText?: string;
  /** The card has no place (a game where the place says nothing until the end). */
  readonly placeHidden?: boolean;
  /** The cat's name: the card shows it when the place is hidden. */
  readonly title?: string;
}

/** The name of an item on a map: the map's own name for it where it has one (same effect, themed name). */
export function itemLabelFor(item: ItemType, map: { readonly itemNames?: Readonly<Partial<Record<ItemType, string>>> }): string {
  const ownName = map.itemNames?.[item];
  return ownName ? placeName(ownName) : t().race.items[item];
}

export class HudView {
  private readonly root = document.createElement('c-hud');

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'hud';
    overlay.appendChild(this.root);
  }

  update(
    players: readonly HudPlayer[],
    lapCount: number,
    raceTimeSeconds: number,
    finishCountdownSeconds: number | null,
    startCountdownLabel: string | null,
    disconnectedDevices: readonly string[],
    statusLines: readonly string[] = [],
  ): void {
    const cards = players.map((player, index) => this.renderCard(player, index, players.length, lapCount));
    const { race } = t();
    const countdown =
      finishCountdownSeconds === null ? nothing : html`<c-hud-timer mode="alert">${race.finishCountdown(Math.ceil(finishCountdownSeconds))}</c-hud-timer>`;
    const startCountdown = startCountdownLabel === null ? nothing : html`<c-start-countdown>${startCountdownLabel}</c-start-countdown>`;
    const deviceWarning =
      disconnectedDevices.length === 0 ? nothing : html`<c-alert-banner>${race.disconnected(disconnectedDevices.join(', '))}</c-alert-banner>`;
    render(
      html`${cards}<c-hud-timer>${statusLines.length > 0 ? statusLines.join(' · ') : formatRaceTime(raceTimeSeconds)}</c-hud-timer>${countdown}${startCountdown}${deviceWarning}`,
      this.root,
    );
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private renderCard(player: HudPlayer, index: number, total: number, lapCount: number): TemplateResult | typeof nothing {
    const appearance = PLAYER_APPEARANCES[player.slot ?? index];
    if (!appearance) return nothing;
    const lap = Math.min(player.lap + 1, lapCount);
    const notes = [
      player.objective && !player.finished ? `→ ${placeName(player.objective)}` : null,
      player.drivingHint && !player.finished ? player.drivingHint : null,
    ].filter((note): note is string => note !== null);
    const { race } = t();
    const penalty = (player.penaltySecondsLeft ?? 0) > 0 ? race.backIn(player.penaltySecondsLeft!.toFixed(1)) : '';

    return html`<c-hud-card
      color=${hexColor(appearance.bodyColor)}
      place=${placeLabelOf(player, total)}
      name=${player.placeHidden ? (player.title ?? '') : ''}
      status=${player.statusText ?? (player.finished ? race.finished : race.lap(lap, lapCount))}
      item=${player.heldItem ? (player.heldItemLabel ?? race.items[player.heldItem]) : ''}
      .notes=${notes}
      penalty=${penalty}
    ></c-hud-card>`;
  }
}

function placeLabelOf(player: HudPlayer, total: number): string {
  return player.placeHidden ? '' : `${player.place}/${player.fieldSize ?? total}`;
}
