import { describe, expect, it } from 'vitest';
import { compileTrack } from '../../src/shared/audio/music/musicPlayer';
import { midiToFrequency, noteToMidi, parseBass, parseChord, parseMelody, parseRhythm } from '../../src/shared/audio/music/notation';
import { MUSIC_TRACKS } from '../../src/shared/audio/music/tracks';
import { GAMES } from '../../src/party/games';

describe('the note language', () => {
  it('reads notes with sharps and flats', () => {
    expect(noteToMidi('c4')).toBe(60);
    expect(noteToMidi('a4')).toBe(69);
    expect(noteToMidi('c#5')).toBe(73);
    expect(noteToMidi('bb4')).toBe(70);
    expect(noteToMidi('g5^')).toBe(79);
    expect(noteToMidi('-')).toBeNull();
    expect(midiToFrequency(69)).toBeCloseTo(440);
  });

  it('builds chords around middle C with the root in the bass octave', () => {
    const am = parseChord('Am');
    expect(am.root).toBe(45);
    expect(am.tones.map((tone) => tone % 12)).toEqual([9, 0, 4]);
    expect(parseChord('Bbmaj7').tones).toHaveLength(4);
    expect(() => parseChord('Xm9')).toThrow();
  });

  it('holds a note over the dashes after it and marks a meow', () => {
    const notes = parseMelody('a4 - - . c5 - . . . . . . g5^ - - -');
    expect(notes).toEqual([
      { step: 0, midi: 69, steps: 3, meow: false },
      { step: 4, midi: 72, steps: 2, meow: false },
      { step: 12, midi: 79, steps: 4, meow: true },
    ]);
  });

  it('plays the bass on the tones of the chord', () => {
    const notes = parseBass('1 . 3 . 5 . 8 . . . . . . . . .', parseChord('C'));
    expect(notes.map((note) => note.midi)).toEqual([36, 40, 43, 48]);
  });

  it('refuses a bar that is not sixteen steps long', () => {
    expect(() => parseRhythm('x . x')).toThrow();
  });
});

describe('the tracks', () => {
  it.each(Object.entries(MUSIC_TRACKS))('%s is written correctly: one melody bar per chord, every bar sixteen steps', (_id, track) => {
    expect(track.melody).toHaveLength(track.chords.length);
    expect(() => compileTrack(track)).not.toThrow();
  });

  it('every melody note lies in a singable range', () => {
    const notes = Object.values(MUSIC_TRACKS).flatMap((track) => track.melody.flatMap((bar) => parseMelody(bar)));
    expect(Math.min(...notes.map((note) => note.midi))).toBeGreaterThanOrEqual(60);
    expect(Math.max(...notes.map((note) => note.midi))).toBeLessThanOrEqual(86);
  });

  it('every game has its music', () => {
    for (const game of GAMES) expect(MUSIC_TRACKS[game.music]).toBeDefined();
  });
});
