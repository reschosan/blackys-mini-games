import type { SurfaceKind } from '../../../../shared/config/surfaces';
import type { KartState } from '../../kart/kartState';
import { isInsideRect } from './collision';
import type { MapConfig } from './mapConfig';

export function surfaceKindAt(map: MapConfig, x: number, z: number, levelId: string): SurfaceKind | null {
  const zone = map.surfaceZones?.find((candidate) => candidate.levelId === levelId && isInsideRect(candidate.rect, x, z));
  return zone?.kind ?? null;
}

/** Records the surface zone under the kart (a cow pat hit counts as mud); a puddle washes off any running boost on entry. */
export function updateKartSurface(map: MapConfig, kart: KartState): void {
  const previous = kart.surfaceKind;
  kart.surfaceKind = kart.stickySecondsLeft > 0 ? 'mud' : surfaceKindAt(map, kart.x, kart.z, kart.levelId);
  if (kart.surfaceKind === 'puddle' && previous !== 'puddle') kart.boostSeconds = 0;
}
