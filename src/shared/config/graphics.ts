export type GraphicsQuality = 'low' | 'high';

/** The frame rate the game works towards on weak devices; below it the readout turns amber. */
export const TARGET_FPS = 30;

export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['high', 'low'];

export interface GraphicsPreset {
  /** Highest pixel ratio the renderer uses; a retina tablet draws four times the pixels at 2. */
  pixelRatioCap: number;
  particleDensity: number;
  /** Share of the optional ground cover (lawn tufts, tall grass, flower fields) that is drawn, 0..1. */
  groundCoverShare: number;
  /** Share of the scenery models (trees, rocks, bushes) that are drawn, 0..1. They are most of the triangles of an outdoor map. */
  sceneryShare: number;
  /** Normal and roughness maps on the big ground planes of the outdoor maps. */
  groundDetailMaps: boolean;
}

export interface GraphicsConfig {
  quality: GraphicsQuality;
  presets: Record<GraphicsQuality, GraphicsPreset>;
  /** Set by the frame-rate governor when "Niedrig" still runs under `EMERGENCY_FPS`: a bare-bones preset replaces it for this session. */
  emergency: boolean;
}

/** Below this frame rate on "Niedrig" the game draws even less (`EMERGENCY_PRESET`). */
export const EMERGENCY_FPS = 15;

/** Bare bones for a device that cannot keep up even on "Niedrig": no ground cover, a tenth of the scenery, fewer pixels and particles. */
const EMERGENCY_PRESET: Readonly<GraphicsPreset> = Object.freeze({
  pixelRatioCap: 0.75,
  particleDensity: 0.15,
  groundCoverShare: 0,
  sceneryShare: 0.1,
  groundDetailMaps: false,
});

export const DEFAULT_GRAPHICS_PRESETS: Readonly<Record<GraphicsQuality, GraphicsPreset>> = {
  high: { pixelRatioCap: 1.5, particleDensity: 0.75, groundCoverShare: 1, sceneryShare: 1, groundDetailMaps: true },
  low: { pixelRatioCap: 1, particleDensity: 0.4, groundCoverShare: 0.25, sceneryShare: 0.3, groundDetailMaps: false },
};

function detectGraphicsQuality(deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory): GraphicsQuality {
  return typeof deviceMemory === 'number' && deviceMemory <= 4 ? 'low' : 'high';
}

export function createRuntimeGraphics(): GraphicsConfig {
  return {
    quality: detectGraphicsQuality(),
    presets: { high: { ...DEFAULT_GRAPHICS_PRESETS.high }, low: { ...DEFAULT_GRAPHICS_PRESETS.low } },
    emergency: false,
  };
}

export function activePreset(graphics: GraphicsConfig): GraphicsPreset {
  if (graphics.emergency && graphics.quality === 'low') return EMERGENCY_PRESET;
  return graphics.presets[graphics.quality];
}

export function otherQuality(quality: GraphicsQuality): GraphicsQuality {
  return quality === 'high' ? 'low' : 'high';
}

export function pixelRatioFor(preset: GraphicsPreset, devicePixelRatio = window.devicePixelRatio): number {
  return Math.min(devicePixelRatio, preset.pixelRatioCap);
}
