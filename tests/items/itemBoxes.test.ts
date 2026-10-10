import { describe, expect, it } from 'vitest';
import { createRuntimeItems, type ItemType } from '../../src/shared/config/items';
import { RING_TEST_MAP, type ItemBoxSpawn } from '../support/ringTestMap';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { createRng } from '../../src/shared/core/rng';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createItemBoxStates, stepItemBoxes, type ItemCarrier } from '../../src/games/kart/items/itemBoxes';

const MAP_WITH_ONE_BOX = {
  ...RING_TEST_MAP,
  itemBoxes: [{ x: 5, z: 5 }] as readonly ItemBoxSpawn[],
};

function carrierAt(x: number, z: number, heldItem: ItemType | null = null): ItemCarrier {
  return { state: createKartState(x, z, 0), heldItem };
}

describe('item box pickup', () => {
  it('starts every box uncollected', () => {
    const states = createItemBoxStates(MAP_WITH_ONE_BOX);
    expect(states).toEqual([{ collected: false, respawnSecondsLeft: 0 }]);
  });

  it('marks a box collected and grants an item once a kart overlaps its spawn point', () => {
    const items = createRuntimeItems();
    const states = createItemBoxStates(MAP_WITH_ONE_BOX);
    const carrier = carrierAt(5, 5);

    stepItemBoxes(MAP_WITH_ONE_BOX, states, items, [carrier], [1], createRng(1), 1 / 60);

    expect(states[0]!.collected).toBe(true);
    expect(states[0]!.respawnSecondsLeft).toBe(items.boxRespawnSeconds);
    expect(carrier.heldItem).not.toBeNull();
  });

  it('leaves a box uncollected while no kart is in range', () => {
    const items = createRuntimeItems();
    const states = createItemBoxStates(MAP_WITH_ONE_BOX);
    const farCarrier = carrierAt(5 + items.boxRadius + 5, 5);

    stepItemBoxes(MAP_WITH_ONE_BOX, states, items, [farCarrier], [1], createRng(1), 1 / 60);

    expect(states[0]!.collected).toBe(false);
    expect(farCarrier.heldItem).toBeNull();
  });

  it('skips a kart that already holds an item, even when overlapping the box', () => {
    const items = createRuntimeItems();
    const states = createItemBoxStates(MAP_WITH_ONE_BOX);
    const carrier = carrierAt(5, 5, 'hairball');

    stepItemBoxes(MAP_WITH_ONE_BOX, states, items, [carrier], [1], createRng(1), 1 / 60);

    expect(states[0]!.collected).toBe(false);
    expect(carrier.heldItem).toBe('hairball');
  });

  it('respawns only once the configured time has fully elapsed', () => {
    const items = createRuntimeItems();
    const states = [{ collected: true, respawnSecondsLeft: items.boxRespawnSeconds }];
    const farCarrier = carrierAt(-1000, -1000);

    stepItemBoxes(MAP_WITH_ONE_BOX, states, items, [farCarrier], [1], createRng(1), items.boxRespawnSeconds - 0.001);
    expect(states[0]!.collected).toBe(true);

    stepItemBoxes(MAP_WITH_ONE_BOX, states, items, [farCarrier], [1], createRng(1), 0.002);
    expect(states[0]!.collected).toBe(false);
  });

  it('draws every eligible item evenly: each of the ten items shows up about equally often, whatever the place', () => {
    const map = { ...MAP_WITH_ONE_BOX, mapItems: ['yarn', 'vacuum', 'gravity', 'cowpat'] as const };
    const counts = new Map<ItemType, number>();
    for (let seed = 1; seed <= 3000; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrierAt(-1, -1), carrier, carrierAt(-2, -2)], [1, 2, 3], createRng(seed), 1 / 60);
      counts.set(carrier.heldItem!, (counts.get(carrier.heldItem!) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const [item, count] of counts) expect(count, item).toBeGreaterThan(220);
    for (const [item, count] of counts) expect(count, item).toBeLessThan(380);
  });

  it('gives the last-place kart the same odds as everyone else, including the shield', () => {
    const lastPlace = new Set<ItemType | null>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(
        MAP_WITH_ONE_BOX,
        createItemBoxStates(MAP_WITH_ONE_BOX),
        createRuntimeItems(),
        [carrier, carrierAt(-1, -1), carrierAt(-2, -2), carrierAt(-3, -3)],
        [4, 1, 2, 3],
        createRng(seed),
        1 / 60,
      );
      lastPlace.add(carrier.heldItem);
    }
    expect(lastPlace).toEqual(new Set<ItemType>(['hairball', 'trap', 'nap', 'boost', 'catnip', 'laser']));
  });

  it('does not collect a family-house box from another level at the same x/z position', () => {
    const items = createRuntimeItems();
    const groundBox = FAMILY_HOUSE.itemBoxes.find((spawn) => spawn.levelId === 'ground')!;
    const upperCarrier: ItemCarrier = {
      state: createKartState(groundBox.x, groundBox.z, 0, 'second'),
      heldItem: null,
    };
    const states = createItemBoxStates(FAMILY_HOUSE);

    stepItemBoxes(FAMILY_HOUSE, states, items, [upperCarrier], [1], createRng(1), 1 / 60);

    expect(states.every((state) => !state.collected)).toBe(true);
    expect(upperCarrier.heldItem).toBeNull();
  });
});

