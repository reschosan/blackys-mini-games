import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { MenuInput } from '../../src/shared/ui/menus/menuInput';

const frame = (overrides: Partial<InputFrame>): InputFrame => ({ ...NEUTRAL_INPUT, ...overrides });

describe('MenuInput on a scrollable page', () => {
  it.each([
    ['gamepad or keyboard down', { menuDown: true }, 1],
    ['gamepad or keyboard up', { menuUp: true }, -1],
    ['phone down button (drift)', { drift: true }, 1],
    ['phone up button (item)', { useItem: true }, -1],
    ['up and down together', { menuUp: true, menuDown: true }, 0],
    ['nothing pressed', {}, 0],
  ] as const)('scrolls on %s', (_name, input, expected) => {
    expect(new MenuInput().read([frame(input)], true).scroll).toBe(expected);
  });

  it('keeps scrolling every step while the button is held', () => {
    const menuInput = new MenuInput();
    const held = [frame({ menuDown: true })];
    expect([menuInput.read(held, true).scroll, menuInput.read(held, true).scroll, menuInput.read(held, true).scroll]).toEqual([1, 1, 1]);
  });

  it('scrolls for the strongest of several players', () => {
    expect(new MenuInput().read([frame({}), frame({ menuDown: true })], true).scroll).toBe(1);
  });

  it('does not confirm with the gas key, only with the confirm action', () => {
    const menuInput = new MenuInput();
    expect(menuInput.read([frame({ accelerate: true, menuUp: true })], true).confirm).toBe(false);
    menuInput.read([frame({})], true);
    expect(menuInput.read([frame({ confirm: true })], true).confirm).toBe(true);
  });

  it('confirms once per press', () => {
    const menuInput = new MenuInput();
    const pressed = [frame({ confirm: true })];
    expect([menuInput.read(pressed, true).confirm, menuInput.read(pressed, true).confirm]).toEqual([true, false]);
  });
});

describe('MenuInput on other pages', () => {
  it('never confirms with the gas key, because W and the arrow keys move the selection', () => {
    const command = new MenuInput().read([frame({ accelerate: true, menuUp: true })]);
    expect(command.confirm).toBe(false);
    expect(command.scroll).toBe(0);
  });

  it('confirms with the confirm action (Tab, 0, gamepad and phone gas), so one key works in every menu', () => {
    expect(new MenuInput().read([frame({ confirm: true })]).confirm).toBe(true);
  });

  it('still moves the selection with left and right', () => {
    expect(new MenuInput().read([frame({ steer: 1 })], true).move).toBe(1);
    expect(new MenuInput().read([frame({ steer: -1 })]).move).toBe(-1);
  });
});

describe('MenuInput on a vertical option list', () => {
  it.each([
    ['stick or D-pad down', { menuDown: true }, 1],
    ['stick or D-pad up', { menuUp: true }, -1],
    ['phone arrow down (drift)', { drift: true }, 1],
    ['phone arrow up (item)', { useItem: true }, -1],
    ['keyboard W (menuUp together with gas)', { menuUp: true, accelerate: true }, -1],
    ['keyboard S (menuDown together with brake)', { menuDown: true, brake: true }, 1],
  ] as const)('moves on %s', (_name, input, expected) => {
    expect(new MenuInput().read([frame(input)]).move).toBe(expected);
  });

  it('moves once per press, not every step', () => {
    const menuInput = new MenuInput();
    const held = [frame({ menuDown: true })];
    expect([menuInput.read(held).move, menuInput.read(held).move]).toEqual([1, 0]);
  });

  it('does not move on a scrollable page, where up and down scroll', () => {
    expect(new MenuInput().read([frame({ menuDown: true })], true).move).toBe(0);
  });
});
