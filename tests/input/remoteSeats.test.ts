import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PLAYERS } from '../../src/shared/config/players';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import { InputManager } from '../../src/shared/input/inputManager';
import { RemoteInput, type RemoteLink } from '../../src/shared/input/remote/remoteInput';
import { NO_PICK, TOUCH_BUTTON_BITS } from '../../src/shared/input/touch/touchSource';

beforeEach(() => {
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true });
});

function newManager(): InputManager {
  return new InputManager(createRuntimeTouchSteering());
}

function newRemote(input: InputManager, clock: () => number = () => 0) {
  const link: RemoteLink = { send: vi.fn(), sendState: vi.fn(), close: vi.fn() };
  return { remote: new RemoteInput(input.nextRemoteId(), link, createRuntimeRemote(), clock), link };
}

describe('InputManager with phones on the network', () => {
  it('lets a phone join as a player of its own and reads its keys', () => {
    const input = newManager();
    const { remote } = newRemote(input);
    expect(input.addRemote(remote)).toBe(true);
    remote.receive({ kind: 'input', stickX: 0, stickY: 0, pressedBits: TOUCH_BUTTON_BITS.confirm, pick: NO_PICK, mode: 'auto', sequence: 1 });

    expect(input.players.map((player) => player.source)).toEqual([{ kind: 'remote', remoteId: 1 }]);
    expect(input.readFrames()[0]?.confirm).toBe(true);
  });

  it('numbers the phones one after the other', () => {
    const input = newManager();
    input.addRemote(newRemote(input).remote);
    expect(input.nextRemoteId()).toBe(2);
  });

  it('refuses a phone when all four places are taken', () => {
    const input = newManager();
    for (let count = 0; count < MAX_PLAYERS; count += 1) input.addRemote(newRemote(input).remote);
    expect(input.addRemote(newRemote(input).remote)).toBe(false);
    expect(input.players).toHaveLength(MAX_PLAYERS);
  });

  it('reports a lost phone like a pulled gamepad and keeps its seat', () => {
    const input = newManager();
    const { remote } = newRemote(input);
    input.addRemote(remote);
    remote.markLost();
    expect(input.disconnectedDeviceNames()).toEqual(['Handy 1']);
    expect(input.players).toHaveLength(1);
  });

  it('gives a lost seat up only after the reservation time', () => {
    let now = 0;
    const input = newManager();
    const { remote } = newRemote(input, () => now);
    input.addRemote(remote);
    remote.markLost();
    now = (createRuntimeRemote().seatReservationSeconds - 1) * 1000;
    expect(input.slotsOfExpiredRemotes(createRuntimeRemote().seatReservationSeconds)).toEqual([]);
    now = createRuntimeRemote().seatReservationSeconds * 1000;
    expect(input.slotsOfExpiredRemotes(createRuntimeRemote().seatReservationSeconds)).toEqual([0]);
  });

  it('closes the connection when the player leaves the lobby', () => {
    const input = newManager();
    const { remote, link } = newRemote(input);
    input.addRemote(remote);
    input.leave(0);
    expect(link.close).toHaveBeenCalledOnce();
    expect(input.players).toHaveLength(0);
    expect(input.remoteInputs).toHaveLength(0);
  });

  it('keeps connected phones when the game returns to the lobby and drops the lost ones', () => {
    const input = newManager();
    const stays = newRemote(input).remote;
    input.addRemote(stays);
    const goes = newRemote(input).remote;
    input.addRemote(goes);
    goes.markLost();

    input.reset();
    expect(input.players).toHaveLength(0);
    input.rejoinConnectedRemotes();

    expect(input.players.map((player) => player.source)).toEqual([{ kind: 'remote', remoteId: stays.id }]);
    expect(input.remoteInputs.map((remote) => remote.id)).toEqual([stays.id]);
  });

  it('finds the slot of a phone after players ahead of it left', () => {
    const input = newManager();
    const first = newRemote(input).remote;
    input.addRemote(first);
    const second = newRemote(input).remote;
    input.addRemote(second);
    input.leave(0);
    expect(input.slotOfRemote(second.id)).toBe(0);
    expect(input.remoteInSlot(0)).toBe(second);
    expect(input.slotOfRemote(first.id)).toBe(-1);
  });
});
