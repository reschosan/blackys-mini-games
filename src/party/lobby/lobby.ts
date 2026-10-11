import { graphicsQualityLabel, labelledStatBars, memoryLevelLabel, planeLabel, playerDisplayName } from '../../shared/i18n/labels';
import { type GraphicsQuality } from '../../shared/config/graphics';
import { html, nothing, render, type TemplateResult } from 'lit';
import { CAT_PRESETS, EYE_COLOR_HEX, FUR_COLOR_HEX, HETEROCHROMIA_EYE_COLORS, type EyeColor, type FurColor } from '../../shared/config/catAppearance';
import { KART_COLORS, statBarsFor, type KartStatsTable } from '../../shared/config/kartLoadout';
import { MAX_PLAYERS, PLAYER_APPEARANCES } from '../../shared/config/players';
import type { JoinedPlayer } from '../../shared/input/inputManager';
import { renderAiSlot, type AiSlotView } from './aiSlotCard';

import { t } from '../../shared/i18n';
import { currentLanguage, LANGUAGE_NAMES, nextLanguage, setLanguage } from '../../shared/i18n/language';
import { rowsFor, type CustomizationEntry, type CustomizationRow } from './catCustomization';
import { hexColor } from '../../shared/core/color';

interface RowValue {
  readonly text: string;
  readonly swatches: readonly string[];
}

const plainValue = (text: string): RowValue => ({ text, swatches: [] });
const furSwatch = (color: FurColor): RowValue => ({ text: t().lobby.furColors[color], swatches: [hexColor(FUR_COLOR_HEX[color])] });

type ValueRow = Exclude<CustomizationRow, 'name' | 'ready' | 'leave'>;

const ROW_VALUES: Readonly<Record<ValueRow, (entry: CustomizationEntry, slotIndex: number) => RowValue>> = {
  preset: (entry) => plainValue(t().lobby.presets[CAT_PRESETS[entry.presetIndex]?.presetId ?? 'blacky']),
  furColor: ({ appearance }) => furSwatch(appearance.furColor),
  pattern: ({ appearance }) => plainValue(t().lobby.patterns[appearance.pattern]),
  secondaryColor: ({ appearance }) => furSwatch(appearance.patternSecondaryColor),
  hairLength: ({ appearance }) => plainValue(t().lobby.hairLengths[appearance.hairLength]),
  mane: ({ appearance }) => plainValue(t().lobby.manes[appearance.mane]),
  eyeColor: ({ appearance }) => eyeColorValue(appearance.eyeColor),
  planeType: ({ plane }) => plainValue(planeLabel(plane)),
  memoryLevel: ({ level }) => plainValue(memoryLevelLabel(level)),
  kartType: ({ loadout }) => plainValue(t().lobby.kartTypes[loadout.kartType]),
  wheels: ({ loadout }) => plainValue(t().lobby.wheels[loadout.wheels]),
  kartColor: ({ loadout }) => ({ text: t().lobby.kartColors[loadout.colorIndex] ?? '', swatches: [hexColor(KART_COLORS[loadout.colorIndex]!.hex)] }),
};

function rowValue(row: ValueRow, entry: CustomizationEntry, slotIndex: number): RowValue {
  return ROW_VALUES[row](entry, slotIndex);
}

function eyeColorValue(eyeColor: EyeColor): RowValue {
  const text = t().lobby.eyeColors[eyeColor];
  if (eyeColor === 'heterochromia') return { text, swatches: HETEROCHROMIA_EYE_COLORS.map(hexColor) };
  return { text, swatches: [hexColor(EYE_COLOR_HEX[eyeColor])] };
}

