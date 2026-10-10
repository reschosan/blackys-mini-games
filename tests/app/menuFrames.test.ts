import { describe, expect, it } from 'vitest';
import { menuFramesFor } from '../../src/party/app/menuFrames';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';

const pressing = { ...NEUTRAL_INPUT, menuDown: true, confirm: true, steer: 1, drift: true, pause: true };

describe('the frames the host menus listen to', () => {
  it('leaves a player alone whose picture is on the host screen', () => {
    expect(menuFramesFor([pressing], [{}])).toEqual([pressing]);
    expect(menuFramesFor([pressing], [{ viewedElsewhere: false }])).toEqual([pressing]);
  });

  it('hears only the pause key of a guest that has its own picture, because that guest cannot see the host menu', () => {
    const [frame] = menuFramesFor([pressing], [{ viewedElsewhere: true }]);
    expect(frame).toEqual({ ...NEUTRAL_INPUT, pause: true });
  });

  it('treats every player by itself', () => {
    const frames = menuFramesFor([pressing, pressing], [{}, { viewedElsewhere: true }]);
    expect(frames[0]).toEqual(pressing);
    expect(frames[1]).toEqual({ ...NEUTRAL_INPUT, pause: true });
  });

  it('copes with more frames than players (nothing to look up)', () => {
    expect(menuFramesFor([pressing], [])).toEqual([pressing]);
  });
});
