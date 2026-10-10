/** How much optional detail a map view builds. The graphics level decides; every map reads only what it uses. */
export interface MapDetail {
  /** Share of the optional ground cover (lawn tufts, tall grass, flower fields) that is built, 0..1. */
  readonly groundCoverShare: number;
  /** Share of the scenery models (trees, rocks, bushes) that are built, 0..1. */
  readonly sceneryShare: number;
  /** Whether the big ground planes carry normal and roughness maps. */
  readonly groundDetailMaps: boolean;
}

export const FULL_MAP_DETAIL: MapDetail = { groundCoverShare: 1, sceneryShare: 1, groundDetailMaps: true };

/** Whether the item at this place stays when only `share` of them are kept: the same places every time, spread evenly over the map. */
export function keepForShare(key: number, share: number): boolean {
  return key % 100 < share * 100;
}

/** Spacing of a regular grid that keeps `share` of its points: a quarter of the points means twice the spacing. */
export function spacingForShare(spacing: number, share: number): number {
  return spacing / Math.sqrt(Math.max(share, 0.01));
}