function renderCustomizationRow(row: CustomizationRow, index: number, entry: CustomizationEntry, slotIndex: number): TemplateResult | typeof nothing {
  if (row === 'name') return nothing;
  const active = index === entry.selectedRow;
  if (row === 'leave') {
    const label = entry.page === 'start' ? t().lobby.leave : t().lobby.back;
    return html`<c-button data-leave-button block size="s" compact mode="cancel" data-row-index=${index} data-row-id=${row} label=${label} ?active=${active}></c-button>`;
  }
  if (row === 'ready') {
    return html`<c-button
      block size="s" compact
      data-row-index=${index}
      data-row-id=${row}
      label=${entry.ready ? t().lobby.notReady : t().lobby.ready}
      mode=${entry.ready ? 'success' : 'default'}
      ?active=${active}
    ></c-button>`;
  }
  const value = rowValue(row, entry, slotIndex);
  return html`<c-setting-row
    data-row-index=${index}
    data-row-id=${row}
    label=${t().lobby.rows[row]}
    value=${value.text}
    .swatches=${value.swatches}
    ?active=${active}
  ></c-setting-row>`;
}

/** The card of one joined player: name, cat view, kart values and the rows of the customization. Also drawn on a guest's own screen. */
export function renderPlayerCard(index: number, deviceName: string, entry: CustomizationEntry | undefined, kartStats: KartStatsTable): TemplateResult {
  const color = hexColor(PLAYER_APPEARANCES[index]?.bodyColor ?? 0xffffff);
  const rows = entry ? rowsFor(entry).map((row, rowIndex) => renderCustomizationRow(row, rowIndex, entry, index)) : nothing;
  return html`<c-cat-preview-card variant="player" color=${color} data-slot="player" data-player-index=${index}>
    <c-player-tag color=${color} ?selected=${entry !== undefined && rowsFor(entry)[entry.selectedRow] === 'name'}>${playerDisplayName(entry?.appearance.name ?? '', index)}</c-player-tag>
    <c-text tone="soft" size="s" measure="inset">${deviceName}</c-text>
    <c-preview-frame data-preview-index=${index}></c-preview-frame>
    ${entry?.page === 'kart' && !isPhoneLayout() ? html`<c-stat-bars .bars=${labelledStatBars(statBarsFor(entry.loadout, kartStats))}></c-stat-bars>` : nothing}
    <c-list inset>${rows}</c-list>
  </c-cat-preview-card>`;
}

function renderSlot(
  index: number,
  player: JoinedPlayer | undefined,
  entry: CustomizationEntry | undefined,
  aiSlot: AiSlotView | null,
  kartStats: KartStatsTable,
): TemplateResult {
  const appearance = PLAYER_APPEARANCES[index];
  if (!player || !appearance) {
    if (aiSlot) return renderAiSlot(index, aiSlot);
    return html`<c-cat-preview-card variant="empty" data-join-slot data-slot="empty">
      <c-header level="4" tone="muted">${t().lobby.seat(index + 1)}</c-header>
      <c-text tone="muted" size="s">${t().lobby.joinHint}</c-text>
    </c-cat-preview-card>`;
  }
  return renderPlayerCard(index, player.deviceName, entry, kartStats);
}

