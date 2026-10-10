import { NEUTRAL_INPUT, type InputFrame } from '../../shared/input/actions';

/** The frames the host's menus (pause, settings, results) listen to. A guest that draws the race itself cannot see the host's menu, so
 *  what it presses there must not move it; only its pause key still counts (every player may pause and resume). A guest that is a plain
 *  controller watches the host's screen and steers the same menu as everybody. */
export function menuFramesFor(frames: readonly InputFrame[], players: readonly { readonly viewedElsewhere?: boolean }[]): readonly InputFrame[] {
  return frames.map((frame, index) => (players[index]?.viewedElsewhere === true ? { ...NEUTRAL_INPUT, pause: frame.pause } : frame));
}
