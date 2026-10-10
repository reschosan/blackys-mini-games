/** Number of fur shells stacked over the body of a long-haired cat (fixed: it sizes the geometry). */
export const CAT_FUR_SHELL_COUNT = 12;

export interface CatFurConfig {
  /** Hair length as a fraction of the cat's bounding-box height. */
  lengthFraction: number;
  /** How far the hair tips sag toward the ground, as a fraction of the cat's bounding-box height. */
  droopFraction: number;
  /** Strands per unit of the cat's bounding-box space; higher means finer hair. */
  strandDensity: number;
  /** 0 keeps the hair as long on the face as on the body, 1 leaves the face bare. */
  faceShortening: number;
  /** Darkening of the hair roots against the tips (0 = none, 1 = black roots). */
  rootDarkening: number;
  /** Mane length by style, as a fraction of the cat's bounding-box height. */
  ruffLengthFraction: number;
  lionLengthFraction: number;
  /** How far the mane reaches over the neck, cheeks and chest (1 = collar, bigger = fuller). */
  ruffReach: number;
  lionReach: number;
  /** Brightness of the mane against the fur color (1 = same, lower = darker like a lion's mane). */
  maneTone: number;
}

const DEFAULT_CAT_FUR: Readonly<CatFurConfig> = Object.freeze({
  lengthFraction: 0.07,
  droopFraction: 0.025,
  strandDensity: 190,
  faceShortening: 0.9,
  rootDarkening: 0.45,
  ruffLengthFraction: 0.1,
  lionLengthFraction: 0.18,
  ruffReach: 1,
  lionReach: 1.35,
  maneTone: 0.94,
});

/** Live tuning values, edited from the debug panel and read by every long-haired cat each frame. */
export const catFur: CatFurConfig = { ...DEFAULT_CAT_FUR };

export function resetCatFur(): void {
  Object.assign(catFur, DEFAULT_CAT_FUR);
}
