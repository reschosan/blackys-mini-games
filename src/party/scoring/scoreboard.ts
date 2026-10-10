/** Points for a place: the winner gets as many points as there are karts, the last one gets one (4/3/2/1 with four karts). */
export function pointsForPlace(place: number, kartCount: number): number {
  return place >= 1 && place <= kartCount ? kartCount - place + 1 : 0;
}

/** The standing over all games played since the lobby was last left. A seat keeps its points when the next game is chosen. */
export class Scoreboard {
  private totals: number[] = [];

  /** `places[slot]` is the place of that seat in the game that just ended (1 is the best). Returns the points each seat got. */
  award(places: readonly number[]): readonly number[] {
    const points = places.map((place) => pointsForPlace(place, places.length));
    this.totals = points.map((gained, slot) => (this.totals[slot] ?? 0) + gained);
    return points;
  }

  totalOf(slot: number): number {
    return this.totals[slot] ?? 0;
  }

  reset(): void {
    this.totals = [];
  }
}
