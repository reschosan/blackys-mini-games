import type { DrivingConfig } from '../../../shared/config/driving';
import type { KartDriveFactors, KartState } from './kartState';

const SIDE_HIT_BASE = 0.4;
const SIDE_HIT_GAIN = 1 - SIDE_HIT_BASE;

function inverseMassOf(kart: KartState, factors: KartDriveFactors | undefined): number {
  return kart.shieldSecondsLeft > 0 ? 0 : 1 / (factors?.massFactor ?? 1);
}

/** How hard a kart drives into the other one: its speed towards it times its ramming power. */
function attackOf(kart: KartState, factors: KartDriveFactors | undefined, towardX: number, towardZ: number): number {
  const approach = Math.max(kart.velocityX * towardX + kart.velocityZ * towardZ, 0);
  return approach * (factors?.rammingFactor ?? 1);
}

function scaleSpeed(kart: KartState, factor: number): void {
  kart.velocityX *= factor;
  kart.velocityZ *= factor;
}

/** The hit is sideways for the victim when the push points along its own sideways axis. */
function sidenessOf(victim: KartState, awayX: number, awayZ: number): number {
  return Math.abs(awayX * -Math.sin(victim.yaw) + awayZ * Math.cos(victim.yaw));
}

interface Contact {
  readonly normalX: number;
  readonly normalZ: number;
  readonly firstInverse: number;
  readonly secondInverse: number;
}

/** Karts bounce off each other along the contact normal, the lighter one more. */
function bounce(config: DrivingConfig, first: KartState, second: KartState, contact: Contact): void {
  const closingSpeed = (second.velocityX - first.velocityX) * contact.normalX + (second.velocityZ - first.velocityZ) * contact.normalZ;
  if (closingSpeed >= 0) return;
  const impulse = (-(1 + config.tackleBounce) * closingSpeed) / (contact.firstInverse + contact.secondInverse);
  first.velocityX -= contact.normalX * impulse * contact.firstInverse;
  first.velocityZ -= contact.normalZ * impulse * contact.firstInverse;
  second.velocityX += contact.normalX * impulse * contact.secondInverse;
  second.velocityZ += contact.normalZ * impulse * contact.secondInverse;
}

interface Tackle {
  readonly attacker: KartState;
  readonly victim: KartState;
  readonly victimInverseMass: number;
  readonly awayX: number;
  readonly awayZ: number;
  readonly margin: number;
}

/** The stronger kart plows on and shoves the other one sideways and slows it; the victim is never left
 *  moving into the attacker, and is safe from the next tackle for a moment. */
function applyTackle(config: DrivingConfig, tackle: Tackle): void {
  const { attacker, victim } = tackle;
  scaleSpeed(attacker, 1 - config.tackleAttackerSpeedLoss);
  const sideness = SIDE_HIT_BASE + SIDE_HIT_GAIN * sidenessOf(victim, tackle.awayX, tackle.awayZ);
  const push = config.tacklePush * tackle.margin * sideness * tackle.victimInverseMass;
  victim.velocityX += tackle.awayX * push;
  victim.velocityZ += tackle.awayZ * push;
  scaleSpeed(victim, 1 - config.tackleVictimSpeedLoss * sideness);
  const intoAttacker = victim.velocityX * tackle.awayX + victim.velocityZ * tackle.awayZ;
  if (intoAttacker < 0) {
    victim.velocityX -= tackle.awayX * intoAttacker;
    victim.velocityZ -= tackle.awayZ * intoAttacker;
  }
  victim.tackleImmunitySeconds = config.tackleImmunitySeconds;
}

function plainBump(config: DrivingConfig, first: KartState, second: KartState, contact: Contact): void {
  bounce(config, first, second, contact);
  for (const kart of [first, second]) if (kart.shieldSecondsLeft <= 0) scaleSpeed(kart, 1 - config.kartCollisionSpeedLoss);
}

/** A tackle that the victim's shield blocks: the attacker just bounces off. */
function bounceOffShield(config: DrivingConfig, first: KartState, second: KartState, attacker: KartState, contact: Contact): void {
  bounce(config, first, second, contact);
  scaleSpeed(attacker, 1 - config.tackleAttackerSpeedLoss);
}

/** The stronger kart (positive `margin` means the first) as attacker and the other one as its victim. */
function tackleOf(first: KartState, second: KartState, contact: Contact, margin: number): Tackle {
  const direction = margin > 0 ? 1 : -1;
  return {
    attacker: margin > 0 ? first : second,
    victim: margin > 0 ? second : first,
    victimInverseMass: margin > 0 ? contact.secondInverse : contact.firstInverse,
    awayX: contact.normalX * direction,
    awayZ: contact.normalZ * direction,
    margin: Math.abs(margin),
  };
}

/** What a touch does, by who is stronger: an even clash is a plain bump; a shielded kart cannot be tackled and
 *  the attacker just bounces off; a kart that was just tackled is only moved apart; otherwise the stronger
 *  kart tackles. */
function resolveContact(config: DrivingConfig, first: KartState, second: KartState, contact: Contact, margin: number): void {
  if (Math.abs(margin) < config.tackleMinMargin) {
    plainBump(config, first, second, contact);
    return;
  }
  const tackle = tackleOf(first, second, contact, margin);
  if (tackle.victim.shieldSecondsLeft > 0) bounceOffShield(config, first, second, tackle.attacker, contact);
  else if (tackle.victim.tackleImmunitySeconds <= 0) applyTackle(config, tackle);
}

/** Karts with a mass and ramming power (their kart type): lighter karts are pushed apart further, the one
 *  driving into the other harder wins the contact. Returns false when the karts do not touch. */
export function resolveWeightedKartPair(
  config: DrivingConfig,
  first: KartState,
  second: KartState,
  firstFactors: KartDriveFactors | undefined,
  secondFactors: KartDriveFactors | undefined,
  radius: number,
): boolean {
  const offsetX = second.x - first.x;
  const offsetZ = second.z - first.z;
  const minDistance = radius * 2;
  const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;
  if (distanceSquared >= minDistance * minDistance || distanceSquared === 0) return false;

  const distance = Math.sqrt(distanceSquared);
  const normalX = offsetX / distance;
  const normalZ = offsetZ / distance;
  const bothImmovable = inverseMassOf(first, firstFactors) === 0 && inverseMassOf(second, secondFactors) === 0;
  const firstInverse = bothImmovable ? 1 : inverseMassOf(first, firstFactors);
  const secondInverse = bothImmovable ? 1 : inverseMassOf(second, secondFactors);
  const margin = attackOf(first, firstFactors, normalX, normalZ) - attackOf(second, secondFactors, -normalX, -normalZ);

  const overlap = minDistance - distance;
  const inverseSum = firstInverse + secondInverse;
  first.x -= normalX * overlap * (firstInverse / inverseSum);
  first.z -= normalZ * overlap * (firstInverse / inverseSum);
  second.x += normalX * overlap * (secondInverse / inverseSum);
  second.z += normalZ * overlap * (secondInverse / inverseSum);

  resolveContact(config, first, second, { normalX, normalZ, firstInverse, secondInverse }, margin);
  return true;
}