export interface LobbyClickHandlers {
  /** A joined player clicked one of their own rows directly, instead of navigating to it. */
  readonly onPlayerRowClick: (playerIndex: number, rowIndex: number) => void;
  /** A joined player clicked a ◀/▶ on their own active row, instead of steering. */
  readonly onPlayerArrowClick: (playerIndex: number, delta: -1 | 1) => void;
  /** Someone clicked a row of the (single, currently focused) AI wizard slot. */
  readonly onAiRowClick: (rowIndex: 0 | 1) => void;
  /** Someone clicked a ◀/▶ on the AI wizard's active row. */
  readonly onAiArrowClick: (delta: -1 | 1) => void;
  /** Global sound preference, controlled by the native lobby checkbox. */
  readonly onAudioMutedChange: (muted: boolean) => void;
  /** Someone clicked the graphics button, switching between high and low. */
  readonly onGraphicsClick: () => void;
  /** Someone clicked the "Controls" button to open the controls overview. */
  readonly onControlsClick: () => void;
  /** Someone clicked the "About Blacky" button to open the story page. */
  readonly onAboutClick: () => void;
  readonly onSettingsClick: () => void;
  /** Someone clicked "Invite players" to bring in other phones. */
  readonly onInviteClick: () => void;
  /** Someone tapped or clicked an empty slot to join with the on-screen controls. */
  readonly onJoinClick: () => void;
  /** Someone clicked the AI button, cycling the number of AI opponents. */
  readonly onAiFillClick: () => void;
  /** Someone clicked a game card in the game vote (the first player; a second click locks it in). */
  readonly onGameClick: (gameIndex: number) => void;
  /** Someone clicked a map card in the vote. */
  readonly onMapClick: (mapIndex: number) => void;
  /** A player clicked "Leave" on their own card. */
  readonly onLeaveClick: (playerIndex: number) => void;
  /** Someone clicked "Back" in the game or map vote. */
  readonly onBackClick: () => void;
}

/** On a phone only the players, the AI cats and one free slot are shown: three more empty cards would only push the cat out of view. */
function isPhoneLayout(): boolean {
  return document.documentElement.dataset.screenSize === 'S';
}

export class LobbyView {
  private readonly root = document.createElement('c-screen');

  constructor(
    private readonly overlay: HTMLElement,
    private readonly clickHandlers: LobbyClickHandlers,
  ) {
    this.root.dataset.testid = 'lobby';
    this.root.tone = 'solid';
    this.overlay.appendChild(this.root);
    // `pointerup` instead of `click`: fires directly off the raw input instead of going through
    // the browser's click-synthesis step (which folds in double-click/drag-threshold timing) —
    // more direct, and was the fix for a real click producing no event at all in testing while a
    // scripted `element.click()` worked fine.
    this.root.addEventListener('pointerup', this.onClick);
    this.root.addEventListener('change', this.onChange);
  }

  /** Single delegated listener (survives `update()` re-rendering underneath it): figures
   *  out what was clicked from its closest `data-*` markers and routes it to the matching
   *  handler, exactly mirroring what steering/confirming to that same row would have done. */
  private readonly onClick = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (this.handleToolbarClick(target) || this.handleLeaveClick(target)) return;

    const arrow = target.closest<HTMLElement>('[data-arrow]');
    const rowElement = target.closest<HTMLElement>('[data-row-index]');
    const playerSlot = target.closest<HTMLElement>('[data-player-index]');
    const isAiWizardRow = target.closest('[data-ai-wizard-rows]') !== null;

