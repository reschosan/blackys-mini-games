import { describe, expect, it, vi } from 'vitest';
import { TOUCH_BUTTON_BITS } from '../../src/shared/input/touch/touchSource';
import { PausePanel } from '../../src/party/join/pausePanel';

function panel() {
  const actions = { resume: vi.fn(), leave: vi.fn(), changed: vi.fn() };
  return { panel: new PausePanel(actions), actions };
}

describe('PausePanel', () => {
  it('resumes with OK on "Weiter", which is chosen first', () => {
    const { panel: pause, actions } = panel();
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.resume).toHaveBeenCalledTimes(1);
  });

  it('moves between its two options with up and down, and only a freshly pressed key counts', () => {
    const { panel: pause, actions } = panel();
    pause.followKeys(TOUCH_BUTTON_BITS.down, true);
    pause.followKeys(TOUCH_BUTTON_BITS.down, true);
    expect(actions.changed).toHaveBeenCalledTimes(1);
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.up, true);
    expect(actions.changed).toHaveBeenCalledTimes(2);
  });

  it('asks before leaving, and a move in between takes the question back', () => {
    const { panel: pause, actions } = panel();
    pause.followKeys(TOUCH_BUTTON_BITS.down, true);
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.leave).not.toHaveBeenCalled();
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.up, true);
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.down, true);
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.leave).not.toHaveBeenCalled();
    pause.choose('leave');
    expect(actions.leave).toHaveBeenCalledTimes(1);
  });

  it('does nothing while it is not shown, but still remembers the keys held', () => {
    const { panel: pause, actions } = panel();
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, false);
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.resume).not.toHaveBeenCalled();
  });

  it('starts at "Weiter" again after reset', () => {
    const { panel: pause, actions } = panel();
    pause.followKeys(TOUCH_BUTTON_BITS.down, true);
    pause.reset();
    pause.followKeys(0, true);
    pause.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.resume).toHaveBeenCalledTimes(1);
  });
});
