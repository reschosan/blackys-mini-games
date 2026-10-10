import { assetUrl } from './assets';

export interface CatModelAttribution {
  readonly modelName: string;
  readonly author: string;
  readonly authorUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
}

export interface CatModelConfig {
  readonly url: string;
  /** Corrective scale on top of the asset's own baked node scale; tuned by eye against the kart. */
  readonly scale: number;
  readonly groundOffsetY: number;
  /** The source asset's nose points along its own +Z; the project's forward is +X, hence +90°. */
  readonly forwardRotationY: number;
  /** Left/right eye centers for the fur shader's eye-color patch, in the model's bounding-box unit
   *  space (0..1 per axis, matching `CatPatternBounds`). The model has no separate eye mesh/material
   *  to recolor and its rig's bind pose doesn't line up with the raw geometry closely enough to
   *  derive this from the eye joints (see catView.ts history) - found instead by rendering the model
   *  head-on and visually matching a test patch to the eyes, the same way `scale`/`groundOffsetY`
   *  above were tuned by eye.
   */
  readonly eyePatchPositions: {
    readonly left: readonly [number, number, number];
    readonly right: readonly [number, number, number];
  };
  /** Radius (same unit space) of the eye-color patch around each center above. */
  readonly eyePatchRadius: number;
}

export const CAT_MODEL: CatModelConfig = {
  url: assetUrl('models/cat.glb'),
  scale: 0.0036,
  groundOffsetY: 0,
  forwardRotationY: Math.PI / 2,
  eyePatchPositions: {
    left: [0.72, 0.78, 0.97],
    right: [0.28, 0.78, 0.97],
  },
  eyePatchRadius: 0.08,
};

export const CAT_MODEL_ATTRIBUTION: CatModelAttribution = {
  modelName: 'Toon Cat FREE',
  author: 'Omabuarts Studio',
  authorUrl: 'https://sketchfab.com/omabuarts',
  license: 'CC-BY-4.0',
  licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386',
};
