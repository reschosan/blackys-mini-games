import { placesByStaying } from '../../../../shared/game/ranking';
import type { ModeTuning } from '../../../../shared/config/modes';
import type { ShoveConfig } from '../../kart/kartShove';
import { type ModeRules, type RulesSetup } from './modeRules';
import { t as texts } from '../../../../shared/i18n';

const NOT_OUT = -1;
/** An AI kart this close to the edge turns back to the middle before it goes on pushing. */
const EDGE_MARGIN_METERS = 3.5;
/** On a platform this small there is no safe middle any more, so the AI karts stop playing safe and push. */
const ENDGAME_RADIUS = 10;

export function sumoShove(tuning: ModeTuning['sumo']): ShoveConfig {
  return {
    range: tuning.shoveRange,
    coneDegrees: tuning.shoveConeDegrees,
    speed: tuning.shoveSpeed,
    flightSeconds: tuning.shoveFlightSeconds,
    cooldownSeconds: tuning.shoveCooldownSeconds,
  };
}

/** Karts ram each other on a round platform that shrinks; whoever leaves it is out, the last one on it wins. */
export function createSumo({ count, tuning }: RulesSetup): ModeRules {
  const t = tuning.sumo;
  let radius = t.platformRadius;
  const outAt = new Array<number>(count).fill(NOT_OUT);
  const shoveReady = new Array<boolean>(count).fill(true);
  let over = false;

  const alive = (): number[] => outAt.flatMap((time, slot) => (time === NOT_OUT ? [slot] : []));
  const outTimes = (): (number | null)[] => outAt.map((time) => (time === NOT_OUT ? null : time));

  return {
    step(context) {
      if (over) return;
      radius = Math.max(t.platformRadius - Math.max(context.timeSeconds - t.shrinkStartSeconds, 0) * t.shrinkMetersPerSecond, t.minimumRadius);
      context.karts.forEach((kart, slot) => {
        if (outAt[slot] === NOT_OUT && Math.hypot(kart.x, kart.z) > radius) outAt[slot] = context.timeSeconds;
        shoveReady[slot] = kart.shoveCooldownSeconds <= 0;
      });
      over = alive().length <= (count > 1 ? 1 : 0);
    },
    get over() {
      return over;
    },
    places: () => placesByStaying(outTimes()),
    isOut: (slot) => outAt[slot] !== NOT_OUT,
    detail: (slot) => {
      const { status } = texts().games;
      return outAt[slot] === NOT_OUT ? status.lastCat : status.outAfter(status.seconds(Math.round(outAt[slot]!)));
    },
    cardText: (slot) => {
      const { status } = texts().games;
      if (outAt[slot] !== NOT_OUT) return status.out;
      return shoveReady[slot] ? status.shoveReady : status.shoveCharging;
    },
    statusLines: () => [texts().games.status.stillIn(alive().length), texts().games.status.platform(Math.round(radius))],
    aim: (slot, karts) => {
      const me = karts[slot]!;
      if (radius > ENDGAME_RADIUS && Math.hypot(me.x, me.z) > radius - EDGE_MARGIN_METERS) return { x: 0, z: 0 };
      const rivals = karts.filter((_, other) => other !== slot && outAt[other] === NOT_OUT);
      if (rivals.length === 0) return { x: 0, z: 0 };
      return rivals.reduce((best, kart) => (Math.hypot(kart.x - me.x, kart.z - me.z) < Math.hypot(best.x - me.x, best.z - me.z) ? kart : best));
    },
    takeKickoff: () => false,
    get visual() {
      return { kind: 'platform' as const, radius };
    },
    toExtras: () => [radius, over ? 1 : 0, ...outAt, ...shoveReady.map((ready) => (ready ? 1 : 0))],
    fromExtras(values) {
      radius = values[0] ?? radius;
      over = values[1] === 1;
      for (let slot = 0; slot < count; slot += 1) {
        outAt[slot] = values[2 + slot] ?? NOT_OUT;
        shoveReady[slot] = values[2 + count + slot] !== 0;
      }
    },
  };
}
