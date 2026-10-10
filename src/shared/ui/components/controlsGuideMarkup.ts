import { t } from '../../i18n';
import { GAMEPAD_ACTION_BUTTONS, type GameAction } from '../../config/input';

type DiagramAction = GameAction | 'steer';

/** The colour of each action in the drawing; its words are in the texts (`controls.actions`). */
const ACTION_FILLS: Readonly<Record<DiagramAction, string>> = {
  accelerate: '#3fae5b',
  brake: '#e0605c',
  steer: '#4d94ff',
  drift: '#f0a820',
  useItem: '#a878e6',
  confirm: '#e6d84a',
  pause: '#9aa0b5',
  settings: '#5cc6c6',
};

const wordsOf = (action: DiagramAction): { readonly legend: string; readonly cap: string } => t().controls.actions[action];

const NEUTRAL_FILL = '#2c2c36';
const FIGURE_CAPTION_CLASSES = 'mb-1.5 text-[0.95rem] font-bold uppercase tracking-wide text-ink';

function actionFillOf(action: DiagramAction | null): string {
  return action ? ACTION_FILLS[action] : NEUTRAL_FILL;
}

interface PadButton {
  readonly index: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly label: { readonly x: number; readonly anchor: 'start' | 'middle' | 'end'; readonly y: number };
}

const PAD_BUTTONS: readonly PadButton[] = [
  { index: 0, name: '✕', x: 345, y: 152, label: { x: 345, anchor: 'middle', y: 184 } },
  { index: 1, name: '○', x: 373, y: 126, label: { x: 392, anchor: 'start', y: 130 } },
  { index: 2, name: '□', x: 317, y: 126, label: { x: 298, anchor: 'end', y: 130 } },
  { index: 3, name: '△', x: 345, y: 100, label: { x: 345, anchor: 'middle', y: 84 } },
];

function padActionFor(index: number): DiagramAction | null {
  return GAMEPAD_ACTION_BUTTONS[index] ?? null;
}

function padButtonSvg(button: PadButton): string {
  const action = padActionFor(button.index);
  const nameClass = action ? 'fill-surface text-[15px] font-extrabold' : 'fill-muted text-[15px] font-semibold';
  const name = `<text class="${nameClass}" text-anchor="middle" x="${button.x}" y="${button.y + 5}">${button.name}</text>`;
  const circle = `<circle cx="${button.x}" cy="${button.y}" r="14" fill="${actionFillOf(action)}" class="stroke-surface stroke-2" />`;
  if (!action) return circle + name;
  const label = `<text class="fill-[#cfcfd8] text-xs font-bold" x="${button.label.x}" y="${button.label.y}" text-anchor="${button.label.anchor}">${wordsOf(action).legend}</text>`;
  return circle + name + label;
}

function padSmallButtonSvg(index: number, x: number, title: string, anchor: 'start' | 'end'): string {
  const action = padActionFor(index);
  const labelX = anchor === 'end' ? x + 8 : x - 8;
  const label = action ? `<text class="fill-[#cfcfd8] text-xs font-bold" x="${labelX}" y="100" text-anchor="${anchor}">${title}</text>` : '';
  return `<rect x="${x - 11}" y="120" width="22" height="10" rx="5" fill="${actionFillOf(action)}" class="stroke-surface stroke-2" />${label}`;
}

function padShapeSvg(): string {
  const steer = ACTION_FILLS.steer;
  const drift = actionFillOf(padActionFor(5));
  const item = actionFillOf(padActionFor(4));
  return `<path class="stroke-surface stroke-2" fill="${NEUTRAL_FILL}" d="M110 70 H350 C400 70 430 110 440 180 C447 235 425 255 400 250 C370 245 360 205 330 190 H130 C100 205 90 245 60 250 C35 255 13 235 20 180 C30 110 60 70 110 70 Z" />
    <rect x="56" y="50" width="72" height="16" rx="8" fill="${item}" class="stroke-surface stroke-2" />
    <text class="fill-[#cfcfd8] text-xs font-bold" x="92" y="40" text-anchor="middle">L · ${wordsOf('useItem').legend}</text>
    <rect x="322" y="50" width="72" height="16" rx="8" fill="${drift}" class="stroke-surface stroke-2" />
    <text class="fill-[#cfcfd8] text-xs font-bold" x="358" y="40" text-anchor="middle">R · ${wordsOf('drift').legend}</text>
    <circle cx="112" cy="122" r="24" fill="${steer}" class="stroke-surface stroke-2" />
    <text class="fill-[#cfcfd8] text-xs font-bold" x="112" y="90" text-anchor="middle">${t().controls.stick}</text>
    <rect x="161" y="142" width="18" height="60" rx="4" fill="${NEUTRAL_FILL}" class="stroke-surface stroke-2" />
    <rect x="140" y="163" width="60" height="18" rx="4" fill="${steer}" class="stroke-surface stroke-2" />
    <text class="fill-[#cfcfd8] text-xs font-bold" x="170" y="222" text-anchor="middle">${t().controls.dpadArrows}</text>
    <circle cx="290" cy="178" r="20" fill="${NEUTRAL_FILL}" class="stroke-surface stroke-2" />`;
}

function gamepadHtml(): string {
  const buttons = PAD_BUTTONS.map(padButtonSvg).join('');
  const small = padSmallButtonSvg(8, 205, wordsOf('settings').cap, 'end') + padSmallButtonSvg(9, 245, wordsOf('pause').cap, 'start');
  return `<figure class="max-w-full">
    <figcaption class="${FIGURE_CAPTION_CLASSES}">${t().controls.gamepad}</figcaption>
    <svg class="h-auto max-w-full" viewBox="0 0 460 270" width="460" height="270" role="img" aria-label="${t().controls.gamepad}">${padShapeSvg()}${small}${buttons}</svg>
  </figure>`;
}

function legendHtml(): string {
  const chips = (Object.keys(ACTION_FILLS) as DiagramAction[])
    .map(
      (action) =>
        `<li><span class="mr-1.5 inline-block size-3 rounded-sm align-[-0.1rem]" style="background: ${ACTION_FILLS[action]}"></span>${wordsOf(action).legend}</li>`,
    )
    .join('');
  return `<ul class="flex list-none flex-wrap justify-center gap-x-5 gap-y-1.5 text-[0.95rem] text-[#cfcfd8]">${chips}</ul>`;
}

/** Drawn gamepad overview with the PSP button names; labels and colours follow the input config so the picture
 *  cannot drift from the real button mapping. */
export function controlsDiagramHtml(): string {
  return `<div class="flex max-w-[62rem] flex-col items-center gap-4 px-6 [&>*]:shrink-0">
    ${legendHtml()}
    ${gamepadHtml()}
    <c-text tone="muted" size="s" measure="prose">${t().controls.menuHint}</c-text>
  </div>`;
}
