import { describe, expect, it, vi } from 'vitest';
import { TOUCH_BUTTON_BITS } from '../../src/shared/input/touch/touchSource';
import { ResultsChoice, resultChoiceOf } from '../../src/party/join/resultsChoice';

function choice() {
  const actions = { choose: vi.fn(), changed: vi.fn() };
  return { choice: new ResultsChoice(actions), actions };
}

describe('ResultsChoice', () => {
  it('confirms "Nochmal" with OK, which is chosen first', () => {
    const { choice: results, actions } = choice();
    results.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.choose).toHaveBeenCalledWith('again');
  });

  it('moves through "Nächstes Spiel" to the lobby with down, and OK confirms that', () => {
    const { choice: results, actions } = choice();
    results.followKeys(TOUCH_BUTTON_BITS.down, true);
    expect(actions.changed).toHaveBeenCalledTimes(1);
    expect(results.selected).toBe('next');
    results.followKeys(0, true);
    results.followKeys(TOUCH_BUTTON_BITS.down, true);
    expect(results.selected).toBe('lobby');
    results.followKeys(0, true);
    results.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.choose).toHaveBeenCalledWith('lobby');
  });

  it('goes around the ends: up from "Nochmal" is the lobby, down from the lobby is "Nochmal"', () => {
    const { choice: results } = choice();
    results.followKeys(TOUCH_BUTTON_BITS.up, true);
    expect(results.selected).toBe('lobby');
    results.followKeys(0, true);
    results.followKeys(TOUCH_BUTTON_BITS.down, true);
    expect(results.selected).toBe('again');
  });

  it('does nothing while the choice is not shown, and a held key counts only once', () => {
    const { choice: results, actions } = choice();
    results.followKeys(TOUCH_BUTTON_BITS.confirm, false);
    results.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.choose).not.toHaveBeenCalled();
    results.followKeys(0, true);
    results.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    results.followKeys(TOUCH_BUTTON_BITS.confirm, true);
    expect(actions.choose).toHaveBeenCalledTimes(1);
  });

  it('starts at "Nochmal" again after reset, and a tap chooses at once', () => {
    const { choice: results, actions } = choice();
    results.followKeys(TOUCH_BUTTON_BITS.down, true);
    results.reset();
    expect(results.selected).toBe('again');
    results.choose('lobby');
    expect(actions.choose).toHaveBeenCalledWith('lobby');
  });

  it('reads a button of the page, and takes "Nochmal" for anything it does not know', () => {
    expect(['again', 'next', 'lobby', 'x', null].map(resultChoiceOf)).toEqual(['again', 'next', 'lobby', 'again', 'again']);
  });
});
