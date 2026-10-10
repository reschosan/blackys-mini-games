// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/shared/ui/components/index';
import '../../../src/shared/ui/components/cAlertBanner';
import '../../../src/shared/ui/components/cPanel';
import '../../../src/shared/ui/components/cScreen';
import '../../../src/shared/ui/components/cScroll';
import '../../../src/shared/ui/components/cStack';
import '../../../src/shared/ui/components/cText';
import type { CHeader } from '../../../src/shared/ui/components/cHeader';
import type { CChip } from '../../../src/shared/ui/components/cChip';
import type { CPerfReadout } from '../../../src/shared/ui/components/cPerfReadout';
import { mount, update } from './mount';

afterEach(() => document.body.replaceChildren());

describe('c-header', () => {
  it('sets role and ARIA level, level 1 is the default', async () => {
    const header = await mount<CHeader>('c-header', {}, 'Titel');
    expect(header.getAttribute('role')).toBe('heading');
    expect(header.getAttribute('aria-level')).toBe('1');
  });

  it.each([
    [0, '1'],
    [2, '2'],
    [4, '4'],
    [9, '6'],
  ])('clamps level %s to ARIA level %s', async (level, expected) => {
    const header = await mount<CHeader>('c-header', { level });
    expect(header.getAttribute('aria-level')).toBe(expected);
  });

  it('greys out with the muted tone and takes it back', async () => {
    const header = await mount<CHeader>('c-header', { tone: 'muted' });
    expect(header.classList.contains('text-muted!')).toBe(true);
    await update(header, { tone: 'default' });
    expect(header.classList.contains('text-muted!')).toBe(false);
  });
});

describe('c-text', () => {
  it('uses the default tone and size, and adds spacing and width only when asked', async () => {
    const text = await mount('c-text', {}, 'Hallo');
    expect(text.classList.contains('text-ink')).toBe(true);
    expect(text.classList.contains('text-base')).toBe(true);
    expect(text.classList.contains('leading-relaxed')).toBe(false);
    await update(text as never, { tone: 'muted', size: 's', relaxed: true, measure: 'prose' });
    expect(text.classList.contains('text-muted')).toBe(true);
    expect(text.classList.contains('text-ink')).toBe(false);
    expect(text.classList.contains('leading-relaxed')).toBe(true);
    expect(text.classList.contains('max-w-[40rem]')).toBe(true);
  });

  it('falls back to the default tone for an unknown value', async () => {
    const text = await mount('c-text', { tone: 'sparkly' });
    expect(text.classList.contains('text-ink')).toBe(true);
  });
});

describe('c-stack', () => {
  it('lines children up in a column without gap by default', async () => {
    const stack = await mount('c-stack');
    for (const name of ['flex', 'flex-col', 'gap-0', 'items-stretch', 'justify-start', 'p-0']) expect(stack.classList.contains(name), name).toBe(true);
  });

  it('applies direction, gap, alignment, padding and the orientation adaptations', async () => {
    const stack = await mount('c-stack', {
      direction: 'row',
      gap: 'm',
      align: 'center',
      justify: 'between',
      padding: 'l',
      grow: true,
      adapt: 'columnInPortrait tightInPortrait',
    });
    for (const name of ['flex-row', 'gap-4', 'items-center', 'justify-between', 'p-6', 'flex-1', 'portrait:flex-col', 'portrait:p-2'])
      expect(stack.classList.contains(name), name).toBe(true);
  });

  it('ignores an unknown adaptation instead of adding a broken class', async () => {
    const stack = await mount('c-stack', { adapt: 'doesNotExist' });
    expect(stack.className).not.toContain('doesNotExist');
  });
});

describe('c-chip', () => {
  it('paints a colour chip with the given colour and clears it for other modes', async () => {
    const chip = await mount<CChip>('c-chip', { mode: 'color', color: 'rgb(1, 2, 3)' }, 'Katze 1');
    expect(chip.style.background).toContain('rgb(1, 2, 3)');
    await update(chip, { mode: 'success' });
    expect(chip.style.background).toBe('');
    expect(chip.classList.contains('bg-success/25')).toBe(true);
  });

  it('fades with dim and rings with outlined', async () => {
    const chip = await mount<CChip>('c-chip', { dim: true, outlined: true });
    expect(chip.classList.contains('opacity-55')).toBe(true);
    expect(chip.classList.contains('ring-2')).toBe(true);
  });
});

describe('small surfaces', () => {
  it('c-screen is dim by default and opaque with the solid tone', async () => {
    const screen = await mount('c-screen');
    expect(screen.classList.contains('bg-surface/92')).toBe(true);
    await update(screen as never, { tone: 'solid' });
    expect(screen.classList.contains('bg-surface')).toBe(true);
    expect(screen.classList.contains('bg-surface/92')).toBe(false);
  });

  it('c-scroll scrolls vertically and always shows its scrollbar', async () => {
    const scroll = await mount('c-scroll');
    expect(scroll.classList.contains('overflow-y-auto')).toBe(true);
    expect(scroll.className).toContain('[&::-webkit-scrollbar]:w-2');
  });

  it('c-alert-banner sits higher when raised above another banner', async () => {
    const banner = await mount('c-alert-banner', {}, 'Gamepad getrennt');
    expect(banner.className).toContain('bottom-[max(1.5rem');
    await update(banner as never, { raised: true });
    expect(banner.className).toContain('bottom-[max(5.5rem');
  });

  it('c-panel is a boxed column', async () => {
    const panel = await mount('c-panel');
    expect(panel.classList.contains('flex-col')).toBe(true);
    expect(panel.classList.contains('rounded-xl')).toBe(true);
  });
});

describe('c-perf-readout', () => {
  it('sits in the corner above everything, never takes a click and shows the frame rate', async () => {
    const readout = await mount<CPerfReadout>('c-perf-readout', { headline: '30 FPS' });
    expect(readout.textContent).toContain('30 FPS');
    for (const name of ['pointer-events-none', 'absolute', 'z-30']) expect(readout.classList.contains(name)).toBe(true);
    expect([...readout.classList].some((name) => name.startsWith('bottom-[max(0.5rem,env(safe-area-inset-bottom))]'))).toBe(true);
    expect(readout.getAttribute('role')).toBe('status');
  });

  it('turns amber with the slow tone and takes it back', async () => {
    const readout = await mount<CPerfReadout>('c-perf-readout', { headline: '15 FPS', tone: 'slow' });
    expect(readout.querySelector('span')?.classList.contains('text-warn')).toBe(true);
    await update(readout, { tone: 'smooth' });
    expect(readout.querySelector('span')?.classList.contains('text-warn')).toBe(false);
    expect(readout.querySelector('span')?.classList.contains('text-ink')).toBe(true);
  });
});
