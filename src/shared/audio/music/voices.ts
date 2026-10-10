import type { ChordSound, LeadSound } from './tracks';

/** The instruments of the music, synthesized from oscillators and noise. Every function schedules one sound at `time` on the
 *  audio clock; `level` already contains the volume settings. Noise is cosmetic randomness, so `Math.random` is fine here. */

export interface VoiceOutput {
  readonly ctx: AudioContext;
  /** The dry mix. */
  readonly out: AudioNode;
  /** The echo send the melody also goes to. */
  readonly echo: AudioNode;
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A gain that rises to `peak` in `attack` seconds and falls away by `release` seconds after the start. */
function envelope(ctx: AudioContext, time: number, peak: number, attack: number, release: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(release, attack + 0.01));
  return gain;
}

function oscillator(ctx: AudioContext, type: OscillatorType, frequency: number, time: number, seconds: number, detuneCents = 0): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  osc.detune.value = detuneCents;
  osc.start(time);
  osc.stop(time + seconds + 0.05);
  return osc;
}

function lowpass(ctx: AudioContext, frequency: number, q = 0.7): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  return filter;
}

function noise(ctx: AudioContext, time: number, seconds: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.start(time, Math.random() * 0.5, seconds + 0.05);
  return source;
}

export function kick({ ctx, out }: VoiceOutput, time: number, level: number): void {
  const osc = oscillator(ctx, 'sine', 150, time, 0.35);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  osc.connect(envelope(ctx, time, level, 0.003, 0.32)).connect(out);
}

export function snare({ ctx, out }: VoiceOutput, time: number, level: number): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1300;
  noise(ctx, time, 0.18)
    .connect(filter)
    .connect(envelope(ctx, time, level * 0.8, 0.002, 0.17))
    .connect(out);
  oscillator(ctx, 'triangle', 190, time, 0.1)
    .connect(envelope(ctx, time, level * 0.5, 0.002, 0.09))
    .connect(out);
}

export function hat({ ctx, out }: VoiceOutput, time: number, level: number, open: boolean): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7500;
  const seconds = open ? 0.24 : 0.045;
  noise(ctx, time, seconds)
    .connect(filter)
    .connect(envelope(ctx, time, level, 0.002, seconds))
    .connect(out);
}

export function bass({ ctx, out }: VoiceOutput, frequency: number, time: number, seconds: number, level: number): void {
  const filter = lowpass(ctx, 900, 4);
  filter.frequency.setValueAtTime(1100, time);
  filter.frequency.exponentialRampToValueAtTime(260, time + Math.min(seconds, 0.25));
  oscillator(ctx, 'sawtooth', frequency, time, seconds)
    .connect(filter)
    .connect(envelope(ctx, time, level, 0.005, seconds * 0.95))
    .connect(out);
}

const CHORD_VOICES: Readonly<Record<ChordSound, (output: VoiceOutput, frequency: number, time: number, seconds: number, level: number) => void>> = {
  keys: ({ ctx, out }, frequency, time, seconds, level) => {
    oscillator(ctx, 'sine', frequency, time, seconds)
      .connect(envelope(ctx, time, level, 0.006, seconds))
      .connect(out);
    oscillator(ctx, 'triangle', frequency * 2, time, 0.3)
      .connect(envelope(ctx, time, level * 0.25, 0.003, 0.3))
      .connect(out);
  },
  stab: ({ ctx, out }, frequency, time, _seconds, level) => {
    oscillator(ctx, 'square', frequency, time, 0.14)
      .connect(lowpass(ctx, 2200))
      .connect(envelope(ctx, time, level * 0.6, 0.004, 0.13))
      .connect(out);
  },
  pad: ({ ctx, out }, frequency, time, seconds, level) => {
    for (const detune of [-8, 8]) {
      oscillator(ctx, 'sawtooth', frequency, time, seconds, detune)
        .connect(lowpass(ctx, 1300))
        .connect(envelope(ctx, time, level * 0.4, 0.35, seconds))
        .connect(out);
    }
  },
  pluck: ({ ctx, out }, frequency, time, _seconds, level) => {
    oscillator(ctx, 'triangle', frequency, time, 0.3)
      .connect(envelope(ctx, time, level, 0.003, 0.28))
      .connect(out);
  },
};

export function chordTone(output: VoiceOutput, sound: ChordSound, frequency: number, time: number, seconds: number, level: number): void {
  CHORD_VOICES[sound](output, frequency, time, seconds, level);
}

const LEAD_WAVES: Readonly<Record<LeadSound, OscillatorType>> = { bell: 'sine', chip: 'square', pluck: 'triangle', synth: 'sawtooth' };
const LEAD_BRIGHTNESS: Readonly<Record<LeadSound, number>> = { bell: 6000, chip: 3200, pluck: 4000, synth: 2400 };

/** A "meow": the pitch slides up and back below the note while the filter opens and closes like a mouth. */
function meow(osc: OscillatorNode, filter: BiquadFilterNode, frequency: number, time: number, seconds: number): void {
  osc.frequency.setValueAtTime(frequency * 0.88, time);
  osc.frequency.exponentialRampToValueAtTime(frequency * 1.22, time + seconds * 0.35);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.8, time + seconds);
  filter.frequency.setValueAtTime(500, time);
  filter.frequency.exponentialRampToValueAtTime(3200, time + seconds * 0.35);
  filter.frequency.exponentialRampToValueAtTime(600, time + seconds);
}

export function lead(output: VoiceOutput, sound: LeadSound, frequency: number, time: number, seconds: number, level: number, meows: boolean): void {
  const { ctx, out, echo } = output;
  const osc = oscillator(ctx, LEAD_WAVES[sound], frequency, time, seconds);
  const filter = lowpass(ctx, LEAD_BRIGHTNESS[sound], meows ? 6 : 0.7);
  const release = sound === 'pluck' || sound === 'bell' ? Math.min(seconds, 0.45) : seconds * 0.95;
  if (meows) meow(osc, filter, frequency, time, seconds);
  else vibrato(ctx, osc, time, seconds);
  const gain = envelope(ctx, time, level, 0.01, release);
  osc.connect(filter).connect(gain);
  gain.connect(out);
  gain.connect(echo);
}

/** Long notes waver a little after a moment, like a singer. */
function vibrato(ctx: AudioContext, osc: OscillatorNode, time: number, seconds: number): void {
  if (seconds < 0.3) return;
  const lfo = oscillator(ctx, 'sine', 5.5, time, seconds);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(12, time + Math.min(seconds, 0.4));
  lfo.connect(depth).connect(osc.detune);
}

export function arpNote({ ctx, out }: VoiceOutput, frequency: number, time: number, level: number): void {
  oscillator(ctx, 'square', frequency, time, 0.1)
    .connect(lowpass(ctx, 1800))
    .connect(envelope(ctx, time, level, 0.003, 0.09))
    .connect(out);
}
