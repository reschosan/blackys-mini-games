import { describe, expect, it } from 'vitest';
import { decodeSnapshot, encodeSnapshot, isNewerSequence, withAckInputSequence } from '../../src/games/kart/replication/snapshot';
import type { KartSnapshot, RaceSnapshot } from '../../src/games/kart/replication/snapshotTypes';

function kart(overrides: Partial<KartSnapshot> = {}): KartSnapshot {
  return {
    x: 12.5,
    z: -3.25,
    yaw: 1.5,
    velocityX: 4,
    velocityZ: -2,
    levelId: 'ground',
    stairTransitionId: null,
    driftDirection: -1,
    driftStage: 2,
    driftCharge: 0.75,
    lastBoostFieldId: 'pad-1',
    lastWindowJumpId: null,
    boostSeconds: 0.5,
    stunSecondsLeft: 0,
    stickySecondsLeft: 1.5,
    shieldSecondsLeft: 1.25,
    catnipSecondsLeft: 0,
    penaltySecondsLeft: 0,
    airborneSecondsLeft: 0,
    airborneSeconds: 0,
    shoveCooldownSeconds: 0,
    onCarpet: true,
    surfaceKind: 'mud',
    windowJumpId: null,
    windowJumpElapsedSeconds: 0,
    lap: 1,
    nextCheckpoint: 3,
    finished: false,
    finishTimeSeconds: null,
    heldItem: 'hairball',
    place: 2,
    ...overrides,
  };
}

function snapshot(overrides: Partial<RaceSnapshot> = {}): RaceSnapshot {
  return {
    sequence: 7,
    ackInputSequence: 0,
    raceTimeSeconds: 12.5,
    countdownSecondsLeft: 0,
    goDisplayActive: true,
    finishCountdownSeconds: null,
    karts: [kart(), kart({ x: 1, heldItem: null, finished: true, finishTimeSeconds: 61.5, windowJumpId: 'window-1', stairTransitionId: 'stairs' })],
    hairballs: [{ kind: 'yarn', x: 1, z: 2, vx: 3, vz: 4, ownerIndex: 1, levelId: 'ground', elevation: 0.5 }],
    traps: [
      { kind: 'cup', x: 5, z: 6, ownerIndex: 0, levelId: 'up', elevation: null },
      { kind: 'cowpat', x: 7, z: 8, ownerIndex: 1, levelId: 'ground', elevation: 0.25 },
    ],
    lasers: [{ x: 1, z: 1, vx: 0, vz: 1, ownerIndex: 0, levelId: 'ground', secondsLeft: 2 }],
    gravityBubbles: [{ x: 2, z: 2, ownerIndex: 1, levelId: 'ground', elevation: 0, secondsLeft: 3 }],
    vacuumPulses: [{ x: 3, z: 3, yaw: 0.5, levelId: 'ground', ageSeconds: 0.125 }],
    shells: [{ x: 4, z: 4, heading: 1, ageSeconds: 0.25, ownerIndex: 2, targetIndex: 0, levelId: 'ground', elevation: 0 }],
    explosions: [{ x: 5, z: 5, levelId: 'ground', elevation: 0, ageSeconds: 0.375 }],
    itemBoxCollected: [true, false, false, true, false, false, false, false, true],
    extras: [12.5, 1, 0.25],
    ...overrides,
  };
}

/** What the float32 numbers on the wire turn a value into. */
const wire = (value: number): number => Math.fround(value);

