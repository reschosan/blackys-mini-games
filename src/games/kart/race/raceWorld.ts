import { createFieldItems, resetFieldItems, type FieldItems } from '../items/fieldItems';
import type { Hairball } from '../items/hairballs';
import { createItemBoxStates, type ItemBoxState } from '../items/itemBoxes';
import { createTankFire, resetTankFire, type TankFire } from '../items/tankFire';
import type { Trap } from '../items/traps';
import type { MapConfig } from '../maps/shared/mapConfig';

/** Everything that lives on the map during a race besides the karts: items, boxes, ranking and clock. */
export interface RaceWorld {
  itemBoxes: ItemBoxState[];
  readonly hairballs: Hairball[];
  readonly traps: Trap[];
  readonly fieldItems: FieldItems;
  readonly tankFire: TankFire;
  places: readonly number[];
  raceTimeSeconds: number;
}

/** Without items every box stays collected, so nothing shows and nothing can be picked up. */
function boxStatesFor(map: MapConfig, itemsEnabled: boolean): ItemBoxState[] {
  const boxes = createItemBoxStates(map);
  return itemsEnabled ? boxes : boxes.map((box) => ({ ...box, collected: true }));
}

export function createRaceWorld(map: MapConfig, itemsEnabled = true): RaceWorld {
  return {
    itemBoxes: boxStatesFor(map, itemsEnabled),
    hairballs: [],
    traps: [],
    fieldItems: createFieldItems(),
    tankFire: createTankFire(),
    places: [],
    raceTimeSeconds: 0,
  };
}

export function resetRaceWorld(world: RaceWorld, map: MapConfig, itemsEnabled = true): void {
  world.itemBoxes = boxStatesFor(map, itemsEnabled);
  world.hairballs.length = 0;
  world.traps.length = 0;
  resetFieldItems(world.fieldItems);
  resetTankFire(world.tankFire);
  world.places = [];
  world.raceTimeSeconds = 0;
}
