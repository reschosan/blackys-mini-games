import { NO_PICK } from '../../src/shared/input/touch/touchSource';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RaceBroadcaster, type BroadcastSource } from '../../src/party/app/raceBroadcaster';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createRuntimeRemote, REMOTE_HOST_MESSAGE_MAX_CHARACTERS } from '../../src/shared/config/remote';
import type { EngineRound } from '../../src/party/app/game/engineRound';
import type { RaceSetup } from '../../src/games/kart/replication/raceSetup';
import { parseHostMessage, serializeHostMessage } from '../../src/shared/net/messages';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import { InputManager } from '../../src/shared/input/inputManager';
import { RemoteInput, type RemoteLink } from '../../src/shared/input/remote/remoteInput';
import { createKartState } from '../../src/games/kart/kart/kartState';
import type { RacePlayer } from '../../src/games/kart/race/racePlayer';
import { createProgress } from '../../src/games/kart/race/raceState';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';
import { decodeSnapshot } from '../../src/games/kart/replication/snapshot';
import { RING_TEST_MAP } from '../support/ringTestMap';

beforeEach(() => {
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true });
  (globalThis as unknown as { __BUILD_ID__: string }).__BUILD_ID__ = 'test-build';
});

function racePlayer(index: number, isAi = false): RacePlayer {
  const start = RING_TEST_MAP.startPositions[index]!;
  return {
    state: createKartState(start.x, start.z, start.yaw),
    progress: createProgress(start.x, start.z),
    isAi,
    aiDriver: null,
    difficulty: null,
    loadout: createKartLoadout(index),
    heldItem: null,
    previousUseItem: false,
    raceStartEarlyPress: false,
    raceStartBoostEarned: false,
  };
}

function fixture(configOverrides: Partial<ReturnType<typeof createRuntimeRemote>> = {}, playerCount = 3, engine: EngineRound | null = null) {
  const config = { ...createRuntimeRemote(), readyWaitSeconds: 2, ...configOverrides };
  const input = new InputManager(createRuntimeTouchSteering());
  const link: RemoteLink = { send: vi.fn(), sendState: vi.fn(), close: vi.fn() };
  const guest = new RemoteInput(input.nextRemoteId(), link, config);
  input.joinTouch();
  input.addRemote(guest);
  const players = [racePlayer(0), racePlayer(1), racePlayer(2, true), racePlayer(3, true)].slice(0, playerCount);
  const world = createRaceWorld(RING_TEST_MAP);
  const source: BroadcastSource = {
    input,
    players: () => players,
    world: () => world,
    modeId: () => 'timetrial',
    mapIndex: () => 1,
    lapCount: () => 3,
    phase: () => 'racing',
    nameOfSlot: (slot) => `Katze ${slot + 1}`,
    appearanceOf: () => createCatAppearance(),
    countdown: () => ({ secondsLeft: 3, goDisplayActive: false }),
    finishCountdownSeconds: () => null,
    extras: () => [],
    engine: () => engine,
  };
  return { broadcaster: new RaceBroadcaster(source, config), guest, link, config };
}

