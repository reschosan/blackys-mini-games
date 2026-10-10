import { describe, expect, it, vi } from 'vitest';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { RemoteInput, type RemoteLink } from '../../src/shared/input/remote/remoteInput';
import { NO_PICK, TOUCH_BUTTON_BITS } from '../../src/shared/input/touch/touchSource';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import type { InputMessage } from '../../src/shared/net/messages';

const steering = createRuntimeTouchSteering();
const racing = { yaw: 0, forwardSpeed: 0, simpleMode: 'kartRelative' as const };

function newRemote(clock: () => number = () => 0) {
  const link: RemoteLink = { send: vi.fn(), sendState: vi.fn(), close: vi.fn() };
  return { remote: new RemoteInput(1, link, createRuntimeRemote(), clock), link };
}

function message(pressedBits: number, overrides: Partial<InputMessage> = {}): InputMessage {
  return { kind: 'input', stickX: 0, stickY: 0, pressedBits, pick: NO_PICK, mode: 'auto', sequence: 1, ...overrides };
}

describe('RemoteInput', () => {
  it('navigates the lobby like the on-screen cross', () => {
    const { remote } = newRemote();
    remote.receive(message(TOUCH_BUTTON_BITS.down | TOUCH_BUTTON_BITS.confirm));
    expect(remote.readFrame(steering, undefined)).toMatchObject({ menuDown: true, confirm: true, menuUp: false });
  });

  it('drives with auto-gas: gas by itself, stick steers, brake brakes', () => {
    const { remote } = newRemote();
    remote.receive(message(0, { stickX: -0.8 }));
    expect(remote.readFrame(steering, racing)).toMatchObject({ accelerate: true, brake: false, steer: -0.8 });
    remote.receive(message(TOUCH_BUTTON_BITS.brake, { stickX: 0 }));
    expect(remote.readFrame(steering, racing)).toMatchObject({ accelerate: false, brake: true });
  });

  it('lets every player pause, but keeps the host settings with the host', () => {
    const { remote } = newRemote();
    remote.receive(message(TOUCH_BUTTON_BITS.pause | TOUCH_BUTTON_BITS.settings | TOUCH_BUTTON_BITS.useItem));
    expect(remote.readFrame(steering, racing)).toMatchObject({ pause: true, settings: false, useItem: true });
    remote.receive(message(TOUCH_BUTTON_BITS.pause | TOUCH_BUTTON_BITS.settings));
    expect(remote.readFrame(steering, undefined)).toMatchObject({ pause: true, settings: false });
  });

  it('does not lose a tap that was released before the host read it', () => {
    const { remote } = newRemote();
    remote.receive(message(TOUCH_BUTTON_BITS.useItem));
    remote.receive(message(0));
    expect(remote.readFrame(steering, racing).useItem).toBe(true);
    expect(remote.readFrame(steering, racing).useItem).toBe(false);
  });

  it('rolls out when the phone has been silent for a moment', () => {
    let now = 0;
    const { remote } = newRemote(() => now);
    remote.receive(message(TOUCH_BUTTON_BITS.drift, { stickX: 1 }));
    now = createRuntimeRemote().staleInputMilliseconds + 1;
    expect(remote.readFrame(steering, racing)).toMatchObject({ steer: 0, drift: false });
  });

  it('gives neutral input and counts the seconds once the connection is lost', () => {
    let now = 0;
    const { remote } = newRemote(() => now);
    remote.receive(message(TOUCH_BUTTON_BITS.confirm));
    remote.markLost();
    now = 5000;
    expect(remote.connected).toBe(false);
    expect(remote.secondsLost()).toBe(5);
    expect(remote.readFrame(steering, undefined)).toEqual(NEUTRAL_INPUT);
    remote.receive(message(TOUCH_BUTTON_BITS.confirm));
    expect(remote.readFrame(steering, undefined)).toEqual(NEUTRAL_INPUT);
  });

  it('measures the round trip of a ping and smooths it', () => {
    let now = 1000;
    const { remote, link } = newRemote(() => now);
    expect(remote.latencyMilliseconds).toBeNull();
    remote.sendPing();
    expect(link.send).toHaveBeenCalledWith({ kind: 'ping', sentAt: 1000 });
    now = 1040;
    remote.receivePong(1000);
    expect(remote.latencyMilliseconds).toBe(40);
    now = 2100;
    remote.receivePong(2000);
    expect(remote.latencyMilliseconds).toBe(58);
  });

  it('takes the seat back with a new connection', () => {
    const { remote } = newRemote();
    remote.markLost();
    const newLink: RemoteLink = { send: vi.fn(), sendState: vi.fn(), close: vi.fn() };
    remote.reconnect(newLink);
    remote.send({ kind: 'buzz' });
    expect(remote.connected).toBe(true);
    expect(newLink.send).toHaveBeenCalledWith({ kind: 'buzz' });
  });

  it('sends nothing while it is lost and closes the link when told to', () => {
    const { remote, link } = newRemote();
    remote.markLost();
    remote.send({ kind: 'buzz' });
    expect(link.send).not.toHaveBeenCalled();
    remote.close();
    expect(link.close).toHaveBeenCalledOnce();
  });
});
