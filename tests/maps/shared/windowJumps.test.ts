import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING } from '../../../src/shared/config/driving';
import { buildWalls, type MapConfig } from '../../../src/games/kart/maps/shared/mapConfig';
import { createKartState } from '../../../src/games/kart/kart/kartState';
import { stepAllKarts } from '../../../src/games/kart/kart/kartSimulation';
import { NEUTRAL_INPUT } from '../../../src/shared/input/actions';
import { windowJumpHeight } from '../../../src/games/kart/maps/shared/windowJumps';
import { FAMILY_HOUSE } from '../../../src/games/kart/maps/familyHouse/map';
import { createItemBoxStates, stepItemBoxes } from '../../../src/games/kart/items/itemBoxes';
import { createRuntimeItems } from '../../../src/shared/config/items';
import { createRng } from '../../../src/shared/core/rng';

const STEP = 1 / 60;
const MAP: MapConfig = {
  name: 'Window jump test',
  room: { x: 0, z: 0, width: 40, depth: 40 },
  wallHeight: 3,
  wallThickness: 1,
  carpet: { island: { x: 0, z: 0, width: 10, depth: 10 }, routeWidth: 5 },
  walls: buildWalls({ x: 0, z: 0, width: 40, depth: 40 }, 1),
  obstacles: [],
  checkpoints: [],
  waypoints: [],
  startPositions: [{ x: 0, z: 0, yaw: 0, levelId: 'ground' }],
  itemBoxes: [],
  windowJumps: [
    {
      id: 'window',
      name: 'Test window',
      levelId: 'ground',
      landingLevelId: 'ground',
      launchRect: { x: 0, z: 0, width: 4, depth: 4 },
      landingRect: { x: 0, z: 0, width: 4, depth: 4 },
      minimumSpeed: 5,
      durationSeconds: 0.2,
      peakHeight: 3,
      airControlPerSecond: 1,
      penaltySeconds: 0.25,
      recovery: { x: -5, z: 0, yaw: 0, levelId: 'ground' },
    },
  ],
};

