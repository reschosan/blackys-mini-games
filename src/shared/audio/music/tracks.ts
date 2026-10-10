/** The music of the party, written in the note language of `notation.ts` and played by the synthesizer (`musicPlayer.ts`): no files,
 *  no licence questions. Every track loops; drums, bass and chord hits repeat each bar, chords and melody go bar by bar. */

export type MusicTrackId = 'lobby' | 'zoomies' | 'arena' | 'memory' | 'jets';

/** How the chords sound: a soft electric piano, short off-beat stabs, a held pad, or plucked like strings. */
export type ChordSound = 'keys' | 'stab' | 'pad' | 'pluck';

/** The voice of the melody. */
export type LeadSound = 'bell' | 'chip' | 'pluck' | 'synth';

export interface MusicTrack {
  readonly bpm: number;
  /** How late every second sixteenth comes, as a share of a sixteenth: 0 is straight, about 0.2 swings. */
  readonly swing: number;
  /** One chord per bar. */
  readonly chords: readonly string[];
  readonly drums: { readonly kick: string; readonly snare: string; readonly hat: string; readonly openHat?: string };
  readonly bass: string;
  readonly chordHits: string;
  readonly chordSound: ChordSound;
  /** Sixteenths running up and down the chord, if the track has them. */
  readonly arp?: string;
  /** One bar of melody per chord. */
  readonly melody: readonly string[];
  readonly lead: LeadSound;
  /** Loudness of each part, 0 to 1. */
  readonly mix: { readonly drums: number; readonly bass: number; readonly chords: number; readonly lead: number; readonly arp: number };
}

