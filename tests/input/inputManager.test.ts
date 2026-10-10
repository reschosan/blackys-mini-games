import { beforeEach, describe, expect, it } from 'vitest';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import { MAX_PLAYERS } from '../../src/shared/config/players';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { InputManager } from '../../src/shared/input/inputManager';
import { MapVoteStage } from '../../src/party/lobby/mapVote';
import { AiWizard } from '../../src/party/lobby/aiWizard';

function stubGamepads(pads: readonly unknown[]): void {
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => pads, configurable: true });
}

function fullPad(pressedButtonIndex: number) {
  return {
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === pressedButtonIndex })),
    axes: [0, 0, 0, 0],
  };
}

function newManager(): InputManager {
  return new InputManager(createRuntimeTouchSteering());
}

const racing = { yaw: 0, forwardSpeed: 0, simpleMode: 'kartRelative' as const };

beforeEach(() => {
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  stubGamepads([]);
});

describe('InputManager gamepads', () => {
  it('lets a gamepad join with any button', () => {
    const input = newManager();
    stubGamepads([fullPad(3)]);

    input.pollJoins();

    expect(input.players.map((player) => player.source)).toEqual([{ kind: 'gamepad', gamepadIndex: 0 }]);
  });

  it('does not join the same gamepad twice', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    input.pollJoins();
    expect(input.players).toHaveLength(1);
  });

  it('waits until every button is released before gamepads can join again after a reset', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.reset();

    input.pollJoins();
    expect(input.players).toHaveLength(0);

    stubGamepads([fullPad(-1)]);
    input.pollJoins();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    expect(input.players).toHaveLength(1);
  });

  it('reports a joined gamepad that was unplugged', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    stubGamepads([]);
    expect(input.disconnectedDeviceNames()).toEqual(['Gamepad 1']);
    expect(input.readFrames()[0]).toEqual(NEUTRAL_INPUT);
  });

  it('ignores gamepads while the page has no focus', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => false };
    expect(input.readFrames()[0]).toEqual(NEUTRAL_INPUT);
  });
});

