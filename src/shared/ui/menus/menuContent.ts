import { html, nothing, type TemplateResult } from 'lit';
import { CAT_ILLNESSES } from '../../config/about';
import type { AudioConfig } from '../../config/audio';
import { CAT_MODEL_ATTRIBUTION } from '../../config/catModel';
import type { GraphicsQuality } from '../../config/graphics';
import { graphicsQualityLabel, touchControlModeLabel, touchLayoutLabel } from '../../i18n/labels';
import type { TouchSettings } from '../../config/touch';
import { hexColor } from '../../core/color';
import { formatRaceTime } from '../format';
import { t } from '../../i18n';
import { currentLanguage, LANGUAGE_NAMES } from '../../i18n/language';
import type { MenuOption } from './menuOverlay';

/** The pause menu; the sound is switched right here (it starts off), without a detour through the settings. */
export function pauseOptions(audio: Pick<AudioConfig, 'muted'>): readonly MenuOption[] {
  const { menus } = t();
  return [
    { id: 'resume', label: menus.resume },
    { id: 'pauseSound', label: soundToggleLabel(audio) },
    { id: 'controls', label: menus.controls },
    { id: 'settings', label: menus.settings },
    { id: 'lobby', label: menus.backToLobby },
  ];
}

const soundToggleLabel = (audio: Pick<AudioConfig, 'muted'>): string => (audio.muted ? t().menus.soundOn : t().menus.soundOff);

export function resultOptions(): readonly MenuOption[] {
  const { menus } = t();
  return [
    { id: 'again', label: menus.again },
    { id: 'next', label: menus.nextGame },
    { id: 'lobby', label: menus.backToLobby },
  ];
}

/** The two touch entries only appear while someone plays with the on-screen controls. */
export function settingsMenuOptions(graphicsQuality: GraphicsQuality, touch: TouchSettings | null = null, canInvite = false): readonly MenuOption[] {
  const { menus } = t();
  const touchOptions: readonly MenuOption[] = touch
    ? [
        { id: 'touchMode', label: menus.touchMode(touchControlModeLabel(touch.mode)) },
        { id: 'touchLayout', label: menus.touchLayout(touchLayoutLabel(touch.layout)) },
      ]
    : [];
  const inviteOptions: readonly MenuOption[] = canInvite ? [{ id: 'invite', label: menus.invite }] : [];
  return [
    { id: 'audio', label: menus.sound },
    { id: 'graphics', label: menus.graphics(graphicsQualityLabel(graphicsQuality)) },
    { id: 'language', label: menus.language(LANGUAGE_NAMES[currentLanguage()]) },
    ...touchOptions,
    { id: 'controls', label: menus.controls },
    { id: 'about', label: menus.about },
    { id: 'credits', label: menus.credits },
    { id: 'privacy', label: menus.privacy },
    ...inviteOptions,
    { id: 'settingsBack', label: menus.back },
  ];
}

/** The only option of a page that just shows something: back to where it was opened from. */
export function backOption(id: string): readonly MenuOption[] {
  return [{ id, label: t().menus.back }];
}

export function scrollPageHint(): TemplateResult {
  return t().menus.scrollHint;
}

export function audioMenuOptions(audio: AudioConfig): readonly MenuOption[] {
  const { menus } = t();
  const percent = (volume: number): number => Math.round(volume * 100);
  const music = percent(audio.musicVolume);
  const effects = percent((audio.sfxVolume + audio.engineVolume) / 2);
  return [
    { id: 'audioToggle', label: soundToggleLabel(audio) },
    { id: 'musicDown', label: menus.musicDown(music) },
    { id: 'musicUp', label: menus.musicUp(music) },
    { id: 'raceDown', label: menus.effectsDown(effects) },
    { id: 'raceUp', label: menus.effectsUp(effects) },
    { id: 'audioBack', label: menus.back },
  ];
}