export const MUSIC_TRACKS: Readonly<Record<MusicTrackId, MusicTrack>> = {
  /** "Sofakissen": lazy lo-fi groove for the lobby, swung, electric piano and a bell melody. */
  lobby: {
    bpm: 92,
    swing: 0.2,
    chords: ['Fmaj7', 'Em7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7'],
    drums: {
      kick: 'x . . . . . . x . . x . . . . .',
      snare: '. . . . x . . . . . . . x . . .',
      hat: 'x . x . x . x . x . x . x . x x',
    },
    bass: '1 - - . . . 5 . 8 - . . 5 . 3 .',
    chordHits: 'x . . . . . x . . . . . . . . .',
    chordSound: 'keys',
    melody: [
      '. . . . a4 - c5 - e5 - - - d5 - c5 -',
      'b4 - - - g4 - - - . . e4 - g4 - b4 -',
      'a4 - - - f4 - a4 - c5 - - - . . . .',
      'b4 - a4 - g4 - f4 - d4 - - - . . . .',
      '. . e5 - g5 - e5 - d5 - c5 - b4 - c5 -',
      'a4 - - - . . c5 - e5 - a5 - g5 - e5 -',
      'f5 - e5 - d5 - c5 - a4 - - - c5 - d5 -',
      'b4 - - - - - - - . . . . g5^ - - -',
    ],
    lead: 'bell',
    mix: { drums: 0.55, bass: 0.7, chords: 0.5, lead: 0.45, arp: 0 },
  },
  /** "Zoomies": fast surf-pop for the races, four on the floor, off-beat stabs, a chiptune hook. */
  zoomies: {
    bpm: 150,
    swing: 0,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E7'],
    drums: {
      kick: 'x . . . x . . . x . . . x . . .',
      snare: '. . . . x . . . . . . . x . . x',
      hat: 'x x x . x x x . x x x . x x x .',
      openHat: '. . . x . . . x . . . x . . . x',
    },
    bass: '1 . 8 . 1 . 8 . 1 . 8 . 5 . 8 .',
    chordHits: '. . x . . . x . . . x . . . x .',
    chordSound: 'stab',
    melody: [
      'e5 - e5 - a5 - g5 - e5 - d5 - c5 - d5 -',
      'e5 - - - c5 - a4 - c5 - - - . . . .',
      'g5 - g5 - e5 - g5 - c6 - b5 - g5 - e5 -',
      'd5 - - - b4 - d5 - g5 - - - . . . .',
      'e5 - e5 - a5 - g5 - e5 - d5 - c5 - d5 -',
      'e5 - - - f5 - e5 - c5 - a4 - c5 - - -',
      'b4 - d5 - g5 - f5 - d5 - b4 - g4 - b4 -',
      'g#4 - - - b4 - - - e5^ - - - . . . .',
    ],
    lead: 'chip',
    mix: { drums: 0.7, bass: 0.75, chords: 0.4, lead: 0.42, arp: 0 },
  },
  /** "Kratzbaum-Party": a bouncy funk groove for the games in the arenas and on the lava floor. */
  arena: {
    bpm: 124,
    swing: 0.12,
    chords: ['Dm7', 'Dm7', 'G7', 'G7', 'Bbmaj7', 'A7', 'Dm7', 'A7'],
    drums: {
      kick: 'x . . x . . x . . . x . . x . .',
      snare: '. . . . x . . . . . . . x . . x',
      hat: 'x . x x x . x x x . x x x . x x',
      openHat: '. . . . . . . . . . . . . . x .',
    },
    bass: '1 . . 1 . 5 . . 8 . . 1 . 5 3 .',
    chordHits: '. . . . x . . x . . . . x . . .',
    chordSound: 'keys',
    melody: [
      'd5 - f5 - . a5 - . g5 f5 d5 - . . . .',
      '. . . . c5 - d5 - f5 - d5 - . . . .',
      'b4 - d5 - . f5 - . e5 d5 b4 - . . . .',
      '. . . . g4 - b4 - d5 - - - f5^ - - -',
      'd5 - f5 - . a5 - . bb5 a5 f5 - . . . .',
      'c#5 - e5 - g5 - e5 - c#5 - a4 - . . . .',
      'd5 - f5 - a5 - d6 - c6 - a5 - f5 - d5 -',
      'e5 - - - c#5 - - - a5^ - - - . . . .',
    ],
    lead: 'synth',
    mix: { drums: 0.65, bass: 0.8, chords: 0.4, lead: 0.38, arp: 0 },
  },
  /** "thinking cat": a light, tiptoeing tune for memory, plucked, with room to think. */
  memory: {
    bpm: 100,
    swing: 0.18,
    chords: ['C', 'Am', 'F', 'G'],
    drums: {
      kick: 'x . . . . . . . x . . . . . . .',
      snare: '. . . . . . . . . . . . . . . .',
      hat: '. . x . . . x . . . x . . . x .',
    },
    bass: '1 . . . . . . . 5 . . . . . . .',
    chordHits: 'x . . . x . . . x . . . x . . .',
    chordSound: 'pluck',
    melody: [
      'e5 . g5 . c6 . . . g5 . e5 . g5 . . .',
      'a5 . . . e5 . c5 . e5 . a5 . . . . .',
      'f5 . a5 . c6 . . . a5 . f5 . a5 . . .',
      'g5 . . . d5 . b4 . d5 . f5 . g5^ - . .',
    ],
    lead: 'pluck',
    mix: { drums: 0.5, bass: 0.75, chords: 0.5, lead: 0.6, arp: 0 },
  },
  /** "Fellblitz": driving synthwave for the fighter jets, a running arpeggio under long notes. */
  jets: {
    bpm: 140,
    swing: 0,
    chords: ['Em', 'C', 'G', 'D'],
    drums: {
      kick: 'x . . . x . . . x . . . x . . .',
      snare: '. . . . x . . . . . . . x . . .',
      hat: '. . x . . . x . . . x . . . x .',
    },
    bass: '1 1 8 1 1 1 8 1 1 1 8 1 1 1 8 1',
    chordHits: 'x . . . . . . . . . . . . . . .',
    chordSound: 'pad',
    arp: 'x x x x x x x x x x x x x x x x',
    melody: [
      'b4 - - - - - e5 - - - g5 - - - f#5 -',
      'e5 - - - - - - - . . c5 - e5 - g5 -',
      'd5 - - - - - b4 - - - d5 - g5 - a5 -',
      'f#5 - - - - - - - a5^ - - - . . . .',
    ],
    lead: 'synth',
    mix: { drums: 0.65, bass: 0.6, chords: 0.3, lead: 0.4, arp: 0.25 },
  },
};
