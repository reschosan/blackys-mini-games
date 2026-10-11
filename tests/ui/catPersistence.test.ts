import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { loadCatAppearance, saveCatAppearance } from '../../src/party/lobby/catPersistence';

function stubStorage(initial: Record<string, string> = {}): Record<string, string> {
  const store = { ...initial };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('saved cat appearance', () => {
  it('keeps a long-haired cat across a reload', () => {
    stubStorage();
    const appearance = { ...createCatAppearance(), hairLength: 'long' as const };
    saveCatAppearance('gamepad:0', appearance);
    expect(loadCatAppearance('gamepad:0')).toEqual(appearance);
  });

  it('treats a cat saved before hair length and mane existed as short-haired without a mane', () => {
    const { hairLength: _hairLength, mane: _mane, ...oldFormat } = createCatAppearance();
    stubStorage({ 'blackys-mini-games:cat:gamepad:0': JSON.stringify(oldFormat) });
    expect(loadCatAppearance('gamepad:0')).toEqual({ ...oldFormat, hairLength: 'short', mane: 'none' });
  });

  it('keeps a mane across a reload and rejects an unknown one', () => {
    stubStorage();
    const appearance = { ...createCatAppearance(), mane: 'lion' as const };
    saveCatAppearance('gamepad:0', appearance);
    expect(loadCatAppearance('gamepad:0')).toEqual(appearance);

    stubStorage({ 'blackys-mini-games:cat:gamepad:0': JSON.stringify({ ...createCatAppearance(), mane: 'mohawk' }) });
    expect(loadCatAppearance('gamepad:0')).toBeNull();
  });

  it('rejects a saved cat with an unknown hair length', () => {
    stubStorage({ 'blackys-mini-games:cat:gamepad:0': JSON.stringify({ ...createCatAppearance(), hairLength: 'fluffy' }) });
    expect(loadCatAppearance('gamepad:0')).toBeNull();
  });

  it('hands the saved name back as it was saved', () => {
    stubStorage();
    saveCatAppearance('gamepad:0', { ...createCatAppearance(), name: 'Mauzi' });
    expect(loadCatAppearance('gamepad:0')?.name).toBe('Mauzi');
  });

  it('stores the appearance without any extra marker', () => {
    stubStorage();
    saveCatAppearance('gamepad:0', createCatAppearance());
    expect(loadCatAppearance('gamepad:0')).toEqual(createCatAppearance());
  });
});