describe('the race leader and nitro', () => {
  it('never draws nitro as the leader, but still draws the other items', () => {
    const drawn = new Set<ItemType | null>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(
        MAP_WITH_ONE_BOX,
        createItemBoxStates(MAP_WITH_ONE_BOX),
        createRuntimeItems(),
        [carrier, carrierAt(-1, -1)],
        [1, 2],
        createRng(seed),
        1 / 60,
      );
      expect(carrier.heldItem).not.toBeNull();
      expect(carrier.heldItem).not.toBe('boost');
      drawn.add(carrier.heldItem);
    }
    expect(drawn).toEqual(new Set<ItemType>(['hairball', 'trap', 'nap', 'laser']));
  });

  it('never gives the leader catnip either, which is a speed boost as well', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(
        MAP_WITH_ONE_BOX,
        createItemBoxStates(MAP_WITH_ONE_BOX),
        createRuntimeItems(),
        [carrier, carrierAt(-1, -1)],
        [1, 2],
        createRng(seed),
        1 / 60,
      );
      expect(carrier.heldItem).not.toBe('catnip');
    }
  });

  it('replaces a fixed nitro box content with another item for the leader only', () => {
    const items = createRuntimeItems();
    const mapWithNitroBox = { ...RING_TEST_MAP, itemBoxes: [{ x: 5, z: 5, item: 'boost' }] as readonly ItemBoxSpawn[] };
    const leader = carrierAt(5, 5);
    stepItemBoxes(mapWithNitroBox, createItemBoxStates(mapWithNitroBox), items, [leader, carrierAt(-1, -1)], [1, 2], createRng(4), 1 / 60);
    expect(leader.heldItem).not.toBe('boost');
    expect(leader.heldItem).not.toBeNull();

    const follower = carrierAt(5, 5);
    stepItemBoxes(mapWithNitroBox, createItemBoxStates(mapWithNitroBox), items, [carrierAt(-1, -1), follower], [1, 2], createRng(4), 1 / 60);
    expect(follower.heldItem).toBe('boost');
  });

  it('draws nitro for everyone behind the leader', () => {
    const drawn = new Set<ItemType | null>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const follower = carrierAt(5, 5);
      stepItemBoxes(
        MAP_WITH_ONE_BOX,
        createItemBoxStates(MAP_WITH_ONE_BOX),
        createRuntimeItems(),
        [carrierAt(-1, -1), follower, carrierAt(-2, -2), carrierAt(-3, -3)],
        [1, 2, 3, 4],
        createRng(seed),
        1 / 60,
      );
      drawn.add(follower.heldItem);
    }
    expect(drawn.has('boost')).toBe(true);
    expect(drawn.has('catnip')).toBe(true);
  });
});

describe('map items', () => {
  const MAP_ITEMS: readonly ItemType[] = ['yarn', 'vacuum', 'gravity', 'cowpat'];

  it('offers a map item only on the maps that list it', () => {
    for (const mapItem of MAP_ITEMS) {
      const map = { ...MAP_WITH_ONE_BOX, mapItems: [mapItem] };
      const seen = new Set<ItemType | null>();
      for (let seed = 1; seed <= 600; seed += 1) {
        const carrier = carrierAt(5, 5);
        stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrierAt(-1, -1), carrier, carrierAt(-2, -2)], [1, 2, 3], createRng(seed), 1 / 60);
        seen.add(carrier.heldItem);
      }
      for (const other of MAP_ITEMS.filter((item) => item !== mapItem)) expect(seen.has(other), `${mapItem} map: ${other}`).toBe(false);
      expect(seen.has(mapItem), mapItem).toBe(true);
    }
  });

  it('draws no map item at all on a map without one', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(
        MAP_WITH_ONE_BOX,
        createItemBoxStates(MAP_WITH_ONE_BOX),
        createRuntimeItems(),
        [carrierAt(-1, -1), carrier, carrierAt(-2, -2)],
        [1, 2, 3],
        createRng(seed),
        1 / 60,
      );
      expect(MAP_ITEMS).not.toContain(carrier.heldItem);
    }
  });

  it('gives the leader map items too', () => {
    const map = { ...MAP_WITH_ONE_BOX, mapItems: MAP_ITEMS };
    const seen = new Set<ItemType | null>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const carrier = carrierAt(5, 5);
      stepItemBoxes(map, createItemBoxStates(map), createRuntimeItems(), [carrier, carrierAt(-1, -1)], [1, 2], createRng(seed), 1 / 60);
      seen.add(carrier.heldItem);
    }
    for (const item of MAP_ITEMS) expect(seen.has(item), item).toBe(true);
  });
});
