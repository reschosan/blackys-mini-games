import type { MapConfig } from './mapConfig';
import type { KartState } from '../../kart/kartState';
import { activateBoost } from '../../kart/boost';
import { kartWorldHeightAt, routeElevationAt } from './surface';
import { isInsideRect } from './collision';

/** A kart in the air (a jump over the field) does not touch it. */
const GROUND_CONTACT_METERS = 0.5;

function isOnTheGround(map: MapConfig, state: KartState, levelId: string): boolean {
  return Math.abs(kartWorldHeightAt(map, state) - routeElevationAt(map, state.x, state.z, levelId)) < GROUND_CONTACT_METERS;
}

export function stepBoostFields(map: MapConfig, state: KartState): void {
  const field = map.boostFields?.find(
    ({ rect, levelId }) => state.levelId === levelId && isInsideRect(rect, state.x, state.z) && isOnTheGround(map, state, levelId),
  );
  if (field && field.id !== state.lastBoostFieldId && state.penaltySecondsLeft <= 0) {
    activateBoost(state, field.durationSeconds);
  }
  state.lastBoostFieldId = field?.id ?? null;
}
