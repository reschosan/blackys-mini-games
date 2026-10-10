// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/shared/ui/components/cQrCode';
import { qrModulePath } from '../../src/shared/ui/components/cQrCode';
import { mount } from './components/mount';

afterEach(() => document.body.replaceChildren());

describe('QR code', () => {
  it('draws black modules inside a quiet zone of four modules', () => {
    const { path, size } = qrModulePath('https://example.com/join.html#o=abc');
    expect(path.startsWith('M')).toBe(true);
    const columns = [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((match) => Number(match[1]));
    expect(Math.min(...columns)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...columns)).toBeLessThan(size - 4);
  });

  it('is bigger for more text and the same for the same text', () => {
    expect(qrModulePath('a'.repeat(900)).size).toBeGreaterThan(qrModulePath('a').size);
    expect(qrModulePath('same')).toEqual(qrModulePath('same'));
  });

  it('shows as a labelled image, and nothing without a value', async () => {
    const empty = await mount('c-qr-code');
    expect(empty.querySelector('svg')).toBeNull();
    const code = await mount('c-qr-code', { value: 'hello', label: 'Code zum Beitreten' });
    expect(code.querySelector('svg')?.getAttribute('aria-label')).toBe('Code zum Beitreten');
  });
});
