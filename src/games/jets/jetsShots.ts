import type { ModeTuning } from '../../shared/config/modes';
import { NOT_OUT, type Jet, type Shot } from './jetsTypes';

const NOSE_METERS = 3;
const MISSILE_SPEED_FACTOR = 0.9;
const MISSILE_HIT_FACTOR = 1.25;
const SHIELD_AFTER_BLOCK_SECONDS = 0.5;
/** A plain shot bends towards an enemy only when it already points that way within this cosine (about 25°). */
const ASSIST_CONE_COSINE = 0.9;

/** The shots in the air: plain bullets that fly straight along the plane's climb, and rockets that turn towards the nearest enemy. */
export function createShots(jets: readonly Jet[], tuning: ModeTuning['jets'], onHit: (jet: Jet, owner: number) => void) {
  const shots: Shot[] = [];

  const fire = (jet: Jet, owner: number): void => {
    shots.push({
      x: jet.x + Math.cos(jet.heading) * NOSE_METERS,
      y: jet.y,
      z: jet.z + Math.sin(jet.heading) * NOSE_METERS,
      vx: Math.cos(jet.heading) * tuning.bulletSpeed,
      vy: jet.vertical,
      vz: Math.sin(jet.heading) * tuning.bulletSpeed,
      owner,
      lifeLeft: tuning.bulletSeconds,
      homing: false,
    });
  };

  const launchRocket = (jet: Jet, owner: number): void => {
    shots.push({
      x: jet.x + Math.cos(jet.heading) * NOSE_METERS,
      y: jet.y,
      z: jet.z + Math.sin(jet.heading) * NOSE_METERS,
      vx: Math.cos(jet.heading) * tuning.bulletSpeed * MISSILE_SPEED_FACTOR,
      vy: 0,
      vz: Math.sin(jet.heading) * tuning.bulletSpeed * MISSILE_SPEED_FACTOR,
      owner,
      lifeLeft: tuning.missileSeconds,
      homing: true,
    });
  };

  const turnTowardsEnemy = (shot: Shot, dt: number, rate: number, coneCosine: number): void => {
    const target = jets
      .filter((jet, slot) => slot !== shot.owner && jet.outAt === NOT_OUT)
      .sort(
        (first, second) =>
          Math.hypot(first.x - shot.x, first.y - shot.y, first.z - shot.z) - Math.hypot(second.x - shot.x, second.y - shot.y, second.z - shot.z),
      )[0];
    if (!target) return;
    const speed = Math.hypot(shot.vx, shot.vy, shot.vz);
    const dx = target.x - shot.x;
    const dy = target.y - shot.y;
    const dz = target.z - shot.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    if ((shot.vx * dx + shot.vy * dy + shot.vz * dz) / (speed * length) < coneCosine) return;
    const blend = Math.min(rate * dt, 1);
    const vx = shot.vx / speed + (dx / length - shot.vx / speed) * blend;
    const vy = shot.vy / speed + (dy / length - shot.vy / speed) * blend;
    const vz = shot.vz / speed + (dz / length - shot.vz / speed) * blend;
    const norm = Math.hypot(vx, vy, vz) || 1;
    shot.vx = (vx / norm) * speed;
    shot.vy = (vy / norm) * speed;
    shot.vz = (vz / norm) * speed;
  };

  const hitBy = (shot: Shot): Jet | undefined => {
    const radius = tuning.hitRadius * (shot.homing ? MISSILE_HIT_FACTOR : 1);
    const canBeHit = (jet: Jet, slot: number): boolean => slot !== shot.owner && jet.outAt === NOT_OUT && jet.invulnerableLeft <= 0;
    return jets.find((jet, slot) => canBeHit(jet, slot) && Math.hypot(shot.x - jet.x, shot.y - jet.y, shot.z - jet.z) < radius);
  };

  const strike = (jet: Jet, shot: Shot): void => {
    if (jet.shieldLeft > 0) {
      jet.shieldLeft = 0;
      jet.invulnerableLeft = SHIELD_AFTER_BLOCK_SECONDS;
      return;
    }
    onHit(jet, shot.owner);
  };

  return {
    list: shots as readonly Shot[],
    fire,
    launchRocket,
    move(dt: number): void {
      for (let index = shots.length - 1; index >= 0; index -= 1) {
        const shot = shots[index]!;
        if (shot.homing) turnTowardsEnemy(shot, dt, tuning.missileTurnRate, -1);
        else turnTowardsEnemy(shot, dt, tuning.shotAssist, ASSIST_CONE_COSINE);
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.z += shot.vz * dt;
        shot.lifeLeft -= dt;
        const target = hitBy(shot);
        if (target) strike(target, shot);
        if (target || shot.lifeLeft <= 0 || shot.y < 0) shots.splice(index, 1);
      }
    },
  };
}
