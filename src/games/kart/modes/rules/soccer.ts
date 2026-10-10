import { KART_COLLIDER_RADIUS } from '../../../../shared/config/kart';
import type { KartState } from '../../kart/kartState';
import { clockText } from '../../../../shared/game/ranking';
import { type ModeRules, type RulesContext, type RulesSetup } from './modeRules';
import { t as texts } from '../../../../shared/i18n';

interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

/** Team red (even seats) attacks towards +x, team blue (odd seats) towards -x; each team defends the goal in its own colour. */
function attackDirection(slot: number): 1 | -1 {
  return slot % 2 === 0 ? 1 : -1;
}

/** Two teams push a ball into the other team's goal; most goals after the time (or the first to the goal limit) wins. A draw is a draw. */
export function createSoccer({ count, tuning }: RulesSetup): ModeRules {
  const t = tuning.soccer;
  const halfWidth = t.fieldWidth / 2;
  const halfDepth = t.fieldDepth / 2;
  const ball: Ball = { x: 0, z: 0, vx: 0, vz: 0 };
  const goals: [number, number] = [0, 0];
  let timeLeft = t.durationSeconds;
  let kickoffLeft = t.kickoffPauseSeconds;
  let kickoffRequested = false;
  let over = false;

  const kick = (kart: KartState): void => {
    const dx = ball.x - kart.x;
    const dz = ball.z - kart.z;
    const distance = Math.hypot(dx, dz);
    const reach = KART_COLLIDER_RADIUS + t.ballRadius;
    if (distance >= reach) return;
    const nx = distance > 0 ? dx / distance : 1;
    const nz = distance > 0 ? dz / distance : 0;
    ball.x = kart.x + nx * reach;
    ball.z = kart.z + nz * reach;
    const push = Math.max(kart.velocityX * nx + kart.velocityZ * nz, 0) * t.kickFactor + 4;
    ball.vx = nx * push + kart.velocityX * 0.3;
    ball.vz = nz * push + kart.velocityZ * 0.3;
  };

  const resetBall = (): void => {
    Object.assign(ball, { x: 0, z: 0, vx: 0, vz: 0 });
    kickoffLeft = t.kickoffPauseSeconds;
    kickoffRequested = true;
  };

  const bounceOffSides = (): void => {
    const limitZ = halfDepth - t.ballRadius;
    if (Math.abs(ball.z) > limitZ) {
      ball.z = Math.sign(ball.z) * limitZ;
      ball.vz = -ball.vz * t.wallBounce;
    }
    const limitX = halfWidth - t.ballRadius;
    if (Math.abs(ball.x) > limitX && Math.abs(ball.z) >= t.goalWidth / 2) {
      ball.x = Math.sign(ball.x) * limitX;
      ball.vx = -ball.vx * t.wallBounce;
    }
  };

  /** The corners are slanted: a ball pushed into a corner rolls back into the field instead of sticking there. */
  const bounceOffCorners = (): void => {
    const outward = { x: Math.sign(ball.x) || 1, z: Math.sign(ball.z) || 1 };
    const slant = halfWidth + halfDepth - t.cornerSize - t.ballRadius * Math.SQRT2;
    const overlap = (Math.abs(ball.x) + Math.abs(ball.z) - slant) / Math.SQRT2;
    if (overlap <= 0) return;
    const normal = { x: -outward.x / Math.SQRT2, z: -outward.z / Math.SQRT2 };
    ball.x += normal.x * overlap;
    ball.z += normal.z * overlap;
    const into = ball.vx * normal.x + ball.vz * normal.z;
    if (into >= 0) return;
    ball.vx -= (1 + t.wallBounce) * into * normal.x;
    ball.vz -= (1 + t.wallBounce) * into * normal.z;
  };

  const scoredGoal = (): boolean => {
    if (Math.abs(ball.x) <= halfWidth || Math.abs(ball.z) >= t.goalWidth / 2) return false;
    goals[ball.x > 0 ? 0 : 1] += 1;
    return true;
  };

  const moveBall = (context: RulesContext): void => {
    ball.x += ball.vx * context.stepSeconds;
    ball.z += ball.vz * context.stepSeconds;
    const keep = Math.max(1 - t.ballDrag * context.stepSeconds, 0);
    ball.vx *= keep;
    ball.vz *= keep;
    context.karts.forEach(kick);
    bounceOffSides();
    bounceOffCorners();
    if (scoredGoal()) resetBall();
  };

  const teamPlaces = (): readonly number[] => {
    if (goals[0] === goals[1]) return Array.from({ length: count }, () => 1);
    const winner = goals[0] > goals[1] ? 0 : 1;
    return Array.from({ length: count }, (_, slot) => (slot % 2 === winner ? 1 : 2));
  };

  return {
    step(context) {
      if (over) return;
      timeLeft = Math.max(t.durationSeconds - context.timeSeconds, 0);
      if (kickoffLeft > 0) kickoffLeft -= context.stepSeconds;
      else moveBall(context);
      over = timeLeft <= 0 || Math.max(...goals) >= t.goalLimit;
    },
    get over() {
      return over;
    },
    places: teamPlaces,
    isOut: () => false,
    detail: (slot) => `${goals[slot % 2]} : ${goals[1 - (slot % 2)]}`,
    cardText: (slot) => texts().games.status.team(texts().games.status.teams[slot % 2]!),
    statusLines: () => {
      const { status } = texts().games;
      return [status.time(clockText(timeLeft)), `${status.teams[0]} ${goals[0]} : ${goals[1]} ${status.teams[1]}`];
    },
    aim: (slot, karts) => {
      const me = karts[slot]!;
      const direction = attackDirection(slot);
      const behindBall = (me.x - ball.x) * direction < -2;
      return behindBall ? { x: ball.x, z: ball.z } : { x: ball.x - direction * 7, z: ball.z + Math.sign(me.z - ball.z) * 3 };
    },
    takeKickoff: () => {
      const requested = kickoffRequested;
      kickoffRequested = false;
      return requested;
    },
    get visual() {
      return {
        kind: 'field' as const,
        width: t.fieldWidth,
        depth: t.fieldDepth,
        goalWidth: t.goalWidth,
        cornerSize: t.cornerSize,
        ballX: ball.x,
        ballZ: ball.z,
        ballRadius: t.ballRadius,
      };
    },
    toExtras: () => [timeLeft, over ? 1 : 0, ball.x, ball.z, ball.vx, ball.vz, goals[0], goals[1], kickoffLeft],
    fromExtras(values) {
      timeLeft = values[0] ?? timeLeft;
      over = values[1] === 1;
      Object.assign(ball, { x: values[2] ?? 0, z: values[3] ?? 0, vx: values[4] ?? 0, vz: values[5] ?? 0 });
      goals[0] = values[6] ?? 0;
      goals[1] = values[7] ?? 0;
      kickoffLeft = values[8] ?? 0;
    },
  };
}
