import { describe, expect, it } from 'vitest';
import { NO_PICK, TOUCH_BUTTON_BITS, TouchSource } from '../../src/shared/input/touch/touchSource';
import { DEFAULT_TOUCH_STEERING } from '../../src/shared/config/touch';

describe('touch snapshot', () => {
  it('has a different bit for every key', () => {
    const bits = Object.values(TOUCH_BUTTON_BITS);
    expect(new Set(bits).size).toBe(bits.length);
    expect(bits.every((bit) => Number.isInteger(Math.log2(bit)))).toBe(true);
  });

  it('holds the keys that are down and the stick', () => {
    const source = new TouchSource();
    source.setHeld('drift', true);
    source.setStick({ x: 0.5, y: 0 });
    expect(source.takeSnapshot()).toEqual({ stick: { x: 0.5, y: 0 }, pressedBits: TOUCH_BUTTON_BITS.drift, pick: NO_PICK });
  });

  it('hands a tap on the picture to the game once, also on the host when the same tap arrives twice', () => {
    const guest = new TouchSource();
    const host = new TouchSource();
    guest.pick(5);
    const snapshot = guest.takeSnapshot();
    host.applySnapshot(snapshot);
    host.applySnapshot(snapshot);
    expect(host.readFrame('auto', DEFAULT_TOUCH_STEERING, undefined).pick).toBe(5);
    expect(host.readFrame('auto', DEFAULT_TOUCH_STEERING, undefined).pick).toBeUndefined();
    guest.pick(5);
    host.applySnapshot(guest.takeSnapshot());
    expect(host.readFrame('auto', DEFAULT_TOUCH_STEERING, undefined).pick).toBe(5);
  });

  it('reports a tap once, even if the finger lifted before the snapshot', () => {
    const source = new TouchSource();
    source.setHeld('useItem', true);
    source.setHeld('useItem', false);
    expect(source.takeSnapshot().pressedBits).toBe(TOUCH_BUTTON_BITS.useItem);
    expect(source.takeSnapshot().pressedBits).toBe(0);
  });

  it('copies a snapshot onto another source, keys going up included', () => {
    const guest = new TouchSource();
    const host = new TouchSource();
    guest.setHeld('brake', true);
    host.applySnapshot(guest.takeSnapshot());
    expect(host.isDown('brake')).toBe(true);
    guest.setHeld('brake', false);
    host.applySnapshot(guest.takeSnapshot());
    expect(host.isDown('brake')).toBe(false);
  });
});
