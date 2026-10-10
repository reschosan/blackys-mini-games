import { describe, expect, it } from 'vitest';
import { KART_MODES, kartModeById } from '../../src/games/kart/modes/kartModes';
import { GAMES } from '../../src/party/games';

describe('kart modes', () => {
  it('start with the race, which is the default of the selection', () => {
    expect(KART_MODES[0]!.id).toBe('race');
    expect(GAMES[0]!.id).toBe('race');
  });

  it('have their own id, a title, a summary and rules a player can read', () => {
    expect(new Set(KART_MODES.map((mode) => mode.id)).size).toBe(KART_MODES.length);
    for (const mode of KART_MODES) {
      expect(mode.title.length).toBeGreaterThan(0);
      expect(mode.summary.length).toBeGreaterThan(0);
      expect(mode.rules.length).toBeGreaterThan(0);
    }
  });

  it('race with items on the laps of the map, time trial without items over one lap', () => {
    expect(kartModeById('race')).toMatchObject({ itemsEnabled: true, lapCount: null });
    expect(kartModeById('timetrial')).toMatchObject({ itemsEnabled: false, lapCount: 1 });
  });

  it('are found by id, and an unknown id is no mode', () => {
    expect(kartModeById('pong')).toBeUndefined();
    expect(kartModeById('toString')).toBeUndefined();
  });

  it('are all offered by the party first, in the same order, before the games of the other engines', () => {
    expect(GAMES.slice(0, KART_MODES.length).map((game) => game.id)).toEqual(KART_MODES.map((mode) => mode.id));
    expect(GAMES.slice(KART_MODES.length).map((game) => game.id)).toContain('memory');
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(GAMES.length);
  });
});
