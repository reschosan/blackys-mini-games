/** The next seat after `current` that is still in the game, going round; -1 when nobody is. Out players watch the others and switch with it. */
export function nextSeatIn(current: number, isIn: readonly boolean[]): number {
  for (let step = 1; step <= isIn.length; step += 1) {
    const seat = (current + step) % isIn.length;
    if (isIn[seat]) return seat;
  }
  return -1;
}

/** Who a player who is out watches: the same one while it is still in, otherwise (or when the player asks for the next) the next one still in. */
export function seatToWatch(watching: number, ownSeat: number, isIn: readonly boolean[], wantsNext: boolean): number {
  const watchedIsIn = isIn[watching] === true;
  if (watchedIsIn && !wantsNext) return watching;
  return nextSeatIn(watchedIsIn ? watching : ownSeat, isIn);
}

/** The seat a player's camera follows: the own one, or the one the player watches once out. */
export function followedSeat(ownSeat: number, out: boolean, watching: number): number {
  return out && watching >= 0 ? watching : ownSeat;
}
