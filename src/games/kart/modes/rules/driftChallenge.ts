import { speedOf } from '../../kart/kartState';
import { clockText, placesByScoreDescending } from '../../../../shared/game/ranking';
import { type ModeRules, type RulesContext, type RulesSetup } from './modeRules';
import { t as texts } from '../../../../shared/i18n';

/** 60 seconds of drifting: points for every second in a drift (more for higher drift stages), banked when the drift ends, lost when the kart hits a wall. */
export function createDriftChallenge({ count, tuning }: RulesSetup): ModeRules {
  const t = tuning.driftChallenge;
  const score = new Array<number>(count).fill(0);
  const streak = new Array<number>(count).fill(0);
  let timeLeft = t.durationSeconds;
  let over = false;

  const bank = (slot: number): void => {
    score[slot] = score[slot]! + streak[slot]!;
    streak[slot] = 0;
  };

  const advance = (context: RulesContext, slot: number): void => {
    const kart = context.karts[slot]!;
    if ((context.speedDrops[slot] ?? 0) > t.bumpSpeedDrop) streak[slot] = 0;
    if (kart.driftDirection !== 0 && speedOf(kart) >= t.minimumSpeed) {
      streak[slot] = streak[slot]! + t.pointsPerSecond * (1 + kart.driftStage * t.stageBonusShare) * context.stepSeconds;
    } else if (kart.driftDirection === 0) {
      bank(slot);
    }
  };

  return {
    step(context) {
      if (over) return;
      timeLeft = Math.max(t.durationSeconds - context.timeSeconds, 0);
      for (let slot = 0; slot < count; slot += 1) advance(context, slot);
      if (timeLeft > 0) return;
      for (let slot = 0; slot < count; slot += 1) bank(slot);
      over = true;
    },
    get over() {
      return over;
    },
    places: () => placesByScoreDescending(score),
    isOut: () => false,
    detail: (slot) => texts().games.status.points(Math.round(score[slot]!)),
    cardText: (slot) => {
      const { status } = texts().games;
      return status.points(Math.round(score[slot]!)) + (streak[slot]! > 0 ? status.streak(Math.round(streak[slot]!)) : '');
    },
    statusLines: () => [texts().games.status.time(clockText(timeLeft))],
    aim: () => null,
    takeKickoff: () => false,
    visual: { kind: 'none' },
    toExtras: () => [timeLeft, over ? 1 : 0, ...score, ...streak],
    fromExtras(values) {
      timeLeft = values[0] ?? timeLeft;
      over = values[1] === 1;
      for (let slot = 0; slot < count; slot += 1) {
        score[slot] = values[2 + slot] ?? 0;
        streak[slot] = values[2 + count + slot] ?? 0;
      }
    },
  };
}
