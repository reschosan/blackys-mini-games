import type { AudioConfig } from '../../config/audio';

const STORAGE_KEY = 'blackys-mini-games:audio';

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;
}

export function loadAudioSettings(defaults: AudioConfig, storage: Storage = window.localStorage): AudioConfig {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as Partial<AudioConfig>;
    return {
      ...defaults,
      muted: typeof saved.muted === 'boolean' ? saved.muted : defaults.muted,
      musicVolume: volume(saved.musicVolume, defaults.musicVolume),
      sfxVolume: volume(saved.sfxVolume, defaults.sfxVolume),
      engineVolume: volume(saved.engineVolume, defaults.engineVolume),
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAudioSettings(audio: AudioConfig, storage: Storage = window.localStorage): void {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ muted: audio.muted, musicVolume: audio.musicVolume, sfxVolume: audio.sfxVolume, engineVolume: audio.engineVolume }),
  );
}
