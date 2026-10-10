import { describe, expect, it } from 'vitest';
import { driveFactorsOf } from '../../src/games/kart/ai/raceAiInput';
import { KART_COLLIDER_RADIUS } from '../../src/shared/config/kart';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createKartLoadout, type KartTypeId } from '../../src/shared/config/kartLoadout';
import { createKartState, speedOf, type KartDriveFactors, type KartState } from '../../src/games/kart/kart/kartState';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { stepAllKarts } from '../../src/games/kart/kart/kartSimulation';
import { resolveWeightedKartPair } from '../../src/games/kart/kart/kartTackle';

const config = createRuntimeDriving();
const TOUCHING = KART_COLLIDER_RADIUS * 2 - 0.2;

function factors(kartType: KartTypeId): KartDriveFactors {
  return driveFactorsOf(createKartLoadout(0, kartType));
}

/** A kart driving east at `speed` that touches a second one standing sideways in front of it. */
function sideHit(rammer: KartTypeId, victim: KartTypeId, speed = 16): { rammerKart: KartState; victimKart: KartState; collided: boolean } {
  const rammerKart = createKartState(0, 0, 0);
  rammerKart.velocityX = speed;
  const victimKart = createKartState(TOUCHING, 0, -Math.PI / 2);
  const collided = resolveWeightedKartPair(config, rammerKart, victimKart, factors(rammer), factors(victim), KART_COLLIDER_RADIUS);
  return { rammerKart, victimKart, collided };
}

const shoveOf = (kart: KartState): number => Math.hypot(kart.velocityX, kart.velocityZ);

describe('tackling between karts', () => {
  it('does nothing while the karts do not touch', () => {
    const first = createKartState(0, 0, 0);
    const second = createKartState(KART_COLLIDER_RADIUS * 2 + 1, 0, 0);
    expect(resolveWeightedKartPair(config, first, second, factors('car'), factors('car'), KART_COLLIDER_RADIUS)).toBe(false);
  });

  it('pushes the karts apart so they no longer overlap, the lighter one further', () => {
    const { rammerKart, victimKart } = sideHit('car', 'motorcycle', 0);
    expect(Math.hypot(victimKart.x - rammerKart.x, victimKart.z - rammerKart.z)).toBeGreaterThanOrEqual(KART_COLLIDER_RADIUS * 2 - 1e-9);

    const heavy = sideHit('car', 'tank', 0);
    const light = sideHit('car', 'motorcycle', 0);
    expect(light.victimKart.x - TOUCHING).toBeGreaterThan(heavy.victimKart.x - TOUCHING);
  });

  it('shoves a victim sideways away from the attacker and slows it, while the attacker keeps most of its speed', () => {
    const { rammerKart, victimKart } = sideHit('car', 'car');
    expect(victimKart.velocityX).toBeGreaterThan(3);
    expect(rammerKart.velocityX).toBeGreaterThan(14);
    expect(speedOf(victimKart)).toBeGreaterThan(3);
  });

  it('lets the tank shove a motorcycle much further than the motorcycle shoves the tank', () => {
    const tankHitsMotorcycle = sideHit('tank', 'motorcycle').victimKart;
    const motorcycleHitsTank = sideHit('motorcycle', 'tank').victimKart;
    expect(shoveOf(tankHitsMotorcycle)).toBeGreaterThan(shoveOf(motorcycleHitsTank) * 2);
  });

  it('lets a heavier kart win a head-on clash of the same speed', () => {
    const tank = createKartState(0, 0, 0);
    tank.velocityX = 12;
    const motorcycle = createKartState(TOUCHING, 0, Math.PI);
    motorcycle.velocityX = -12;

    resolveWeightedKartPair(config, tank, motorcycle, factors('tank'), factors('motorcycle'), KART_COLLIDER_RADIUS);

    expect(tank.velocityX).toBeGreaterThan(6);
    expect(motorcycle.velocityX).toBeGreaterThanOrEqual(0);
  });

  it('treats an even clash as a plain bump: both lose speed and nobody is shoved sideways', () => {
    const first = createKartState(0, 0, 0);
    first.velocityX = 10;
    const second = createKartState(TOUCHING, 0, Math.PI);
    second.velocityX = -10;

    resolveWeightedKartPair(config, first, second, factors('car'), factors('car'), KART_COLLIDER_RADIUS);

    expect(first.velocityZ).toBeCloseTo(0);
    expect(second.velocityZ).toBeCloseTo(0);
    expect(speedOf(first)).toBeLessThan(10);
    expect(speedOf(second)).toBeLessThan(10);
  });

  it('cannot tackle a kart with a Nickerchen shield: it stays put and the attacker bounces off, the shield stays', () => {
    const rammerKart = createKartState(0, 0, 0);
    rammerKart.velocityX = 16;
    const shielded = createKartState(TOUCHING, 0, -Math.PI / 2);
    shielded.shieldSecondsLeft = 3;

    resolveWeightedKartPair(config, rammerKart, shielded, factors('tank'), factors('motorcycle'), KART_COLLIDER_RADIUS);

    expect(shielded.velocityX).toBe(0);
    expect(shielded.velocityZ).toBe(0);
    expect(shielded.x).toBe(TOUCHING);
    expect(shielded.shieldSecondsLeft).toBe(3);
    expect(rammerKart.velocityX).toBeLessThan(16 * 0.5);
  });

  it('a shielded kart can tackle: the shield is not used up', () => {
    const shielded = createKartState(0, 0, 0);
    shielded.velocityX = 16;
    shielded.shieldSecondsLeft = 3;
    const victim = createKartState(TOUCHING, 0, -Math.PI / 2);

    resolveWeightedKartPair(config, shielded, victim, factors('car'), factors('car'), KART_COLLIDER_RADIUS);

    expect(shielded.shieldSecondsLeft).toBe(3);
    expect(victim.velocityX).toBeGreaterThan(1);
  });

  it('protects a freshly tackled kart for a moment, so two karts cannot lock each other', () => {
    const first = sideHit('car', 'car');
    expect(first.victimKart.tackleImmunitySeconds).toBe(config.tackleImmunitySeconds);

    const velocityBefore = [first.victimKart.velocityX, first.victimKart.velocityZ];
    first.rammerKart.velocityX = 16;
    first.rammerKart.x = first.victimKart.x - TOUCHING;
    first.rammerKart.z = first.victimKart.z;
    resolveWeightedKartPair(config, first.rammerKart, first.victimKart, factors('car'), factors('car'), KART_COLLIDER_RADIUS);

    expect([first.victimKart.velocityX, first.victimKart.velocityZ]).toEqual(velocityBefore);
    expect(Math.hypot(first.victimKart.x - first.rammerKart.x, first.victimKart.z - first.rammerKart.z)).toBeGreaterThanOrEqual(
      KART_COLLIDER_RADIUS * 2 - 1e-9,
    );
  });

  it('is deterministic: the same hit gives the same result', () => {
    const run = () => {
      const { rammerKart, victimKart } = sideHit('sportsCar', 'skateboard', 18);
      return [rammerKart.velocityX, rammerKart.velocityZ, victimKart.velocityX, victimKart.velocityZ, victimKart.x];
    };
    expect(run()).toEqual(run());
  });
});

