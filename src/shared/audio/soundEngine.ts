import type { AudioConfig } from '../config/audio';
import type { ItemType } from '../config/items';
import { MusicPlayer } from './music/musicPlayer';
import type { MusicTrackId } from './music/tracks';

/** The events that count as a user gesture for the autoplay policy; a finger going down (`pointerdown`) is none, lifting it is. */
const GESTURES = ['pointerup', 'keydown'] as const;

interface EngineVoice {
  readonly osc: OscillatorNode;
  readonly gain: GainNode;
}

/**
 * All sound effects are synthesized at runtime with the Web Audio API (oscillators + generated
 * noise buffers) instead of shipped audio files — zero bundle weight, zero licensing to map.
 * `Math.random()` for noise generation is intentional (see architecture rules): this is a purely
 * cosmetic side effect that only ever reads simulation state, never the deterministic sim RNG.
 *
 * The context is created lazily via `unlock()`, called on the first user gesture, per the browser
 * autoplay policy — nothing plays before that.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private readonly engines = new Map<number, EngineVoice>();
  private music: MusicPlayer | null = null;
  /** The track asked for before the first gesture unlocked the sound; it starts with the unlock. The game opens in the lobby. */
  private wantedMusic: MusicTrackId | null = 'lobby';

  constructor(private readonly config: AudioConfig) {}

  get isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = this.config.muted ? 0 : 1;
    this.bus.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.config.muted ? 0 : 1;
    this.musicBus.connect(this.ctx.destination);
    this.music = new MusicPlayer(this.ctx, this.musicBus, this.config);
    if (this.wantedMusic) this.music.play(this.wantedMusic);
  }

  setMuted(muted: boolean): void {
    this.config.muted = muted;
    if (this.ctx && this.bus && this.musicBus) {
      const gain = muted ? 0 : 1;
      this.bus.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
      this.musicBus.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
    }
  }

  /** Switches to a track (the lobby's, or the one of the game being played); the same track keeps playing where it is. */
  playMusic(track: MusicTrackId): void {
    this.wantedMusic = track;
    this.music?.play(track);
  }

  stopMusic(): void {
    this.wantedMusic = null;
    this.music?.stop();
  }

  private sfxGain(level: number): number {
    return level * this.config.sfxVolume * this.config.masterVolume;
  }

  private envelope(peak: number, duration: number, attack: number): GainNode {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    return gain;
  }

  private tone(frequencyStart: number, frequencyEnd: number, duration: number, type: OscillatorType, level: number): void {
    if (this.config.muted || !this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(frequencyStart, 1), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(frequencyEnd, 1), now + duration);
    const gain = this.envelope(this.sfxGain(level), duration, 0.005);
    osc.connect(gain).connect(this.bus);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private noiseBurst(duration: number, level: number, lowpassFrequency: number): void {
    if (this.config.muted || !this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassFrequency;
    const gain = this.envelope(this.sfxGain(level), duration, 0.002);
    source.connect(filter).connect(gain).connect(this.bus);
    source.start(ctx.currentTime);
  }

  playDriftStart(): void {
    this.tone(220, 260, 0.1, 'square', 0.12);
  }

  playDriftStage(stage: number): void {
    const base = 260 + stage * 90;
    this.tone(base, base * 1.4, 0.16, 'square', 0.16);
  }

  playBoost(): void {
    this.noiseBurst(0.15, 0.22, 2500);
    this.tone(180, 900, 0.35, 'sawtooth', 0.18);
  }

  playCollision(): void {
    this.noiseBurst(0.12, 0.28, 800);
  }

  playItemHit(): void {
    this.noiseBurst(0.18, 0.26, 500);
    this.tone(160, 60, 0.2, 'square', 0.14);
  }

  playItemPickup(): void {
    this.tone(500, 900, 0.12, 'sine', 0.16);
  }

  playItemUse(item: ItemType): void {
    switch (item) {
      case 'boost':
        this.playBoost();
        return;
      case 'hairball':
        this.tone(700, 1400, 0.1, 'square', 0.18);
        return;
      case 'trap':
      case 'cowpat':
        this.tone(220, 90, 0.18, 'triangle', 0.18);
        return;
      case 'nap':
        this.tone(500, 950, 0.35, 'sine', 0.14);
        return;
      case 'catnip':
        this.playBoost();
        this.tone(900, 500, 0.3, 'triangle', 0.12);
        return;
      case 'laser':
        this.tone(1800, 2600, 0.2, 'sine', 0.12);
        return;
      case 'yarn':
        this.tone(520, 320, 0.15, 'triangle', 0.18);
        return;
      case 'vacuum':
        this.noiseBurst(0.5, 0.22, 300);
        this.tone(180, 700, 0.5, 'sawtooth', 0.12);
        return;
      case 'gravity':
        this.tone(700, 150, 0.5, 'sine', 0.16);
        return;
    }
  }

  playTankShot(): void {
    this.noiseBurst(0.12, 0.2, 1500);
    this.tone(260, 90, 0.25, 'sawtooth', 0.2);
  }

  playExplosion(): void {
    this.noiseBurst(0.5, 0.4, 700);
    this.tone(120, 40, 0.45, 'square', 0.22);
  }

  playMenuNavigate(): void {
    this.tone(400, 420, 0.04, 'square', 0.08);
  }

  playMenuConfirm(): void {
    this.tone(500, 800, 0.12, 'square', 0.16);
  }

  playCountdownBeep(): void {
    this.tone(600, 600, 0.08, 'sine', 0.18);
  }

  playGo(): void {
    this.tone(500, 1000, 0.25, 'sawtooth', 0.22);
  }

  /** Starts a kart's continuous engine hum if it isn't already running. No-op before `unlock()`. */
  ensureEngineStarted(kartIndex: number): void {
    if (!this.ctx || !this.bus || this.engines.has(kartIndex)) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.bus);
    osc.start(ctx.currentTime);
    this.engines.set(kartIndex, { osc, gain });
  }

  /** Updates a kart's engine pitch/volume for its current speed (m/s). */
  updateEngine(kartIndex: number, speed: number): void {
    const engine = this.engines.get(kartIndex);
    if (!engine || !this.ctx) return;
    const speedRatio = Math.min(Math.abs(speed) / 25, 1);
    const targetTime = this.ctx.currentTime;
    engine.osc.frequency.setTargetAtTime(70 + speedRatio * 260, targetTime, 0.05);
    const level = this.config.muted ? 0 : (0.025 + speedRatio * 0.05) * this.config.engineVolume * this.config.masterVolume;
    engine.gain.gain.setTargetAtTime(level, targetTime, 0.08);
  }

  stopAllEngines(): void {
    for (const engine of this.engines.values()) engine.osc.stop();
    this.engines.clear();
  }
}

/** Starts the sound with the next user gesture and tries again with every further one until it runs: Safari keeps a context
 *  that was not started inside a gesture suspended. Returns the attempt for moments the page knows are a gesture too. */
export function unlockOnGestures(sound: SoundEngine, onFailure: () => void): () => void {
  let settled = false;
  const attempt = (): void => {
    if (settled) return;
    try {
      sound.unlock();
      settled = sound.isRunning;
    } catch (error) {
      console.error('Audio could not be started', error);
      settled = true;
      onFailure();
    }
    if (settled) GESTURES.forEach((type) => window.removeEventListener(type, attempt, true));
  };
  GESTURES.forEach((type) => window.addEventListener(type, attempt, true));
  return attempt;
}
