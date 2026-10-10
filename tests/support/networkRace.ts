import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createRuntimeRemote, type RemoteConfig } from '../../src/shared/config/remote';
import { createRng } from '../../src/shared/core/rng';
import { NEUTRAL_INPUT, type InputFrame } from '../../src/shared/input/actions';
import { createItemBoxStates } from '../../src/games/kart/items/itemBoxes';
import { createKartState, DEFAULT_KART_DRIVE_FACTORS } from '../../src/games/kart/kart/kartState';
import type { RacePlayer } from '../../src/games/kart/race/racePlayer';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';
import { createProgress } from '../../src/games/kart/race/raceState';
import { OwnKartPredictor } from '../../src/games/kart/replication/ownKartPredictor';
import { decodeSnapshot, encodeSnapshot, withAckInputSequence } from '../../src/games/kart/replication/snapshot';
import { buildSnapshot } from '../../src/games/kart/replication/snapshotBuilder';
import { SnapshotTimeline } from '../../src/games/kart/replication/snapshotTimeline';
import { RING_TEST_MAP } from './ringTestMap';

const STEP = 1 / 60;

export interface NetworkOptions {
  /** One way, in milliseconds. */
  readonly latencyMilliseconds: number;
  readonly jitterMilliseconds: number;
  /** Share of messages that never arrive, 0..1. */
  readonly loss: number;
  readonly seconds: number;
  readonly predict: boolean;
  /** Steering of the guest at a given time. */
  readonly steer: (seconds: number) => number;
  /** Another kart drives beside the guest and steers into it, so the two bump all the time. */
  readonly rival?: boolean;
  /** The host puts the kart into a spin-out at this time (a hairball hit): only the host knows about it. */
  readonly hitAtSeconds?: number;
  readonly seed?: number;
  readonly config?: Partial<RemoteConfig>;
}

export interface NetworkResult {
  /** Mean and worst distance between the kart as the guest shows it and where the host puts it after the same input, in meters. */
  readonly meanErrorMeters: number;
  readonly worstErrorMeters: number;
  /** How many corrections were too big to hide and made the picture jump. */
  readonly snaps: number;
  /** Time from the first steering input until the shown kart has turned by 2 degrees, in milliseconds. */
  readonly responseMilliseconds: number | null;
  /** Largest sudden move of the shown kart between two frames beyond what its speed explains, in meters. */
  readonly worstJumpMeters: number;
  readonly snapshotBytes: number;
  /** After a hit: the biggest distance between shown kart and host, and how long until it was under 0.3 m for good (milliseconds). */
  readonly hitPeakErrorMeters: number;
  /** How many times the shown kart was moved by more than 0.15 m by a correction within one frame (a visible lurch of the camera). */
  readonly lurches: number;
  /** With a rival: how often the other kart, as the guest shows it, moved by more than 0.2 m more or less in one frame than it really did (a pop). */
  readonly rivalPops: number;
  readonly hitSettleMilliseconds: number | null;
}

function racePlayer(x: number, z: number, yaw: number): RacePlayer {
  return {
    state: createKartState(x, z, yaw),
    progress: createProgress(x, z),
    isAi: false,
    aiDriver: null,
    difficulty: null,
    loadout: createKartLoadout(),
    heldItem: null,
    previousUseItem: false,
    raceStartEarlyPress: false,
    raceStartBoostEarned: false,
  };
}

interface Transit<T> {
  readonly arriveAt: number;
  readonly payload: T;
}