describe('tackling while driving', () => {
  const NORTH = -Math.PI / 2;

  /** All karts drive on at full throttle; the first one steers right for the first half second. */
  function drive(karts: KartState[], kinds: KartTypeId[], seconds: number, steerFirst = 0): void {
    const kartFactors = kinds.map(factors);
    for (let tick = 0; tick < seconds * 60; tick += 1) {
      const steer = tick < 30 ? steerFirst : 0;
      const inputs = karts.map((_, index) => ({ ...NEUTRAL_INPUT, accelerate: true, steer: index === 0 ? steer : 0 }));
      stepAllKarts(config, RING_TEST_MAP, karts, inputs, 1 / 60, kartFactors);
    }
  }

  /** The kart on the left steers into the one on the right; returns how far the right one was shoved sideways. */
  function sidewaysShove(rammer: KartTypeId, victim: KartTypeId): { shove: number; speeds: number[]; gap: number } {
    const left = createKartState(44.5, 40, NORTH, 'ground');
    const right = createKartState(47.2, 40, NORTH, 'ground');
    for (const kart of [left, right]) kart.velocityZ = -18;
    drive([left, right], [rammer, victim], 2.5, 0.6);
    return {
      shove: right.x - 47.2,
      speeds: [speedOf(left), speedOf(right)],
      gap: Math.hypot(right.x - left.x, right.z - left.z),
    };
  }

  it('lets a tank steering into a motorcycle shove it aside, and both keep driving', () => {
    const { shove, speeds } = sidewaysShove('tank', 'motorcycle');
    expect(shove).toBeGreaterThan(0.5);
    for (const speed of speeds) expect(speed).toBeGreaterThan(8);
  });

  it('shoves a light motorcycle further than a heavy tank gets shoved by the same hit', () => {
    expect(sidewaysShove('tank', 'motorcycle').shove).toBeGreaterThan(sidewaysShove('motorcycle', 'tank').shove + 0.3);
  });

  it('does not make two equal karts that drive side by side stick to each other', () => {
    const left = createKartState(48, 40, NORTH, 'ground');
    const right = createKartState(49.8, 40, NORTH, 'ground');
    drive([left, right], ['car', 'car'], 3);

    expect(speedOf(left)).toBeGreaterThan(12);
    expect(speedOf(right)).toBeGreaterThan(12);
  });

  it('keeps the old plain bump when karts have no mass and ramming power (older simulations)', () => {
    const first = createKartState(0, 0, 0);
    first.velocityX = 10;
    const second = createKartState(TOUCHING, 0, 0);
    stepAllKarts(config, RING_TEST_MAP, [first, second], [NEUTRAL_INPUT, NEUTRAL_INPUT], 1 / 60);
    expect(second.tackleImmunitySeconds).toBe(0);
  });
});
