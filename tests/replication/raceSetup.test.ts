import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { parseRaceEvent, parseRaceSetup, type RaceSetup } from '../../src/games/kart/replication/raceSetup';

const MAPS = 3;

function setup(overrides: Record<string, unknown> = {}): unknown {
  const base: RaceSetup = {
    buildId: 'abc',
    mode: 'race',
    mapIndex: 1,
    lapCount: 3,
    seat: 1,
    snapshotHz: 20,
    resume: false,
    players: [
      { slot: 0, isAi: false, name: 'Mauzi', color: '#e0533d', appearance: createCatAppearance(), loadout: createKartLoadout(0) },
      { slot: 1, isAi: false, name: 'Felix', color: '#3d8fe0', appearance: createCatAppearance(), loadout: createKartLoadout(1, 'tank') },
    ],
  };
  return JSON.parse(JSON.stringify({ ...base, ...overrides }));
}

describe('race setup', () => {
  it('survives the trip as JSON', () => {
    expect(parseRaceSetup(setup(), MAPS)).toEqual(setup());
  });

  it.each([
    ['a game that does not exist', { mode: 'pong' }],
    ['a game that is no text', { mode: 4 }],
    ['a map that does not exist', { mapIndex: 3 }],
    ['a negative map', { mapIndex: -1 }],
    ['no laps', { lapCount: 0 }],
    ['far too many laps', { lapCount: 100 }],
    ['a seat nobody sits on', { seat: 5 }],
    ['an absurd snapshot rate', { snapshotHz: 1000 }],
    ['a build id that is no text', { buildId: 7 }],
    ['a build id that is far too long', { buildId: 'x'.repeat(100) }],
    ['no players', { players: [] }],
    [
      'a colour that is no colour',
      { players: [{ slot: 0, isAi: false, name: 'x', color: 'red', appearance: createCatAppearance(), loadout: createKartLoadout() }] },
    ],
    [
      'a cat that does not exist',
      {
        players: [
          { slot: 1, isAi: false, name: 'x', color: '#ffffff', appearance: { ...createCatAppearance(), furColor: 'rainbow' }, loadout: createKartLoadout() },
        ],
      },
    ],
    [
      'a kart that does not exist',
      {
        players: [
          {
            slot: 1,
            isAi: false,
            name: 'x',
            color: '#ffffff',
            appearance: createCatAppearance(),
            loadout: { kartType: 'rocket', wheels: 'standard', colorIndex: 0 },
          },
        ],
      },
    ],
  ])('refuses %s', (_reason, change) => {
    expect(parseRaceSetup(setup(change), MAPS)).toBeNull();
  });

  it('refuses anything that is not an object', () => {
    for (const value of [null, 'text', 5, [], undefined]) expect(parseRaceSetup(value, MAPS)).toBeNull();
  });
});

describe('race events', () => {
  it('reads every kind of event', () => {
    expect(parseRaceEvent({ type: 'itemUsed', slot: 1, item: 'boost' })).toEqual({ type: 'itemUsed', slot: 1, item: 'boost' });
    expect(parseRaceEvent({ type: 'collision', slot: 0 })).toEqual({ type: 'collision', slot: 0 });
    expect(parseRaceEvent({ type: 'go' })).toEqual({ type: 'go' });
    const rows = [{ place: 1, name: 'Mauzi', color: '#e0533d', time: '1:02.3', score: '+4 · 9' }];
    expect(parseRaceEvent({ type: 'results', rows })).toEqual({ type: 'results', rows });
  });

  it.each([
    ['an unknown kind', { type: 'explodeEverything' }],
    ['an inherited name', { type: 'constructor' }],
    ['a slot out of range', { type: 'collision', slot: 99 }],
    ['results with a broken row', { type: 'results', rows: [{ place: 1 }] }],
    ['results with too many rows', { type: 'results', rows: Array.from({ length: 20 }, () => ({ place: 1, name: 'a', color: '#ffffff', time: '0' })) }],
    ['no type', {}],
  ])('refuses %s', (_reason, event) => {
    expect(parseRaceEvent(event)).toBeNull();
  });
});
