export interface AudioConfig {
  muted: boolean;
  /** Overall multiplier applied on top of `sfxVolume`/`engineVolume`. */
  masterVolume: number;
  /** Volume for one-shot effects (drift, boost, collision, items, menu). */
  sfxVolume: number;
  /** Volume for the continuous, per-kart engine hum. */
  engineVolume: number;
  /** Volume for the procedural lobby background music, separate from `sfxVolume`. */
  musicVolume: number;
}

const DEFAULT_AUDIO: Readonly<AudioConfig> = Object.freeze({
  muted: true,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  engineVolume: 0.6,
  musicVolume: 0.5,
} satisfies AudioConfig);

export function createRuntimeAudio(): AudioConfig {
  return { ...DEFAULT_AUDIO };
}

export function resetRuntimeAudio(target: AudioConfig): void {
  Object.assign(target, createRuntimeAudio());
}
