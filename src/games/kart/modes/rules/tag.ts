import { clockText, placesByScoreAscending } from '../../../../shared/game/ranking';
import { type ModeRules, type RulesContext, type RulesSetup } from './modeRules';
import { t as texts } from '../../../../shared/i18n';

/** One kart hunts, the others flee; a touch passes the hunt on. Whoever hunted for the shortest time wins. */
export function createTag({ count, rng, tuning }: RulesSetup): ModeRules {
  const t = tuning.tag;
  const timeAsHunter = new Array<number>(count).fill(0);
  let hunter = rng.nextInt(count);
  let immunityLeft = 0;
  let timeLeft = t.durationSeconds;
  let over = false;
  const half = t.arenaSize / 2;

  const caughtBy = (context: RulesContext): number =>
    context.karts.findIndex(
      (kart, slot) => slot !== hunter && Math.hypot(kart.x - context.karts[hunter]!.x, kart.z - context.karts[hunter]!.z) < t.touchDistance,
    );

  const nearestOther = (slot: number, x: number, z: number, karts: readonly { x: number; z: number }[]): { x: number; z: number } | null => {
    const others = karts.filter((_, index) => index !== slot);
    if (others.length === 0) return null;
    return others.reduce((best, kart) => (Math.hypot(kart.x - x, kart.z - z) < Math.hypot(best.x - x, best.z - z) ? kart : best));
  };

  const fleeFrom = (x: number, z: number, from: { x: number; z: number }): { x: number; z: number } => {
    const length = Math.hypot(x - from.x, z - from.z) || 1;
    const clamp = (value: number): number => Math.max(-half * 0.8, Math.min(half * 0.8, value));
    return { x: clamp(x + ((x - from.x) / length) * 30), z: clamp(z + ((z - from.z) / length) * 30) };
  };

  return {
    step(context) {
      if (over) return;
      timeLeft = Math.max(t.durationSeconds - context.timeSeconds, 0);
      timeAsHunter[hunter] = timeAsHunter[hunter]! + context.stepSeconds;
      immunityLeft = Math.max(immunityLeft - context.stepSeconds, 0);
      const caught = immunityLeft > 0 ? -1 : caughtBy(context);
      if (caught >= 0) {
        hunter = caught;
        immunityLeft = t.immunitySeconds;
      }
      over = timeLeft <= 0;
    },
    get over() {
      return over;
    },
    places: () => placesByScoreAscending(timeAsHunter.map((seconds) => Math.round(seconds * 10))),
    isOut: () => false,
    detail: (slot) => texts().games.status.asHunter(Math.round(timeAsHunter[slot]!)),
    cardText: (slot) => (slot === hunter ? texts().games.status.hunter : texts().games.status.asHunter(Math.round(timeAsHunter[slot]!))),
    statusLines: () => [texts().games.status.time(clockText(timeLeft))],
    aim: (slot, karts) => {
      const me = karts[slot]!;
      if (slot === hunter) return nearestOther(slot, me.x, me.z, karts);
      return fleeFrom(me.x, me.z, karts[hunter]!);
    },
    takeKickoff: () => false,
    get visual() {
      return { kind: 'tag' as const, hunterSlot: hunter };
    },
    toExtras: () => [timeLeft, over ? 1 : 0, hunter, immunityLeft, ...timeAsHunter],
    fromExtras(values) {
      timeLeft = values[0] ?? timeLeft;
      over = values[1] === 1;
      hunter = values[2] ?? hunter;
      immunityLeft = values[3] ?? 0;
      for (let slot = 0; slot < count; slot += 1) timeAsHunter[slot] = values[4 + slot] ?? 0;
    },
  };
}