describe('RaceBroadcaster', () => {
  it('sends every guest the setup with its own seat when a race begins', () => {
    const { broadcaster, link } = fixture();
    broadcaster.beginRace();
    const sent = vi.mocked(link.send).mock.calls[0]![0];
    expect(sent.kind).toBe('setup');
    if (sent.kind !== 'setup') return;
    const setup = sent.setup as RaceSetup;
    expect(sent.game).toBe('timetrial');
    expect(setup).toMatchObject({
      buildId: 'test-build',
      mode: 'timetrial',
      mapIndex: 1,
      lapCount: 3,
      seat: 1,
      resume: false,
      snapshotHz: createRuntimeRemote().snapshotHz,
    });
    expect(setup.players.map((player) => player.isAi)).toEqual([false, false, true]);
  });

  it('holds the start until the guest is ready, and not longer than the wait time', () => {
    const { broadcaster, guest } = fixture();
    broadcaster.beginRace();
    expect(broadcaster.waitingForGuests).toBe(true);
    expect(broadcaster.holdsStart(1)).toBe(true);
    broadcaster.guestMessage(guest, { kind: 'ready', renders: true });
    expect(broadcaster.waitingForGuests).toBe(false);
    expect(broadcaster.holdsStart(1)).toBe(false);

    broadcaster.beginRace();
    expect(broadcaster.holdsStart(1.5)).toBe(true);
    expect(broadcaster.holdsStart(1)).toBe(false);
    expect(broadcaster.waitingForGuests).toBe(false);
  });

  it('sends no pictures to a guest that stays a controller, and does not hold the start for it', () => {
    const { broadcaster, guest, link } = fixture();
    broadcaster.beginRace();
    broadcaster.guestMessage(guest, { kind: 'ready', renders: false });
    for (let tick = 0; tick < 30; tick += 1) broadcaster.tick();
    expect(link.sendState).not.toHaveBeenCalled();
    expect(broadcaster.holdsStart(1)).toBe(false);
    expect(broadcaster.drawsItself(1)).toBe(false);
  });

  it("sends the pictures at the snapshot rate, each with the guest's own acknowledged input", () => {
    const { broadcaster, guest, link, config } = fixture();
    broadcaster.beginRace();
    guest.receive({ kind: 'input', stickX: 0, stickY: 0, pressedBits: 0, pick: NO_PICK, mode: 'auto', sequence: 777 });
    broadcaster.guestMessage(guest, { kind: 'ready', renders: true });
    for (let tick = 0; tick < 60; tick += 1) broadcaster.tick();
    expect(vi.mocked(link.sendState)).toHaveBeenCalledTimes(config.snapshotHz);
    const decoded = decodeSnapshot(vi.mocked(link.sendState).mock.calls[0]![0]);
    expect(decoded?.ackInputSequence).toBe(777);
    expect(decoded?.karts).toHaveLength(3);
    expect(broadcaster.drawsItself(1)).toBe(true);
    expect(broadcaster.drawsItself(0)).toBe(false);
  });

  it('forgets who draws when the race ends, and sends events only to guests that draw', () => {
    const { broadcaster, guest, link } = fixture();
    broadcaster.beginRace();
    broadcaster.event({ type: 'go' });
    expect(vi.mocked(link.send).mock.calls.filter(([message]) => message.kind === 'event')).toHaveLength(0);
    broadcaster.guestMessage(guest, { kind: 'ready', renders: true });
    broadcaster.event({ type: 'go' });
    expect(vi.mocked(link.send).mock.calls.filter(([message]) => message.kind === 'event')).toHaveLength(1);
    broadcaster.endRace();
    expect(broadcaster.drawsItself(1)).toBe(false);
  });

  it('gives a returning guest a setup that says the race is already under way', () => {
    const { broadcaster, guest, link } = fixture();
    broadcaster.resumeFor(guest);
    const sent = vi.mocked(link.send).mock.calls[0]![0];
    expect(sent.kind === 'setup' && (sent.setup as RaceSetup).resume).toBe(true);
  });

  it('moves a snapshot rate that does not divide 60 to the nearest one that does, and tells the guest the rate it really gets', () => {
    const { broadcaster, guest, link } = fixture({ snapshotHz: 40 });
    broadcaster.beginRace();
    const sent = vi.mocked(link.send).mock.calls[0]![0];
    expect(sent.kind === 'setup' && (sent.setup as RaceSetup).snapshotHz).toBe(30);
    broadcaster.guestMessage(guest, { kind: 'ready', renders: true });
    for (let tick = 0; tick < 60; tick += 1) broadcaster.tick();
    expect(vi.mocked(link.sendState)).toHaveBeenCalledTimes(30);
  });

  it('keeps the setup of four cats well under the size a guest accepts', () => {
    const { broadcaster, link } = fixture({}, 4);
    broadcaster.beginRace();
    const sent = vi.mocked(link.send).mock.calls[0]![0];
    expect(serializeHostMessage(sent).length).toBeLessThan(REMOTE_HOST_MESSAGE_MAX_CHARACTERS / 2);
    expect(parseHostMessage(serializeHostMessage(sent))).not.toBeNull();
  });

  it('sends a game of another engine its own setup and the same frame to every guest that draws, without the kart snapshot', () => {
    const frame = new TextEncoder().encode('{"state":{}}').buffer as ArrayBuffer;
    const engine = {
      seats: [
        { slot: 0, name: 'Katze 1', color: '#e0533d', isAi: false, appearance: createCatAppearance() },
        { slot: 1, name: 'Katze 2', color: '#3d8fe0', isAi: false, appearance: createCatAppearance() },
      ],
      encode: () => frame,
    } as unknown as EngineRound;
    const { broadcaster, guest, link } = fixture({}, 2, engine);
    broadcaster.beginRace();
    const sent = vi.mocked(link.send).mock.calls[0]![0];
    expect(sent.kind === 'setup' && sent.game).toBe('timetrial');
    expect(sent.kind === 'setup' && (sent.setup as { seats: unknown[]; seat: number })).toMatchObject({ seat: 1, resume: false });
    expect(sent.kind === 'setup' && (sent.setup as { seats: unknown[] }).seats).toHaveLength(2);
    broadcaster.guestMessage(guest, { kind: 'ready', renders: true });
    for (let tick = 0; tick < 60; tick += 1) broadcaster.tick();
    expect(vi.mocked(link.sendState)).toHaveBeenCalled();
    expect(vi.mocked(link.sendState).mock.calls.every(([payload]) => payload === frame)).toBe(true);
  });
});
