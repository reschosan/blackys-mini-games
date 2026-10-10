// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/shared/ui/components/index';
import '../../../src/shared/ui/components/cResultRow';
import '../../../src/shared/ui/components/cSettingRow';
import '../../../src/shared/ui/components/cStatBars';
import '../../../src/shared/ui/components/cTouchButton';
import type { CButton } from '../../../src/shared/ui/components/cButton';
import type { CCheckbox } from '../../../src/shared/ui/components/cCheckbox';
import type { CList } from '../../../src/shared/ui/components/cList';
import type { CDpad } from '../../../src/shared/ui/components/cDpad';
import type { CListItem } from '../../../src/shared/ui/components/cListItem';
import type { CPlayerTag } from '../../../src/shared/ui/components/cPlayerTag';
import type { CResultRow } from '../../../src/shared/ui/components/cResultRow';
import type { CSettingRow } from '../../../src/shared/ui/components/cSettingRow';
import type { CStatBars } from '../../../src/shared/ui/components/cStatBars';
import type { CTouchButton } from '../../../src/shared/ui/components/cTouchButton';
import { mount, update } from './mount';

afterEach(() => document.body.replaceChildren());

const innerButton = (host: HTMLElement): HTMLButtonElement => host.querySelector('button')!;

describe('c-button', () => {
  it('shows its label in a real button', async () => {
    const button = await mount<CButton>('c-button', { label: 'Zurück' });
    expect(innerButton(button).textContent).toBe('Zurück');
    expect(innerButton(button).type).toBe('button');
  });

  it('marks the active option like a solid button', async () => {
    const button = await mount<CButton>('c-button', { label: 'OK' });
    expect(innerButton(button).className).toContain('border-line');
    await update(button, { active: true });
    expect(innerButton(button).className).toContain('bg-ink');
  });

  it.each([
    ['success', 'border-success'],
    ['cancel', 'border-cancel'],
    ['unknown', 'border-line'],
  ])('uses the %s mode', async (mode, expected) => {
    const button = await mount<CButton>('c-button', { label: 'x', mode });
    expect(innerButton(button).className).toContain(expected);
  });

  it('is wider with size l and narrower when compact', async () => {
    const regular = await mount<CButton>('c-button', { label: 'x' });
    const large = await mount<CButton>('c-button', { label: 'x', size: 'l' });
    const compact = await mount<CButton>('c-button', { label: 'x', compact: true });
    expect(innerButton(large).className).toContain('px-6 py-4');
    expect(innerButton(regular).className).toContain('px-6 py-2.5');
    expect(innerButton(compact).className).toContain('px-4 py-1');
  });

  it('fills its row with grow and block, and disables itself', async () => {
    const grown = await mount<CButton>('c-button', { label: 'x', grow: true });
    expect(grown.classList.contains('flex-1')).toBe(true);
    expect(innerButton(grown).className).toContain('w-full');
    const disabled = await mount<CButton>('c-button', { label: 'x', disabled: true });
    expect(innerButton(disabled).disabled).toBe(true);
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.classList.contains('pointer-events-none')).toBe(true);
    await update(disabled, { disabled: false });
    expect(disabled.hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('c-checkbox', () => {
  it('c-checkbox follows the native checkbox', async () => {
    const checkbox = await mount<CCheckbox>('c-checkbox', { label: 'Ton' });
    const input = checkbox.querySelector('input')!;
    expect(input.checked).toBe(false);
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(checkbox.checked).toBe(true);
  });

  it('c-checkbox shows an initial checked state', async () => {
    const checkbox = await mount<CCheckbox>('c-checkbox', { label: 'Ton', checked: true });
    expect(checkbox.querySelector('input')!.checked).toBe(true);
  });
});

describe('c-touch-button', () => {
  it('uses the label as the accessible name unless an aria text is given', async () => {
    const button = await mount<CTouchButton>('c-touch-button', { label: '▲', kind: 'arrow' });
    expect(innerButton(button).getAttribute('aria-label')).toBe('▲');
    await update(button, { aria: 'Nach oben' });
    expect(innerButton(button).getAttribute('aria-label')).toBe('Nach oben');
  });

  it.each([
    ['arrow', 'rounded-[0.8rem]'],
    ['ok', 'bg-success'],
    ['system', 'rounded-full border'],
    ['action', 'font-bold'],
  ])('draws the %s shape', async (kind, expected) => {
    const button = await mount<CTouchButton>('c-touch-button', { label: 'x', kind });
    expect(innerButton(button).className).toContain(expected);
  });

  it('colours action buttons by mode and size', async () => {
    const button = await mount<CTouchButton>('c-touch-button', { label: 'Drift', kind: 'action', mode: 'warn', size: 'l' });
    expect(innerButton(button).className).toContain('bg-warn');
    expect(innerButton(button).className).toContain('size-30');
  });
});

describe('lists', () => {
  it('c-list is a column with the list role, and falls back to a column for an unknown direction', async () => {
    const list = await mount<CList>('c-list');
    expect(list.classList.contains('flex-col')).toBe(true);
    expect(list.getAttribute('role')).toBe('list');
    await update(list, { direction: 'row' });
    expect(list.classList.contains('flex-wrap')).toBe(true);
    await update(list, { direction: 'diagonal' });
    expect(list.classList.contains('flex-col')).toBe(true);
  });

  it('c-list-item highlights the active row and shows a pointer when clickable', async () => {
    const item = await mount<CListItem>('c-list-item');
    expect(item.getAttribute('role')).toBe('listitem');
    expect(item.classList.contains('font-bold')).toBe(false);
    await update(item, { active: true, interactive: true });
    expect(item.classList.contains('font-bold')).toBe(true);
    expect(item.classList.contains('cursor-pointer')).toBe(true);
  });
});

describe('game cards', () => {
  it('c-player-tag shows the player colour and marks the selected name with arrows', async () => {
    const tag = await mount<CPlayerTag>('c-player-tag', { color: 'rgb(10, 20, 30)' }, 'Katze 1');
    expect(tag.style.background).toContain('rgb(10, 20, 30)');
    expect(tag.className).not.toContain('outline-white');
    await update(tag, { selected: true });
    expect(tag.className).toContain('outline-white');
  });

  it('c-result-row shows place, name next to a dot in its colour (readable text, colour only as an extra) and time', async () => {
    const row = await mount<CResultRow>('c-result-row', { place: 2, name: 'Katze 2', color: 'rgb(1, 2, 3)', time: '0:12.37' });
    expect(row.textContent).toContain('2.');
    expect(row.textContent).toContain('Katze 2');
    expect(row.textContent).toContain('0:12.37');
    const dot = row.querySelector<HTMLElement>('span[style]')!;
    expect(dot.style.background).toContain('rgb(1, 2, 3)');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.textContent).toBe('');
  });

  it('c-setting-row shows arrows only while active, and one swatch per colour', async () => {
    const row = await mount<CSettingRow>('c-setting-row', { label: 'Fellfarbe', value: 'Schwarz', swatches: ['#000', '#fff'] });
    expect(row.querySelectorAll('[data-arrow]')).toHaveLength(0);
    expect(row.querySelectorAll('span[style*="background"]')).toHaveLength(2);
    await update(row, { active: true });
    expect([...row.querySelectorAll('[data-arrow]')].map((arrow) => arrow.getAttribute('data-arrow'))).toEqual(['left', 'right']);
    expect(row.hasAttribute('active')).toBe(true);
  });

  it('c-stat-bars draws one bar per value and keeps the width between 0 and 100 percent', async () => {
    const bars = await mount<CStatBars>('c-stat-bars', {
      bars: [
        { label: 'Tempo', ratio: 0.6 },
        { label: 'Grip', ratio: 3 },
        { label: 'Drift', ratio: -1 },
      ],
    });
    const widths = [...bars.querySelectorAll<HTMLElement>('[data-stat] span[style]')].map((bar) => bar.style.width);
    expect(widths).toEqual(['60%', '100%', '0%']);
  });
});

describe('c-dpad', () => {
  const key = (dpad: HTMLElement, id: string) => dpad.querySelector<HTMLButtonElement>(`#pad-${id}`)!;

  it('renders five real buttons with names for screen readers, in a labelled group', async () => {
    const dpad = await mount<CDpad>('c-dpad');
    expect(dpad.querySelector('[role=group]')?.getAttribute('aria-label')).toBe('Steuerkreuz');
    expect(['up', 'left', 'ok', 'right', 'down'].map((id) => key(dpad, id).getAttribute('aria-label'))).toEqual([
      'Nach oben',
      'Nach links',
      'Bestätigen',
      'Nach rechts',
      'Nach unten',
    ]);
    expect(dpad.querySelectorAll('button').length).toBe(5);
  });

  it('dims a key by disabling it and saying so, instead of removing it', async () => {
    const dpad = await mount<CDpad>('c-dpad', { left: 'dim', right: 'dim' });
    expect(key(dpad, 'left').disabled).toBe(true);
    expect(key(dpad, 'left').getAttribute('aria-disabled')).toBe('true');
    expect(key(dpad, 'up').disabled).toBe(false);
    expect(dpad.querySelectorAll('button').length).toBe(5);
    await update(dpad, { left: 'on' });
    expect(key(dpad, 'left').disabled).toBe(false);
  });

  it('shows "Zurück" on OK with the same name for screen readers when the page is left with it', async () => {
    const dpad = await mount<CDpad>('c-dpad', { okLabel: 'Zurück' });
    expect(key(dpad, 'ok').textContent).toBe('Zurück');
    expect(key(dpad, 'ok').getAttribute('aria-label')).toBe('Zurück');
  });

  it('keeps every key at least 44 px by its size classes', async () => {
    const dpad = await mount<CDpad>('c-dpad');
    for (const id of ['up', 'down', 'left', 'right', 'ok']) expect(key(dpad, id).className).toContain('size-[max(44px,');
  });
});
