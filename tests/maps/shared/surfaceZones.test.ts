import { describe, expect, it } from 'vitest';
import { driveFactorsOf } from '../../../src/games/kart/ai/raceAiInput';
import { createRuntimeDriving } from '../../../src/shared/config/driving';
import { createKartLoadout, type WheelTypeId } from '../../../src/shared/config/kartLoadout';
import { NEUTRAL_INPUT } from '../../../src/shared/input/actions';
import { createKartState, forwardSpeedOf, stepKart, type KartDriveFactors } from '../../../src/games/kart/kart/kartState';
import type { MapPlacement } from '../../../src/games/kart/maps/shared/mapSettings';
import { withMapPlacements } from '../../../src/games/kart/maps/shared/mapPlacements';
import { AVAILABLE_MAPS } from '../../../src/games/kart/maps/registry';
import { RING_TEST_MAP } from '../../support/ringTestMap';
import { surfaceKindAt, updateKartSurface } from '../../../src/games/kart/maps/shared/surfaceZones';
import type { MapConfig } from '../../../src/games/kart/maps/shared/mapConfig';

const STEP = 1 / 60;
const STRAIGHT: Omit<MapConfig, 'itemBoxes'> = {
  ...RING_TEST_MAP,
  walls: [],
  obstacles: [],
  waypoints: [
    { x: 0, z: 0 },
    { x: 50, z: 0 },
    { x: 100, z: 0 },
  ],
  raceFormat: 'pointToPoint',
};

function mapWith(placements: readonly MapPlacement[]): MapConfig {
  return withMapPlacements(STRAIGHT, placements);
}

function wheelFactors(wheels: WheelTypeId): KartDriveFactors {
  return driveFactorsOf(createKartLoadout(0, 'car', wheels));
}

function topSpeedOn(kind: 'mud' | null, factors: KartDriveFactors): number {
  const config = createRuntimeDriving();
  const kart = createKartState(0, 0, 0);
  kart.surfaceKind = kind;
  for (let tick = 0; tick < 600; tick += 1) stepKart(config, kart, { ...NEUTRAL_INPUT, accelerate: true }, STEP, factors);
  return forwardSpeedOf(kart);
}

describe('surface zone placement', () => {
  it('turns a placement into a rect across the route at the given meter', () => {
    const map = mapWith([{ type: 'surfaceZone', kind: 'mud', level: 0, meter: 50, length: 10 }]);
    const [zone] = map.surfaceZones!;
    expect(zone).toMatchObject({ kind: 'mud', levelId: 'ground' });
    expect(zone!.rect).toMatchObject({ x: 50, z: 0, width: 10 });
    expect(surfaceKindAt(map, 50, 0, 'ground')).toBe('mud');
    expect(surfaceKindAt(map, 70, 0, 'ground')).toBeNull();
    expect(surfaceKindAt(map, 50, 0, 'first')).toBeNull();
  });

  it('rejects a zone that does not fit on a straight segment', () => {
    expect(() => mapWith([{ type: 'surfaceZone', kind: 'mud', level: 0, meter: 3, length: 10 }])).toThrow(/straight segment/);
  });

  it('places zones on every real map without leaving the route', () => {
    for (const map of AVAILABLE_MAPS) expect(map.surfaceZones, map.name).toBeDefined();
    expect(AVAILABLE_MAPS.find((map) => map.name === 'Naturpfad')!.surfaceZones!.map((zone) => zone.kind)).toContain('mud');
    expect(AVAILABLE_MAPS.find((map) => map.name === 'Mondbasis')!.surfaceZones!.map((zone) => zone.kind)).toContain('moondust');
  });
});

describe('driving on surface zones', () => {
  const map = mapWith([{ type: 'surfaceZone', kind: 'puddle', level: 0, meter: 50, length: 10 }]);

  it('slows the kart in mud but not on a plain road', () => {
    const plain = wheelFactors('standard');
    expect(topSpeedOn('mud', plain)).toBeLessThan(topSpeedOn(null, plain) * 0.9);
  });

  it('slows every kart in mud by the same share, whatever its wheels', () => {
    const shareLeft = (wheels: WheelTypeId): number => topSpeedOn('mud', wheelFactors(wheels)) / topSpeedOn(null, wheelFactors(wheels));
    for (const wheels of ['offroad', 'driftTires', 'slick'] as const) expect(shareLeft(wheels)).toBeCloseTo(shareLeft('standard'), 2);
  });

  it('applies no zone effect without kart factors, keeping older simulations unchanged', () => {
    expect(topSpeedOn('mud', { topSpeedFactor: 1, accelerationFactor: 1 })).toBeCloseTo(topSpeedOn(null, { topSpeedFactor: 1, accelerationFactor: 1 }));
  });

  it('washes off a running boost the moment a puddle is entered', () => {
    const kart = createKartState(50, 0, 0);
    kart.boostSeconds = 3;
    updateKartSurface(map, kart);
    expect(kart.surfaceKind).toBe('puddle');
    expect(kart.boostSeconds).toBe(0);

    kart.boostSeconds = 2;
    updateKartSurface(map, kart);
    expect(kart.boostSeconds).toBe(2);
  });
});