    if (arrow) this.handleArrowClick(arrow.dataset.arrow === 'left' ? -1 : 1, playerSlot, isAiWizardRow);
    else if (rowElement) this.handleRowClick(Number(rowElement.dataset.rowIndex), playerSlot, isAiWizardRow);
  };

  private handleToolbarClick(target: HTMLElement): boolean {
    const clickActions: readonly (readonly [selector: string, action: () => void])[] = [
      ['[data-controls-button]', this.clickHandlers.onControlsClick],
      ['[data-about-button]', this.clickHandlers.onAboutClick],
      ['[data-graphics-button]', this.clickHandlers.onGraphicsClick],
      ['[data-language-button]', () => setLanguage(nextLanguage())],
      ['[data-settings-button]', this.clickHandlers.onSettingsClick],
      ['[data-invite-button]', this.clickHandlers.onInviteClick],
      ['[data-ai-fill-button]', this.clickHandlers.onAiFillClick],
      ['[data-join-slot]', this.clickHandlers.onJoinClick],
    ];
    const match = clickActions.find(([selector]) => target.closest(selector));
    match?.[1]();
    return match !== undefined;
  }

  private handleLeaveClick(target: HTMLElement): boolean {
    if (!target.closest('[data-leave-button]')) return false;
    const playerSlot = target.closest<HTMLElement>('[data-player-index]');
    if (playerSlot) this.clickHandlers.onLeaveClick(Number(playerSlot.dataset.playerIndex));
    return true;
  }

  private handleArrowClick(delta: -1 | 1, playerSlot: HTMLElement | null, isAiWizardRow: boolean): void {
    if (playerSlot) this.clickHandlers.onPlayerArrowClick(Number(playerSlot.dataset.playerIndex), delta);
    else if (isAiWizardRow) this.clickHandlers.onAiArrowClick(delta);
  }

  private handleRowClick(rowIndex: number, playerSlot: HTMLElement | null, isAiWizardRow: boolean): void {
    if (playerSlot) this.clickHandlers.onPlayerRowClick(Number(playerSlot.dataset.playerIndex), rowIndex);
    else if (isAiWizardRow) this.clickHandlers.onAiRowClick(rowIndex === 1 ? 1 : 0);
  }

  private readonly onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.closest('[data-audio-toggle]')) return;
    this.clickHandlers.onAudioMutedChange(!target.checked);
  };

  update(
    players: readonly JoinedPlayer[],
    entryFor: (player: JoinedPlayer) => CustomizationEntry | undefined,
    aiSlots: readonly (AiSlotView | null)[],
    audioMuted: boolean,
    graphicsQuality: GraphicsQuality,
    kartStats: KartStatsTable,
  ): void {
    const isFree = (index: number): boolean => !players[index] && !aiSlots[index];
    const firstFreeSlot = Array.from({ length: MAX_PLAYERS }, (_, index) => index).find(isFree);
    const showsOnlyFirstFreeSlot = isPhoneLayout();
    const slots = Array.from({ length: MAX_PLAYERS }, (_, index) => {
      const player = players[index];
      if (showsOnlyFirstFreeSlot && isFree(index) && index !== firstFreeSlot) return nothing;
      return renderSlot(index, player, player ? entryFor(player) : undefined, aiSlots[index] ?? null, kartStats);
    });

    const gameChosen = players.some((player) => (entryFor(player)?.page ?? 'start') !== 'start');
    const { lobby, menus } = t();
    const nextStep = gameChosen ? lobby.nextStepStart : lobby.nextStepChoose;
    const aiCount = aiSlots.filter((slot) => slot !== null).length;
    const aiFillButton = players.length === 0 ? nothing : html`<c-button data-ai-fill-button size="s" label=${lobby.aiOpponents(aiCount)}></c-button>`;
    render(
      html`
      <c-header>Blacky's Mini Games</c-header>
      <c-list direction="row" gap="m">${slots}</c-list>
      <c-list direction="row" gap="m" align="center">
        <c-checkbox data-audio-toggle label=${lobby.soundCheckbox} ?checked=${!audioMuted}></c-checkbox>
        <c-button data-graphics-button size="s" label=${menus.graphics(graphicsQualityLabel(graphicsQuality))}></c-button>
        <c-button data-language-button size="s" label=${menus.language(LANGUAGE_NAMES[currentLanguage()])}></c-button>
        ${aiFillButton}
        <c-button data-invite-button size="s" label=${menus.invite} ?disabled=${players.length >= MAX_PLAYERS}></c-button>
        <c-button data-settings-button size="s" label=${menus.settings}></c-button>
        <c-button data-controls-button size="s" label=${menus.controls}></c-button>
        <c-button data-about-button size="s" label=${menus.about}></c-button>
      </c-list>
      <c-text tone="muted" size="s">${lobby.hint} · ${nextStep}</c-text>`,
      this.root,
    );
  }

  /** The placeholder for a joined slot's live cat preview canvas, or null if that slot isn't
   *  currently showing a joined player. The caller mounts its own persistent canvas into it. */
  previewContainer(index: number): HTMLElement | null {
    return this.root.querySelector(`[data-preview-index="${index}"]`);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
