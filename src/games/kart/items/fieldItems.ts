import type { GravityBubble } from './gravityBubbles';
import type { LaserDot } from './lasers';
import type { VacuumPulse } from './vacuum';

/** World objects of the map-specific and laser items, owned by the race and read by the views. */
export interface FieldItems {
  readonly lasers: LaserDot[];
  readonly gravityBubbles: GravityBubble[];
  readonly vacuumPulses: VacuumPulse[];
}

export function createFieldItems(): FieldItems {
  return { lasers: [], gravityBubbles: [], vacuumPulses: [] };
}

export function resetFieldItems(fieldItems: FieldItems): void {
  fieldItems.lasers.length = 0;
  fieldItems.gravityBubbles.length = 0;
  fieldItems.vacuumPulses.length = 0;
}
