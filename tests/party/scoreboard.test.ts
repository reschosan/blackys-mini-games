import { describe, expect, it } from 'vitest';
import { Scoreboard, pointsForPlace } from '../../src/party/scoring/scoreboard';

describe('points for a place', () => {
  it.each([
    [1, 4, 4],
    [2, 4, 3],
    [3, 4, 2],
    [4, 4, 1],
    [1, 3, 3],
    [3, 3, 1],
    [1, 2, 2],
    [2, 2, 1],
    [1, 1, 1],
  ])('place %i of %i karts gives %i points', (place, karts, points) => {
    expect(pointsForPlace(place, karts)).toBe(points);
  });

  it('gives nothing to a place that does not exist', () => {
    expect(pointsForPlace(0, 4)).toBe(0);
    expect(pointsForPlace(5, 4)).toBe(0);
  });
});

describe('Scoreboard', () => {
  it('adds the points of every game up per seat', () => {
    const board = new Scoreboard();
    expect(board.award([2, 1, 3, 4])).toEqual([3, 4, 2, 1]);
    board.award([1, 2, 3, 4]);
    expect([0, 1, 2, 3].map((slot) => board.totalOf(slot))).toEqual([7, 7, 4, 2]);
  });

  it('starts from nothing again after a reset, and knows no total for a seat that never played', () => {
    const board = new Scoreboard();
    board.award([1, 2]);
    board.reset();
    expect(board.totalOf(0)).toBe(0);
    expect(board.totalOf(7)).toBe(0);
  });
});
