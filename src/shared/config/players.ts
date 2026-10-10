export const MAX_PLAYERS = 4;

export interface PlayerAppearance {
  readonly bodyColor: number;
  /** A shape besides the colour, so seats stay apart for people who cannot tell the colours apart. */
  readonly symbol: string;
}

export const PLAYER_APPEARANCES: readonly PlayerAppearance[] = [
  { bodyColor: 0xe0533d, symbol: '●' },
  { bodyColor: 0x3d8fe0, symbol: '▲' },
  { bodyColor: 0x5ec25a, symbol: '■' },
  { bodyColor: 0xe0c33d, symbol: '◆' },
];