describe('snapshot codec', () => {
  it('gives the same snapshot back that went in', () => {
    const decoded = decodeSnapshot(encodeSnapshot(snapshot()));
    expect(decoded).toEqual(snapshot());
  });

  it('keeps positions exact to float32 precision', () => {
    const decoded = decodeSnapshot(encodeSnapshot(snapshot({ karts: [kart({ x: 123.456789, z: -98.7654321 })] })));
    expect(decoded?.karts[0]?.x).toBe(wire(123.456789));
    expect(decoded?.karts[0]?.z).toBe(wire(-98.7654321));
  });

  it('stays far below the size of one network packet for four karts and a busy track', () => {
    const busy = snapshot({
      karts: [kart(), kart(), kart(), kart()],
      hairballs: Array.from({ length: 6 }, () => snapshot().hairballs[0]!),
      traps: Array.from({ length: 6 }, () => snapshot().traps[0]!),
      itemBoxCollected: Array.from({ length: 24 }, (_, index) => index % 3 === 0),
    });
    expect(encodeSnapshot(busy).byteLength).toBeLessThan(1200);
  });

  it('changes only the acknowledged input for another guest', () => {
    const encoded = encodeSnapshot(snapshot());
    const decoded = decodeSnapshot(withAckInputSequence(encoded, 4321));
    expect(decoded).toEqual(snapshot({ ackInputSequence: 4321 }));
    expect(decodeSnapshot(encoded)?.ackInputSequence).toBe(0);
  });

  it('wraps the sequence like a 16 bit counter', () => {
    expect(decodeSnapshot(encodeSnapshot(snapshot({ sequence: 65537 })))?.sequence).toBe(1);
    expect(isNewerSequence(1, 65535)).toBe(true);
    expect(isNewerSequence(65535, 1)).toBe(false);
    expect(isNewerSequence(5, 5)).toBe(false);
    expect(isNewerSequence(100, 99)).toBe(true);
  });

  it('refuses damaged messages instead of passing nonsense on', () => {
    const good = encodeSnapshot(snapshot());
    expect(decodeSnapshot(good.slice(0, good.byteLength - 3))).toBeNull();
    expect(decodeSnapshot(new ArrayBuffer(0))).toBeNull();
    const wrongVersion = good.slice(0);
    new Uint8Array(wrongVersion)[0] = 99;
    expect(decodeSnapshot(wrongVersion)).toBeNull();
    const trailing = new Uint8Array(good.byteLength + 1);
    trailing.set(new Uint8Array(good));
    expect(decodeSnapshot(trailing.buffer)).toBeNull();
  });

  it('refuses a number that is not a number', () => {
    const nan = snapshot({ raceTimeSeconds: Number.NaN });
    expect(decodeSnapshot(encodeSnapshot(nan))).toBeNull();
    const infinite = snapshot({ karts: [kart({ x: Number.POSITIVE_INFINITY })] });
    expect(decodeSnapshot(encodeSnapshot(infinite))).toBeNull();
  });

  it('refuses a message that claims far too many entries', () => {
    const good = new Uint8Array(encodeSnapshot(snapshot({ karts: [] })));
    const kartCountPosition = 1 + 1 + 2 + 2 + 4 + 4 + 1 + 1 + 4;
    good[kartCountPosition] = 200;
    expect(decodeSnapshot(good.buffer)).toBeNull();
  });

  it('carries the state of the rules of a game as numbers, and nothing in the plain race', () => {
    const decoded = decodeSnapshot(encodeSnapshot(snapshot({ extras: [0.5, 3, -1, 1024] })))!;
    expect(decoded.extras).toEqual([0.5, 3, -1, 1024]);
    expect(decodeSnapshot(encodeSnapshot(snapshot({ extras: [] })))!.extras).toEqual([]);
  });

  it('refuses a message that claims far too many numbers of rules', () => {
    const encoded = new Uint8Array(encodeSnapshot(snapshot({ extras: [] })));
    encoded[encoded.length - 1] = 200;
    expect(decodeSnapshot(encoded.buffer)).toBeNull();
  });

  it('refuses an item that does not exist', () => {
    const bare = snapshot({
      karts: [kart({ heldItem: 'hairball' })],
      hairballs: [],
      traps: [],
      lasers: [],
      gravityBubbles: [],
      vacuumPulses: [],
      shells: [],
      explosions: [],
      itemBoxCollected: [],
      extras: [],
    });
    const encoded = new Uint8Array(encodeSnapshot(bare));
    const itemPosition = encoded.length - 11;
    expect(encoded[itemPosition]).toBe(0);
    encoded[itemPosition] = 50;
    expect(decodeSnapshot(encoded.buffer)).toBeNull();
  });
});
