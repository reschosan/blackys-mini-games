import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatAppearance, MAX_CAT_NAME_LENGTH } from '../../src/shared/config/catAppearance';
import { CAT_NAMES, firstFreeCatName, nextFreeCatName, type CatNameId } from '../../src/shared/config/catNames';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { LobbyCustomization, rowsFor } from '../../src/party/lobby/catCustomization';

function gamepadPlayer(gamepadIndex: number): JoinedPlayer {
  return { source: { kind: 'gamepad', gamepadIndex }, deviceName: `Gamepad ${gamepadIndex + 1}` };
}

function press(customization: LobbyCustomization, players: readonly JoinedPlayer[], playerIndex: number, input: Partial<InputFrame>): void {
  const neutral = players.map(() => NEUTRAL_INPUT);
  customization.update(players, neutral);
  customization.update(
    players,
    neutral.map((frame, index) => (index === playerIndex ? { ...frame, ...input } : frame)),
  );
}

function setup(playerCount: number): { customization: LobbyCustomization; players: JoinedPlayer[] } {
  const players = Array.from({ length: playerCount }, (_, index) => gamepadPlayer(index));
  const customization = new LobbyCustomization();
  customization.syncPlayers(players);
  customization.showPage(players, 'cat');
  return { customization, players };
}

const nameOf = (customization: LobbyCustomization, player: JoinedPlayer): string => customization.entryFor(player)!.appearance.name;

describe('fixed cat names', () => {
  it('offers ten valid, different names', () => {
    expect(CAT_NAMES).toHaveLength(10);
    expect(new Set(CAT_NAMES).size).toBe(10);
    for (const name of CAT_NAMES) expect(name.length).toBeLessThanOrEqual(MAX_CAT_NAME_LENGTH);
  });

  it('puts the name above the first setting and starts the cursor below it', () => {
    const { customization, players } = setup(1);
    const entry = customization.entryFor(players[0]!)!;
    expect(rowsFor(entry)[0]).toBe('name');
    expect(rowsFor(entry)[entry.selectedRow]).toBe('preset');
  });

  it('gives every joined player a different name from the start', () => {
    const { customization, players } = setup(4);
    const names = players.map((player) => nameOf(customization, player));
    expect(new Set(names).size).toBe(4);
    names.forEach((name) => expect(CAT_NAMES).toContain(name));
  });

  it('steps through the names with right and back with left', () => {
    const { customization, players } = setup(1);
    const player = players[0]!;
    customization.selectRow(player, rowsFor(customization.entryFor(player)!).indexOf('name'));
    const first = nameOf(customization, player);

    press(customization, players, 0, { steer: 1 });
    expect(nameOf(customization, player)).toBe(CAT_NAMES[(CAT_NAMES.indexOf(first as CatNameId) + 1) % CAT_NAMES.length]);
    press(customization, players, 0, { steer: -1 });
    expect(nameOf(customization, player)).toBe(first);
  });

  it('skips a name another player already has, in both directions', () => {
    const { customization, players } = setup(2);
    const [first, second] = players as [JoinedPlayer, JoinedPlayer];
    customization.selectRow(first, rowsFor(customization.entryFor(first)!).indexOf('name'));
    const taken = nameOf(customization, second);

    press(customization, players, 0, { steer: 1 });
    expect(nameOf(customization, first)).not.toBe(taken);
    press(customization, players, 0, { steer: -1 });
    press(customization, players, 0, { steer: -1 });
    expect(nameOf(customization, first)).not.toBe(taken);
  });

  it('never lets two players share a name, even when one steps through every name', () => {
    const { customization, players } = setup(3);
    const [first] = players as [JoinedPlayer];
    customization.selectRow(first, rowsFor(customization.entryFor(first)!).indexOf('name'));
    for (let step = 0; step < CAT_NAMES.length * 2; step += 1) {
      press(customization, players, 0, { steer: 1 });
      const names = players.map((player) => nameOf(customization, player));
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('confirm on the name row just sets ready; nothing is typed', () => {
    const { customization, players } = setup(1);
    const player = players[0]!;
    customization.selectRow(player, rowsFor(customization.entryFor(player)!).indexOf('name'));
    press(customization, players, 0, { confirm: true });
    expect(customization.entryFor(player)!.ready).toBe(true);
  });
});

describe('saved names', () => {
  function stubStorage(entries: Record<string, string>): void {
    const store = new Map(Object.entries(entries));
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: () => undefined } });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('keeps a saved cat name that is valid and free', () => {
    stubStorage({ 'catkart:cat:gamepad:0': JSON.stringify({ ...createCatAppearance(), name: CAT_NAMES[4] }) });
    const { customization, players } = setup(1);
    expect(nameOf(customization, players[0]!)).toBe(CAT_NAMES[4]);
  });

  it('replaces a saved name from an earlier version by the first free cat name', () => {
    stubStorage({ 'catkart:cat:gamepad:0': JSON.stringify({ ...createCatAppearance(), name: 'Luna' }) });
    const { customization, players } = setup(1);
    expect(nameOf(customization, players[0]!)).toBe(CAT_NAMES[0]);
  });

  it('gives the second player another name when both saved the same one', () => {
    const saved = JSON.stringify({ ...createCatAppearance(), name: CAT_NAMES[2] });
    stubStorage({ 'catkart:cat:gamepad:0': saved, 'catkart:cat:gamepad:1': saved });
    const { customization, players } = setup(2);
    expect(nameOf(customization, players[0]!)).toBe(CAT_NAMES[2]);
    expect(nameOf(customization, players[1]!)).not.toBe(CAT_NAMES[2]);
  });
});

describe('free name helpers', () => {
  it('firstFreeCatName takes the first name nobody has', () => {
    expect(firstFreeCatName(new Set())).toBe(CAT_NAMES[0]);
    expect(firstFreeCatName(new Set([CAT_NAMES[0]!, CAT_NAMES[1]!]))).toBe(CAT_NAMES[2]);
  });

  it('nextFreeCatName stays put when every other name is taken', () => {
    const others = new Set(CAT_NAMES.filter((name) => name !== CAT_NAMES[3]));
    expect(nextFreeCatName(CAT_NAMES[3]!, 1, others)).toBe(CAT_NAMES[3]);
  });

  it('nextFreeCatName wraps around at both ends', () => {
    expect(nextFreeCatName(CAT_NAMES[9]!, 1, new Set())).toBe(CAT_NAMES[0]);
    expect(nextFreeCatName(CAT_NAMES[0]!, -1, new Set())).toBe(CAT_NAMES[9]);
  });
});
