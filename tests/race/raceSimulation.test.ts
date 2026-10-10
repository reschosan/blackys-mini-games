import type { ItemType } from '../../src/shared/config/items';
import { describe, expect, it } from 'vitest';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { createRng } from '../../src/shared/core/rng';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createFieldItems } from '../../src/games/kart/items/fieldItems';
import { createItemBoxStates } from '../../src/games/kart/items/itemBoxes';
import { createProgress } from '../../src/games/kart/race/raceState';
import { stepRaceSimulation, type RaceStep } from '../../src/games/kart/race/raceSimulation';

function fixture(): RaceStep {
  const start = RING_TEST_MAP.startPositions[0]!;
  return {
    map: RING_TEST_MAP,
    driving: createRuntimeDriving(),
    items: createRuntimeItems(),
    participants: [
      {
        state: createKartState(start.x, start.z, start.yaw, start.levelId),
        progress: createProgress(start.x, start.z, start.levelId),
        heldItem: 'boost',
        previousUseItem: false,
      },
    ],
    frames: [{ ...NEUTRAL_INPUT, useItem: true }],
    hairballs: [],
    traps: [],
    fieldItems: createFieldItems(),
    itemBoxes: createItemBoxStates(RING_TEST_MAP),
    places: [1],
    rng: createRng(1),
    lapCount: 3,
    raceTimeSeconds: 1 / 60,
    stepSeconds: 1 / 60,
  };
}

describe('shared race simulation', () => {
  it('keeps physics, item-use and item-change feedback in their existing order', () => {
    const step = fixture();
    const events: string[] = [];
    const places = stepRaceSimulation(step, {
      afterPhysics: () => {
        events.push('physics');
        expect(step.participants[0]!.state.boostSeconds).toBe(0);
      },
      itemUsed: (item, index) => {
        events.push(item);
        expect(index).toBe(0);
        expect(step.participants[0]!.heldItem).toBe('boost');
      },
      itemsChanged: (previous) => {
        events.push('items');
        expect(previous).toEqual(['boost']);
        expect(step.participants[0]!.heldItem).toBeNull();
      },
    });
    expect(events).toEqual(['physics', 'boost', 'items']);
    expect(places).toEqual([1]);
    expect(step.participants[0]!.state.boostSeconds).toBe(step.items.boost.durationSeconds);
  });

  it('does not fire again while useItem stays held', () => {
    const step = fixture();
    stepRaceSimulation(step);
    step.participants[0]!.heldItem = 'boost';
    stepRaceSimulation(step);
    expect(step.participants[0]!.heldItem).toBe('boost');
  });

  it('consumes a blocked press without using the item during a penalty', () => {
    const step = fixture();
    step.participants[0]!.state.penaltySecondsLeft = 1;
    stepRaceSimulation(step);
    expect(step.participants[0]!.heldItem).toBe('boost');
    expect(step.participants[0]!.previousUseItem).toBe(true);
  });

  it('lets active racers pass a finished kart without a body collision', () => {
    const base = fixture();
    const finished = base.participants[0]!;
    finished.progress.finished = true;
    const active = {
      state: createKartState(finished.state.x + 1, finished.state.z, finished.state.yaw),
      progress: createProgress(finished.state.x + 1, finished.state.z),
      heldItem: null,
      previousUseItem: false,
    };
    const step = { ...base, participants: [finished, active], frames: [NEUTRAL_INPUT, NEUTRAL_INPUT], places: [1, 2] };

    stepRaceSimulation(step);

    expect(active.state.x - finished.state.x).toBeCloseTo(1, 3);
  });
});

describe('using the new items through the race simulation', () => {
  function twoRacers(heldItem: ItemType) {
    const base = fixture();
    const user = base.participants[0]!;
    user.heldItem = heldItem;
    const targetX = user.state.x + Math.cos(user.state.yaw) * 6;
    const targetZ = user.state.z + Math.sin(user.state.yaw) * 6;
    const target = {
      state: createKartState(targetX, targetZ, user.state.yaw, user.state.levelId),
      progress: createProgress(targetX, targetZ, user.state.levelId),
      heldItem: null,
      previousUseItem: false,
    };
    return { ...base, participants: [user, target], frames: [{ ...NEUTRAL_INPUT, useItem: true }, NEUTRAL_INPUT], places: [1, 2] };
  }

  it('catnip boosts the user and starts the effect timer', () => {
    const step = twoRacers('catnip');
    stepRaceSimulation(step);
    expect(step.participants[0]!.state.boostSeconds).toBeGreaterThan(0);
    expect(step.participants[0]!.state.catnipSecondsLeft).toBeGreaterThan(0);
    expect(step.participants[0]!.heldItem).toBeNull();
  });

  it('laser puts a dot on the map', () => {
    const step = twoRacers('laser');
    stepRaceSimulation(step);
    expect(step.fieldItems.lasers).toHaveLength(1);
  });

  it('yarn flies as a yarn projectile', () => {
    const step = twoRacers('yarn');
    stepRaceSimulation(step);
    expect(step.hairballs.map((ball) => ball.kind)).toEqual(['yarn']);
  });

  it('vacuum stuns the kart ahead and leaves a visual pulse', () => {
    const step = twoRacers('vacuum');
    stepRaceSimulation(step);
    expect(step.participants[1]!.state.stunSecondsLeft).toBeGreaterThan(0);
    expect(step.fieldItems.vacuumPulses).toHaveLength(1);
  });

  it('gravity bubble is placed behind the user, and not used mid-air in a window jump', () => {
    const step = twoRacers('gravity');
    stepRaceSimulation(step);
    expect(step.fieldItems.gravityBubbles).toHaveLength(1);

    const airborne = twoRacers('gravity');
    airborne.participants[0]!.state.windowJumpId = 'jump';
    stepRaceSimulation(airborne);
    expect(airborne.fieldItems.gravityBubbles).toHaveLength(0);
    expect(airborne.participants[0]!.heldItem).toBe('gravity');
  });

  it('a lured driver turns toward the laser dot without any steering input', () => {
    const step = twoRacers('laser');
    stepRaceSimulation(step);
    const dot = step.fieldItems.lasers[0]!;
    const lured = step.participants[1]!.state;
    dot.x = lured.x + 4 * Math.sin(lured.yaw) * -1;
    dot.z = lured.z + 4 * Math.cos(lured.yaw);
    dot.vx = 0;
    dot.vz = 0;
    const yawBefore = lured.yaw;
    lured.velocityX = 10 * Math.cos(lured.yaw);
    lured.velocityZ = 10 * Math.sin(lured.yaw);

    stepRaceSimulation({ ...step, frames: [NEUTRAL_INPUT, NEUTRAL_INPUT] });

    expect(step.participants[1]!.state.yaw).not.toBe(yawBefore);
  });
});
