import type { ModeTuning } from '../../shared/config/modes';
import type { Rng } from '../../shared/core/rng';
import { ITEM_NONE, ITEM_TYPES, NOT_OUT, type Jet, type Pickup } from './jetsTypes';

const SPREAD = 0.8;
const HEIGHT_MARGIN_METERS = 2;

/** The item boxes that float in the room: a pilot that flies into one while it holds nothing takes an item (boost, shield or rocket), and the box comes back somewhere else after a while. */
export function createPickups(tuning: ModeTuning['jets'], rng: Rng) {
  const half = (tuning.arenaSize / 2) * SPREAD;
  const place = (pickup: Pickup): void => {
    pickup.x = (rng.next() * 2 - 1) * half;
    pickup.z = (rng.next() * 2 - 1) * half;
    pickup.y = tuning.minAltitude + HEIGHT_MARGIN_METERS + rng.next() * (tuning.maxAltitude - tuning.minAltitude - HEIGHT_MARGIN_METERS * 2);
  };
  const list: Pickup[] = Array.from({ length: tuning.pickupCount }, () => {
    const pickup = { x: 0, y: 0, z: 0, backAt: 0 };
    place(pickup);
    return pickup;
  });

  return {
    list: list as readonly Pickup[],
    /** The boxes that hang in the air now. */
    active: (time: number): readonly Pickup[] => list.filter((pickup) => pickup.backAt <= time),
    collect(time: number, jets: readonly Jet[]): void {
      for (const jet of jets) {
        if (jet.item !== ITEM_NONE || jet.outAt !== NOT_OUT) continue;
        const box = list.find((pickup) => pickup.backAt <= time && Math.hypot(pickup.x - jet.x, pickup.y - jet.y, pickup.z - jet.z) < tuning.pickupRadius);
        if (!box) continue;
        jet.item = 1 + rng.nextInt(ITEM_TYPES);
        box.backAt = time + tuning.pickupRespawnSeconds;
        place(box);
      }
    },
  };
}