/** Runs a host and one guest on a ring track at 60 Hz over a pretend network, for tests and for the numbers in the gameplay review. */
export function runNetworkRace(options: NetworkOptions): NetworkResult {
  const config = { ...createRuntimeRemote(), ...options.config };
  const rng = createRng(options.seed ?? 11);
  const start = RING_TEST_MAP.startPositions[0]!;
  const driving = createRuntimeDriving();
  const items = createRuntimeItems();
  const players = [racePlayer(start.x, start.z, start.yaw)];
  if (options.rival) players.push(racePlayer(start.x + 1.2, start.z + 2.4, start.yaw));
  const world = createRaceWorld(RING_TEST_MAP);
  world.itemBoxes = createItemBoxStates(RING_TEST_MAP);
  const frames: InputFrame[] = players.map(() => NEUTRAL_INPUT);
  const predictor = new OwnKartPredictor({ map: RING_TEST_MAP, driving, items, driveFactors: DEFAULT_KART_DRIVE_FACTORS }, config);
  predictor.follow({ ...kartOf(players[0]!), place: 1 });
  const timeline = new SnapshotTimeline(config.snapshotHz, config);

  const toHost: Transit<{ sequence: number; frame: InputFrame }>[] = [];
  const toGuest: Transit<ArrayBuffer>[] = [];
  const sendTimeOf = (now: number): number => now + options.latencyMilliseconds + (rng.next() * 2 - 1) * options.jitterMilliseconds;
  const lost = (): boolean => rng.next() < options.loss;

  let appliedSequence = 0;
  let sequence = 0;
  let snapshotSequence = 0;
  const hostTrail: { x: number; z: number }[] = [];
  const shown: { x: number; z: number; yaw: number }[] = [];
  const shownRival: { x: number; z: number }[] = [];
  const hostRival: { x: number; z: number }[] = [];
  const hostAppliedAtGuestTick: number[] = [];
  let snaps = 0;
  let snapshotBytes = 0;
  let responseTick: number | null = null;
  const steerStartSeconds = 1;
  const totalTicks = Math.round(options.seconds * 60);
  let startYaw = 0;
  let hostFrame: InputFrame = NEUTRAL_INPUT;

  for (let tick = 0; tick < totalTicks; tick += 1) {
    const now = tick * STEP * 1000;
    // guest: input, prediction, sending
    const steer = options.steer(tick * STEP);
    const frame: InputFrame = { ...NEUTRAL_INPUT, accelerate: true, steer };
    sequence = (sequence + 1) & 0xffff;
    if (!lost()) toHost.push({ arriveAt: sendTimeOf(now), payload: { sequence, frame } });
    if (options.predict) predictor.step(frame, sequence, STEP);

    // host: takes in what has arrived, simulates, sends snapshots
    for (let index = toHost.length - 1; index >= 0; index -= 1) {
      const message = toHost[index]!;
      if (message.arriveAt > now) continue;
      toHost.splice(index, 1);
      if (((message.payload.sequence - appliedSequence) & 0x8000) === 0) {
        appliedSequence = message.payload.sequence;
        hostFrame = message.payload.frame;
      }
    }
    frames[0] = hostFrame;
    if (options.rival) frames[1] = rivalFrame(players[1]!, players[0]!);
    if (options.hitAtSeconds !== undefined && tick === Math.round(options.hitAtSeconds * 60)) players[0]!.state.stunSecondsLeft = 1.2;
    world.raceTimeSeconds = (tick + 1) * STEP;
    world.places = stepRaceSimulation({
      map: RING_TEST_MAP,
      driving,
      items,
      participants: players,
      frames,
      hairballs: world.hairballs,
      traps: world.traps,
      fieldItems: world.fieldItems,
      itemBoxes: world.itemBoxes,
      places: world.places.length > 0 ? world.places : players.map((_, index) => index + 1),
      rng: createRng(1),
      lapCount: 3,
      raceTimeSeconds: world.raceTimeSeconds,
      stepSeconds: STEP,
    });
    hostTrail.push({ x: players[0]!.state.x, z: players[0]!.state.z });
    if (players[1]) hostRival.push({ x: players[1].state.x, z: players[1].state.z });
    hostAppliedAtGuestTick.push(appliedSequence);
    if (tick % Math.round(60 / config.snapshotHz) === 0) {
      snapshotSequence = (snapshotSequence + 1) & 0xffff;
      const snapshot = buildSnapshot(
        { players, world, countdownSecondsLeft: 0, goDisplayActive: false, finishCountdownSeconds: null, extras: [] },
        snapshotSequence,
      );
      const encoded = withAckInputSequence(encodeSnapshot(snapshot), appliedSequence);
      snapshotBytes = encoded.byteLength;
      if (!lost()) toGuest.push({ arriveAt: sendTimeOf(now), payload: encoded });
    }

    // guest: takes in snapshots, corrects, shows
    for (let index = 0; index < toGuest.length; index += 1) {
      const arrived = toGuest[index]!;
      if (arrived.arriveAt > now) continue;
      toGuest.splice(index, 1);
      index -= 1;
      const decoded = decodeSnapshot(arrived.payload);
      if (!decoded) continue;
      if (options.predict) {
        if (timeline.push(decoded, now)) {
          const result = predictor.reconcile(decoded.karts[0]!, decoded.ackInputSequence, STEP);
          if (result.snapped) snaps += 1;
        }
      } else {
        timeline.push(decoded, now);
      }
    }
    if (options.rival) {
      const sampled = timeline.sample(now)?.karts[1];
      if (sampled) shownRival.push({ x: sampled.x, z: sampled.z });
    }
    if (options.predict) {
      predictor.melt(STEP);
      shown.push({ x: predictor.state.x + predictor.offset.x, z: predictor.state.z + predictor.offset.z, yaw: predictor.state.yaw + predictor.offset.yaw });
    } else {
      const sampled = timeline.sample(now);
      const kart = sampled?.karts[0];
      shown.push(kart ? { x: kart.x, z: kart.z, yaw: kart.yaw } : { x: start.x, z: start.z, yaw: start.yaw });
    }
    if (tick === Math.round(steerStartSeconds * 60)) startYaw = shown[shown.length - 1]!.yaw;
    if (responseTick === null && tick > Math.round(steerStartSeconds * 60) && Math.abs(shown[shown.length - 1]!.yaw - startYaw) > (2 * Math.PI) / 180)
      responseTick = tick;
  }

  const uplinkTicks = Math.round((options.latencyMilliseconds / 1000) * 60);
  let sum = 0;
  let worst = 0;
  let counted = 0;
  const settleTicks = 2 * 60;
  for (let tick = settleTicks; tick < shown.length; tick += 1) {
    const host = hostTrail[Math.min(tick + uplinkTicks, hostTrail.length - 1)]!;
    const error = Math.hypot(shown[tick]!.x - host.x, shown[tick]!.z - host.z);
    sum += error;
    worst = Math.max(worst, error);
    counted += 1;
  }
  let hitPeak = 0;
  let hitSettleTick: number | null = null;
  if (options.hitAtSeconds !== undefined) {
    const hitTick = Math.round(options.hitAtSeconds * 60);
    let calmSince: number | null = null;
    for (let tick = hitTick; tick < shown.length; tick += 1) {
      const host = hostTrail[Math.min(tick + uplinkTicks, hostTrail.length - 1)]!;
      const error = Math.hypot(shown[tick]!.x - host.x, shown[tick]!.z - host.z);
      hitPeak = Math.max(hitPeak, error);
      if (error < 0.3) calmSince ??= tick;
      else calmSince = null;
      if (calmSince !== null && tick - calmSince >= 18 && hitSettleTick === null && hitPeak > 0.3) hitSettleTick = calmSince;
    }
    if (hitPeak <= 0.3) hitSettleTick = hitTick;
    if (hitSettleTick !== null) hitSettleTick -= hitTick;
  }
  let rivalPops = 0;
  for (let tick = 1; tick < shownRival.length; tick += 1) {
    const shownMove = Math.hypot(shownRival[tick]!.x - shownRival[tick - 1]!.x, shownRival[tick]!.z - shownRival[tick - 1]!.z);
    const hostIndex = tick + (hostRival.length - shownRival.length);
    const realMove = Math.hypot(hostRival[hostIndex]!.x - hostRival[hostIndex - 1]!.x, hostRival[hostIndex]!.z - hostRival[hostIndex - 1]!.z);
    if (Math.abs(shownMove - realMove) > 0.2) rivalPops += 1;
  }
  let lurches = 0;
  for (let tick = 1; tick < shown.length; tick += 1) {
    const move = Math.hypot(shown[tick]!.x - shown[tick - 1]!.x, shown[tick]!.z - shown[tick - 1]!.z);
    const expected = Math.hypot(hostTrail[tick]!.x - hostTrail[tick - 1]!.x, hostTrail[tick]!.z - hostTrail[tick - 1]!.z);
    if (Math.abs(move - expected) > 0.15) lurches += 1;
  }
  let worstJump = 0;
  for (let tick = 1; tick < shown.length; tick += 1) {
    const move = Math.hypot(shown[tick]!.x - shown[tick - 1]!.x, shown[tick]!.z - shown[tick - 1]!.z);
    const hostMove = Math.hypot(hostTrail[tick]!.x - hostTrail[tick - 1]!.x, hostTrail[tick]!.z - hostTrail[tick - 1]!.z);
    worstJump = Math.max(worstJump, move - hostMove);
  }
  return {
    meanErrorMeters: counted === 0 ? 0 : sum / counted,
    worstErrorMeters: worst,
    snaps,
    responseMilliseconds: responseTick === null ? null : (responseTick - Math.round(steerStartSeconds * 60)) * STEP * 1000,
    worstJumpMeters: worstJump,
    snapshotBytes,
    hitPeakErrorMeters: hitPeak,
    lurches,
    rivalPops,
    hitSettleMilliseconds: hitSettleTick === null ? null : hitSettleTick * STEP * 1000,
  };
}

