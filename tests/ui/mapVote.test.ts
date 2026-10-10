import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/shared/core/rng';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { MapVoteStage } from '../../src/party/lobby/mapVote';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';

const MAP_COUNT = 2;

function gamepadPlayer(gamepadIndex: number): JoinedPlayer {
  return { source: { kind: 'gamepad', gamepadIndex }, deviceName: `Gamepad ${gamepadIndex + 1}` };
}

describe('MapVoteStage', () => {
  it('starts every joined player unconfirmed on the first map', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);

    expect(stage.pickFor(player)).toEqual({ mapIndex: 0, confirmed: false });
    expect(stage.allConfirmed([player])).toBe(false);
  });

  it('accepts the first arrow immediately after entering the vote', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);

    stage.update([player], [{ ...NEUTRAL_INPUT, steer: 1 }]);

    expect(stage.pickFor(player)?.mapIndex).toBe(1);
  });

  it('does not confirm from a button still held across the stage transition', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);

    stage.update([player], [{ ...NEUTRAL_INPUT, confirm: true }]);

    expect(stage.pickFor(player)?.confirmed).toBe(false);
  });

  it('a single player picking and confirming wins that map directly', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);
    const pick = stage.pickFor(player)!;
    pick.mapIndex = 1;
    pick.confirmed = true;

    expect(stage.allConfirmed([player])).toBe(true);
    expect(stage.resolveWinnerIndex([player], createRng(1))).toBe(1);
  });

  it('the majority wins with more than one player', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const players = [gamepadPlayer(0), gamepadPlayer(1), gamepadPlayer(2)];
    stage.start(players);
    stage.pickFor(players[0]!)!.mapIndex = 1;
    stage.pickFor(players[1]!)!.mapIndex = 1;
    stage.pickFor(players[2]!)!.mapIndex = 0;

    expect(stage.resolveWinnerIndex(players, createRng(1))).toBe(1);
  });

  it('is not all-confirmed until every joined player has locked in', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const players = [gamepadPlayer(0), gamepadPlayer(1)];
    stage.start(players);
    stage.pickFor(players[0]!)!.confirmed = true;

    expect(stage.allConfirmed(players)).toBe(false);

    stage.pickFor(players[1]!)!.confirmed = true;
    expect(stage.allConfirmed(players)).toBe(true);
  });

  it('breaks a tie deterministically via the given rng', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const players = [gamepadPlayer(0), gamepadPlayer(1)];
    stage.start(players);
    stage.pickFor(players[0]!)!.mapIndex = 0;
    stage.pickFor(players[1]!)!.mapIndex = 1;

    const first = stage.resolveWinnerIndex(players, createRng(42));
    const second = stage.resolveWinnerIndex(players, createRng(42));
    expect(first).toBe(second);
    expect([0, 1]).toContain(first);
  });

  it('a click moves the first player to that map and a second click locks it in', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const players = [gamepadPlayer(0)];
    stage.start(players);

    stage.clickMap(players, 1);
    expect(stage.pickFor(players[0]!)).toEqual({ mapIndex: 1, confirmed: false });

    stage.clickMap(players, 1);
    expect(stage.allConfirmed(players)).toBe(true);
  });

  it('a first click on the already highlighted map does not lock it in', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);

    stage.clickMap([player], 0);

    expect(stage.pickFor(player)?.confirmed).toBe(false);
  });

  it('a click only votes for the first player and ignores out-of-range maps', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const first = gamepadPlayer(0);
    const second = gamepadPlayer(1);
    stage.start([first, second]);

    stage.clickMap([first, second], 1);
    stage.clickMap([first, second], 99);

    expect(stage.pickFor(first)?.mapIndex).toBe(1);
    expect(stage.pickFor(second)?.mapIndex).toBe(0);
  });

  it('steering runs through the maps and then a "Zurück" option before wrapping around', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);
    const steer = (): void => {
      stage.update([player], [{ ...NEUTRAL_INPUT, steer: 1 }]);
      stage.update([player], [NEUTRAL_INPUT]);
    };

    steer();
    steer();
    expect(stage.pickFor(player)?.mapIndex).toBe(stage.backIndex);
    steer();
    expect(stage.pickFor(player)?.mapIndex).toBe(0);
  });

  it('confirming "Zurück" reports it without locking a vote', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);
    stage.pickFor(player)!.mapIndex = stage.backIndex;
    stage.update([player], [NEUTRAL_INPUT]);

    const back = stage.update([player], [{ ...NEUTRAL_INPUT, confirm: true }]);

    expect(back).toBe(true);
    expect(stage.pickFor(player)?.confirmed).toBe(false);
  });

  it('confirming a map does not report "Zurück"', () => {
    const stage = new MapVoteStage(MAP_COUNT);
    const player = gamepadPlayer(0);
    stage.start([player]);
    stage.update([player], [NEUTRAL_INPUT]);

    expect(stage.update([player], [{ ...NEUTRAL_INPUT, confirm: true }])).toBe(false);
    expect(stage.pickFor(player)?.confirmed).toBe(true);
  });
});
