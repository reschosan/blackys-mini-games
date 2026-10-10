export const MAX_CAT_NAME_LENGTH = 12;

export type FurColor = 'black' | 'white' | 'gray' | 'red' | 'cream' | 'brown';

export type CatPattern = 'solid' | 'tabby' | 'bicolor' | 'lucky';

export type EyeColor = 'amber' | 'green' | 'blue' | 'heterochromia';

export type HairLength = 'short' | 'long';

export type ManeStyle = 'none' | 'ruff' | 'lion';

export const FUR_COLORS: readonly FurColor[] = ['black', 'white', 'gray', 'red', 'cream', 'brown'];

export const CAT_PATTERNS: readonly CatPattern[] = ['solid', 'tabby', 'bicolor', 'lucky'];

export const EYE_COLORS: readonly EyeColor[] = ['amber', 'green', 'blue', 'heterochromia'];

export const HAIR_LENGTHS: readonly HairLength[] = ['short', 'long'];

export const MANE_STYLES: readonly ManeStyle[] = ['none', 'ruff', 'lion'];

export const FUR_COLOR_HEX: Readonly<Record<FurColor, number>> = {
  black: 0x1c1a1a,
  white: 0xf5f1e8,
  gray: 0x8d8d90,
  red: 0xc06a3a,
  cream: 0xe8cfa0,
  brown: 0x6b4a30,
};

export const EYE_COLOR_HEX: Readonly<Record<Exclude<EyeColor, 'heterochromia'>, number>> = {
  amber: 0xd68b1e,
  green: 0x4caf6e,
  blue: 0x3d8fe0,
};

export const HETEROCHROMIA_EYE_COLORS: readonly [number, number] = [EYE_COLOR_HEX.blue, EYE_COLOR_HEX.amber];

export const LUCKY_PATTERN_COLORS = {
  base: 0xf5f1e8,
  patchA: 0xad2a1c,
  patchB: 0x161414,
} as const;

const PATTERNS_WITH_SECONDARY_COLOR: readonly CatPattern[] = ['tabby', 'bicolor'];

export function patternUsesSecondaryColor(pattern: CatPattern): boolean {
  return PATTERNS_WITH_SECONDARY_COLOR.includes(pattern);
}

export interface CatAppearance {
  readonly name: string;
  readonly furColor: FurColor;
  readonly pattern: CatPattern;
  readonly patternSecondaryColor: FurColor;
  readonly eyeColor: EyeColor;
  readonly hairLength: HairLength;
  readonly mane: ManeStyle;
}

type CatPresetId = 'blacky' | 'snowflake' | 'tiger' | 'cookie' | 'lucky' | 'mist';

export interface CatPreset extends Omit<CatAppearance, 'name'> {
  /** The texts name the preset by this id (`lobby.presets`). */
  readonly presetId: CatPresetId;
}

export const CAT_PRESETS: readonly CatPreset[] = [
  {
    presetId: 'blacky',
    furColor: 'black',
    pattern: 'solid',
    patternSecondaryColor: 'white',
    eyeColor: 'amber',
    hairLength: 'short',
    mane: 'none',
  },
  {
    presetId: 'snowflake',
    furColor: 'white',
    pattern: 'solid',
    patternSecondaryColor: 'gray',
    eyeColor: 'blue',
    hairLength: 'short',
    mane: 'none',
  },
  {
    presetId: 'tiger',
    furColor: 'brown',
    pattern: 'tabby',
    patternSecondaryColor: 'black',
    eyeColor: 'amber',
    hairLength: 'short',
    mane: 'none',
  },
  {
    presetId: 'cookie',
    furColor: 'cream',
    pattern: 'bicolor',
    patternSecondaryColor: 'white',
    eyeColor: 'amber',
    hairLength: 'short',
    mane: 'none',
  },
  {
    presetId: 'lucky',
    furColor: 'white',
    pattern: 'lucky',
    patternSecondaryColor: 'red',
    eyeColor: 'heterochromia',
    hairLength: 'short',
    mane: 'none',
  },
  {
    presetId: 'mist',
    furColor: 'gray',
    pattern: 'solid',
    patternSecondaryColor: 'white',
    eyeColor: 'green',
    hairLength: 'short',
    mane: 'none',
  },
];

const DEFAULT_PRESET = CAT_PRESETS[0]!;

/** A preset gives the look only; the name is the player's own ('' = unnamed, shown as "Cat N"). */
export function createCatAppearance(preset: CatPreset = DEFAULT_PRESET, name = ''): CatAppearance {
  const { presetId: _presetId, ...look } = preset;
  return { ...look, name };
}

export function isValidCatAppearance(appearance: CatAppearance): boolean {
  return (
    FUR_COLORS.includes(appearance.furColor) &&
    CAT_PATTERNS.includes(appearance.pattern) &&
    FUR_COLORS.includes(appearance.patternSecondaryColor) &&
    EYE_COLORS.includes(appearance.eyeColor) &&
    HAIR_LENGTHS.includes(appearance.hairLength) &&
    MANE_STYLES.includes(appearance.mane) &&
    typeof appearance.name === 'string' &&
    appearance.name.length <= MAX_CAT_NAME_LENGTH
  );
}
