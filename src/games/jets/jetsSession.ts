import { playerDisplayName } from '../../shared/i18n/labels';
import { roundForSnapshot, type EngineSession, type EngineSetup, type EngineSnapshot } from '../../shared/game/engine';
import { clockText, placesByScoreDescending } from '../../shared/game/ranking';
import { seatToWatch } from '../../shared/game/spectate';
import { jetRow } from './jetRow';
import { pressesMainAction, type InputFrame } from '../../shared/input/actions';
import { jetAiFrame } from './jetsAi';
import { createPickups } from './jetsPickups';
import { createShots } from './jetsShots';
import { ITEM_BOOST, ITEM_MISSILE, ITEM_NONE, ITEM_SHIELD, NOT_OUT, type Jet, type JetIntent } from './jetsTypes';
import { t as texts } from '../../shared/i18n';

const AIM_ERROR_SECONDS = 1.2;
const TARGET_CHANGE_SECONDS = 4;
const MOST_ENEMIES = 3;
const VERTICAL_RESPONSE = 6;
const EDGE_MARGIN = 0.94;
const EDGE_TURN_FACTOR = 2.5;
/** A pilot that is still in ranks above every pilot that is out. */
const ALIVE_SCORE_BASE = 10_000;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** Kampfjets: cats fly small planes through a big room, collect item boxes in the air (boost, shield, rocket) and shoot each other; three hits and a pilot is out, the last one flying wins (after the time, the one with the fewest hits). */
export function createJetsSession({ seats, rng, tuning }: EngineSetup): EngineSession {
  const t = tuning.jets;
  const half = t.arenaSize / 2;
  const jets: Jet[] = seats.map((_, index) => {
    const angle = (index / seats.length) * Math.PI * 2;
    return {
      x: Math.cos(angle) * half * 0.55,
      y: (t.minAltitude + t.maxAltitude) / 2,
      z: Math.sin(angle) * half * 0.55,
      heading: angle + Math.PI,
      vertical: 0,
      hits: 0,
      dealt: 0,
      outAt: NOT_OUT,
      invulnerableLeft: t.startProtectionSeconds,
      cooldownLeft: 0,
      boostLeft: 0,
      shieldLeft: 0,
      item: ITEM_NONE,
      fireHeld: false,
      itemHeld: false,
      watching: -1,
    };
  });
  const aimErrors = seats.map(() => ({ radians: 0, secondsLeft: 0, rank: 0, rankSecondsLeft: 0 }));
  const pickups = createPickups(t, rng);
  let time = 0;
  let over = false;

  const shots = createShots(jets, t, (jet, owner) => {
    jet.hits += 1;
    jets[owner]!.dealt += 1;
    jet.invulnerableLeft = t.invulnerableSeconds;
    if (jet.hits >= t.hitsToLose) jet.outAt = time;
  });
  const alive = (): Jet[] => jets.filter((jet) => jet.outAt === NOT_OUT);

  const aimErrorOf = (slot: number): number => {
    const error = aimErrors[slot]!;
    if (error.secondsLeft <= 0) {
      error.radians = (rng.next() - 0.5) * 2 * t.aiAimError;
      error.secondsLeft = AIM_ERROR_SECONDS;
    }
    return error.radians;
  };

  /** Which enemy an AI pilot goes for (the nearest, the second nearest …): it changes every few seconds, so that they do not all hunt the same one. */
  const targetRankOf = (slot: number): number => {
    const state = aimErrors[slot]!;
    if (state.rankSecondsLeft <= 0) {
      state.rank = rng.nextInt(MOST_ENEMIES);
      state.rankSecondsLeft = TARGET_CHANGE_SECONDS;
    }
    return state.rank;
  };

  const intent = (slot: number, frame: InputFrame | undefined): JetIntent => {
    if (seats[slot]?.isAi) {
      const jet = jets[slot]!;
      return jetAiFrame(
        jet,
        alive().filter((other) => other !== jet),
        pickups.active(time),
        t,
        aimErrorOf(slot),
        targetRankOf(slot),
      );
    }
    return {
      steer: frame?.move?.x ?? frame?.steer ?? 0,
      climb: -(frame?.move?.y ?? 0),
      fire: pressesMainAction(frame) || (frame?.confirm ?? false),
      useItem: frame?.useItem ?? false,
    };
  };

  const turnBackInside = (jet: Jet, dt: number): void => {
    const limit = half * EDGE_MARGIN;
    if (Math.abs(jet.x) > limit || Math.abs(jet.z) > limit) {
      const towardsCentre = Math.atan2(-jet.z, -jet.x);
      const delta = Math.atan2(Math.sin(towardsCentre - jet.heading), Math.cos(towardsCentre - jet.heading));
      jet.heading += Math.sign(delta) * Math.min(Math.abs(delta), t.turnRate * EDGE_TURN_FACTOR * dt);
    }
    jet.x = clamp(jet.x, -half, half);
    jet.z = clamp(jet.z, -half, half);
  };

  const move = (jet: Jet, wanted: JetIntent, dt: number): void => {
    jet.heading += clamp(wanted.steer, -1, 1) * t.turnRate * dt;
    jet.vertical += (clamp(wanted.climb, -1, 1) * t.climbSpeed - jet.vertical) * Math.min(dt * VERTICAL_RESPONSE, 1);
    jet.y = clamp(jet.y + jet.vertical * dt, t.minAltitude, t.maxAltitude);
    if (jet.y === t.minAltitude || jet.y === t.maxAltitude) jet.vertical = 0;
    const speed = t.speed * (jet.boostLeft > 0 ? t.boostFactor : 1);
    jet.x += Math.cos(jet.heading) * speed * dt;
    jet.z += Math.sin(jet.heading) * speed * dt;
    turnBackInside(jet, dt);
  };

  const useItem = (jet: Jet, slot: number): void => {
    if (jet.item === ITEM_BOOST) jet.boostLeft = t.boostSeconds;
    else if (jet.item === ITEM_SHIELD) jet.shieldLeft = t.shieldSeconds;
    else if (jet.item === ITEM_MISSILE) shots.launchRocket(jet, slot);
    jet.item = ITEM_NONE;
  };

  const act = (jet: Jet, slot: number, wanted: JetIntent, dt: number): void => {
    jet.cooldownLeft = Math.max(jet.cooldownLeft - dt, 0);
    jet.invulnerableLeft = Math.max(jet.invulnerableLeft - dt, 0);
    jet.boostLeft = Math.max(jet.boostLeft - dt, 0);
    jet.shieldLeft = Math.max(jet.shieldLeft - dt, 0);
    if (wanted.fire && jet.cooldownLeft <= 0) {
      jet.cooldownLeft = t.fireCooldownSeconds;
      shots.fire(jet, slot);
    }
    if (wanted.useItem && !jet.itemHeld && jet.item !== ITEM_NONE) useItem(jet, slot);
    jet.itemHeld = wanted.useItem;
  };

  /** A pilot that is out watches another one and switches to the next with fire or the item key. */
  const watchOthers = (jet: Jet, slot: number, wanted: JetIntent): void => {
    const pressed = wanted.fire || wanted.useItem;
    const stillIn = jets.map((other) => other.outAt === NOT_OUT);
    jet.watching = seatToWatch(jet.watching, slot, stillIn, pressed && !jet.fireHeld);
    jet.fireHeld = pressed;
  };

  const scores = (): number[] => jets.map((jet) => (jet.outAt === NOT_OUT ? ALIVE_SCORE_BASE - jet.hits * 100 + jet.dealt : jet.outAt));

  return {
    step(frames, dt) {
      if (over) return;
      time += dt;
      aimErrors.forEach((error) => {
        error.secondsLeft -= dt;
        error.rankSecondsLeft -= dt;
      });
      jets.forEach((jet, slot) => {
        const wanted = intent(slot, frames[slot]);
        if (jet.outAt !== NOT_OUT) {
          if (!seats[slot]?.isAi) watchOthers(jet, slot, wanted);
          return;
        }
        move(jet, wanted, dt);
        act(jet, slot, wanted, dt);
      });
      pickups.collect(time, alive());
      shots.move(dt);
      over = time >= t.durationSeconds || alive().length <= (jets.length > 1 ? 1 : 0);
    },
    get over() {
      return over;
    },
    places: () => placesByScoreDescending(scores()),
    detail: (slot) => {
      const jet = jets[slot]!;
      const { status } = texts().games;
      if (jet.outAt !== NOT_OUT) return status.outAfter(clockText(jet.outAt));
      return alive().length === 1 ? status.lastPilot : status.hits(jet.hits);
    },
    cardText: (slot) => {
      const jet = jets[slot]!;
      const { status } = texts().games;
      if (jet.outAt !== NOT_OUT) return jet.watching < 0 ? status.out : status.watching(playerDisplayName(seats[jet.watching]?.name ?? '', jet.watching));
      const lives = status.lives(t.hitsToLose - jet.hits);
      return jet.item === ITEM_NONE ? lives : `${lives} · ${status.jetItems[jet.item]}`;
    },
    statusLines: () => [texts().games.status.time(clockText(t.durationSeconds - time)), texts().games.status.stillIn(alive().length)],
    snapshot: (): EngineSnapshot => ({
      jets: jets.map(jetRow),
      bullets: shots.list.map((shot) => [roundForSnapshot(shot.x), roundForSnapshot(shot.z), roundForSnapshot(shot.y), shot.homing ? 1 : 0]),
      pickups: pickups.list.map((pickup) => [
        roundForSnapshot(pickup.x),
        roundForSnapshot(pickup.z),
        roundForSnapshot(pickup.y),
        pickup.backAt <= time ? 1 : 0,
      ]),
      size: t.arenaSize,
      maxAltitude: t.maxAltitude,
    }),
  };
}
