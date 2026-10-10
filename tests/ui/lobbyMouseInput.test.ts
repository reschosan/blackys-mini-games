import { describe, expect, it } from 'vitest';
import { CAT_PRESETS } from '../../src/shared/config/catAppearance';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { LobbyCustomization, rowsFor } from '../../src/party/lobby/catCustomization';
import { AiWizard } from '../../src/party/lobby/aiWizard';

function gamepadPlayer(gamepadIndex: number): JoinedPlayer {
  return { source: { kind: 'gamepad', gamepadIndex }, deviceName: `Gamepad ${gamepadIndex + 1}` };
}

describe('LobbyCustomization mouse equivalents (selectRow/changeValue)', () => {
  it('selectRow moves the cursor exactly like navigating there would', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);

    customization.selectRow(player, 2);

    expect(customization.entryFor(player)?.selectedRow).toBe(2);
  });

  it('selectRow ignores an out-of-range index', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);

    const before = customization.entryFor(player)?.selectedRow;

    customization.selectRow(player, 999);

    expect(customization.entryFor(player)?.selectedRow).toBe(before);
  });

  it('changeValue on a non-ready row cycles the appearance, same as steering would', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    customization.selectRow(player, rowsFor(customization.entryFor(player)!).indexOf('furColor'));
    const before = customization.entryFor(player)?.appearance.furColor;

    customization.changeValue(player, 1);

    expect(customization.entryFor(player)?.appearance.furColor).not.toBe(before);
  });

  it('changes the look but keeps the name when changing cat templates', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    const name = customization.entryFor(player)!.appearance.name;

    customization.changeValue(player, 1);
    expect(customization.entryFor(player)?.appearance).toMatchObject({ name, furColor: CAT_PRESETS[1]!.furColor });

    customization.changeValue(player, 1);
    expect(customization.entryFor(player)?.appearance).toMatchObject({ name, furColor: CAT_PRESETS[2]!.furColor });
  });

  it('selectRow on the ready row toggles ready directly, like a button', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    const readyRowIndex = rowsFor(customization.entryFor(player)!).indexOf('ready');

    customization.selectRow(player, readyRowIndex);
    expect(customization.entryFor(player)?.ready).toBe(true);

    customization.selectRow(player, readyRowIndex);
    expect(customization.entryFor(player)?.ready).toBe(false);
  });

  it('lets confirm set ready from any personalization row', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);

    const rowBefore = customization.entryFor(player)?.selectedRow;

    customization.update([player], [NEUTRAL_INPUT], () => null);
    customization.update([player], [{ ...NEUTRAL_INPUT, confirm: true }], () => null);

    expect(customization.entryFor(player)?.selectedRow).toBe(rowBefore);
    expect(customization.entryFor(player)?.ready).toBe(true);
  });
});

describe('AiWizard mouse equivalents (selectRow/changeValue)', () => {
  it('selectRow and changeValue only ever affect the currently focused slot', () => {
    const wizard = new AiWizard();
    wizard.syncCount(1);

    wizard.selectRow(1); // "Aktion" row
    wizard.changeValue(1); // toggles pendingAction

    expect(wizard.viewFor(0, true)?.selectedRow).toBe(1);
    expect(wizard.viewFor(0, true)?.pendingAction).toBe('back');
  });

  it('changeValue on the difficulty row cycles it, same as steering would', () => {
    const wizard = new AiWizard();
    wizard.syncCount(1);
    const before = wizard.difficultyFor(0);

    wizard.changeValue(1);

    expect(wizard.difficultyFor(0)).not.toBe(before);
  });

  it('confirmFocused sets every AI cat up at once with the strength of the focused one', () => {
    const wizard = new AiWizard();
    wizard.syncCount(3);
    wizard.changeValue(1);
    const chosen = wizard.viewFor(0, true)?.difficulty;

    expect(wizard.confirmFocused()).toBe(false);

    expect(wizard.focusIndex).toBe(-1);
    expect(wizard.allReady()).toBe(true);
    expect([0, 1, 2].map((slot) => wizard.difficultyFor(slot))).toEqual([chosen, chosen, chosen]);
  });

  it('confirmFocused on "Zurück" of the first slot asks the caller to un-ready player one', () => {
    const wizard = new AiWizard();
    wizard.syncCount(1);
    wizard.selectRow(1);
    wizard.changeValue(1);

    expect(wizard.confirmFocused()).toBe(true);
  });

  it('going back resets "Aktion" to "Bereit" so the next round starts on the default again', () => {
    const wizard = new AiWizard();
    wizard.syncCount(1);
    wizard.selectRow(1);
    wizard.changeValue(1);
    wizard.confirmFocused();

    expect(wizard.viewFor(0, true)).toMatchObject({ pendingAction: 'confirm', selectedRow: 0, ready: false });
  });
});