export function controlsBody(): TemplateResult {
  return html`<c-scroll>
    <c-controls-guide></c-controls-guide>
    <c-text tone="soft" size="s" relaxed measure="prose">${t().menus.controlsLobby}</c-text>
  </c-scroll>`;
}

function link(url: string, label: string): TemplateResult {
  return html`<a href=${url} target="_blank" rel="noreferrer">${label}</a>`;
}

export function aboutBody(): TemplateResult {
  const { pages } = t();
  const paragraph = (text: string): TemplateResult => html`<c-text tone="soft" relaxed>${text}</c-text>`;
  return html`<c-scroll>
    ${pages.aboutStory.map(paragraph)}
    <c-header level="2">${pages.whatIsThat}</c-header>
    ${CAT_ILLNESSES.map((illness) => {
      const text = pages.illnesses[illness.id];
      return html`<c-text tone="soft" relaxed>
        <b>${illness.name}:</b> ${text.explanation} ${pages.source} ${link(illness.sourceUrl, text.sourceLabel)}
      </c-text>`;
    })}
    <c-text tone="muted" size="s">${pages.noVetAdvice}</c-text>
    <c-header level="2">${pages.notAPurpose}</c-header>
    ${pages.notAPurposeText.map(paragraph)}
  </c-scroll>`;
}

export function privacyBody(): TemplateResult {
  return html`<c-scroll>
    ${t().pages.privacy.map(
      (section) => html`${section.heading ? html`<c-header level="2">${section.heading}</c-header>` : nothing}
        <c-text tone="soft" relaxed measure="prose">${section.text}</c-text>`,
    )}
  </c-scroll>`;
}

export function creditsBody(): TemplateResult {
  return html`<c-text tone="soft" relaxed measure="prose">${t().pages.credits(CAT_MODEL_ATTRIBUTION, link)}</c-text>`;
}

export interface ResultRow {
  readonly place: number;
  readonly label: string;
  readonly color: number;
  readonly finishTimeSeconds: number | null;
  /** Points of this game and the total over all games played since the lobby. */
  readonly points: number;
  readonly total: number;
  /** What the table shows instead of a finish time (the score or the goals of a game with its own rules). */
  readonly detail?: string;
}

export interface ResultTableRow {
  readonly place: number;
  readonly name: string;
  readonly color: string;
  readonly time: string;
  readonly score: string;
}

export function resultTableRows(rows: readonly ResultRow[]): readonly ResultTableRow[] {
  return [...rows]
    .sort((left, right) => left.place - right.place)
    .map((row) => ({
      place: row.place,
      name: row.label,
      color: hexColor(row.color),
      time: row.detail ?? (row.finishTimeSeconds === null ? '—' : formatRaceTime(row.finishTimeSeconds)),
      score: `+${row.points} · ${row.total}`,
    }));
}

/** The headline of the result page names who won, in every game: "Mauzi wins!", a shared first place "Mauzi and Crumbs win!", everybody first "Draw!". */
export function resultsTitle(rows: readonly Pick<ResultTableRow, 'place' | 'name'>[]): string {
  const winners = rows.filter((row) => row.place === 1).map((row) => row.name);
  const { menus } = t();
  if (winners.length === 0) return menus.resultsTitle;
  if (winners.length === rows.length && rows.length > 1) return menus.draw;
  if (winners.length === 1) return menus.wins(winners[0]!);
  return menus.winTogether(winners.slice(0, -1), winners.at(-1)!);
}

/** Explains the right column of the result table: the points of this game, then the total of all games. It sits under the options so that they stay in view above the touch cross. */
export function scoreLegend(): TemplateResult {
  return html`<c-text tone="muted" size="s" data-score-legend>${t().menus.scoreLegend}</c-text>`;
}

export function resultsBody(rows: readonly ResultRow[]): TemplateResult {
  return html`<c-list gap="s">${resultTableRows(rows).map(
    (row) => html`
    <c-result-row place=${row.place} name=${row.name} color=${row.color} time=${row.time} score=${row.score}></c-result-row>`,
  )}
  </c-list>`;
}