describe('window jumps', () => {
  it('leaves more than twenty metres after the hobby jump landing before the next turn at normal top speed', () => {
    const jump = FAMILY_HOUSE.windowJumps!.find((jump) => jump.id === 'hobby-item-ramp')!;
    expect(60 - jump.launchRect.x - 22 * jump.durationSeconds).toBeGreaterThan(20);
    expect(FAMILY_HOUSE.windowJumps!.every((jump) => jump.optional)).toBe(true);
    expect(FAMILY_HOUSE.windowJumps!.some((jump) => jump.id === 'living-item-ramp')).toBe(false);
  });
  it('does not let an optional item jump bypass a wall during flight or landing', () => {
    const map = {
      ...MAP,
      walls: [{ x: 2, z: 0, width: 0.5, depth: 20 }],
      windowJumps: [{ ...MAP.windowJumps![0]!, optional: true, landingRect: { x: 0, z: 0, width: 40, depth: 40 } }],
    };
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 8;
    for (let tick = 0; tick < 30; tick += 1) stepAllKarts(DEFAULT_DRIVING, map, [kart], [NEUTRAL_INPUT], STEP);
    expect(kart.x).toBeLessThan(1);
    expect(kart.penaltySecondsLeft).toBe(0);
  });
  it.each(FAMILY_HOUSE.windowJumps!.filter((jump) => jump.optional))('$name rewards airborne driving but can be bypassed or approached slowly', (jump) => {
    const box = FAMILY_HOUSE.itemBoxes.find(
      (box) => box.levelId === jump.levelId && box.heightOffset && Math.hypot(box.x - jump.launchRect.x, box.z - jump.launchRect.z) < 20,
    )!;
    const floorCarrier = { state: createKartState(box.x, box.z, 0, jump.levelId), heldItem: null };
    stepItemBoxes(FAMILY_HOUSE, createItemBoxStates(FAMILY_HOUSE), createRuntimeItems(), [floorCarrier], [1], createRng(1), STEP);
    expect(floorCarrier.heldItem).toBeNull();
    for (const speed of [12, 18, 22]) {
      const yaw = jump.launchYaw ?? 0;
      const kart = createKartState(jump.launchRect.x, jump.launchRect.z, yaw, jump.levelId);
      kart.velocityX = Math.cos(yaw) * speed;
      kart.velocityZ = Math.sin(yaw) * speed;
      const carrier = { state: kart, heldItem: null };
      const states = createItemBoxStates(FAMILY_HOUSE);
      for (let tick = 0; tick < 50; tick += 1) {
        stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [NEUTRAL_INPUT], STEP);
        stepItemBoxes(FAMILY_HOUSE, states, createRuntimeItems(), [carrier], [1], createRng(1), STEP);
      }
      expect(carrier.heldItem, `speed ${speed}`).not.toBeNull();
      expect(kart.windowJumpId).toBeNull();
      expect(kart.penaltySecondsLeft).toBe(0);
    }
    for (const [offset, speed] of [
      [0, 3],
      [3, 18],
    ]) {
      const yaw = jump.launchYaw ?? 0;
      const kart = createKartState(jump.launchRect.x - Math.sin(yaw) * offset!, jump.launchRect.z + Math.cos(yaw) * offset!, yaw, jump.levelId);
      kart.velocityX = Math.cos(yaw) * speed!;
      kart.velocityZ = Math.sin(yaw) * speed!;
      stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [NEUTRAL_INPUT], STEP);
      expect(kart.windowJumpId).toBeNull();
      expect(kart.penaltySecondsLeft).toBe(0);
    }
  });
  it.each([
    ['ground', -27],
    ['first', 63.6],
  ] as const)('drives through the former %s window without a forced jump or penalty', (levelId, x) => {
    const kart = createKartState(x, 93, Math.PI / 2, levelId);
    for (let tick = 0; tick < 180; tick += 1) stepAllKarts(DEFAULT_DRIVING, FAMILY_HOUSE, [kart], [{ ...NEUTRAL_INPUT, accelerate: true }], STEP);
    expect(kart.z).toBeGreaterThan(110);
    expect(kart.windowJumpId).toBeNull();
    expect(kart.penaltySecondsLeft).toBe(0);
  });
  it('penalizes a jump with insufficient launch speed then returns to its recovery point', () => {
    const kart = createKartState(0, 0, 0);
    stepAllKarts(DEFAULT_DRIVING, MAP, [kart], [NEUTRAL_INPUT], STEP);

    expect(kart.penaltySecondsLeft).toBeCloseTo(0.25, 3);
    for (let tick = 0; tick < 16; tick += 1) stepAllKarts(DEFAULT_DRIVING, MAP, [kart], [NEUTRAL_INPUT], STEP);
    expect(kart).toMatchObject({ x: -5, z: 0, levelId: 'ground', windowJumpId: null, penaltySecondsLeft: 0 });
  });

  it('lands only inside the configured landing zone and gives the jump visible height', () => {
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 8;
    stepAllKarts(DEFAULT_DRIVING, MAP, [kart], [NEUTRAL_INPUT], STEP);
    for (let tick = 0; tick < 6; tick += 1) stepAllKarts(DEFAULT_DRIVING, MAP, [kart], [NEUTRAL_INPUT], STEP);
    expect(windowJumpHeight(MAP, kart)).toBeGreaterThan(0);
    for (let tick = 0; tick < 12; tick += 1) stepAllKarts(DEFAULT_DRIVING, MAP, [kart], [NEUTRAL_INPUT], STEP);
    expect(kart.windowJumpId).toBeNull();
    expect(kart.penaltySecondsLeft).toBe(0);
  });

  it('penalizes a fast jump that misses its configured landing zone', () => {
    const missMap: MapConfig = {
      ...MAP,
      windowJumps: [{ ...MAP.windowJumps![0]!, landingRect: { x: 10, z: 0, width: 2, depth: 2 }, airControlPerSecond: 20 }],
    };
    const kart = createKartState(0, 0, 0);
    kart.velocityX = 8;
    for (let tick = 0; tick < 14; tick += 1) stepAllKarts(DEFAULT_DRIVING, missMap, [kart], [{ ...NEUTRAL_INPUT, steer: 1 }], STEP);

    expect(kart.penaltySecondsLeft).toBeGreaterThan(0);
  });
});
