import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createRng } from '../../src/shared/core/rng';
import { createKartState, type KartState } from '../../src/games/kart/kart/kartState';
import { createTankFire, stepTankFire, type TankFire, type TankFireParticipant } from '../../src/games/kart/items/tankFire';
import { RING_TEST_MAP } from '../support/ringTestMap';

const STEP = 1 / 60;

const NORTH = -Math.PI / 2;
const LANE_X = 50;

/** A kart on the open carpet lane of the ring test map, driving north (towards smaller z). */
function participant(z: number, kartType: 'tank' | 'car' = 'car', x = LANE_X, yaw = NORTH): TankFireParticipant & { readonly state: KartState } {
  return { state: createKartState(x, z, yaw), progress: { finished: false }, loadout: { kartType } };
}

function readyTank(fire: TankFire, index: number, place: number): void {
  fire.shooters[index] = { cooldownSeconds: 0, holdoffSeconds: 0, previousPlace: place };
}

function runSeconds(
  fire: TankFire,
  participants: readonly TankFireParticipant[],
  places: readonly number[],
  seconds: number,
  rng = createRng(1),
  events = {},
): void {
  const items = createRuntimeItems();
  for (let tick = 0; tick < seconds / STEP; tick += 1) stepTankFire(fire, items, RING_TEST_MAP, participants, places, rng, STEP, events);
}

function countFiredShots(run: (events: { fired: () => void }) => void): number {
  let fired = 0;
  run({
    fired: () => {
      fired += 1;
    },
  });
  return fired;
}

describe('tank automatic shot', () => {
  it('waits the configured interval before the first shot', () => {
    const items = createRuntimeItems();
    const racers = [participant(0), participant(30, 'tank')];
    const fire = createTankFire();

    const early = countFiredShots((events) => runSeconds(fire, racers, [1, 2], items.tank.shotIntervalSeconds - 1, createRng(1), events));
    const late = countFiredShots((events) => runSeconds(fire, racers, [1, 2], 1.5, createRng(1), events));

    expect(early).toBe(0);
    expect(late).toBe(1);
  });

  it('never shoots while leading', () => {
    const fire = createTankFire();
    const racers = [participant(30, 'tank'), participant(50)];
    readyTank(fire, 0, 1);

    expect(countFiredShots((events) => runSeconds(fire, racers, [1, 2], 30, createRng(1), events))).toBe(0);
  });

  it('holds fire for the holdoff time after being overtaken, then shoots', () => {
    const items = createRuntimeItems();
    const racers = [participant(0), participant(20), participant(30, 'tank')];
    const fire = createTankFire();
    readyTank(fire, 2, 2);

    const duringHoldoff = countFiredShots((events) => {
      stepTankFire(fire, items, RING_TEST_MAP, racers, [1, 2, 3], createRng(1), STEP, events);
      runSeconds(fire, racers, [1, 2, 3], items.tank.overtakenHoldoffSeconds - 1.5, createRng(1), events);
    });
    const afterHoldoff = countFiredShots((events) => runSeconds(fire, racers, [1, 2, 3], 2, createRng(1), events));

    expect(duringHoldoff).toBe(0);
    expect(afterHoldoff).toBe(1);
  });

  it('picks its target by the place-based odds', () => {
    const counts = [0, 0, 0, 0];
    const rng = createRng(7);
    const items = createRuntimeItems();
    const trials = 1000;
    for (let trial = 0; trial < trials; trial += 1) {
      const fire = createTankFire();
      const racers = [participant(-30), participant(-10), participant(10), participant(30, 'tank')];
      readyTank(fire, 3, 4);
      stepTankFire(fire, items, RING_TEST_MAP, racers, [1, 2, 3, 4], rng, STEP);
      counts[fire.shells[0]!.targetIndex]! += 1;
    }
    expect(counts[0]! / trials).toBeGreaterThan(0.43);
    expect(counts[0]! / trials).toBeLessThan(0.57);
    expect(counts[1]! / trials).toBeGreaterThan(0.23);
    expect(counts[1]! / trials).toBeLessThan(0.37);
    expect(counts[2]! / trials).toBeGreaterThan(0.13);
    expect(counts[2]! / trials).toBeLessThan(0.27);
    expect(counts[3]).toBe(0);
  });

  it('always targets the leader from second place and never a finished kart', () => {
    const items = createRuntimeItems();
    const fire = createTankFire();
    readyTank(fire, 1, 2);
    stepTankFire(fire, items, RING_TEST_MAP, [participant(0), participant(30, 'tank')], [1, 2], createRng(3), STEP);
    expect(fire.shells[0]!.targetIndex).toBe(0);

    const noTarget = createTankFire();
    const finishedLeader = { ...participant(0), progress: { finished: true } };
    readyTank(noTarget, 1, 2);
    stepTankFire(noTarget, items, RING_TEST_MAP, [finishedLeader, participant(30, 'tank')], [1, 2], createRng(3), STEP);
    expect(noTarget.shells).toHaveLength(0);
  });

  it('homes in, explodes, and stuns the target and neighbours inside the radius', () => {
    const fire = createTankFire();
    const target = participant(-10);
    const neighbour = participant(-12, 'car', LANE_X + 2);
    const faraway = participant(-50);
    const racers = [target, neighbour, faraway, participant(30, 'tank')];
    readyTank(fire, 3, 4);
    const detonations: number[] = [];

    runSeconds(fire, racers, [1, 2, 3, 4], 3, createRng(11), { detonated: () => detonations.push(1) });

    expect(detonations).toHaveLength(1);
    expect(target.state.stunSecondsLeft).toBeGreaterThan(0);
    expect(neighbour.state.stunSecondsLeft).toBeGreaterThan(0);
    expect(faraway.state.stunSecondsLeft).toBe(0);
  });

  it('bends towards a target that is not straight ahead', () => {
    const fire = createTankFire();
    const target = participant(0, 'car', LANE_X + 12);
    const racers = [target, participant(30, 'tank')];
    readyTank(fire, 1, 2);

    runSeconds(fire, racers, [1, 2], 3, createRng(5));

    expect(target.state.stunSecondsLeft).toBeGreaterThan(0);
  });

  it('is blocked by a Nickerchen shield', () => {
    const fire = createTankFire();
    const target = participant(-10);
    target.state.shieldSecondsLeft = 5;
    const racers = [target, participant(30, 'tank')];
    readyTank(fire, 1, 2);

    runSeconds(fire, racers, [1, 2], 3);

    expect(target.state.shieldSecondsLeft).toBe(0);
    expect(target.state.stunSecondsLeft).toBe(0);
  });

  it('can hit the tank itself when the shell explodes right in front of it', () => {
    const fire = createTankFire();
    const tank = participant(-64, 'tank');
    const racers = [participant(-60), tank];
    readyTank(fire, 1, 2);

    runSeconds(fire, racers, [1, 2], 0.5);

    expect(tank.state.stunSecondsLeft).toBeGreaterThan(0);
  });
});
