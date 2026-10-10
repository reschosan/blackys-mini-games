import { describe, expect, it } from 'vitest';
import { followedSeat, nextSeatIn, seatToWatch } from '../../src/shared/game/spectate';

describe('nextSeatIn', () => {
  it('goes to the next seat that is still in, round the end', () => {
    expect(nextSeatIn(0, [false, true, false, true])).toBe(1);
    expect(nextSeatIn(1, [false, true, false, true])).toBe(3);
    expect(nextSeatIn(3, [false, true, false, true])).toBe(1);
  });

  it('stays on the only one that is in and says -1 when nobody is', () => {
    expect(nextSeatIn(1, [false, true, false])).toBe(1);
    expect(nextSeatIn(0, [false, false])).toBe(-1);
  });
});

describe('seatToWatch', () => {
  it('keeps watching a player who is still in', () => {
    expect(seatToWatch(3, 0, [false, true, false, true], false)).toBe(3);
  });

  it('moves on when the watched one drops out, from the own seat when nobody was watched', () => {
    expect(seatToWatch(1, 0, [false, false, false, true], false)).toBe(3);
    expect(seatToWatch(-1, 2, [true, false, false, true], false)).toBe(3);
  });

  it('moves on to the next one when the player asks for it', () => {
    expect(seatToWatch(1, 0, [false, true, false, true], true)).toBe(3);
  });
});

describe('followedSeat', () => {
  it('follows the own seat while in, the watched one once out', () => {
    expect(followedSeat(0, false, 2)).toBe(0);
    expect(followedSeat(0, true, 2)).toBe(2);
    expect(followedSeat(0, true, -1)).toBe(0);
  });
});
