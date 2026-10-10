import type { AiConfig } from '../../../../shared/config/ai';
import type { ItemType } from '../../../../shared/config/items';
import type { KartState } from '../../kart/kartState';
import type { RubberBandContext, MapPoint2D } from './driverTypes';

/** Whether any of `otherKarts` sits within `rangeMeters` and inside the forward-facing cone of
 *  half-angle `halfAngleRadians` (or the opposite, rearward cone, when `forwardSign` is -1). */
function hasKartInCone(state: KartState, otherKarts: readonly MapPoint2D[], forwardSign: 1 | -1, halfAngleRadians: number, rangeMeters: number): boolean {
  const coneX = Math.cos(state.yaw) * forwardSign;
  const coneZ = Math.sin(state.yaw) * forwardSign;
  const cosHalfAngle = Math.cos(halfAngleRadians);

  return otherKarts.some((kart) => {
    const dx = kart.x - state.x;
    const dz = kart.z - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0 || distance > rangeMeters) return false;
    return (dx * coneX + dz * coneZ) / distance >= cosHalfAngle;
  });
}

/** Simple, non-tactical "does this look like a good moment?" check per held item type: fire
 *  a hairball at a kart ahead, drop a trap when someone is pursuing closely, use
 *  the shield while meaningfully behind the leader. The newer items reuse these shapes: yarn, laser
 *  and vacuum need a kart ahead, the gravity bubble a pursuer, catnip behaves like nitro.
 *  No aiming/prediction beyond that. */
export function shouldAiUseHeldItem(
  config: AiConfig,
  heldItem: ItemType,
  state: KartState,
  otherKarts: readonly MapPoint2D[],
  rubberBanding: RubberBandContext | null,
): boolean {
  switch (heldItem) {
    case 'boost':
    case 'catnip':
      return state.boostSeconds <= 0 && state.stunSecondsLeft <= 0 && state.catnipSecondsLeft <= 0;
    case 'hairball':
    case 'yarn':
      return hasKartInCone(state, otherKarts, 1, config.itemAimConeRadians, config.itemAimRangeMeters);
    case 'trap':
    case 'cowpat':
    case 'gravity':
      return hasKartInCone(state, otherKarts, -1, config.trapPursuerConeRadians, config.trapPursuerRangeMeters);
    case 'laser':
      return hasKartInCone(state, otherKarts, 1, config.laserTargetConeRadians, config.laserTargetRangeMeters);
    case 'vacuum':
      return hasKartInCone(state, otherKarts, 1, config.vacuumTargetConeRadians, config.vacuumTargetRangeMeters);
    case 'nap':
      return rubberBanding !== null && rubberBanding.leaderScore - rubberBanding.myScore >= config.napDeficitMeters;
  }
}
