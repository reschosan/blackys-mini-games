import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { parseGuestControl, parseHostMessage, serializeGuestProfile, serializeGuestTap, serializeHostMessage } from '../../src/shared/net/messages';
import { parseGuestLobbyState, parseLobbyTap, type GuestLobbyState } from '../../src/games/kart/replication/lobbyState';

const MAPS = 3;
const GAMES = 2;

function lobby(overrides: Partial<GuestLobbyState> = {}): GuestLobbyState {
  return {
    stage: 'customizing',
    seat: 1,
    game: 0,
    entry: {
      appearance: createCatAppearance(undefined, 'Mauzi'),
      loadout: createKartLoadout(1),
      plane: 'jet',
      level: 1,
      page: 'cat',
      presetIndex: 2,
      ready: false,
      selectedRow: 3,
    },
    picks: [],
    ...overrides,
  };
}

describe('lobby state for a guest', () => {
  it('survives the trip as a message', () => {
    const sent = lobby({ stage: 'trackVote', picks: [{ slot: 0, name: 'Felix', color: '#e0533d', mapIndex: 3, confirmed: true }] });
    const received = parseHostMessage(serializeHostMessage({ kind: 'lobby', lobby: sent }));
    expect(received?.kind === 'lobby' && parseGuestLobbyState(received.lobby, MAPS)).toEqual(sent);
  });

  it.each([
    ['an unknown stage', { stage: 'party' }],
    ['a game that does not exist', { game: 99 }],
    ['a seat out of range', { seat: 20 }],
    ['a cat that does not exist', { entry: { ...lobby().entry, appearance: { ...createCatAppearance(), furColor: 'rainbow' } } }],
    ['a kart that does not exist', { entry: { ...lobby().entry, loadout: { kartType: 'rocket', wheels: 'standard', colorIndex: 0 } } }],
    ['a cursor far outside the card', { entry: { ...lobby().entry, selectedRow: 500 } }],
    ['a pick on a map that does not exist', { picks: [{ slot: 0, name: 'x', color: '#ffffff', mapIndex: 9, confirmed: false }] }],
    ['a pick with a colour that is no colour', { picks: [{ slot: 0, name: 'x', color: 'red', mapIndex: 0, confirmed: false }] }],
    ['too many picks', { picks: Array.from({ length: 12 }, () => ({ slot: 0, name: 'x', color: '#ffffff', mapIndex: 0, confirmed: false })) }],
  ])('is refused with %s', (_reason, change) => {
    expect(parseGuestLobbyState({ ...lobby(), ...change }, MAPS)).toBeNull();
  });

  it('takes a lobby without a card (the guest is not in the list yet)', () => {
    expect(parseGuestLobbyState(lobby({ entry: null }), MAPS)?.entry).toBeNull();
  });
});

describe('what a guest sends from its own lobby screen', () => {
  it('sends the saved cat and kart', () => {
    const profile = { kind: 'profile' as const, appearance: createCatAppearance(undefined, 'Mauzi'), loadout: createKartLoadout(2) };
    expect(parseGuestControl(serializeGuestProfile(profile))).toEqual(profile);
  });

  it('refuses a cat or kart that does not exist', () => {
    const bad = JSON.stringify({ k: 'f', a: { ...createCatAppearance(), pattern: 'zebra' }, l: createKartLoadout() });
    expect(parseGuestControl(bad)).toBeNull();
    expect(parseGuestControl(JSON.stringify({ k: 'f', a: createCatAppearance(), l: 'tank' }))).toBeNull();
  });

  it.each([
    { target: 'row', value: 4 },
    { target: 'arrow', value: -1 },
    { target: 'arrow', value: 1 },
    { target: 'game', value: 1 },
    { target: 'map', value: 2 },
    { target: 'back' },
    { target: 'leave' },
  ] as const)('sends the tap %j', (tap) => {
    expect(parseGuestControl(serializeGuestTap({ kind: 'tap', tap }))).toEqual({ kind: 'tap', tap });
    expect(parseLobbyTap(tap, MAPS, GAMES)).toEqual(tap);
  });

  it.each([
    { target: 'row', value: -1 },
    { target: 'row', value: 1000 },
    { target: 'arrow', value: 2 },
    { target: 'map', value: 3 },
    { target: 'map', value: 'x' },
    { target: 'game', value: 2 },
    { target: 'game', value: -1 },
    { target: 'format-disk' },
    {},
    'row',
  ])('refuses the tap %j', (tap) => {
    expect(parseLobbyTap(tap, MAPS, GAMES)).toBeNull();
  });
});
