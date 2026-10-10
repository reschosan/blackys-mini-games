import type { InputFrame } from '../../../shared/input/actions';
import type { KartState } from '../kart/kartState';
import { driveCentreline } from './driver/centrelineDriving';
import type { AiDriveContext } from './driver/driverTypes';
import { driveRoute } from './driver/routeDriving';

export { createAiDriverState, type AiDriveContext, type AiDriverState, type MapPoint2D } from './driver/driverTypes';
export { shouldAiUseHeldItem } from './driver/itemUse';

/** One tick of AI driving: authored route nodes (house) take precedence over the centreline of
 *  ring and corridor courses. Difficulty controls steering precision, cornering confidence and
 *  top speed; rubber-banding nudges that top speed toward the current race leader. */
export function driveAiKart(state: KartState, context: AiDriveContext): InputFrame {
  return context.map.routeNodes ? driveRoute(state, context) : driveCentreline(state, context);
}