describe('InputManager touch player', () => {
  it('joins once and is named Touch', () => {
    const input = newManager();
    expect(input.joinTouch()).toBe(true);
    expect(input.joinTouch()).toBe(false);
    expect(input.hasTouchPlayer()).toBe(true);
    expect(input.players).toEqual([{ source: { kind: 'touch' }, deviceName: 'Touch' }]);
  });

  it('stops joining at MAX_PLAYERS', () => {
    const input = newManager();
    stubGamepads(Array.from({ length: MAX_PLAYERS }, () => fullPad(0)));
    input.pollJoins();
    expect(input.players).toHaveLength(MAX_PLAYERS);
    expect(input.joinTouch()).toBe(false);
  });

  it('sits next to gamepad players and keeps its own frames', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    input.joinTouch();
    input.touch.setHeld('right', true);

    const frames = input.readFrames();

    expect(input.players.map((player) => player.source.kind)).toEqual(['gamepad', 'touch']);
    expect(frames[0]).toMatchObject({ steer: 0, confirm: true });
    expect(frames[1]).toMatchObject({ steer: 1 });
  });

  describe('in the lobby and menus (no kart orientation)', () => {
    it('maps the cross to steering, row moves, confirm and settings', () => {
      const input = newManager();
      input.joinTouch();
      input.touch.setHeld('left', true);
      input.touch.setHeld('up', true);
      expect(input.readFrames()[0]).toMatchObject({ steer: -1, menuUp: true, menuDown: false, confirm: false });
      input.touch.setHeld('left', false);
      input.touch.setHeld('up', false);
      input.touch.setHeld('confirm', true);
      input.touch.setHeld('settings', true);
      expect(input.readFrames()[0]).toMatchObject({ steer: 0, confirm: true, settings: true, accelerate: false });
    });

    it('does not lose a tap that was released between two reads', () => {
      const input = newManager();
      input.joinTouch();
      input.touch.setHeld('confirm', true);
      input.touch.setHeld('confirm', false);

      expect(input.readFrames()[0]).toMatchObject({ confirm: true });
      expect(input.readFrames()[0]).toMatchObject({ confirm: false });
    });

    it('does not give gas in the lobby, whatever the mode', () => {
      const input = newManager();
      input.joinTouch();
      for (const mode of ['auto', 'simple', 'classic'] as const) {
        input.controlMode = mode;
        expect(input.readFrames()[0]).toMatchObject({ accelerate: false, confirm: false });
      }
    });

    it('selects and confirms a map with the cross', () => {
      const input = newManager();
      input.joinTouch();
      const stage = new MapVoteStage(3);
      stage.start(input.players);
      stage.update(input.players, input.readFrames());
      input.touch.setHeld('right', true);
      stage.update(input.players, input.readFrames());
      input.touch.setHeld('right', false);
      expect(stage.pickFor(input.players[0]!)?.mapIndex).toBe(1);
      stage.update(input.players, input.readFrames());
      input.touch.setHeld('confirm', true);
      stage.update(input.players, input.readFrames());
      expect(stage.allConfirmed(input.players)).toBe(true);
    });

    it('confirms an AI slot with OK', () => {
      const input = newManager();
      input.joinTouch();
      const wizard = new AiWizard();
      wizard.syncCount(1);
      wizard.update(input.readFrames()[0]!);
      input.touch.setHeld('confirm', true);
      wizard.update(input.readFrames()[0]!);
      expect(wizard.allReady()).toBe(true);
    });
  });

  describe('driving', () => {
    it('auto-gas gives gas by itself and steers with the horizontal stick only', () => {
      const input = newManager();
      input.joinTouch();
      input.controlMode = 'auto';
      input.touch.setStick({ x: 0.8, y: 1 });
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: true, brake: false, steer: 0.8, confirm: false });
    });

    it('auto-gas is the mode a player never changed', () => {
      const input = newManager();
      input.joinTouch();
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: true, brake: false });
    });

    it('auto-gas stops the gas while the brake is held and resumes it on release', () => {
      const input = newManager();
      input.joinTouch();
      input.touch.setHeld('brake', true);
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: false, brake: true });
      input.touch.setHeld('brake', false);
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: true, brake: false });
    });

    it('keeps drift, item and pause as the player presses them', () => {
      const input = newManager();
      input.joinTouch();
      input.touch.setHeld('drift', true);
      input.touch.setHeld('useItem', true);
      input.touch.setHeld('pause', true);
      expect(input.readFrames([racing])[0]).toMatchObject({ drift: true, useItem: true, pause: true, accelerate: true });
    });

    it('classic: gas and brake are buttons, and drift also gives gas', () => {
      const input = newManager();
      input.joinTouch();
      input.controlMode = 'classic';
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: false, brake: false });
      input.touch.setHeld('gas', true);
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: true });
      input.touch.setHeld('gas', false);
      input.touch.setHeld('drift', true);
      expect(input.readFrames([racing])[0]).toMatchObject({ accelerate: true, drift: true });
    });

    it('simple: the stick drives relative to the camera mode', () => {
      const input = newManager();
      input.joinTouch();
      input.controlMode = 'simple';
      input.touch.setStick({ x: 0, y: -1 });
      const orientation = { yaw: Math.PI / 2, forwardSpeed: 0 };
      expect(input.readFrames([{ ...orientation, simpleMode: 'kartRelative' }])[0]).toMatchObject({ accelerate: true, brake: false, steer: 0 });
      input.touch.setStick({ x: 0, y: -1 });
      expect(input.readFrames([{ ...orientation, simpleMode: 'screenRelative' }])[0]).toMatchObject({ accelerate: false, brake: true });
    });

    it('lets go of everything when released, as on a screen change', () => {
      const input = newManager();
      input.joinTouch();
      input.controlMode = 'classic';
      input.touch.setStick({ x: 1, y: 0 });
      input.touch.setHeld('gas', true);
      input.touch.setHeld('drift', true);
      input.touch.releaseAll();
      expect(input.readFrames([racing])[0]).toEqual({ ...NEUTRAL_INPUT, move: { x: 0, y: 0 }, look: 0 });
    });
  });
});

describe('InputManager leaving', () => {
  it('moves later players up one slot and ignores unknown indexes', () => {
    const input = newManager();
    input.joinTouch();
    stubGamepads([fullPad(0), fullPad(0)]);
    input.pollJoins();

    input.leave(0);
    input.leave(7);
    input.leave(-1);

    expect(input.players.map((player) => player.source)).toEqual([
      { kind: 'gamepad', gamepadIndex: 0 },
      { kind: 'gamepad', gamepadIndex: 1 },
    ]);
  });

  it('lets the touch player join again after leaving', () => {
    const input = newManager();
    input.joinTouch();
    input.leave(0);

    expect(input.joinTouch()).toBe(true);
    expect(input.players).toHaveLength(1);
  });

  it('does not let a gamepad that is still held rejoin right after leaving', () => {
    const input = newManager();
    stubGamepads([fullPad(0)]);
    input.pollJoins();
    input.leave(0);
    input.pollJoins();
    expect(input.players).toHaveLength(0);
  });
});
