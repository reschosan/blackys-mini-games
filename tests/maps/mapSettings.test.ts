import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRuntimeItems, DEFAULT_ITEMS, resetRuntimeItems } from '../../src/shared/config/items';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { DEFAULT_ITEM_BOX_LOOK, DEFAULT_SHOULDER, surfaceStyle } from '../../src/games/kart/maps/shared/mapDefaults';
import { configFieldsFromSettings, type MapSettings } from '../../src/games/kart/maps/shared/mapSettings';
import { DEFAULT_RACE } from '../../src/shared/config/race';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { SPACE } from '../../src/games/kart/maps/space/map';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { ItemBoxView } from '../../src/games/kart/items/views/itemBoxView';

const MINIMAL_MAP: MapSettings = { name: 'Testkarte', placements: [] };

describe('central map defaults', () => {
  it('fills every default when a map only names itself', () => {
    expect(configFieldsFromSettings(MINIMAL_MAP)).toEqual({
      name: 'Testkarte',
      lapCount: DEFAULT_RACE.lapCount,
      itemBoxLook: DEFAULT_ITEM_BOX_LOOK,
    });
  });

  it('carries over only what a map overrides and merges partial box looks with the default', () => {
    const fields = configFieldsFromSettings({
      ...MINIMAL_MAP,
      lapCount: 5,
      itemBox: { color: 0xff0000 },
      offroad: { speedFactor: 0.3, accelerationFactor: 0.4 },
      shoulder: DEFAULT_SHOULDER,
      items: { boxRadius: 2 },
      aiPaceFactors: { easy: 0.5, medium: 0.6, hard: 0.7 },
      aiOffCourseMeters: 13,
      skyColor: 0,
    });
    expect(fields.lapCount).toBe(5);
    expect(fields.itemBoxLook).toEqual({ ...DEFAULT_ITEM_BOX_LOOK, color: 0xff0000 });
    expect(fields.offroad).toEqual({ speedFactor: 0.3, accelerationFactor: 0.4 });
    expect(fields.shoulder).toEqual(DEFAULT_SHOULDER);
    expect(fields.itemOverrides).toEqual({ boxRadius: 2 });
    expect(fields.aiPaceFactors).toEqual({ easy: 0.5, medium: 0.6, hard: 0.7 });
    expect(fields.aiOffCourseMeters).toBe(13);
    expect(fields.skyColor).toBe(0);
  });

  it('fills texture defaults for surface styles unless a map sets its own', () => {
    expect(surfaceStyle({ color: 1 })).toEqual({ color: 1, textureSize: 256, anisotropy: 4, roughness: 1 });
    expect(surfaceStyle({ color: 1, textureSize: 128, roughness: 0.5 })).toEqual({ color: 1, textureSize: 128, anisotropy: 4, roughness: 0.5 });
  });

  it('gives every registered map a complete set of resolved fields', () => {
    for (const map of AVAILABLE_MAPS) {
      expect(map.lapCount, map.name).toBeGreaterThan(0);
      expect(map.itemBoxLook, map.name).toBeDefined();
    }
    expect(RING_TEST_MAP.lapCount).toBe(DEFAULT_RACE.lapCount);
    expect(NATURE.shoulder).toEqual(DEFAULT_SHOULDER);
    expect(SPACE.shoulder).toEqual(DEFAULT_SHOULDER);
  });
});

describe('per-map item overrides', () => {
  it('keeps every default that a map does not override', () => {
    const items = createRuntimeItems({ hairball: { speedMetersPerSecond: 10 }, boost: { durationSeconds: 7 } });
    expect(items.hairball.speedMetersPerSecond).toBe(10);
    expect(items.hairball.rangeMeters).toBe(DEFAULT_ITEMS.hairball.rangeMeters);
    expect(items.boost.durationSeconds).toBe(7);
    expect(items.boxRadius).toBe(DEFAULT_ITEMS.boxRadius);
  });

  it('never changes the shared defaults', () => {
    createRuntimeItems({ boxRadius: 99, hairball: { stunSeconds: 99 } });
    expect(DEFAULT_ITEMS.boxRadius).not.toBe(99);
    expect(DEFAULT_ITEMS.hairball.stunSeconds).not.toBe(99);
  });

  it('resets in place so bound debug controllers keep their objects', () => {
    const items = createRuntimeItems();
    const boundHairball = items.hairball;
    resetRuntimeItems(items, { hairball: { stunSeconds: 2 } });
    expect(items.hairball).toBe(boundHairball);
    expect(boundHairball.stunSeconds).toBe(2);
    resetRuntimeItems(items);
    expect(boundHairball.stunSeconds).toBe(DEFAULT_ITEMS.hairball.stunSeconds);
  });
});

describe('per-map offroad and item box look', () => {
  const offroadSpeedAfter = (map: typeof RING_TEST_MAP): number => {
    const kart = createKartState(0, 0, 0);
    for (let tick = 0; tick < 90; tick += 1) stepAllKarts(DEFAULT_DRIVING, map, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], 1 / 60);
    expect(kart.onCarpet).toBe(false);
    return Math.hypot(kart.velocityX, kart.velocityZ);
  };

  it('uses the driving default off the route unless the map overrides it', () => {
    const defaultSpeed = offroadSpeedAfter(RING_TEST_MAP);
    expect(defaultSpeed).toBeLessThanOrEqual(DEFAULT_DRIVING.maxSpeed * DEFAULT_DRIVING.offroadSpeedFactor + 0.01);
    const slowSpeed = offroadSpeedAfter({ ...RING_TEST_MAP, offroad: { speedFactor: 0.2, accelerationFactor: 0.3 } });
    expect(slowSpeed).toBeLessThanOrEqual(DEFAULT_DRIVING.maxSpeed * 0.2 + 0.01);
    expect(slowSpeed).toBeLessThan(defaultSpeed);
  });

  it('draws item boxes with the map look and the default look otherwise', () => {
    const colorOf = (view: ItemBoxView): number => ((view.object.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex();
    expect(colorOf(new ItemBoxView(RING_TEST_MAP))).toBe(DEFAULT_ITEM_BOX_LOOK.color);
    expect(colorOf(new ItemBoxView({ ...RING_TEST_MAP, itemBoxLook: { ...DEFAULT_ITEM_BOX_LOOK, color: 0x123456 } }))).toBe(0x123456);
  });
});
