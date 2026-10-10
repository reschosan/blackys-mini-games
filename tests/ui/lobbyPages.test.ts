import { planeLabel } from '../../src/shared/i18n/labels';
import { describe, expect, it } from 'vitest';
import { PLANE_TYPES } from '../../src/shared/config/planeTypes';
import { inLanguage, LANGUAGES } from '../../src/shared/i18n/language';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { LobbyCustomization, rowsFor } from '../../src/party/lobby/catCustomization';

const player: JoinedPlayer = { source: { kind: 'gamepad', gamepadIndex: 0 }, deviceName: 'Gamepad 1' };

function lobby(): LobbyCustomization {
  const customization = new LobbyCustomization();
  customization.syncPlayers([player]);
  return customization;
}

describe('the pages of the lobby card', () => {
  it('starts with the preset of the cat only: no other cat rows, no kart, no plane before a game is chosen', () => {
    expect(rowsFor(lobby().entryFor(player)!)).toEqual(['preset', 'ready', 'leave']);
  });

  it('shows the whole cat on the page of the lava game, the whole card (cat and kart) on the kart page, the plane alone and the level of memory alone', () => {
    const customization = lobby();
    customization.setReady(player, true);
    customization.showPage([player], 'cat');
    expect(customization.entryFor(player)!.ready).toBe(false);
    const catRows = rowsFor(customization.entryFor(player)!);
    expect(catRows).toContain('furColor');
    expect(catRows).not.toContain('kartType');
    customization.showPage([player], 'kart');
    const kartRows = rowsFor(customization.entryFor(player)!);
    expect(kartRows).toContain('furColor');
    expect(kartRows.slice(-5)).toEqual(['kartType', 'wheels', 'kartColor', 'ready', 'leave']);
    customization.showPage([player], 'plane');
    expect(rowsFor(customization.entryFor(player)!)).toEqual(['planeType', 'ready', 'leave']);
    customization.showPage([player], 'memory');
    expect(rowsFor(customization.entryFor(player)!)).toEqual(['memoryLevel', 'ready', 'leave']);
    customization.showPage([player], 'start');
    expect(customization.pageOf(player)).toBe('start');
  });

  it('cycles through the plane types and keeps the choice for the seat', () => {
    const customization = lobby();
    customization.showPage([player], 'plane');
    expect(customization.planeOf(player, 0)).toBe('jet');
    for (const expected of ['flitzer', 'ufo', 'liner', 'jet'] as const) {
      customization.changeValue(player, 1);
      expect(customization.planeOf(player, 0)).toBe(expected);
    }
  });

  it('gives a seat without a player (AI) a plane by its place', () => {
    expect(lobby().planeOf(undefined, 1)).toBe(PLANE_TYPES[1]);
  });

  it('names the plane types short enough for the small screens', () => {
    for (const language of LANGUAGES) for (const type of PLANE_TYPES) expect(inLanguage(language, () => planeLabel(type)).length).toBeLessThanOrEqual(8);
  });
});
