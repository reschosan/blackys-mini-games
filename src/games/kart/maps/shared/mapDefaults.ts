import type { ItemBoxLook, MapLighting, ShoulderSettings } from './mapConfig';

/** Central defaults for everything a map can override in its own `maps/<map>.ts` file.
 *  Item odds and effects default to `DEFAULT_ITEMS` (config/items.ts), driving values to
 *  `DEFAULT_DRIVING`, the lap count to `DEFAULT_RACE`; a map only lists what differs. */
export const DEFAULT_ITEM_BOX_LOOK: Readonly<ItemBoxLook> = Object.freeze({ color: 0xf2c744, size: 0.8, spinSpeed: 1.2 });

/** Daylight, as every map was lit before maps could set their own light. */
export const DEFAULT_LIGHTING: Readonly<MapLighting> = Object.freeze({
  hemisphereSky: 0xffffff,
  hemisphereGround: 0x404050,
  hemisphereIntensity: 2,
  sunColor: 0xffffff,
  sunIntensity: 1.2,
});

/** Slower rim of the route, opted into by maps with a rough edge (grass, dust). */
export const DEFAULT_SHOULDER: Readonly<ShoulderSettings> = Object.freeze({ widthFraction: 0.1, speedFactor: 0.9 });

export interface SurfaceTexture {
  readonly textureSize: number;
  readonly anisotropy: number;
  readonly roughness: number;
}

const DEFAULT_SURFACE_TEXTURE: Readonly<SurfaceTexture> = Object.freeze({ textureSize: 256, anisotropy: 4, roughness: 1 });

export function surfaceStyle<T extends object>(style: T & Partial<SurfaceTexture>): T & SurfaceTexture {
  return { ...DEFAULT_SURFACE_TEXTURE, ...style } as T & SurfaceTexture;
}