/** The rival steers toward the guest's kart and keeps its gas down: they run side by side and bump. */
function rivalFrame(rival: RacePlayer, target: RacePlayer): InputFrame {
  const angle = Math.atan2(target.state.z - rival.state.z, target.state.x - rival.state.x);
  const difference = Math.atan2(Math.sin(angle - rival.state.yaw), Math.cos(angle - rival.state.yaw));
  return { ...NEUTRAL_INPUT, accelerate: true, steer: Math.max(-1, Math.min(1, difference * 2)) };
}

function kartOf(player: RacePlayer) {
  const { state, progress } = player;
  return {
    x: state.x,
    z: state.z,
    yaw: state.yaw,
    velocityX: 0,
    velocityZ: 0,
    levelId: state.levelId,
    stairTransitionId: null,
    driftDirection: 0 as const,
    driftStage: 0,
    driftCharge: 0,
    lastBoostFieldId: null,
    lastWindowJumpId: null,
    boostSeconds: 0,
    stunSecondsLeft: 0,
    stickySecondsLeft: 0,
    shieldSecondsLeft: 0,
    catnipSecondsLeft: 0,
    penaltySecondsLeft: 0,
    airborneSecondsLeft: 0,
    airborneSeconds: 0,
    shoveCooldownSeconds: 0,
    onCarpet: true,
    surfaceKind: null,
    windowJumpId: null,
    windowJumpElapsedSeconds: 0,
    lap: progress.lap,
    nextCheckpoint: progress.nextCheckpoint,
    finished: false,
    finishTimeSeconds: null,
    heldItem: null,
  };
}