describe('LobbyCustomization leave row', () => {
  function setup() {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    const leaveIndex = rowsFor(customization.entryFor(player)!).indexOf('leave');
    return { customization, player, leaveIndex };
  }

  it('puts "Ausklinken" after "Bereit" as the last row', () => {
    const { customization, player } = setup();
    const rows = rowsFor(customization.entryFor(player)!);
    expect(rows.slice(-2)).toEqual(['ready', 'leave']);
  });

  it('confirming on the leave row asks to remove the player instead of toggling ready', () => {
    const { customization, player, leaveIndex } = setup();
    customization.selectRow(player, leaveIndex);
    customization.update([player], [NEUTRAL_INPUT], () => null);

    const leavers = customization.update([player], [{ ...NEUTRAL_INPUT, confirm: true }], () => null);

    expect(leavers).toEqual([player]);
    expect(customization.entryFor(player)?.ready).toBe(false);
  });

  it('confirming on any other row still toggles ready and nobody leaves', () => {
    const { customization, player } = setup();

    customization.update([player], [NEUTRAL_INPUT], () => null);
    const leavers = customization.update([player], [{ ...NEUTRAL_INPUT, confirm: true }], () => null);

    expect(leavers).toEqual([]);
    expect(customization.entryFor(player)?.ready).toBe(true);
  });

  it('steering left or right on the leave row changes nothing', () => {
    const { customization, player, leaveIndex } = setup();
    customization.selectRow(player, leaveIndex);
    const before = customization.entryFor(player)!.appearance;
    customization.update([player], [NEUTRAL_INPUT], () => null);

    customization.changeValue(player, 1);
    customization.update([player], [{ ...NEUTRAL_INPUT, steer: 1 }], () => null);

    expect(customization.entryFor(player)?.appearance).toEqual(before);
  });
});

describe('LobbyCustomization after returning from another screen', () => {
  it('ignores a confirm that is still held until it was released once', () => {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    customization.update([player], [NEUTRAL_INPUT], () => null);

    customization.holdInputsUntilRelease();
    customization.update([player], [{ ...NEUTRAL_INPUT, confirm: true }], () => null);
    expect(customization.entryFor(player)?.ready).toBe(false);

    customization.update([player], [NEUTRAL_INPUT], () => null);
    customization.update([player], [{ ...NEUTRAL_INPUT, confirm: true }], () => null);
    expect(customization.entryFor(player)?.ready).toBe(true);
  });
});

describe('hair length row', () => {
  function setup() {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    customization.showPage([player], 'cat');
    const rowIndex = (): number => rowsFor(customization.entryFor(player)!).indexOf('hairLength');
    return { customization, player, rowIndex };
  }

  it('sits between the pattern rows and the eye color', () => {
    const { customization, player } = setup();
    const rows = rowsFor(customization.entryFor(player)!);
    expect(rows.indexOf('hairLength')).toBe(rows.indexOf('eyeColor') - 2);
    expect(rows.indexOf('mane')).toBe(rows.indexOf('eyeColor') - 1);
    expect(rows.indexOf('hairLength')).toBeGreaterThan(rows.indexOf('pattern'));
  });

  it('switches between short and long hair and keeps every other value', () => {
    const { customization, player, rowIndex } = setup();
    const before = customization.entryFor(player)!.appearance;
    customization.selectRow(player, rowIndex());

    customization.changeValue(player, 1);
    expect(customization.entryFor(player)?.appearance).toEqual({ ...before, hairLength: 'long' });

    customization.changeValue(player, 1);
    expect(customization.entryFor(player)?.appearance.hairLength).toBe('short');
  });

  it('a preset sets the hair length again, like every other value', () => {
    const { customization, player, rowIndex } = setup();
    customization.selectRow(player, rowIndex());
    customization.changeValue(player, 1);
    customization.selectRow(player, rowsFor(customization.entryFor(player)!).indexOf('preset'));

    customization.changeValue(player, 1);

    expect(customization.entryFor(player)?.appearance.hairLength).toBe('short');
  });
});

describe('mane row', () => {
  function setup() {
    const customization = new LobbyCustomization();
    const player = gamepadPlayer(0);
    customization.syncPlayers([player]);
    customization.showPage([player], 'cat');
    const rowIndex = (): number => rowsFor(customization.entryFor(player)!).indexOf('mane');
    return { customization, player, rowIndex };
  }

  it('cycles through none, ruff and lion and wraps around, keeping every other value', () => {
    const { customization, player, rowIndex } = setup();
    const before = customization.entryFor(player)!.appearance;
    customization.selectRow(player, rowIndex());

    const seen = [0, 1, 2, 3].map(() => {
      customization.changeValue(player, 1);
      return customization.entryFor(player)!.appearance.mane;
    });

    expect(seen).toEqual(['ruff', 'lion', 'none', 'ruff']);
    expect(customization.entryFor(player)?.appearance).toEqual({ ...before, mane: 'ruff' });
  });

  it('works with short and with long hair', () => {
    const { customization, player, rowIndex } = setup();
    customization.selectRow(player, rowIndex());
    customization.changeValue(player, 1);
    customization.selectRow(player, rowIndex() - 1);
    customization.changeValue(player, 1);

    expect(customization.entryFor(player)?.appearance).toMatchObject({ hairLength: 'long', mane: 'ruff' });
  });
});
