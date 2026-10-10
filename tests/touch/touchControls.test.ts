// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TouchSource } from '../../src/shared/input/touch/touchSource';
import { TouchControls } from '../../src/shared/touch/touchControls';

const MARKUP = `
  <div id="app"><div id="touch-controls">
    <div id="touch-navigation"><button id="pad-ok">OK</button></div>
    <div id="touch-driving"><button id="btn-drift">Drift</button><button id="btn-gas"></button><button id="btn-brake"></button><button id="btn-item"></button></div>
  </div></div>`;

function setUp(): { readonly source: TouchSource; readonly controls: TouchControls } {
  document.body.innerHTML = MARKUP;
  const source = new TouchSource();
  const controls = new TouchControls(document.querySelector<HTMLElement>('#touch-controls')!, source);
  return { source, controls };
}

function press(selector: string): void {
  document.querySelector(selector)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
}

function lastFingerLeaves(type: 'touchend' | 'touchcancel', fingersLeft = 0): void {
  window.dispatchEvent(Object.assign(new Event(type), { touches: Array.from({ length: fingersLeft }) }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('keys that can get stuck', () => {
  it('lets go of a key when the last finger leaves without the key hearing about it', () => {
    const { source } = setUp();
    press('#btn-drift');
    expect(source.isDown('drift')).toBe(true);
    lastFingerLeaves('touchend');
    expect(source.isDown('drift')).toBe(false);
  });

  it('does the same when the browser cancels the touch', () => {
    const { source } = setUp();
    press('#btn-drift');
    lastFingerLeaves('touchcancel');
    expect(source.isHeld()).toBe(false);
  });

  it('lets go of a stick that stayed off centre', () => {
    const { source } = setUp();
    source.setStick({ x: -1, y: 0 });
    lastFingerLeaves('touchend');
    expect(source.isHeld()).toBe(false);
  });

  it('keeps everything while another finger is still on the screen', () => {
    const { source } = setUp();
    press('#btn-drift');
    lastFingerLeaves('touchend', 1);
    expect(source.isDown('drift')).toBe(true);
  });

  it('does not eat a quick tap that has already ended: the game still sees it once', () => {
    const { source, controls } = setUp();
    press('#pad-ok');
    window.dispatchEvent(new MouseEvent('pointerup'));
    lastFingerLeaves('touchend');
    expect(source.takeSnapshot().pressedBits).not.toBe(0);
    expect(controls).toBeDefined();
  });
});
