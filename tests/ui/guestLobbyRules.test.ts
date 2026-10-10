import { beforeEach, describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { CAT_NAMES } from '../../src/shared/config/catNames';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { LobbyCustomization } from '../../src/party/lobby/catCustomization';
import { MapVoteStage } from '../../src/party/lobby/mapVote';

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage: new MemoryStorage() };
});

function twoPlayers(): { readonly players: readonly JoinedPlayer[]; readonly customization: LobbyCustomization } {
  const customization = new LobbyCustomization();
  const first = { source: { kind: 'touch' as const }, deviceName: 'Touch' };
  const second = { source: { kind: 'remote' as const, remoteId: 1 }, deviceName: 'Handy 1' };
  customization.syncPlayers([first, second]);
  return { players: [first, second], customization };
}

describe('taking over the cat a guest phone has saved', () => {
  it('keeps the look and the kart, and the name only when it is a free cat name', () => {
    const { players, customization } = twoPlayers();
    const hostName = customization.entryFor(players[0]!)!.appearance.name;
    const guestEntry = customization.entryFor(players[1]!)!;
    const guestName = guestEntry.appearance.name;
    customization.applyProfile(players[1]!, { ...createCatAppearance(undefined, hostName), furColor: 'red', pattern: 'tabby' }, createKartLoadout(3, 'tank'));
    expect(guestEntry.appearance).toMatchObject({ furColor: 'red', pattern: 'tabby', name: guestName });
    expect(guestEntry.loadout.kartType).toBe('tank');
    expect(customization.entryFor(players[0]!)!.appearance.name).toBe(hostName);
  });

  it('takes a free saved name', () => {
    const { players, customization } = twoPlayers();
    const taken = new Set(players.map((player) => customization.entryFor(player)!.appearance.name));
    const free = CAT_NAMES.filter((name) => !taken.has(name)).at(-1)!;
    customization.applyProfile(players[1]!, createCatAppearance(undefined, free), createKartLoadout());
    expect(customization.entryFor(players[1]!)!.appearance.name).toBe(free);
  });
});

describe('a guest votes with taps on its own screen', () => {
  it('first tap points at the map, second tap locks it in, independent of other players', () => {
    const { players } = twoPlayers();
    const vote = new MapVoteStage(3);
    vote.start(players);
    vote.tapMap(players[1]!, 2);
    expect(vote.pickFor(players[1]!)).toEqual({ mapIndex: 2, confirmed: false });
    vote.tapMap(players[0]!, 1);
    vote.tapMap(players[1]!, 2);
    expect(vote.pickFor(players[1]!)).toEqual({ mapIndex: 2, confirmed: true });
    expect(vote.pickFor(players[0]!)).toEqual({ mapIndex: 1, confirmed: false });
  });

  it('ignores a map that does not exist and a vote that is already locked', () => {
    const { players } = twoPlayers();
    const vote = new MapVoteStage(3);
    vote.start(players);
    vote.tapMap(players[1]!, 7);
    expect(vote.pickFor(players[1]!)?.mapIndex).toBe(0);
    vote.tapMap(players[1]!, 1);
    vote.tapMap(players[1]!, 1);
    vote.tapMap(players[1]!, 2);
    expect(vote.pickFor(players[1]!)).toEqual({ mapIndex: 1, confirmed: true });
  });
});
