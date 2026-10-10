import type { AudioConfig } from '../../config/audio';
import { midiToFrequency, parseBass, parseChord, parseMelody, parseRhythm, STEPS_PER_BAR, type Chord, type MelodyNote } from './notation';
import { MUSIC_TRACKS, type MusicTrack, type MusicTrackId } from './tracks';
import { arpNote, bass, chordTone, hat, kick, lead, snare, type VoiceOutput } from './voices';

const SCHEDULE_AHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 25;
const ECHO_STEPS = 3;
const ECHO_FEEDBACK = 0.28;
const ECHO_LEVEL = 0.3;

interface CompiledBar {
  readonly chord: Chord;
  readonly melody: ReadonlyMap<number, MelodyNote>;
  readonly bass: ReadonlyMap<number, MelodyNote>;
}

interface CompiledTrack {
  readonly source: MusicTrack;
  readonly bars: readonly CompiledBar[];
  readonly kick: readonly boolean[];
  readonly snare: readonly boolean[];
  readonly hat: readonly boolean[];
  readonly openHat: readonly boolean[];
  readonly chordHits: readonly boolean[];
  readonly arp: readonly boolean[];
}

const byStep = (notes: readonly MelodyNote[]): ReadonlyMap<number, MelodyNote> => new Map(notes.map((note) => [note.step, note]));
const NO_HITS = parseRhythm('. . . . . . . . . . . . . . . .');

/** Turns the written track into what the scheduler reads every step. */
export function compileTrack(track: MusicTrack): CompiledTrack {
  return {
    source: track,
    bars: track.chords.map((name, bar) => {
      const chord = parseChord(name);
      return { chord, melody: byStep(parseMelody(track.melody[bar]!)), bass: byStep(parseBass(track.bass, chord)) };
    }),
    kick: parseRhythm(track.drums.kick),
    snare: parseRhythm(track.drums.snare),
    hat: parseRhythm(track.drums.hat),
    openHat: track.drums.openHat ? parseRhythm(track.drums.openHat) : NO_HITS,
    chordHits: parseRhythm(track.chordHits),
    arp: track.arp ? parseRhythm(track.arp) : NO_HITS,
  };
}

/** Plays one track at a time in a loop, with the Web Audio "lookahead scheduler": a timer looks a little ahead of the audio clock and
 *  schedules every sound at its exact time, which `setTimeout` alone could not. While the sound is off nothing is scheduled. */
export class MusicPlayer {
  private readonly output: VoiceOutput;
  private track: CompiledTrack | null = null;
  private playingId: MusicTrackId | null = null;
  private step = 0;
  private nextStepTime = 0;
  private timerId: number | null = null;
  private readonly echo: DelayNode;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly config: AudioConfig,
  ) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(destination);
    this.echo = ctx.createDelay(1);
    const feedback = ctx.createGain();
    feedback.gain.value = ECHO_FEEDBACK;
    const wet = ctx.createGain();
    wet.gain.value = ECHO_LEVEL;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(compressor);
    this.output = { ctx, out: compressor, echo: this.echo };
  }

  play(id: MusicTrackId): void {
    if (this.playingId === id) return;
    this.stop();
    this.playingId = id;
    this.track = compileTrack(MUSIC_TRACKS[id]);
    this.echo.delayTime.value = this.stepSeconds() * ECHO_STEPS;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.timerId = window.setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  stop(): void {
    this.playingId = null;
    this.track = null;
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private stepSeconds(): number {
    return 60 / (this.track?.source.bpm ?? 120) / 4;
  }

  private schedule(): void {
    const track = this.track;
    if (!track) return;
    const now = this.ctx.currentTime;
    // A hidden tab runs the timer late: skip what was missed instead of playing it all at once.
    if (this.nextStepTime < now - 0.05) this.nextStepTime = now + 0.02;
    while (this.nextStepTime < now + SCHEDULE_AHEAD_SECONDS) {
      if (!this.config.muted) this.scheduleStep(track, this.step, this.swungTime(this.step));
      this.nextStepTime += this.stepSeconds();
      this.step = (this.step + 1) % (track.bars.length * STEPS_PER_BAR);
    }
  }

  private swungTime(step: number): number {
    return this.nextStepTime + (step % 2 === 1 ? (this.track?.source.swing ?? 0) * this.stepSeconds() : 0);
  }

  private level(part: keyof MusicTrack['mix']): number {
    return (this.track?.source.mix[part] ?? 0) * this.config.musicVolume * this.config.masterVolume;
  }

  private scheduleStep(track: CompiledTrack, step: number, time: number): void {
    const bar = track.bars[Math.floor(step / STEPS_PER_BAR)]!;
    const inBar = step % STEPS_PER_BAR;
    this.scheduleDrums(track, inBar, time);
    this.scheduleHarmony(track, bar, inBar, time);
    const note = bar.melody.get(inBar);
    if (note) lead(this.output, track.source.lead, midiToFrequency(note.midi), time, note.steps * this.stepSeconds(), this.level('lead') * 0.5, note.meow);
  }

  private scheduleDrums(track: CompiledTrack, inBar: number, time: number): void {
    const drums = this.level('drums');
    if (track.kick[inBar]) kick(this.output, time, drums);
    if (track.snare[inBar]) snare(this.output, time, drums * 0.6);
    if (track.openHat[inBar]) hat(this.output, time, drums * 0.18, true);
    else if (track.hat[inBar]) hat(this.output, time, drums * (inBar % 4 === 2 ? 0.16 : 0.1), false);
  }

  private scheduleHarmony(track: CompiledTrack, bar: CompiledBar, inBar: number, time: number): void {
    const bassNote = bar.bass.get(inBar);
    if (bassNote) bass(this.output, midiToFrequency(bassNote.midi), time, bassNote.steps * this.stepSeconds(), this.level('bass') * 0.45);
    if (track.chordHits[inBar]) {
      const seconds = this.stepSeconds() * STEPS_PER_BAR * 0.45;
      for (const tone of bar.chord.tones) chordTone(this.output, track.source.chordSound, midiToFrequency(tone), time, seconds, this.level('chords') * 0.14);
    }
    if (track.arp[inBar]) {
      const tones = bar.chord.tones;
      const tone = tones[inBar % tones.length]! + (Math.floor(inBar / tones.length) % 2) * 12;
      arpNote(this.output, midiToFrequency(tone), time, this.level('arp') * 0.2);
    }
  }
}
