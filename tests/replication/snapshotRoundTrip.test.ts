import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createRng } from '../../src/shared/core/rng';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import type { RacePlayer } from '../../src/games/kart/race/racePlayer';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createProgress } from '../../src/games/kart/race/raceState';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';
import { decodeSnapshot, encodeSnapshot } from '../../src/games/kart/replication/snapshot';
import { applyKartProgress, applyKartSnapshot, applyWorldSnapshot, createRemoteRacer } from '../../src/games/kart/replication/snapshotApply';
import { buildSnapshot } from '../../src/games/kart/replication/snapshotBuilder';
import { RING_TEST_MAP } from '../support/ringTestMap';

const STEP = 1 / 60;

function racePlayer(index: number): RacePlayer {
  const start = RING_TEST_MAP.startPositions[index]!;
  return {
    state: createKartState(start.x, start.z, start.yaw, start.levelId),
    progress: createProgress(start.x, start.z, start.levelId),
    isAi: false,
    aiDriver: null,
    difficulty: null,
    loadout: createKartLoadout(index),
    heldItem: null,
    previousUseItem: false,
    raceStartEarlyPress: false,
    raceStartBoostEarned: false,
  };
}

describe('a real race through the wire', () => {
  it('shows on the guest what the host has: karts, items on the track, boxes, places', () => {
    const players = [racePlayer(0), racePlayer(1)];
    players[0]!.heldItem = 'hairball';
    players[1]!.heldItem = 'trap';
    const world = createRaceWorld(RING_TEST_MAP);
    const driving = createRuntimeDriving();
    const items = createRuntimeItems();
    for (let tick = 0; tick < 180; tick += 1) {
      world.raceTimeSeconds += STEP;
      world.places = stepRaceSimulation({
        map: RING_TEST_MAP,
        driving,
        items,
        participants: players,
        frames: [
          { ...NEUTRAL_INPUT, accelerate: true, steer: tick % 90 < 45 ? 0.5 : -0.5, useItem: tick === 30 },
          { ...NEUTRAL_INPUT, accelerate: true, useItem: tick === 40 },
        ],
        hairballs: world.hairballs,
        traps: world.traps,
        fieldItems: world.fieldItems,
        tankFire: world.tankFire,
        itemBoxes: world.itemBoxes,
        places: world.places.length > 0 ? world.places : [1, 2],
        rng: createRng(5),
        lapCount: 3,
        raceTimeSeconds: world.raceTimeSeconds,
        stepSeconds: STEP,
      });
    }
    expect(world.hairballs.length + world.traps.length).toBeGreaterThan(0);

    const decoded = decodeSnapshot(
      encodeSnapshot(buildSnapshot({ players, world, countdownSecondsLeft: 0, goDisplayActive: false, finishCountdownSeconds: null, extras: [] }, 1)),
    )!;
    expect(decoded).not.toBeNull();

    const guestWorld = createRaceWorld(RING_TEST_MAP);
    const racers = players.map(() => createRemoteRacer(true));
    decoded.karts.forEach((kart, index) => {
      applyKartSnapshot(racers[index]!.state, kart);
      applyKartProgress(racers[index]!, kart);
    });
    applyWorldSnapshot(guestWorld, decoded);

    players.forEach((player, index) => {
      const shown = racers[index]!;
      expect(shown.state.x).toBeCloseTo(player.state.x, 4);
      expect(shown.state.z).toBeCloseTo(player.state.z, 4);
      expect(shown.state.yaw).toBeCloseTo(player.state.yaw, 5);
      expect(shown.state.driftStage).toBe(player.state.driftStage);
      expect(shown.state.stunSecondsLeft).toBeCloseTo(player.state.stunSecondsLeft, 5);
      expect(shown.progress.lap).toBe(player.progress.lap);
      expect(shown.heldItem).toBe(player.heldItem);
    });
    expect(guestWorld.hairballs).toHaveLength(world.hairballs.length);
    expect(guestWorld.traps).toHaveLength(world.traps.length);
    expect(guestWorld.itemBoxes.map((box) => box.collected)).toEqual(world.itemBoxes.map((box) => box.collected));
    expect(guestWorld.places).toEqual(world.places);
    expect(guestWorld.raceTimeSeconds).toBeCloseTo(world.raceTimeSeconds, 4);
  });

  it('keeps the same objects when a new snapshot is applied, because the views hold on to them', () => {
    const world = createRaceWorld(RING_TEST_MAP);
    const hairballs = world.hairballs;
    const racer = createRemoteRacer(true);
    const state = racer.state;
    const players = [racePlayer(0)];
    const snapshot = buildSnapshot({ players, world, countdownSecondsLeft: 0, goDisplayActive: false, finishCountdownSeconds: null, extras: [] }, 1);
    applyWorldSnapshot(world, snapshot);
    applyKartSnapshot(racer.state, snapshot.karts[0]!);
    expect(world.hairballs).toBe(hairballs);
    expect(racer.state).toBe(state);
  });
});
