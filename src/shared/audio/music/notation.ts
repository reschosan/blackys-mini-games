/** The little note language the music tracks are written in, turned into numbers the player can schedule.
 *  A bar is 16 tokens (sixteenth notes), separated by spaces:
 *  - melody: a note like `a4`, `c#5`, `bb4` starts a tone, `-` holds the one before, `.` is silence, and a trailing `^` turns the
 *    note into a "meow" (it slides up and back down);
 *  - rhythm: `x` hits, anything else is silence;
 *  - bass: `1`, `3`, `5`, `7` are that tone of the bar's chord, `8` is the root an octave up, `-` holds, `.` is silence. */

export const STEPS_PER_BAR = 16;

const NOTE_OFFSETS: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

const CHORD_INTERVALS: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};

/** A tone of a melody: its MIDI number, how many steps it lasts, and whether it meows. */
export interface MelodyNote {
  readonly step: number;
  readonly midi: number;
  readonly steps: number;
  readonly meow: boolean;
}

export interface Chord {
  /** MIDI number of the root in the bass octave (C2 to B2). */
  readonly root: number;
  /** The tones of the chord voiced around middle C. */
  readonly tones: readonly number[];
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** `#` raises and `b` lowers by a semitone. */
function accidentalOf(sign: string | undefined): number {
  if (sign === '#') return 1;
  return sign === 'b' ? -1 : 0;
}

/** `c4` is 60, `a4` is 69. */
export function noteToMidi(note: string): number | null {
  const match = /^([a-g])(#|b)?(\d)\^?$/.exec(note);
  if (!match) return null;
  return (Number(match[3]) + 1) * 12 + NOTE_OFFSETS[match[1]!]! + accidentalOf(match[2]);
}

/** `Am`, `F`, `G7`, `Fmaj7`, `Bbmaj7`, `F#m7` … */
export function parseChord(name: string): Chord {
  const match = /^([A-G])(#|b)?(.*)$/.exec(name);
  const intervals = match ? CHORD_INTERVALS[match[3]!] : undefined;
  if (!match || !intervals) throw new Error(`unknown chord: ${name}`);
  const pitchClass = (NOTE_OFFSETS[match[1]!.toLowerCase()]! + accidentalOf(match[2]) + 12) % 12;
  const voicingRoot = 55 + ((pitchClass - 7 + 12) % 12);
  return { root: 36 + pitchClass, tones: intervals.map((interval) => voicingRoot + interval) };
}

function tokensOf(bar: string): readonly string[] {
  const tokens = bar.trim().split(/\s+/);
  if (tokens.length !== STEPS_PER_BAR) throw new Error(`a bar needs ${STEPS_PER_BAR} steps: ${bar}`);
  return tokens;
}

/** How many steps a tone starting at `start` lasts: itself and every `-` after it. */
function lengthFrom(tokens: readonly string[], start: number): number {
  let end = start + 1;
  while (tokens[end] === '-') end += 1;
  return end - start;
}

export function parseMelody(bar: string): readonly MelodyNote[] {
  const tokens = tokensOf(bar);
  return tokens.flatMap((token, step) => {
    const midi = noteToMidi(token);
    return midi === null ? [] : [{ step, midi, steps: lengthFrom(tokens, step), meow: token.endsWith('^') }];
  });
}

export function parseRhythm(bar: string): readonly boolean[] {
  return tokensOf(bar).map((token) => token === 'x');
}

const BASS_DEGREES: Readonly<Record<string, (chord: Chord) => number>> = {
  '1': (chord) => chord.root,
  '3': (chord) => chord.root + (chord.tones[1]! - chord.tones[0]!),
  '5': (chord) => chord.root + 7,
  '7': (chord) => chord.root + (chord.tones[3] ?? chord.tones[0]! + 10) - chord.tones[0]!,
  '8': (chord) => chord.root + 12,
};

/** The bass line of one bar over its chord. */
export function parseBass(bar: string, chord: Chord): readonly MelodyNote[] {
  const tokens = tokensOf(bar);
  return tokens.flatMap((token, step) => {
    const degree = BASS_DEGREES[token];
    return degree ? [{ step, midi: degree(chord), steps: lengthFrom(tokens, step), meow: false }] : [];
  });
}
