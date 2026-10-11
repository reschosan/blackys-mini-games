import { GRAPHICS_QUALITIES, type GraphicsConfig } from '../../config/graphics';

const STORAGE_KEY = 'blackys-mini-games:graphics';

export function loadGraphicsSettings(defaults: GraphicsConfig, storage: Storage = window.localStorage): GraphicsConfig {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    const quality = GRAPHICS_QUALITIES.find((candidate) => candidate === saved);
    return quality ? { ...defaults, quality } : defaults;
  } catch {
    return defaults;
  }
}

export function saveGraphicsSettings(graphics: GraphicsConfig, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, graphics.quality);
  } catch {
    // localStorage unavailable - the choice just does not survive a reload.
  }
}
