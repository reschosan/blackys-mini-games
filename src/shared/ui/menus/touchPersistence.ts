import { TOUCH_CONTROL_MODES, TOUCH_LAYOUTS, type TouchSettings } from '../../config/touch';

const STORAGE_KEY = 'catkart:touch';

export function loadTouchSettings(defaults: TouchSettings, storage: Storage = window.localStorage): TouchSettings {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof saved !== 'object' || saved === null) return defaults;
    const { mode, layout } = saved as Partial<Record<keyof TouchSettings, unknown>>;
    return {
      mode: TOUCH_CONTROL_MODES.find((candidate) => candidate === mode) ?? defaults.mode,
      layout: TOUCH_LAYOUTS.find((candidate) => candidate === layout) ?? defaults.layout,
    };
  } catch {
    return defaults;
  }
}

export function saveTouchSettings(settings: TouchSettings, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable - the choice just does not survive a reload.
  }
}
