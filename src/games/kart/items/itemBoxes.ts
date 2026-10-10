import { ITEM_TYPES, MAP_ITEM_TYPES, SPEED_REWARD_ITEM_TYPES, type ItemConfig, type ItemType } from '../../../shared/config/items';
import { KART_COLLIDER_RADIUS } from '../../../shared/config/kart';
import type { MapConfig } from '../maps/shared/mapConfig';
import type { Rng } from '../../../shared/core/rng';
import { kartWorldHeightAt, routeElevationAt, type PositionedKart } from '../maps/shared/surface';
import type { KartState } from '../kart/kartState';

export interface ItemBoxState {
  collected: boolean;
  respawnSecondsLeft: number;
}

/** What `stepItemBoxes` needs from a kart: its position (to test overlap) and its held-item
 *  slot (mutated in place on pickup, so the caller's own kart/player object stays the owner). */
export interface ItemCarrier {
  readonly state: PositionedKart & Partial<Pick<KartState, 'boostSeconds'>>;
  heldItem: ItemType | null;
}

export function createItemBoxStates(map: MapConfig): ItemBoxState[] {
  return map.itemBoxes.map(() => ({ collected: false, respawnSecondsLeft: 0 }));
}

function isLeader(rank: number, kartCount: number): boolean {
  return kartCount <= 1 || rank <= 1;
}

/** The leader never receives speed rewards; map items only appear on the maps that list them. */
function itemTypesFor(leader: boolean, map: MapConfig): readonly ItemType[] {
  return ITEM_TYPES.filter((type) => {
    if (MAP_ITEM_TYPES.includes(type) && !map.mapItems?.includes(type)) return false;
    return !leader || !SPEED_REWARD_ITEM_TYPES.includes(type);
  });
}

/** Every eligible item is equally likely; a box with a fixed item gives that item when it is eligible. */
function grantedItem(fixedItem: ItemType | undefined, rng: Rng, leader: boolean, map: MapConfig): ItemType {
  const types = itemTypesFor(leader, map);
  if (fixedItem !== undefined && types.includes(fixedItem)) return fixedItem;
  return types[Math.floor(rng.next() * types.length)]!;
}

/** Placeholder pickup + grant step: decrements respawn timers, and for each uncollected box
 *  grants the first eligible (not already holding an item) overlapping kart one item, its type
 *  drawn evenly from the items that kart may get (the leader gets no speed boost). Purely `stepSeconds` + seeded-`rng`-driven, no Math.random(), so it stays covered
 *  by the determinism test. */
export function stepItemBoxes(
  map: MapConfig,
  states: readonly ItemBoxState[],
  items: ItemConfig,
  carriers: readonly ItemCarrier[],
  ranks: readonly number[],
  rng: Rng,
  stepSeconds: number,
): void {
  const pickupRadius = KART_COLLIDER_RADIUS + items.boxRadius;
  const pickupRadiusSquared = pickupRadius * pickupRadius;

  states.forEach((state, index) => {
    const spawn = map.itemBoxes[index];
    if (!spawn) return;

    if (state.collected) {
      state.respawnSecondsLeft -= stepSeconds;
      if (state.respawnSecondsLeft <= 0) state.collected = false;
      return;
    }

    const carrierIndex = carriers.findIndex((carrier) => {
      if (carrier.heldItem !== null) return false;
      if ((carrier.state.penaltySecondsLeft ?? 0) > 0) return false;
      if (spawn.levelId !== undefined && carrier.state.levelId !== spawn.levelId) return false;
      if (spawn.jumpId !== undefined && carrier.state.windowJumpId !== spawn.jumpId) return false;
      const dx = carrier.state.x - spawn.x;
      const dz = carrier.state.z - spawn.z;
      const dy = kartWorldHeightAt(map, carrier.state) - routeElevationAt(map, spawn.x, spawn.z, spawn.levelId) - (spawn.heightOffset ?? 0);
      return dx * dx + dy * dy + dz * dz <= pickupRadiusSquared;
    });
    if (carrierIndex === -1) return;

    state.collected = true;
    state.respawnSecondsLeft = items.boxRespawnSeconds;
    const rank = ranks[carrierIndex] ?? carriers.length;
    const leader = isLeader(rank, carriers.length);
    const carrier = carriers[carrierIndex]!;
    carrier.heldItem = grantedItem(spawn.item, rng, leader, map);
    if (spawn.jumpId !== undefined && carrier.state.windowJumpId === spawn.jumpId) {
      carrier.state.boostSeconds = Math.max(carrier.state.boostSeconds ?? 0, spawn.boostSeconds ?? 0);
    }
  });
}
