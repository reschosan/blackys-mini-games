import { graphicsQualityLabel } from '../../src/shared/i18n/labels';
import { describe, expect, it } from 'vitest';
import { activePreset, createRuntimeGraphics, DEFAULT_GRAPHICS_PRESETS, otherQuality, pixelRatioFor } from '../../src/shared/config/graphics';
import { loadGraphicsSettings, saveGraphicsSettings } from '../../src/shared/ui/menus/graphicsPersistence';
import { keepForShare, spacingForShare } from '../../src/games/kart/maps/shared/view/mapDetail';

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  } as Storage;
}

describe('graphics levels', () => {
  it('has a high level that draws everything and a low level that is lighter on every lever', () => {
    const { high, low } = DEFAULT_GRAPHICS_PRESETS;
    expect(low.pixelRatioCap).toBeLessThan(high.pixelRatioCap);
    expect(low.particleDensity).toBeLessThan(high.particleDensity);
    expect(low.groundCoverShare).toBeLessThan(high.groundCoverShare);
    expect(low.sceneryShare).toBeLessThan(high.sceneryShare);
    expect(high.groundCoverShare).toBe(1);
    expect(high.sceneryShare).toBe(1);
    expect(high.groundDetailMaps).toBe(true);
    expect(low.groundDetailMaps).toBe(false);
  });

  it('caps the pixel ratio of a retina screen by the level', () => {
    expect(pixelRatioFor(DEFAULT_GRAPHICS_PRESETS.high, 2)).toBe(1.5);
    expect(pixelRatioFor(DEFAULT_GRAPHICS_PRESETS.low, 2)).toBe(1);
    expect(pixelRatioFor(DEFAULT_GRAPHICS_PRESETS.low, 0.75)).toBe(0.75);
  });

  it('switches between the two levels and names them for the player', () => {
    expect(otherQuality('high')).toBe('low');
    expect(otherQuality('low')).toBe('high');
    expect(graphicsQualityLabel('high')).toBe('Hoch');
    expect(graphicsQualityLabel('low')).toBe('Niedrig');
  });

  it('gives every runtime copy its own preset values, so tuning one does not change the defaults', () => {
    const graphics = createRuntimeGraphics();
    activePreset({ ...graphics, quality: 'low' }).pixelRatioCap = 0.5;
    expect(DEFAULT_GRAPHICS_PRESETS.low.pixelRatioCap).toBe(1);
  });

  it('thins a ground cover grid by spacing: a quarter of the points means twice the spacing', () => {
    expect(spacingForShare(0.5, 1)).toBe(0.5);
    expect(spacingForShare(0.5, 0.25)).toBe(1);
  });
});

describe('keeping a share of the places', () => {
  it('keeps everything at full share and nothing at zero, and the same places every time', () => {
    const keys = Array.from({ length: 1000 }, (_, index) => index * 7919);
    expect(keys.every((key) => keepForShare(key, 1))).toBe(true);
    expect(keys.some((key) => keepForShare(key, 0))).toBe(false);
    const kept = keys.filter((key) => keepForShare(key, 0.3)).length;
    expect(kept).toBeGreaterThan(250);
    expect(kept).toBeLessThan(350);
    expect(keys.filter((key) => keepForShare(key, 0.3))).toEqual(keys.filter((key) => keepForShare(key, 0.3)));
  });
});

describe('graphics persistence', () => {
  it('remembers the chosen level and ignores unknown stored values', () => {
    const storage = fakeStorage();
    saveGraphicsSettings({ ...createRuntimeGraphics(), quality: 'low' }, storage);
    expect(loadGraphicsSettings(createRuntimeGraphics(), storage).quality).toBe('low');
    expect(loadGraphicsSettings(createRuntimeGraphics(), fakeStorage({ 'blackys-mini-games:graphics': 'ultra' })).quality).toBe(
      createRuntimeGraphics().quality,
    );
  });
});

describe('emergency graphics', () => {
  it('replaces "Niedrig" with a bare-bones preset, and only "Niedrig"', () => {
    const graphics = { ...createRuntimeGraphics(), quality: 'low' as const, emergency: true };
    const preset = activePreset(graphics);
    expect(preset.groundCoverShare).toBe(0);
    expect(preset.sceneryShare).toBeLessThan(DEFAULT_GRAPHICS_PRESETS.low.sceneryShare);
    expect(preset.pixelRatioCap).toBeLessThan(DEFAULT_GRAPHICS_PRESETS.low.pixelRatioCap);
    expect(activePreset({ ...graphics, quality: 'high' })).toEqual(DEFAULT_GRAPHICS_PRESETS.high);
    expect(activePreset({ ...graphics, emergency: false })).toEqual(DEFAULT_GRAPHICS_PRESETS.low);
  });
});
