import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ITEM_LOOKS, itemLookOf } from '../../src/shared/config/itemLooks';
import { createRuntimeItems } from '../../src/shared/config/items';
import { GravityBubbleView } from '../../src/games/kart/items/views/gravityBubbleView';
import { HairballView } from '../../src/games/kart/items/views/hairballView';
import { TrapView } from '../../src/games/kart/items/views/trapView';
import { VacuumView } from '../../src/games/kart/items/views/vacuumView';
import { CITY } from '../../src/games/kart/maps/city/map';
import { FARM } from '../../src/games/kart/maps/farm/map';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { SPACE } from '../../src/games/kart/maps/space/map';
import { TOWN } from '../../src/games/kart/maps/town/map';
import { RING_TEST_MAP } from '../support/ringTestMap';

const items = createRuntimeItems();
const yarn = { kind: 'yarn' as const, x: 0, z: 0, vx: 1, vz: 0, ownerIndex: 0, levelId: 'ground', distanceTraveled: 3, bouncesRemaining: 1 };

describe('how the map items look', () => {
  it('gives a map without looks the default ones, and every map item a look of its own on the new maps', () => {
    for (const item of ['yarn', 'vacuum', 'gravity', 'cowpat'] as const) {
      expect(itemLookOf(RING_TEST_MAP, item)).toBe(DEFAULT_ITEM_LOOKS[item]);
      const looks = [FARM, TOWN, CITY].map((map) => itemLookOf(map, item));
      for (const look of looks) expect(look).not.toBe(DEFAULT_ITEM_LOOKS[item]);
      expect(new Set(looks.map((look) => JSON.stringify(look))).size).toBe(3);
    }
  });

  it('dresses the items of the older maps too: the forest, the house and the moon base differ from the default where their item has a theme', () => {
    expect(itemLookOf(NATURE, 'vacuum')).not.toBe(DEFAULT_ITEM_LOOKS.vacuum);
    expect(itemLookOf(FAMILY_HOUSE, 'gravity')).not.toBe(DEFAULT_ITEM_LOOKS.gravity);
    expect(itemLookOf(SPACE, 'cowpat')).not.toBe(DEFAULT_ITEM_LOOKS.cowpat);
    expect(itemLookOf(NATURE, 'yarn')).toBe(DEFAULT_ITEM_LOOKS.yarn);
    expect(itemLookOf(FAMILY_HOUSE, 'vacuum')).toBe(DEFAULT_ITEM_LOOKS.vacuum);
  });

  it('draws a thrown yarn ball as a hay bale, a cannonball or a cable tangle, and the default as a knot', () => {
    const geometryOn = (map: typeof FARM): THREE.BufferGeometry => {
      const view = new HairballView();
      view.update(map, [yarn], [0xff0000]);
      return (view.object.children[0] as THREE.Mesh).geometry;
    };
    const shapes = [FARM, TOWN, CITY, RING_TEST_MAP as unknown as typeof FARM].map((map) => geometryOn(map).type);
    expect(shapes).toEqual(['CylinderGeometry', 'SphereGeometry', 'TorusKnotGeometry', 'TorusKnotGeometry']);
    expect(geometryOn(CITY)).not.toBe(geometryOn(RING_TEST_MAP as unknown as typeof FARM));
  });

  it('tints the default yarn fully in the owner colour and a themed one only a little', () => {
    const colorOn = (map: typeof FARM): number => {
      const view = new HairballView();
      view.update(map, [yarn], [0xff0000]);
      return ((view.object.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex();
    };
    expect(colorOn(NATURE)).toBe(0xff0000);
    expect(colorOn(SPACE)).not.toBe(0xff0000);
    expect(colorOn(FARM)).not.toBe(0xff0000);
  });

  it('adds chickens to the gravity bubble on the farm, runes in the town and a scan line in the city, none by default', () => {
    const bubble = [{ x: 0, z: 0, ownerIndex: 0, levelId: 'ground', elevation: 0, secondsLeft: 5, caughtKartIndices: [] }];
    const partsOn = (map: typeof FARM): number => {
      const view = new GravityBubbleView();
      view.update(0.016, bubble, items, map);
      return view.object.children[0]!.children.length - 2;
    };
    expect([FARM, TOWN, CITY, RING_TEST_MAP as unknown as typeof FARM].map(partsOn)).toEqual([6, 6, 1, 0]);
  });

  it('sweeps the suction in the colours of the map, with more rings for stripes', () => {
    const pulse = [{ x: 0, z: 0, yaw: 0, levelId: 'ground', ageSeconds: 0.1 }];
    const ringsOn = (map: typeof FARM): number => {
      const view = new VacuumView();
      view.update(map, pulse, items);
      return view.object.children[0]!.children.length;
    };
    expect([FARM, TOWN, CITY, RING_TEST_MAP as unknown as typeof FARM].map(ringsOn)).toEqual([5, 3, 5, 3]);
  });

  it('dresses the cow pat as the map wants and starts over when the map changes', () => {
    const view = new TrapView();
    const trap = [{ kind: 'cowpat' as const, x: 0, z: 0, ownerIndex: 0, levelId: 'ground' }];
    const partsOn = (map: typeof FARM): number => {
      view.update(map, trap);
      return (view.object.children[0]!.children[1] as THREE.Group).children.length;
    };
    expect([partsOn(FARM), partsOn(TOWN), partsOn(CITY), partsOn(RING_TEST_MAP as unknown as typeof FARM)]).toEqual([1, 5, 2, 1]);
  });
});
